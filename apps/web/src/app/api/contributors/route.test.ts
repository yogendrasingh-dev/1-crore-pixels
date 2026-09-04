import { prisma } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { createTestContribution, deleteTestContribution, type TestContribution } from "@/lib/test-support";
import { GET } from "./route";

const ALLOWED_ITEM_FIELDS = ["displayName", "anonymous", "pixelCount", "contributedAgo"].sort();

describe("GET /api/contributors (docs/API.md §2.7)", () => {
  let fixture: TestContribution | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    fixture = undefined;
  });

  it("only lists PUBLISHED contributions with exactly the documented fields", async () => {
    fixture = await createTestContribution({ status: "PUBLISHED", amountPaise: 500n });
    await prisma.contribution.update({
      where: { id: fixture.contribution.id },
      data: { publishedAt: new Date() },
    });
    await prisma.pixelAllocation.create({
      data: { contributionId: fixture.contribution.id, startPixel: 8_000_000, endPixel: 8_000_005 },
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/contributors?search=${fixture.contributor.displayName}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(Object.keys(body.items[0]).sort()).toEqual(ALLOWED_ITEM_FIELDS);
    expect(body.items[0].pixelCount).toBe(5);
    expect(body).not.toHaveProperty("amountRupees");
  });

  it("never lists an unpublished contribution", async () => {
    fixture = await createTestContribution({ status: "VERIFYING" });

    const response = await GET(
      new NextRequest(`http://localhost/api/contributors?search=${fixture.contributor.displayName}`),
    );
    const body = await response.json();

    expect(body.items).toHaveLength(0);
  });
});
