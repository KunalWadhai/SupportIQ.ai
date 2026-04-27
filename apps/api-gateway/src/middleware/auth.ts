import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { prisma } from "../lib/prisma";

export interface AuthPayload {
  userId: string;
  orgId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
      orgId?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorised" });
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, config.jwt.secret) as AuthPayload;

    req.auth = payload;
    req.orgId = payload.orgId;
    next();
  } catch {
    return res.status(401).json({ success: false, error: "Invalid token" });
  }
}

// Widget requests authenticate via API key (public-facing chat endpoint)
export async function requireWidgetKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const apiKey =
      req.headers["x-api-key"] ||
      (req.query.apiKey as string);

    if (!apiKey) {
      return res.status(401).json({ success: false, error: "API key required" });
    }

    const org = await prisma.organisation.findUnique({
      where: { apiKey: apiKey as string },
      select: { id: true },
    });

    if (!org) {
      return res.status(401).json({ success: false, error: "Invalid API key" });
    }

    req.orgId = org.id;
    next();
  } catch {
    return res.status(500).json({ success: false, error: "Auth error" });
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }
    next();
  };
}
