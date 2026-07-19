import "./load-env";

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

import router from "./routes/index";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));

// Widget endpoint needs open CORS so customer websites can call it
app.use("/api/chat/widget", cors({ origin: "*" }));
app.use("/api/widget", cors({ origin: "*" }));

app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests" },
});

const widgetLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { success: false, error: "Chat rate limit exceeded" },
});

app.use(limiter);
app.use("/api/chat/widget", widgetLimiter);

app.use('/api', router);

app.get("/health", (_, res) => {
  res.json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.path} not found` });
});

app.use(globalErrorHandler);

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

process.on("SIGTERM", async () => {
  console.log("SIGTERM received — shutting down");
  await prisma.$disconnect();
  process.exit(0);
});
