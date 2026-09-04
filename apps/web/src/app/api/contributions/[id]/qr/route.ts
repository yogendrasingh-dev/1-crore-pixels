// POST /api/contributions/{id}/qr — docs/API.md §2.2.
import { requestPaymentQr } from "@1crore-pixels/core";
import { prisma } from "@1crore-pixels/db";
import { NextResponse } from "next/server";
import { apiErrors, paiseToRupees } from "@/lib/api-response";
import { paymentProvider } from "@/lib/payment-provider";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contribution = await prisma.contribution.findUnique({ where: { publicCode: id } });
  if (!contribution) return apiErrors.notFound("Contribution not found");

  const result = await requestPaymentQr(contribution.id, paymentProvider);
  if (!result) return apiErrors.invalidState("Contribution is not eligible for a new payment request");

  return NextResponse.json({
    contributionId: result.contribution.publicCode,
    status: result.contribution.status,
    upiDeepLink: result.paymentRequest.upiDeepLink,
    qrImageUrl: result.paymentRequest.qrImageUrl,
    amountRupees: paiseToRupees(result.contribution.amountPaise),
    expiresAt: result.contribution.expiresAt,
  });
}
