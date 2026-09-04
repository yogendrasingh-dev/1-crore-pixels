// GET /api/admin/dashboard — docs/API.md §4, docs/PRD.md §22.
import { prisma, type Contribution, type Contributor, type PrismaClient } from "@1crore-pixels/db";

const PENDING_STATUSES: ("PAYMENT_SUBMITTED" | "VERIFYING")[] = ["PAYMENT_SUBMITTED", "VERIFYING"];
const RECENT_LIMIT = 10;

export interface AdminDashboard {
  totalVerifiedAmountPaise: bigint;
  verifiedContributorCount: bigint;
  totalPixelsAllocated: bigint;
  pendingVerificationCount: number;
  recentContributions: (Contribution & { contributor: Contributor })[];
}

export async function getAdminDashboard(db: PrismaClient = prisma): Promise<AdminDashboard> {
  const [totals, pendingVerificationCount, recentContributions] = await Promise.all([
    db.campaignTotals.findUniqueOrThrow({ where: { id: 1 } }),
    db.contribution.count({ where: { status: { in: PENDING_STATUSES } } }),
    db.contribution.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
      include: { contributor: true },
    }),
  ]);

  return {
    totalVerifiedAmountPaise: totals.totalVerifiedAmountPaise,
    verifiedContributorCount: totals.verifiedContributorCount,
    totalPixelsAllocated: totals.totalPixelsAllocated,
    pendingVerificationCount,
    recentContributions,
  };
}
