import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@1crore-pixels/db";
import { verifyAndAllocatePixels } from "./allocation";
import { createTestContribution, deleteTestContribution, type TestContribution } from "../test-support/fixtures";

describe("verifyAndAllocatePixels (docs/PIXEL_SYSTEM.md §2.3)", () => {
  const created: TestContribution[] = [];

  afterEach(async () => {
    await Promise.all(created.splice(0).map(deleteTestContribution));
  });

  async function verifyingContribution(amountPaise: bigint) {
    const fixture = await createTestContribution({ status: "VERIFYING", amountPaise });
    created.push(fixture);
    return fixture;
  }

  it("allocates exactly the contribution's rupee amount in pixels and publishes it", async () => {
    const { contribution } = await verifyingContribution(101n * 100n);
    const cursorBefore = await prisma.pixelCursor.findUniqueOrThrow({ where: { id: 1 } });
    const totalsBefore = await prisma.campaignTotals.findUniqueOrThrow({ where: { id: 1 } });

    const result = await verifyAndAllocatePixels(contribution.id);

    expect(result).not.toBeNull();
    expect(result?.contribution.status).toBe("PUBLISHED");
    expect(result?.contribution.publishedAt).not.toBeNull();
    expect(result?.pixelAllocation.pixelCount).toBe(101n);
    expect(result?.pixelAllocation.startPixel).toBe(cursorBefore.nextIndex);
    expect(result?.pixelAllocation.endPixel).toBe(cursorBefore.nextIndex + 101n);

    const cursorAfter = await prisma.pixelCursor.findUniqueOrThrow({ where: { id: 1 } });
    expect(cursorAfter.nextIndex).toBe(cursorBefore.nextIndex + 101n);

    const totalsAfter = await prisma.campaignTotals.findUniqueOrThrow({ where: { id: 1 } });
    expect(totalsAfter.totalVerifiedAmountPaise).toBe(totalsBefore.totalVerifiedAmountPaise + 101n * 100n);
    expect(totalsAfter.verifiedContributorCount).toBe(totalsBefore.verifiedContributorCount + 1n);
    expect(totalsAfter.totalPixelsAllocated).toBe(totalsBefore.totalPixelsAllocated + 101n);
  });

  it("is a no-op that touches no other table when the contribution is not VERIFYING", async () => {
    const fixture = await createTestContribution({ status: "PAYMENT_PENDING" });
    created.push(fixture);
    const cursorBefore = await prisma.pixelCursor.findUniqueOrThrow({ where: { id: 1 } });
    const totalsBefore = await prisma.campaignTotals.findUniqueOrThrow({ where: { id: 1 } });

    const result = await verifyAndAllocatePixels(fixture.contribution.id);

    expect(result).toBeNull();
    const allocation = await prisma.pixelAllocation.findUnique({
      where: { contributionId: fixture.contribution.id },
    });
    expect(allocation).toBeNull();
    await expect(prisma.pixelCursor.findUniqueOrThrow({ where: { id: 1 } })).resolves.toMatchObject({
      nextIndex: cursorBefore.nextIndex,
    });
    await expect(prisma.campaignTotals.findUniqueOrThrow({ where: { id: 1 } })).resolves.toMatchObject({
      totalPixelsAllocated: totalsBefore.totalPixelsAllocated,
    });
  });

  it("is idempotent: a second call for an already-allocated contribution is a no-op", async () => {
    const { contribution } = await verifyingContribution(10n * 100n);

    const first = await verifyAndAllocatePixels(contribution.id);
    const second = await verifyAndAllocatePixels(contribution.id);

    expect(first).not.toBeNull();
    expect(second).toBeNull();

    const allocations = await prisma.pixelAllocation.findMany({
      where: { contributionId: contribution.id },
    });
    expect(allocations).toHaveLength(1);
  });
});
