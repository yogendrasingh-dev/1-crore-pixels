// GET /api/referrals/{code} — docs/API.md §2.8. Side-effect-free and cacheable.
import { resolvePublicDisplayName } from "@1crore-pixels/core";
import { prisma } from "@1crore-pixels/db";
import { NextResponse } from "next/server";
import { apiErrors } from "@/lib/api-response";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const referral = await prisma.referral.findUnique({
    where: { code },
    include: { contributor: { select: { displayName: true, anonymous: true } } },
  });
  if (!referral) return apiErrors.notFound("Referral code not found");

  return NextResponse.json(
    {
      code: referral.code,
      ownerDisplayName: resolvePublicDisplayName(
        referral.contributor.displayName,
        referral.contributor.anonymous,
      ),
    },
    // Side-effect-free and rarely changes — cacheable (docs/API.md §2.8).
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } },
  );
}
