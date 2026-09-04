// POST /api/contributions — docs/API.md §2.1.
import { createContribution, createContributionRequestSchema } from "@1crore-pixels/core";
import type { Contribution } from "@1crore-pixels/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors, paiseToRupees } from "@/lib/api-response";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getRequestSignals } from "@/lib/request-context";

function serialize(contribution: Contribution) {
  return {
    contributionId: contribution.publicCode,
    status: contribution.status,
    amountRupees: paiseToRupees(contribution.amountPaise),
    displayName: contribution.displayName,
    anonymous: contribution.anonymous,
  };
}

export async function POST(request: NextRequest) {
  const { ip, ipHash, userAgentHash } = getRequestSignals(request);
  const rateLimit = await checkRateLimit(ip, RATE_LIMITS.createContribution);
  if (!rateLimit.allowed) return apiErrors.rateLimited();

  const body: unknown = await request.json().catch(() => undefined);
  const parsed = createContributionRequestSchema.safeParse(body);
  if (!parsed.success) return apiErrors.validation(parsed.error.issues[0]?.message ?? "Invalid request");

  const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;

  const contribution = await createContribution({
    displayName: parsed.data.displayName,
    anonymous: parsed.data.anonymous,
    amountPaise: parsed.data.amountRupees,
    referralCode: parsed.data.referralCode,
    idempotencyKey,
    ipHash,
    userAgentHash,
  });

  return NextResponse.json(serialize(contribution), { status: 201 });
}
