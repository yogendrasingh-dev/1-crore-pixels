// GET /api/leaderboard — docs/API.md §2.10, PRD §20/§21.
import { getReferralLeaderboard } from "@1crore-pixels/core";
import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(MAX_LIMIT, Math.max(1, Number(limitParam))) : DEFAULT_LIMIT;

  const items = await getReferralLeaderboard(limit);

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } },
  );
}
