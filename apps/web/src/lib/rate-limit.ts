// Per-IP (and per-referral, per-contribution, etc.) rate limiting for high-risk public
// endpoints — docs/SECURITY.md §3. Exact numeric thresholds are an Open Decision
// (docs/SECURITY.md §11); the limits below are reasonable engineering defaults, kept as
// named constants so they can be tuned without touching call sites.
import { redis } from "./redis";

export interface RateLimitConfig {
  /** Distinguishes independent buckets sharing the same key namespace. */
  bucket: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Fixed-window counter (INCR + EXPIRE) — simpler than a token bucket and sufficient for
 * the "reject after N requests per window" contract these endpoints need; not a global
 * lock, so it composes fine with the DB-level guarantees that make allocation safe.
 */
export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${config.bucket}:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, config.windowSeconds);
  }
  return { allowed: count <= config.limit, remaining: Math.max(0, config.limit - count) };
}

export const RATE_LIMITS = {
  createContribution: { bucket: "create-contribution", limit: 10, windowSeconds: 60 },
  submitUtr: { bucket: "submit-utr", limit: 20, windowSeconds: 60 },
  referralVisit: { bucket: "referral-visit", limit: 30, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitConfig>;
