import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { config } from "../config";
import { requireAuth } from "../middleware/auth";

const router = Router();

// ─── Register ─────────────────────────────────────────────────────────────────
const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  orgName: z.string().min(2).max(100),
});

router.post("/register", async (req, res) => {
  try {
    const body = RegisterSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return res.status(409).json({ success: false, error: "Email already in use" });
    }

    const slug = body.orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);

    const hashedPassword = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: "OWNER",
        org: {
          create: {
            name: body.orgName,
            slug: `${slug}-${Date.now()}`,
          },
        },
      },
      include: { org: true },
    });

    const token = jwt.sign(
      { userId: user.id, orgId: user.orgId, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        org: { id: user.org.id, name: user.org.name, apiKey: user.org.apiKey },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    console.error(err);
    return res.status(500).json({ success: false, error: "Registration failed" });
  }
});

// ─── Login ─────────────────────────────────────────────────────────────────────
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { org: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, orgId: user.orgId, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        org: { id: user.org.id, name: user.org.name, apiKey: user.org.apiKey, widgetColor: user.org.widgetColor, widgetGreeting: user.org.widgetGreeting },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    return res.status(500).json({ success: false, error: "Login failed" });
  }
});

// ─── Me ───────────────────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      include: { org: true },
    });

    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    return res.json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        org: { id: user.org.id, name: user.org.name, apiKey: user.org.apiKey, widgetColor: user.org.widgetColor, widgetGreeting: user.org.widgetGreeting, plan: user.org.plan },
      },
    });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to fetch user" });
  }
});

export default router;
