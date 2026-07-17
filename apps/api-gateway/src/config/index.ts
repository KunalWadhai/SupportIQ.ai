function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return "dev-only-jwt-secret-not-for-production-use";
}

function resolveStorageProvider(): "minio" | "s3" {
  const explicit = process.env.STORAGE_PROVIDER?.toLowerCase();
  if (explicit === "s3" || explicit === "minio") return explicit;

  if (process.env.NODE_ENV === "production" && process.env.AWS_S3_BUCKET) {
    return "s3";
  }
  return "minio";
}

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  jwt: {
    secret: resolveJwtSecret(),
    expiresIn: "7d",
  },

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },

  aiService: {
    url: process.env.AI_SERVICE_URL || "http://localhost:8000",
  },

  storage: {
    provider: resolveStorageProvider(),
  },

  minio: {
    endpoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT || "9000", 10),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY || "supportiq_minio",
    secretKey: process.env.MINIO_SECRET_KEY || "supportiq_minio_secret",
    bucket: process.env.MINIO_BUCKET || "supportiq-docs",
  },

  s3: {
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_S3_BUCKET,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  },

  queues: {
    ingestion: "document-ingestion",
  },

  cors: {
    origin: process.env.ALLOWED_ORIGINS || "*",
  },
} as const;
