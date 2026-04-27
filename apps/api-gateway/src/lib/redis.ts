import IORedis from "ioredis";
import { config } from "../config";

// Singleton Redis client — used by BullMQ workers and any caching needs
let _redis: IORedis | null = null;

export function getRedis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(config.redis.url, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      lazyConnect: false,
    });

    _redis.on("connect", () => console.log("✅ Redis connected"));
    _redis.on("error", (err) => console.error("❌ Redis error:", err.message));
    _redis.on("reconnecting", () => console.log("🔄 Redis reconnecting..."));
  }
  return _redis;
}

// Lightweight cache helpers
export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await getRedis().get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  await getRedis().set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function cacheDelete(key: string): Promise<void> {
  await getRedis().del(key);
}

export async function cachePrefixDelete(prefix: string): Promise<void> {
  const keys = await getRedis().keys(`${prefix}*`);
  if (keys.length > 0) {
    await getRedis().del(...keys);
  }
}
