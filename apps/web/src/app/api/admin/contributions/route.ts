// GET /api/admin/contributions — verification queue with filters — docs/API.md §4.
import { adminQueueFiltersSchema, listVerificationQueue } from "@1crore-pixels/core";
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors } from "@/lib/api-response";
import { isAuthResult, requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthResult(auth)) return auth;

  const url = new URL(request.url);
  const parsed = adminQueueFiltersSchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) return apiErrors.validation(parsed.error.issues[0]?.message ?? "Invalid request");

  const queue = await listVerificationQueue(parsed.data);
  return NextResponse.json({
    items: queue.map(({ contribution, ambiguousMatch }) => ({
      contributionId: contribution.publicCode,
      status: contribution.status,
      displayName: contribution.displayName,
      anonymous: contribution.anonymous,
      amountRupees: Number(contribution.amountPaise) / 100,
      utrLast4: contribution.utrLast4,
      createdAt: contribution.createdAt,
      paymentSubmittedAt: contribution.paymentSubmittedAt,
      contributor: { id: contribution.contributor.id.toString(), displayName: contribution.contributor.displayName },
      ambiguousMatch,
    })),
  });
}
