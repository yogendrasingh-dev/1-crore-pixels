// Pixel allocation transaction — docs/PIXEL_SYSTEM.md §2.3, docs/PAYMENT.md §2.1.
//
// This is the *only* code path that may move a contribution to PAID/PIXELS_ASSIGNED/PUBLISHED
// or create a `pixel_allocations` row (CLAUDE.md §8, §9). It runs as a single Prisma interactive
// transaction so steps 1-4 either all happen or none do. The `VERIFYING -> PAID` conditional
// update deliberately is not exposed as a standalone state-machine transition (see
// state-machine/index.ts) — folding it in here is what prevents a second way to reach
// PIXELS_ASSIGNED.
import { Prisma, prisma, type Contribution, type PixelAllocation, type PrismaClient } from "@1crore-pixels/db";

export interface PixelAllocationResult {
  contribution: Contribution;
  pixelAllocation: PixelAllocation;
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/**
 * Verifies a `VERIFYING` contribution and allocates its pixel range, per
 * `docs/PIXEL_SYSTEM.md` §2.3. Returns `null` if the contribution was not (or no longer)
 * `VERIFYING` — a retried/duplicate call, or a race with another verification — which is a
 * guaranteed no-op, never a partial allocation (docs/PAYMENT.md §2.1, §8).
 */
export async function verifyAndAllocatePixels(
  contributionId: bigint,
  db: PrismaClient = prisma,
): Promise<PixelAllocationResult | null> {
  return db.$transaction(async (tx) => {
    let paid: Contribution;
    try {
      paid = await tx.contribution.update({
        where: { id: contributionId, status: "VERIFYING" },
        data: { status: "PAID", paidAt: new Date() },
      });
    } catch (error) {
      if (isRecordNotFound(error)) return null;
      throw error;
    }

    const pixelCount = paid.amountPaise / 100n;

    const reservations = await tx.$queryRaw<{ reservedStart: bigint }[]>`
      UPDATE pixel_cursor
      SET next_index = next_index + ${pixelCount}, updated_at = now()
      WHERE id = 1
      RETURNING next_index - ${pixelCount} AS "reservedStart"
    `;
    const reservation = reservations[0];
    if (!reservation) {
      throw new Error("pixel_cursor row is missing — seed migration T1.4 did not run");
    }
    const { reservedStart } = reservation;

    const pixelAllocation = await tx.pixelAllocation.create({
      data: {
        contributionId,
        startPixel: reservedStart,
        endPixel: reservedStart + pixelCount,
      },
    });

    await tx.contribution.update({
      where: { id: contributionId },
      data: { status: "PIXELS_ASSIGNED" },
    });

    await tx.campaignTotals.update({
      where: { id: 1 },
      data: {
        totalVerifiedAmountPaise: { increment: paid.amountPaise },
        verifiedContributorCount: { increment: 1 },
        totalPixelsAllocated: { increment: pixelCount },
      },
    });

    const published = await tx.contribution.update({
      where: { id: contributionId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    return { contribution: published, pixelAllocation };
  });
}
