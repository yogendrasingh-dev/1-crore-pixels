// Admin session storage — docs/SECURITY.md §5. Sessions are opaque random tokens keyed
// in Redis (never a self-verifying JWT, so logout truly invalidates the token rather than
// merely expiring client-side) and are rotated (a fresh token/CSRF pair) on every login.
import { randomBytes } from "node:crypto";
import type { AdminRole } from "@1crore-pixels/db";
import { redis } from "./redis";

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_CSRF_COOKIE = "admin_csrf";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface AdminSession {
  adminId: string;
  role: AdminRole;
  csrfToken: string;
}

function sessionKey(token: string): string {
  return `admin-session:${token}`;
}

export async function createAdminSession(adminId: bigint, role: AdminRole): Promise<AdminSession & { token: string }> {
  const token = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(32).toString("hex");
  const session: AdminSession = { adminId: adminId.toString(), role, csrfToken };
  await redis.set(sessionKey(token), JSON.stringify(session), "EX", SESSION_TTL_SECONDS);
  return { ...session, token };
}

export async function getAdminSession(token: string): Promise<AdminSession | null> {
  const raw = await redis.get(sessionKey(token));
  if (!raw) return null;
  return JSON.parse(raw) as AdminSession;
}

export async function destroyAdminSession(token: string): Promise<void> {
  await redis.del(sessionKey(token));
}

export const ADMIN_SESSION_TTL_SECONDS = SESSION_TTL_SECONDS;
