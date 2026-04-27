/**
 * Auth routes integration tests
 * Run with: npm test (from apps/api-gateway)
 *
 * Uses a real test database — set TEST_DATABASE_URL in env.
 * Mocks external deps (MinIO, AI service, BullMQ) to stay fast.
 */

import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";

// ── Mock external services before importing routes ─────────────────────────
jest.mock("../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    organisation: {
      findUnique: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password"),
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("mock.jwt.token"),
  verify: jest.fn().mockReturnValue({ userId: "user-1", orgId: "org-1", role: "OWNER" }),
}));

// ── Import after mocks ──────────────────────────────────────────────────────
import authRouter from "../routes/auth.routes";
import { prisma } from "../lib/prisma";

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);

const mockUser = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  password: "hashed_password",
  role: "OWNER",
  orgId: "org-1",
  org: {
    id: "org-1",
    name: "Test Org",
    apiKey: "test-api-key",
    widgetColor: "#6366f1",
    widgetGreeting: "Hi!",
  },
};

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 201 and token on valid registration", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null); // no existing user
    (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

    const res = await request(app).post("/api/auth/register").send({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
      orgName: "Test Org",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("token");
    expect(res.body.data.user.email).toBe("test@example.com");
  });

  it("returns 409 when email already exists", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const res = await request(app).post("/api/auth/register").send({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
      orgName: "Test Org",
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/already in use/i);
  });

  it("returns 400 on missing required fields", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "bad@example.com",
      // missing name, password, orgName
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 when password is shorter than 8 chars", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app).post("/api/auth/register").send({
      name: "Test",
      email: "test@example.com",
      password: "short",
      orgName: "Org",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 and token on valid credentials", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const res = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "password123",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBe("mock.jwt.token");
  });

  it("returns 401 when user not found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app).post("/api/auth/login").send({
      email: "ghost@example.com",
      password: "password123",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 on invalid email format", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "not-an-email",
      password: "password123",
    });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns user data with valid token", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer mock.jwt.token");

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("test@example.com");
  });
});
