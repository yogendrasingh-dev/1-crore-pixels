// GET /api/pixels?chunk= — docs/API.md §2.6, docs/PIXEL_SYSTEM.md §3.2-3.3.
import { chunkBounds, getWallGeometry, parseChunkId, resolvePublicDisplayName } from "@1crore-pixels/core";
import { prisma } from "@1crore-pixels/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const chunkId = request.nextUrl.searchParams.get("chunk");
  if (!chunkId) return apiErrors.validation("chunk query parameter is required");

  let bounds;
  let chunkIndex: bigint;
  try {
    bounds = chunkBounds(chunkId);
    chunkIndex = parseChunkId(chunkId);
  } catch {
    return apiErrors.validation(`Invalid chunkId: ${chunkId}`);
  }

  const geometry = getWallGeometry();

  // Range-overlap test using the plain start/end columns — equivalent to the int8range
  // `&&` query in docs/PIXEL_SYSTEM.md §3.3, without needing raw SQL for this read path.
  const allocations = await prisma.pixelAllocation.findMany({
    where: {
      startPixel: { lt: bounds.end },
      endPixel: { gt: bounds.start },
      contribution: { status: "PUBLISHED" },
    },
    include: { contribution: { select: { displayName: true, anonymous: true } } },
    orderBy: { startPixel: "asc" },
  });

  return NextResponse.json(
    {
      chunkId,
      bounds: {
        chunkIndex: Number(chunkIndex),
        rowStart: Number(chunkIndex) * geometry.chunkRows,
        rowEnd: (Number(chunkIndex) + 1) * geometry.chunkRows,
        pixelStart: Number(bounds.start),
        pixelEnd: Number(bounds.end),
      },
      allocations: allocations.map((allocation) => ({
        start: Number(allocation.startPixel),
        end: Number(allocation.endPixel),
        displayName: resolvePublicDisplayName(
          allocation.contribution.displayName,
          allocation.contribution.anonymous,
        ),
        anonymous: allocation.contribution.anonymous,
      })),
    },
    // Invalidated implicitly by TTL expiry rather than active invalidation — a few
    // seconds of staleness on a just-claimed pixel is acceptable (docs/DEPLOYMENT.md §5).
    { headers: { "Cache-Control": "s-maxage=10, stale-while-revalidate=30" } },
  );
}
