// POST /api/referrals/{code}/visit — docs/API.md §2.8.1. Kept separate from the GET above
// so that stays cacheable/side-effect-free (docs/API.md §2.8).
import { prisma } from "@1crore-pixels/db";
import type { NextRequest } from "next/server";
import { apiErrors } from "@/lib/api-response";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getRequestSignals } from "@/lib/request-context";

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { ip, ipHash } = getRequestSignals(request);

  // Per-IP + per-referral debounce window against visit-count inflation (docs/SECURITY.md §3).
  const rateLimit = await checkRateLimit(`${code}:${ip}`, RATE_LIMITS.referralVisit);
  if (!rateLimit.allowed) return apiErrors.rateLimited();

  const referral = await prisma.referral.findUnique({ where: { code } });
  if (!referral) return apiErrors.notFound("Referral code not found");

  await prisma.referralEvent.create({
    data: { referralId: referral.id, eventType: "VISIT", ipHash },
  });

  return new Response(null, { status: 204 });
}
