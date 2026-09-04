// Referral leaderboard ("Community leaderboard: Most referrals" — PRD §21, §20) —
// docs/API.md §2.10. Ranks contributors by verified-conversion referral events, not raw
// visits, since a visit alone is not a conversion (docs/API.md §2.1).
import { prisma, type PrismaClient } from "@1crore-pixels/db";
import { resolvePublicDisplayName } from "../validation/display-name";

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  anonymous: boolean;
  referralCount: number;
}

export async function getReferralLeaderboard(
  limit: number,
  db: PrismaClient = prisma,
): Promise<LeaderboardEntry[]> {
  const grouped = await db.referralEvent.groupBy({
    by: ["referralId"],
    where: { eventType: "CONTRIBUTION" },
    _count: { _all: true },
    orderBy: { _count: { referralId: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const referrals = await db.referral.findMany({
    where: { id: { in: grouped.map((g) => g.referralId) } },
    include: { contributor: { select: { displayName: true, anonymous: true } } },
  });
  const referralById = new Map(referrals.map((r) => [r.id, r]));

  return grouped
    .map((g, index) => {
      const referral = referralById.get(g.referralId);
      if (!referral) return undefined;
      return {
        rank: index + 1,
        displayName: resolvePublicDisplayName(referral.contributor.displayName, referral.contributor.anonymous),
        anonymous: referral.contributor.anonymous,
        referralCount: g._count._all,
      };
    })
    .filter((entry): entry is LeaderboardEntry => entry !== undefined);
}
