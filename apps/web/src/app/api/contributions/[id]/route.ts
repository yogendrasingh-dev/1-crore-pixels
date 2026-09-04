// GET /api/contributions/{id} — docs/API.md §2.4. Not cached (docs/DEPLOYMENT.md §5) —
// this is the individual user's own status polling and must reflect current server state.
import { resolvePublicDisplayName } from "@1crore-pixels/core";
import { prisma } from "@1crore-pixels/db";
import { NextResponse } from "next/server";
import { apiErrors, paiseToRupees } from "@/lib/api-response";

const GENERIC_VERIFICATION_FAILED_MESSAGE =
  "Your payment could not be verified. Please contact support with your contribution ID.";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contribution = await prisma.contribution.findUnique({
    where: { publicCode: id },
    include: { pixelAllocation: true, contributor: { select: { referralCode: true } } },
  });
  if (!contribution) return apiErrors.notFound("Contribution not found");

  const body: Record<string, unknown> = {
    contributionId: contribution.publicCode,
    status: contribution.status,
    displayName: resolvePublicDisplayName(contribution.displayName, contribution.anonymous),
    anonymous: contribution.anonymous,
    amountRupees: paiseToRupees(contribution.amountPaise),
  };

  // Own referral link for the "Share My Contribution" screen (PRD §19/§20, T9.3) — omitted
  // for older/test-fixture contributors created before referral codes existed.
  if (contribution.contributor.referralCode) {
    body.referralCode = contribution.contributor.referralCode;
  }

  if (contribution.pixelAllocation) {
    body.pixelRange = {
      start: Number(contribution.pixelAllocation.startPixel),
      end: Number(contribution.pixelAllocation.endPixel),
      count: Number(contribution.pixelAllocation.pixelCount),
    };
  }

  if (contribution.status === "VERIFICATION_FAILED") {
    body.message = GENERIC_VERIFICATION_FAILED_MESSAGE;
  }

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
