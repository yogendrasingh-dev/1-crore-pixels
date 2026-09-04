// POST /api/admin/contributions/{id}/moderate-name — docs/API.md §4, PRD §9.1, §16. Role:
// CONTENT_EDITOR+. Hides (forces "Anonymous") or replaces the stored display name.
import { adminModerateNameRequestSchema, moderateContributionDisplayName } from "@1crore-pixels/core";
import { prisma } from "@1crore-pixels/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors } from "@/lib/api-response";
import { isAuthResult, requireAdmin } from "@/lib/admin-auth";
import { getRequestSignals } from "@/lib/request-context";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request, "CONTENT_EDITOR");
  if (isAuthResult(auth)) return auth;

  const { id } = await params;
  const contribution = await prisma.contribution.findUnique({ where: { publicCode: id } });
  if (!contribution) return apiErrors.notFound("Contribution not found");

  const body: unknown = await request.json().catch(() => undefined);
  const parsed = adminModerateNameRequestSchema.safeParse(body);
  if (!parsed.success) return apiErrors.validation(parsed.error.issues[0]?.message ?? "Invalid request");

  const { ip } = getRequestSignals(request);
  const moderated = await moderateContributionDisplayName(contribution.id, parsed.data, {
    adminUserId: auth.adminId,
    ipAddress: ip,
  });
  if (!moderated) return apiErrors.notFound("Contribution not found");

  return NextResponse.json({ contributionId: moderated.publicCode, displayName: moderated.displayName });
}
