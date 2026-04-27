import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// ─── Overview stats ────────────────────────────────────────────────────────────
router.get("/overview", async (req, res) => {
  try {
    const orgId = req.orgId!;
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [total, resolved, escalated, messages] = await Promise.all([
      prisma.conversation.count({ where: { orgId, createdAt: { gte: since } } }),
      prisma.conversation.count({ where: { orgId, status: "RESOLVED", createdAt: { gte: since } } }),
      prisma.conversation.count({ where: { orgId, status: "ESCALATED", createdAt: { gte: since } } }),
      prisma.message.count({ where: { conversation: { orgId }, createdAt: { gte: since } } }),
    ]);

    // Conversations by day (last N days)
    const conversationsByDay = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT DATE(created_at)::text as date, COUNT(*)::bigint as count
      FROM conversations
      WHERE org_id = ${orgId}
        AND created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Average confidence from assistant messages
    const avgConfidenceResult = await prisma.message.aggregate({
      where: {
        role: "ASSISTANT",
        confidence: { not: null },
        conversation: { orgId },
        createdAt: { gte: since },
      },
      _avg: { confidence: true },
    });

    // Top questions (first user message per conversation)
    const firstMessages = await prisma.message.findMany({
      where: {
        role: "USER",
        conversation: { orgId },
        createdAt: { gte: since },
      },
      select: { content: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Simple keyword frequency for top questions
    const questionFreq: Record<string, number> = {};
    firstMessages.forEach((m) => {
      const key = m.content.slice(0, 80).toLowerCase().trim();
      questionFreq[key] = (questionFreq[key] || 0) + 1;
    });

    const topQuestions = Object.entries(questionFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([question, count]) => ({ question, count }));

    return res.json({
      success: true,
      data: {
        totalConversations: total,
        resolvedByAI: resolved,
        escalatedToHuman: escalated,
        openConversations: total - resolved - escalated,
        totalMessages: messages,
        aiResolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
        escalationRate: total > 0 ? Math.round((escalated / total) * 100) : 0,
        avgConfidence: avgConfidenceResult._avg.confidence ?? 0,
        conversationsByDay: conversationsByDay.map((r) => ({
          date: r.date,
          count: Number(r.count),
        })),
        topQuestions,
        periodDays: days,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Failed to fetch analytics" });
  }
});

// ─── Document stats ───────────────────────────────────────────────────────────
router.get("/knowledge", async (req, res) => {
  try {
    const orgId = req.orgId!;

    const [total, ready, processing, failed] = await Promise.all([
      prisma.knowledgeDocument.count({ where: { orgId } }),
      prisma.knowledgeDocument.count({ where: { orgId, status: "READY" } }),
      prisma.knowledgeDocument.count({ where: { orgId, status: "PROCESSING" } }),
      prisma.knowledgeDocument.count({ where: { orgId, status: "FAILED" } }),
    ]);

    const totalChunks = await prisma.knowledgeDocument.aggregate({
      where: { orgId, status: "READY" },
      _sum: { chunkCount: true },
    });

    return res.json({
      success: true,
      data: {
        totalDocuments: total,
        readyDocuments: ready,
        processingDocuments: processing,
        failedDocuments: failed,
        totalChunks: totalChunks._sum.chunkCount ?? 0,
      },
    });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to fetch knowledge stats" });
  }
});

export default router;
