import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./index";

describe("pixel_allocations GiST exclusion constraint (docs/DATABASE.md §3.4)", () => {
  const base = 5_000_000 + Math.floor(Math.random() * 1_000_000);
  let contributorId: bigint;
  let contributionAId: bigint;
  let contributionBId: bigint;

  beforeAll(async () => {
    const contributor = await prisma.contributor.create({
      data: { displayName: "GiST Test Contributor" },
    });
    contributorId = contributor.id;

    const suffix = Date.now();
    const [a, b] = await Promise.all([
      prisma.contribution.create({
        data: {
          publicCode: `C_GIST_TEST_A_${suffix}`,
          displayName: "GiST Test A",
          amountPaise: 10,
          status: "PIXELS_ASSIGNED",
          contributorId,
        },
      }),
      prisma.contribution.create({
        data: {
          publicCode: `C_GIST_TEST_B_${suffix}`,
          displayName: "GiST Test B",
          amountPaise: 10,
          status: "PIXELS_ASSIGNED",
          contributorId,
        },
      }),
    ]);
    contributionAId = a.id;
    contributionBId = b.id;
  });

  afterAll(async () => {
    await prisma.pixelAllocation.deleteMany({
      where: { contributionId: { in: [contributionAId, contributionBId] } },
    });
    await prisma.contribution.deleteMany({
      where: { id: { in: [contributionAId, contributionBId] } },
    });
    await prisma.contributor.delete({ where: { id: contributorId } });
  });

  it("rejects an insert whose pixel range overlaps an existing allocation", async () => {
    await prisma.pixelAllocation.create({
      data: { contributionId: contributionAId, startPixel: base, endPixel: base + 10 },
    });

    await expect(
      prisma.pixelAllocation.create({
        data: { contributionId: contributionBId, startPixel: base + 5, endPixel: base + 15 },
      }),
    ).rejects.toThrow();
  });

  it("allows an insert whose pixel range does not overlap an existing allocation", async () => {
    await expect(
      prisma.pixelAllocation.create({
        data: { contributionId: contributionBId, startPixel: base + 10, endPixel: base + 20 },
      }),
    ).resolves.toMatchObject({ contributionId: contributionBId });
  });
});
