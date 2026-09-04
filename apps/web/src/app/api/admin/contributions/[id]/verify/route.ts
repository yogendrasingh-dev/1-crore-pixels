// POST /api/admin/contributions/{id}/verify — docs/API.md §4. Role: VERIFIER+. Triggers the
// single allocation transaction (docs/PIXEL_SYSTEM.md §2.3, docs/PAYMENT.md §2.1) — never a
// second way to reach PIXELS_ASSIGNED.
import { adminVerifyContribution } from "@1crore-pixels/core";
import { prisma } from "@1crore-pixels/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors, paiseToRupees } from "@/lib/api-response";
import { isAuthResult, requireAdmin } from "@/lib/admin-auth";
import { getRequestSignals } from "@/lib/request-context";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request, "VERIFIER");
  if (isAuthResult(auth)) return auth;

  const { id } = await params;
  const contribution = await prisma.contribution.findUnique({ where: { publicCode: id } });
  if (!contribution) return apiErrors.notFound("Contribution not found");

  const { ip } = getRequestSignals(request);
  const result = await adminVerifyContribution(contribution.id, { adminUserId: auth.adminId, ipAddress: ip });
  if (!result) return apiErrors.invalidState("Contribution is not awaiting verification");

  return NextResponse.json({
    contributionId: result.contribution.publicCode,
    status: result.contribution.status,
    amountRupees: paiseToRupees(result.contribution.amountPaise),
    pixelCount: result.pixelAllocation.pixelCount.toString(),
    startPixel: result.pixelAllocation.startPixel.toString(),
    endPixel: result.pixelAllocation.endPixel.toString(),
  });
}
