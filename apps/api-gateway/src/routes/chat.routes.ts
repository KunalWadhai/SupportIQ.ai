import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { requireWidgetKey, requireAuth } from "../middleware/auth";
import { queryRAGStream, queryRAG } from "../services/ai.service";

const router = Router();

const ChatSchema = z.object({
  sessionId: z.string().uuid().optional().default(() => uuidv4()),
  message: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  visitorEmail: z.string().email().optional(),
});

// ─── Widget Chat (public, API-key auth) ───────────────────────────────────────
// Streams SSE back to the embeddable widget
router.post("/widget", requireWidgetKey, async (req, res) => {
  try {
    const body = ChatSchema.parse(req.body);
    const orgId = req.orgId!;

    // Find or create conversation
    let conversation = body.conversationId
      ? await prisma.conversation.findFirst({
          where: { id: body.conversationId, orgId },
          include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
        })
      : null;

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          orgId,
          sessionId: body.sessionId,
          status: "OPEN",
          visitorEmail: body.visitorEmail,
        },
        include: { messages: true },
      });
    }

    // Build conversation history for context
    const history = conversation.messages.map((m) => ({
      role: m.role.toLowerCase(),
      content: m.content,
    }));

    // Save user message
    const userMsg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: body.message,
      },
    });

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Conversation-Id", conversation.id);
    res.flushHeaders();

    // Send conversation ID immediately so client can store it
    res.write(`data: ${JSON.stringify({ type: "meta", conversationId: conversation.id, messageId: userMsg.id })}\n\n`);

    let fullContent = "";
    let sources: any[] = [];
    let confidence = 1;
    let shouldEscalate = false;

    try {
      // Call Python AI service streaming endpoint
      const aiRes = await queryRAGStream({
        orgId,
        question: body.message,
        conversationHistory: history,
      });

      if (!aiRes.body) throw new Error("No stream body");

      const reader = aiRes.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === "token") {
              fullContent += parsed.content;
              res.write(`data: ${JSON.stringify({ type: "token", content: parsed.content })}\n\n`);
            } else if (parsed.type === "sources") {
              sources = parsed.sources;
              confidence = parsed.confidence ?? 1;
              shouldEscalate = parsed.shouldEscalate ?? false;
              res.write(`data: ${JSON.stringify({ type: "sources", sources, confidence, shouldEscalate })}\n\n`);
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (streamErr) {
      console.error("Streaming error:", streamErr);
      fullContent = "I'm having trouble connecting right now. Please try again in a moment.";
      shouldEscalate = true;
      res.write(`data: ${JSON.stringify({ type: "token", content: fullContent })}\n\n`);
    }

    // Save assistant message
    const assistantMsg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: fullContent,
        sources: sources as any,
        confidence,
      },
    });

    // Handle escalation
    if (shouldEscalate || confidence < 0.4) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: "ESCALATED", escalatedAt: new Date() },
      });
    }

    res.write(`data: ${JSON.stringify({ type: "done", messageId: assistantMsg.id })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.write(`data: ${JSON.stringify({ type: "error", error: err.errors[0].message })}\n\n`);
    } else {
      console.error(err);
      res.write(`data: ${JSON.stringify({ type: "error", error: "Chat failed" })}\n\n`);
    }
    res.end();
  }
});

// ─── Dashboard Chat Test (JWT auth) ───────────────────────────────────────────
router.post("/test", requireAuth, async (req, res) => {
  try {
    const { message } = z.object({ message: z.string().min(1) }).parse(req.body);

    const result = await queryRAG({
      orgId: req.orgId!,
      question: message,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    return res.status(500).json({ success: false, error: "Test query failed" });
  }
});

// ─── Get conversations (dashboard) ────────────────────────────────────────────
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;

    const where: any = { orgId: req.orgId! };
    if (status) where.status = status.toUpperCase();

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true, role: true, createdAt: true },
          },
          _count: { select: { messages: true } },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    return res.json({
      success: true,
      data: { conversations, total, page, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to fetch conversations" });
  }
});

// ─── Get single conversation with all messages ─────────────────────────────────
router.get("/conversations/:id", requireAuth, async (req, res) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, orgId: req.orgId! },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: "Conversation not found" });
    }

    return res.json({ success: true, data: conversation });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to fetch conversation" });
  }
});

// ─── Resolve conversation ─────────────────────────────────────────────────────
router.patch("/conversations/:id/resolve", requireAuth, async (req, res) => {
  try {
    const conv = await prisma.conversation.updateMany({
      where: { id: req.params.id, orgId: req.orgId! },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });

    if (conv.count === 0) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    return res.json({ success: true, data: { resolved: true } });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to resolve" });
  }
});

export default router;
