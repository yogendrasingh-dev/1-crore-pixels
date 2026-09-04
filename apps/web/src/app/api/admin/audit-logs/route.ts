// GET /api/admin/audit-logs — docs/API.md §4, PRD §22 Audit. Role: SUPER_ADMIN only.
import { adminAuditLogFiltersSchema, listAuditLogs } from "@1crore-pixels/core";
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors } from "@/lib/api-response";
import { isAuthResult, requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request, "SUPER_ADMIN");
  if (isAuthResult(auth)) return auth;

  const url = new URL(request.url);
  const parsed = adminAuditLogFiltersSchema.safeParse({
    entityType: url.searchParams.get("entityType") ?? undefined,
    entityId: url.searchParams.get("entityId") ?? undefined,
    adminUserId: url.searchParams.get("adminUserId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return apiErrors.validation(parsed.error.issues[0]?.message ?? "Invalid request");

  const logs = await listAuditLogs(parsed.data);
  return NextResponse.json({
    items: logs.map((log) => ({
      id: log.id.toString(),
      adminUserId: log.adminUserId?.toString() ?? null,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      beforeState: log.beforeState,
      afterState: log.afterState,
      createdAt: log.createdAt,
    })),
  });
}
