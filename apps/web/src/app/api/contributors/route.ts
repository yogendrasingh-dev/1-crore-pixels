// GET /api/contributors — docs/API.md §2.7, PRD §8.6/§16. Paginated, most-recent-first,
// `PUBLISHED`-only. `amountRupees` is omitted pending PRD §36.6's Open Decision (docs/API.md §6.2).
import { resolvePublicDisplayName } from "@1crore-pixels/core";
import { prisma } from "@1crore-pixels/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors } from "@/lib/api-response";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function encodeCursor(id: bigint): string {
  return Buffer.from(id.toString(), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): bigint {
  return BigInt(Buffer.from(cursor, "base64url").toString("utf8"));
}

function contributedAgo(publishedAt: Date | null): string {
  if (!publishedAt) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - publishedAt.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const limitParam = params.get("limit");
  const limit = limitParam ? Math.min(MAX_LIMIT, Math.max(1, Number(limitParam))) : DEFAULT_LIMIT;
  const search = params.get("search")?.trim();
  const cursorParam = params.get("cursor");

  let cursorId: bigint | undefined;
  if (cursorParam) {
    try {
      cursorId = decodeCursor(cursorParam);
    } catch {
      return apiErrors.validation("Invalid cursor");
    }
  }

  const contributions = await prisma.contribution.findMany({
    where: {
      status: "PUBLISHED",
      ...(search ? { displayName: { contains: search, mode: "insensitive" } } : {}),
      ...(cursorId !== undefined ? { id: { lt: cursorId } } : {}),
    },
    include: { pixelAllocation: { select: { pixelCount: true } } },
    orderBy: { id: "desc" },
    take: limit + 1,
  });

  const hasMore = contributions.length > limit;
  const page = contributions.slice(0, limit);

  return NextResponse.json({
    items: page.map((contribution) => ({
      displayName: resolvePublicDisplayName(contribution.displayName, contribution.anonymous),
      anonymous: contribution.anonymous,
      pixelCount: Number(contribution.pixelAllocation?.pixelCount ?? 0n),
      contributedAgo: contributedAgo(contribution.publishedAt),
    })),
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]!.id) : null,
  });
}
