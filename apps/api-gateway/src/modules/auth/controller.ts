import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { config } from "../../config";
import z from 'zod';


export async function register(req: Request, res: Response){
    try {
        const body = req.body;
    
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
            org: {
              id: user.org.id,
              name: user.org.name,
              apiKey: user.org.apiKey,
              widgetColor: user.org.widgetColor,
              widgetGreeting: user.org.widgetGreeting,
              plan: user.org.plan,
            },
          },
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ success: false, error: err.errors[0].message });
        }
        console.error(err);
        return res.status(500).json({ success: false, error: "Registration failed" });
      }
}


export async function login(req: Request, res: Response){
    try {
        const { email, password } = req.body;
    
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
            org: { id: user.org.id, name: user.org.name, apiKey: user.org.apiKey, widgetColor: user.org.widgetColor, widgetGreeting: user.org.widgetGreeting, plan: user.org.plan },
          },
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ success: false, error: err.errors[0].message });
        }
        return res.status(500).json({ success: false, error: "Login failed" });
      }
}

export async function getMe(req: Request, res: Response) {
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
        org: {
          id: user.org.id,
          name: user.org.name,
          apiKey: user.org.apiKey,
          widgetColor: user.org.widgetColor,
          widgetGreeting: user.org.widgetGreeting,
          plan: user.org.plan,
        },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Failed to fetch user" });
  }
}
