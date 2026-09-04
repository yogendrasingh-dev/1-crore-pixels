// POST /api/contributions/{id}/utr — docs/API.md §2.3. No code path to `PAID` (CLAUDE.md §7).
import { recordUtrSubmission } from "@1crore-pixels/core";
import { prisma } from "@1crore-pixels/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiErrors } from "@/lib/api-response";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getRequestSignals } from "@/lib/request-context";

const utrRequestSchema = z.object({
  utrLast4: z.string().regex(/^\d{4}$/, "utrLast4 must be exactly 4 digits"),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ip } = getRequestSignals(request);
  const rateLimit = await checkRateLimit(ip, RATE_LIMITS.submitUtr);
  if (!rateLimit.allowed) return apiErrors.rateLimited();

  const { id } = await params;
  const contribution = await prisma.contribution.findUnique({ where: { publicCode: id } });
  if (!contribution) return apiErrors.notFound("Contribution not found");

  const rateLimitByContribution = await checkRateLimit(id, RATE_LIMITS.submitUtr);
  if (!rateLimitByContribution.allowed) return apiErrors.rateLimited();

  const body: unknown = await request.json().catch(() => undefined);
  const parsed = utrRequestSchema.safeParse(body);
  if (!parsed.success) return apiErrors.validation(parsed.error.issues[0]?.message ?? "Invalid request");

  const updated = await recordUtrSubmission(contribution.id, parsed.data.utrLast4);
  if (!updated) return apiErrors.invalidState("Contribution is not awaiting a UTR submission");

  return NextResponse.json({ contributionId: updated.publicCode, status: updated.status }, { status: 202 });
}
