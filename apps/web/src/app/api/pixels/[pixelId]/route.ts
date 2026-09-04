// GET /api/pixels/{pixelId} — docs/API.md §2.6.1, docs/PIXEL_SYSTEM.md §3.4.
import { resolvePublicDisplayName } from "@1crore-pixels/core";
import { prisma } from "@1crore-pixels/db";
import { NextResponse } from "next/server";
import { apiErrors } from "@/lib/api-response";

export async function GET(_request: Request, { params }: { params: Promise<{ pixelId: string }> }) {
  const { pixelId } = await params;
  if (!/^\d+$/.test(pixelId)) return apiErrors.validation("pixelId must be a non-negative integer");
  const index = BigInt(pixelId);

  const allocation = await prisma.pixelAllocation.findFirst({
    where: { startPixel: { lte: index }, endPixel: { gt: index }, contribution: { status: "PUBLISHED" } },
    include: { contribution: { select: { publicCode: true, displayName: true, anonymous: true } } },
  });

  if (!allocation) {
    return NextResponse.json({ pixelId: Number(index), claimed: false });
  }

  return NextResponse.json({
    pixelId: Number(index),
    claimed: true,
    displayName: resolvePublicDisplayName(allocation.contribution.displayName, allocation.contribution.anonymous),
    anonymous: allocation.contribution.anonymous,
    contributionId: allocation.contribution.publicCode,
  });
}
