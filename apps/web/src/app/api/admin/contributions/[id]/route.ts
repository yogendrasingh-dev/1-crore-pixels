// GET /api/admin/contributions/{id} — full detail incl. payment evidence + audit trail;
// the only place this data is ever returned (docs/API.md §4).
import { prisma } from "@1crore-pixels/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors } from "@/lib/api-response";
import { isAuthResult, requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (isAuthResult(auth)) return auth;

  const { id } = await params;
  const contribution = await prisma.contribution.findUnique({
    where: { publicCode: id },
    include: {
      contributor: true,
      payments: true,
      pixelAllocation: true,
    },
  });
  if (!contribution) return apiErrors.notFound("Contribution not found");

  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "contribution", entityId: String(contribution.id) },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    contributionId: contribution.publicCode,
    status: contribution.status,
    displayName: contribution.displayName,
    anonymous: contribution.anonymous,
    amountRupees: Number(contribution.amountPaise) / 100,
    utrLast4: contribution.utrLast4,
    rejectionReason: contribution.rejectionReason,
    ipHash: contribution.ipHash,
    userAgentHash: contribution.userAgentHash,
    createdAt: contribution.createdAt,
    paymentSubmittedAt: contribution.paymentSubmittedAt,
    paidAt: contribution.paidAt,
    verifiedAt: contribution.verifiedAt,
    publishedAt: contribution.publishedAt,
    contributor: {
      id: contribution.contributor.id.toString(),
      displayName: contribution.contributor.displayName,
    },
    payments: contribution.payments.map((payment) => ({
      id: payment.id.toString(),
      provider: payment.provider,
      status: payment.status,
      amountRupees: Number(payment.amountPaise) / 100,
      utrLast4: payment.utrLast4,
      referenceHash: payment.referenceHash,
      verificationMethod: payment.verificationMethod,
      verifiedByAdminId: payment.verifiedByAdminId?.toString() ?? null,
      createdAt: payment.createdAt,
    })),
    pixelAllocation: contribution.pixelAllocation
      ? {
          startPixel: contribution.pixelAllocation.startPixel.toString(),
          endPixel: contribution.pixelAllocation.endPixel.toString(),
          pixelCount: contribution.pixelAllocation.pixelCount.toString(),
        }
      : null,
    auditLogs: auditLogs.map((log) => ({
      id: log.id.toString(),
      adminUserId: log.adminUserId?.toString() ?? null,
      action: log.action,
      beforeState: log.beforeState,
      afterState: log.afterState,
      createdAt: log.createdAt,
    })),
  });
}
