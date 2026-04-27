import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { config } from "./config";
import { prisma } from "./lib/prisma";
import { initStorage } from "./services/storage.service";
import { startIngestionWorker } from "./services/queue.service";
import { globalErrorHandler } from "./middleware/error";

import authRouter from "./routes/auth.routes";
import knowledgeRouter from "./routes/knowledge.routes";
import chatRouter from "./routes/chat.routes";
import analyticsRouter from "./routes/analytics.routes";
import widgetRouter from "./routes/widget.routes";

const app = express();

// ─── Security & Logging ───────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Widget endpoint needs open CORS so customer websites can call it
app.use("/api/chat/widget", cors({ origin: "*" }));
app.use("/api/widget", cors({ origin: "*" }));

// Dashboard endpoints are restricted
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests" },
});

// Widget chat gets a tighter limit per IP
const widgetLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { success: false, error: "Chat rate limit exceeded" },
});

app.use(limiter);
app.use("/api/chat/widget", widgetLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/knowledge", knowledgeRouter);
app.use("/api/chat", chatRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/widget", widgetRouter);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (_, res) => {
  res.json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.path} not found` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(globalErrorHandler);

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");

    await initStorage();
    console.log("✅ Storage initialised");

    startIngestionWorker();

    app.listen(config.port, () => {
      console.log(`🚀 API Gateway running on http://localhost:${config.port}`);
      console.log(`   Environment: ${config.nodeEnv}`);
    });
  } catch (err) {
    console.error("❌ Bootstrap failed:", err);
    process.exit(1);
  }
}

bootstrap();

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on("SIGTERM", async () => {
  console.log("SIGTERM received — shutting down");
  await prisma.$disconnect();
  process.exit(0);
});
