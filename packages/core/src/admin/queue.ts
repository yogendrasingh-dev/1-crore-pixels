// Verification queue + ambiguous-match surfacing — docs/API.md §4, docs/PAYMENT.md §3.1.
// Admin responses are not allowlisted as strictly as public ones (docs/API.md §4), but
// secrets (password hashes, MFA secrets) are still never included here.
import { Prisma, prisma, type Contribution, type Contributor, type PrismaClient } from "@1crore-pixels/db";
import type { AdminQueueFilters } from "./schema";

const DEFAULT_QUEUE_STATUSES: ("PAYMENT_SUBMITTED" | "VERIFYING")[] = ["PAYMENT_SUBMITTED", "VERIFYING"];

export interface AmbiguousMatchGroup {
  amountPaise: bigint;
  utrLast4: string;
  contributionIds: bigint[];
}

/** Same amount + same UTR-last-4 across multiple `VERIFYING` contributions (docs/PAYMENT.md §3.1). */
export async function findAmbiguousMatches(db: PrismaClient = prisma): Promise<AmbiguousMatchGroup[]> {
  const candidates = await db.contribution.findMany({
    where: { status: "VERIFYING", utrLast4: { not: null } },
    select: { id: true, amountPaise: true, utrLast4: true },
  });

  const groups = new Map<string, AmbiguousMatchGroup>();
  for (const candidate of candidates) {
    if (!candidate.utrLast4) continue;
    const key = `${candidate.amountPaise}:${candidate.utrLast4}`;
    const existing = groups.get(key);
    if (existing) {
      existing.contributionIds.push(candidate.id);
    } else {
      groups.set(key, {
        amountPaise: candidate.amountPaise,
        utrLast4: candidate.utrLast4,
        contributionIds: [candidate.id],
      });
    }
  }

  return [...groups.values()].filter((group) => group.contributionIds.length > 1);
}

export interface AdminQueueItem {
  contribution: Contribution & { contributor: Contributor };
  ambiguousMatch: boolean;
}

export async function listVerificationQueue(
  filters: AdminQueueFilters,
  db: PrismaClient = prisma,
): Promise<AdminQueueItem[]> {
  const where: Prisma.ContributionWhereInput = {
    status: filters.status ?? { in: DEFAULT_QUEUE_STATUSES },
  };

  if (filters.search) {
    where.OR = [
      { displayName: { contains: filters.search, mode: "insensitive" } },
      { publicCode: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  const contributions = await db.contribution.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { contributor: true },
  });

  const ambiguousGroups = await findAmbiguousMatches(db);
  const ambiguousIds = new Set(ambiguousGroups.flatMap((group) => group.contributionIds.map(String)));

  return contributions.map((contribution) => ({
    contribution,
    ambiguousMatch: ambiguousIds.has(String(contribution.id)),
  }));
}
