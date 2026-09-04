// GET /api/updates — docs/API.md §2.9, PRD §18. Standard paginated read, `PUBLISHED`-only.
import { prisma } from "@1crore-pixels/db";
import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(MAX_LIMIT, Math.max(1, Number(limitParam))) : DEFAULT_LIMIT;

  const updates = await prisma.update.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    items: updates.map((update) => ({
      id: update.id,
      title: update.title,
      body: update.body,
      imageUrl: update.imageUrl,
      milestoneId: update.milestoneId,
      publishedAt: update.publishedAt,
    })),
  });
}
