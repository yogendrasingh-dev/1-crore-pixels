// GET /api/progress — docs/API.md §2.5. O(1) read from the `campaign_totals` cache,
// never recomputed by summing transactional tables (CLAUDE.md §3).
import { CAMPAIGN_GOAL_RUPEES } from "@1crore-pixels/core";
import { prisma } from "@1crore-pixels/db";
import { NextResponse } from "next/server";
import { paiseToRupees } from "@/lib/api-response";

export async function GET() {
  const totals = await prisma.campaignTotals.findUniqueOrThrow({ where: { id: 1 } });
  const totalRaisedRupees = paiseToRupees(totals.totalVerifiedAmountPaise);

  return NextResponse.json(
    {
      totalRaisedRupees,
      goalRupees: CAMPAIGN_GOAL_RUPEES,
      percentFunded: Math.round((totalRaisedRupees / CAMPAIGN_GOAL_RUPEES) * 10000) / 100,
      verifiedContributorCount: Number(totals.verifiedContributorCount),
      pixelsClaimed: Number(totals.totalPixelsAllocated),
      updatedAt: totals.updatedAt,
    },
    // Short TTL — the underlying value only changes on verified payment events, so a
    // few seconds of staleness shields the DB from per-visitor load (docs/DEPLOYMENT.md §5).
    { headers: { "Cache-Control": "s-maxage=10, stale-while-revalidate=30" } },
  );
}
