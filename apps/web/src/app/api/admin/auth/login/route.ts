// POST /api/admin/auth/login — docs/API.md §4, docs/SECURITY.md §5.
import { adminLoginRequestSchema, authenticateAdmin } from "@1crore-pixels/core";
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors } from "@/lib/api-response";
import { ADMIN_CSRF_COOKIE, ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS, createAdminSession } from "@/lib/admin-session";
import { env } from "@/lib/env";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getRequestSignals } from "@/lib/request-context";

export async function POST(request: NextRequest) {
  const { ip } = getRequestSignals(request);
  const rateLimit = await checkRateLimit(ip, RATE_LIMITS.adminLogin);
  if (!rateLimit.allowed) return apiErrors.rateLimited();

  const body: unknown = await request.json().catch(() => undefined);
  const parsed = adminLoginRequestSchema.safeParse(body);
  if (!parsed.success) return apiErrors.validation(parsed.error.issues[0]?.message ?? "Invalid request");

  const result = await authenticateAdmin(parsed.data.email, parsed.data.password, parsed.data.mfaCode, ip);

  if (result.outcome === "MFA_REQUIRED") return apiErrors.validation("MFA code required");
  if (result.outcome !== "OK") return apiErrors.unauthorized("Invalid credentials");

  const session = await createAdminSession(result.admin.id, result.admin.role);

  const response = NextResponse.json({ role: session.role });
  const secure = env.NODE_ENV === "production";
  response.cookies.set(ADMIN_SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  response.cookies.set(ADMIN_CSRF_COOKIE, session.csrfToken, {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  return response;
}
