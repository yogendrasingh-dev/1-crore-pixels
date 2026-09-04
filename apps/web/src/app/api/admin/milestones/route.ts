// GET/POST /api/admin/milestones — docs/API.md §4. GET: any authenticated admin. POST (manage
// milestones, PRD §17): role CONTENT_EDITOR+.
import { adminMilestoneCreateSchema, createMilestone } from "@1crore-pixels/core";
import { prisma } from "@1crore-pixels/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors, paiseToRupees } from "@/lib/api-response";
import { isAuthResult, requireAdmin } from "@/lib/admin-auth";
import { getRequestSignals } from "@/lib/request-context";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthResult(auth)) return auth;

  const milestones = await prisma.milestone.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({
    items: milestones.map((milestone) => ({
      id: milestone.id,
      label: milestone.label,
      targetAmountRupees:
        milestone.targetAmountPaise !== null ? paiseToRupees(milestone.targetAmountPaise) : null,
      phase: milestone.phase,
      sortOrder: milestone.sortOrder,
      achievedAt: milestone.achievedAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request, "CONTENT_EDITOR");
  if (isAuthResult(auth)) return auth;

  const body: unknown = await request.json().catch(() => undefined);
  const parsed = adminMilestoneCreateSchema.safeParse(body);
  if (!parsed.success) return apiErrors.validation(parsed.error.issues[0]?.message ?? "Invalid request");

  const { ip } = getRequestSignals(request);
  const milestone = await createMilestone(parsed.data, { adminUserId: auth.adminId, ipAddress: ip });

  return NextResponse.json({ id: milestone.id }, { status: 201 });
}
