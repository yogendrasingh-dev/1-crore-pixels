import Redis from "ioredis";
import { env } from "./env";

declare global {
  var redisGlobal: Redis | undefined;
}

// Single connection shared across hot-reloads in dev, mirroring packages/db's Prisma
// singleton pattern (docs/ARCHITECTURE.md §3).
export const redis = globalThis.redisGlobal ?? new Redis(env.REDIS_URL);

if (process.env.NODE_ENV !== "production") {
  globalThis.redisGlobal = redis;
}
