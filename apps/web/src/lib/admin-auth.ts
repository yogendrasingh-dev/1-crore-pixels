// RBAC middleware for `/api/admin/*` — docs/SECURITY.md §5, docs/API.md §4. Every admin
// route calls `requireAdmin` first; a role check happens server-side on every request,
// never left to the admin UI alone. Also enforces the CSRF double-submit check for
// state-changing methods (docs/SECURITY.md §7 — the admin surface is cookie-authenticated).
import { hasRole } from "@1crore-pixels/core";
import type { AdminRole } from "@1crore-pixels/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors } from "./api-response";
import { ADMIN_CSRF_COOKIE, ADMIN_SESSION_COOKIE, getAdminSession } from "./admin-session";

export interface AuthenticatedAdmin {
  adminId: bigint;
  role: AdminRole;
}

const STATE_CHANGING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * `minimumRole` omitted means "any authenticated admin" (e.g. read-only endpoints not
 * listed with a role in docs/API.md §4); otherwise the caller must satisfy `hasRole`.
 */
export async function requireAdmin(
  request: NextRequest,
  minimumRole?: AdminRole,
): Promise<AuthenticatedAdmin | NextResponse> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return apiErrors.unauthorized();

  const session = await getAdminSession(token);
  if (!session) return apiErrors.unauthorized();

  if (STATE_CHANGING_METHODS.has(request.method)) {
    const csrfHeader = request.headers.get("x-csrf-token");
    if (!csrfHeader || csrfHeader !== session.csrfToken) {
      return apiErrors.forbidden("Missing or invalid CSRF token");
    }
  }

  if (minimumRole && !hasRole(session.role, minimumRole)) return apiErrors.forbidden();

  return { adminId: BigInt(session.adminId), role: session.role };
}

export function isAuthResult(value: AuthenticatedAdmin | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
