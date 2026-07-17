import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/:orgId/config", async (req, res) => {
  try {
    const org = await prisma.organisation.findUnique({
      where: { id: req.params.orgId },
      select: { id: true, name: true, widgetColor: true, widgetGreeting: true },
    });

    if (!org) {
      return res.status(404).json({ success: false, error: "Organisation not found" });
    }

    return res.json({ success: true, data: org });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to fetch widget config" });
  }
});

import { requireAuth } from "../middleware/auth";

const WidgetSettingsSchema = z.object({
  widgetColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  widgetGreeting: z.string().min(1).max(300).optional(),
  name: z.string().min(2).max(100).optional(),
});

router.patch("/settings", requireAuth, async (req, res) => {
  try {
    const body = WidgetSettingsSchema.parse(req.body);

    const org = await prisma.organisation.update({
      where: { id: req.orgId! },
      data: body,
      select: { id: true, name: true, widgetColor: true, widgetGreeting: true, apiKey: true },
    });

    return res.json({ success: true, data: org });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    return res.status(500).json({ success: false, error: "Update failed" });
  }
});

router.post("/regenerate-key", requireAuth, async (req, res) => {
  try {
    const { v4: uuidv4 } = await import("uuid");
    const org = await prisma.organisation.update({
      where: { id: req.orgId! },
      data: { apiKey: uuidv4() },
      select: { apiKey: true },
    });

    return res.json({ success: true, data: { apiKey: org.apiKey } });
  } catch {
    return res.status(500).json({ success: false, error: "Key regeneration failed" });
  }
});

export default router;
