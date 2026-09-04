// Concurrency test suite — docs/TESTING.md §4. These race real concurrent requests against a
// real Postgres instance; they exist to prove the DB-level guarantees in docs/DATABASE.md §5
// and docs/PIXEL_SYSTEM.md §2.4 hold, not just that the code looks right on inspection.
import { describe, expect, it } from "vitest";
import { prisma } from "@1crore-pixels/db";
import { verifyAndAllocatePixels } from "./allocation";
import { createTestContribution, deleteTestContribution, type TestContribution } from "../test-support/fixtures";

describe("pixel allocation concurrency (docs/TESTING.md §4)", () => {
  it("duplicate verify race: exactly one allocation and one totals increment survive N concurrent verifies", async () => {
    const fixture = await createTestContribution({ status: "VERIFYING", amountPaise: 500n });
    const totalsBefore = await prisma.campaignTotals.findUniqueOrThrow({ where: { id: 1 } });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => verifyAndAllocatePixels(fixture.contribution.id)),
    );

    const successes = results.filter((r) => r !== null);
    const noops = results.filter((r) => r === null);
    expect(successes).toHaveLength(1);
    expect(noops).toHaveLength(9);

    const allocations = await prisma.pixelAllocation.findMany({
      where: { contributionId: fixture.contribution.id },
    });
    expect(allocations).toHaveLength(1);
    expect(allocations[0]?.pixelCount).toBe(5n);

    const totalsAfter = await prisma.campaignTotals.findUniqueOrThrow({ where: { id: 1 } });
    expect(totalsAfter.totalPixelsAllocated).toBe(totalsBefore.totalPixelsAllocated + 5n);
    expect(totalsAfter.verifiedContributorCount).toBe(totalsBefore.verifiedContributorCount + 1n);

    await deleteTestContribution(fixture);
  });

  it("concurrent contributions with no overlap: N simultaneous verifies produce disjoint, contiguous ranges", async () => {
    const pixelCounts = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n];
    const fixtures: TestContribution[] = await Promise.all(
      pixelCounts.map((count) => createTestContribution({ status: "VERIFYING", amountPaise: count * 100n })),
    );
    const cursorBefore = await prisma.pixelCursor.findUniqueOrThrow({ where: { id: 1 } });
    const totalsBefore = await prisma.campaignTotals.findUniqueOrThrow({ where: { id: 1 } });

    const results = await Promise.all(
      fixtures.map((fixture) => verifyAndAllocatePixels(fixture.contribution.id)),
    );

    const allocations = results
      .map((r) => r?.pixelAllocation)
      .filter((allocation): allocation is NonNullable<typeof allocation> => allocation !== undefined)
      .sort((a, b) => (a.startPixel < b.startPixel ? -1 : 1));

    expect(allocations).toHaveLength(pixelCounts.length);

    // Pairwise non-overlapping and contiguous with respect to allocation order.
    for (let i = 0; i < allocations.length; i += 1) {
      const allocation = allocations[i]!;
      expect(allocation.endPixel).toBeGreaterThan(allocation.startPixel);
      if (i > 0) {
        expect(allocation.startPixel).toBe(allocations[i - 1]!.endPixel);
      }
    }
    expect(allocations[0]!.startPixel).toBeGreaterThanOrEqual(cursorBefore.nextIndex);

    const totalPixels = pixelCounts.reduce((sum, count) => sum + count, 0n);
    const totalsAfter = await prisma.campaignTotals.findUniqueOrThrow({ where: { id: 1 } });
    expect(totalsAfter.totalPixelsAllocated).toBe(totalsBefore.totalPixelsAllocated + totalPixels);
    expect(totalsAfter.verifiedContributorCount).toBe(
      totalsBefore.verifiedContributorCount + BigInt(pixelCounts.length),
    );

    const cursorAfter = await prisma.pixelCursor.findUniqueOrThrow({ where: { id: 1 } });
    expect(cursorAfter.nextIndex).toBe(cursorBefore.nextIndex + totalPixels);

    await Promise.all(fixtures.map(deleteTestContribution));
  });

  it("cursor correctness under load: repeated concurrent allocation leaves no gaps and no double-issued index", async () => {
    const concurrency = 20;
    const fixtures: TestContribution[] = await Promise.all(
      Array.from({ length: concurrency }, () => createTestContribution({ status: "VERIFYING", amountPaise: 100n })),
    );
    const cursorBefore = await prisma.pixelCursor.findUniqueOrThrow({ where: { id: 1 } });

    const results = await Promise.all(
      fixtures.map((fixture) => verifyAndAllocatePixels(fixture.contribution.id)),
    );

    const ranges = results
      .map((r) => r?.pixelAllocation)
      .filter((allocation): allocation is NonNullable<typeof allocation> => allocation !== undefined)
      .sort((a, b) => (a.startPixel < b.startPixel ? -1 : 1));

    expect(ranges).toHaveLength(concurrency);

    let expectedNext = cursorBefore.nextIndex;
    for (const range of ranges) {
      expect(range.startPixel).toBe(expectedNext);
      expectedNext = range.endPixel;
    }

    const cursorAfter = await prisma.pixelCursor.findUniqueOrThrow({ where: { id: 1 } });
    expect(cursorAfter.nextIndex).toBe(expectedNext);
    expect(cursorAfter.nextIndex).toBe(cursorBefore.nextIndex + BigInt(concurrency) * 1n);

    await Promise.all(fixtures.map(deleteTestContribution));
  });
});
