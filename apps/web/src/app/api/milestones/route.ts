// GET /api/milestones — docs/API.md §2.9, PRD §17. Admin-configurable, publicly readable.
import { prisma } from "@1crore-pixels/db";
import { NextResponse } from "next/server";
import { paiseToRupees } from "@/lib/api-response";

export async function GET() {
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
