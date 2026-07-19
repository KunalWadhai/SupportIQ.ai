import {Request, Response} from "express";
import { prisma } from "../../lib/prisma";
import z from "zod";

export async function widgetConfigByOrdId({req, res}: {req: Request,  res: Response}){
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
}

export async function updateWidgetSettings({req,res}: {req: Request; res: Response;}) {
    try {
      const body = req.body;
  
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
}

export async function regenerateWidgetKey({req,res}: {req: Request, res: Response}) {
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
}