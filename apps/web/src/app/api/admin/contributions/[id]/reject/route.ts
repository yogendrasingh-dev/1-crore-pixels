// POST /api/admin/contributions/{id}/reject — docs/API.md §4. Role: VERIFIER+.
import { adminRejectContribution, adminRejectRequestSchema } from "@1crore-pixels/core";
import { prisma } from "@1crore-pixels/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors } from "@/lib/api-response";
import { isAuthResult, requireAdmin } from "@/lib/admin-auth";
import { getRequestSignals } from "@/lib/request-context";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request, "VERIFIER");
  if (isAuthResult(auth)) return auth;

  const { id } = await params;
  const contribution = await prisma.contribution.findUnique({ where: { publicCode: id } });
  if (!contribution) return apiErrors.notFound("Contribution not found");

  const body: unknown = await request.json().catch(() => undefined);
  const parsed = adminRejectRequestSchema.safeParse(body);
  if (!parsed.success) return apiErrors.validation(parsed.error.issues[0]?.message ?? "Invalid request");

  const { ip } = getRequestSignals(request);
  const rejected = await adminRejectContribution(contribution.id, parsed.data.reason, {
    adminUserId: auth.adminId,
    ipAddress: ip,
  });
  if (!rejected) return apiErrors.invalidState("Contribution is not awaiting verification");

  return NextResponse.json({ contributionId: rejected.publicCode, status: rejected.status });
}
