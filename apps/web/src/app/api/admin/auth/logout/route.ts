// POST /api/admin/auth/logout — docs/API.md §4, docs/SECURITY.md §5, §7 (CSRF).
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors } from "@/lib/api-response";
import { ADMIN_CSRF_COOKIE, ADMIN_SESSION_COOKIE, destroyAdminSession, getAdminSession } from "@/lib/admin-session";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return apiErrors.unauthorized();

  const session = await getAdminSession(token);
  if (!session) return apiErrors.unauthorized();

  const csrfHeader = request.headers.get("x-csrf-token");
  if (!csrfHeader || csrfHeader !== session.csrfToken) {
    return apiErrors.forbidden("Missing or invalid CSRF token");
  }

  await destroyAdminSession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  response.cookies.delete(ADMIN_CSRF_COOKIE);
  return response;
}
