// PATCH /api/admin/updates/{id} — docs/API.md §4, PRD §18. Role: CONTENT_EDITOR+.
import { adminUpdateEditSchema, editUpdate } from "@1crore-pixels/core";
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors } from "@/lib/api-response";
import { isAuthResult, requireAdmin } from "@/lib/admin-auth";
import { getRequestSignals } from "@/lib/request-context";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request, "CONTENT_EDITOR");
  if (isAuthResult(auth)) return auth;

  const { id } = await params;
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = adminUpdateEditSchema.safeParse(body);
  if (!parsed.success) return apiErrors.validation(parsed.error.issues[0]?.message ?? "Invalid request");

  const { ip } = getRequestSignals(request);
  const updated = await editUpdate(id, parsed.data, { adminUserId: auth.adminId, ipAddress: ip });
  if (!updated) return apiErrors.notFound("Update not found");

  return NextResponse.json({ id: updated.id, status: updated.status });
}
