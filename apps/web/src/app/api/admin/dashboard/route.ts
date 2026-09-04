// GET /api/admin/dashboard — docs/API.md §4, docs/PRD.md §22.
import { getAdminDashboard } from "@1crore-pixels/core";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthResult, requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthResult(auth)) return auth;

  const dashboard = await getAdminDashboard();

  return NextResponse.json({
    totalVerifiedAmountRupees: Number(dashboard.totalVerifiedAmountPaise) / 100,
    verifiedContributorCount: dashboard.verifiedContributorCount.toString(),
    totalPixelsAllocated: dashboard.totalPixelsAllocated.toString(),
    pendingVerificationCount: dashboard.pendingVerificationCount,
    recentContributions: dashboard.recentContributions.map((contribution) => ({
      contributionId: contribution.publicCode,
      status: contribution.status,
      displayName: contribution.displayName,
      anonymous: contribution.anonymous,
      amountRupees: Number(contribution.amountPaise) / 100,
      createdAt: contribution.createdAt,
    })),
  });
}
