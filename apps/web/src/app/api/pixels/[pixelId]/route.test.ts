import { prisma } from "@1crore-pixels/db";
import { afterEach, describe, expect, it } from "vitest";
import { createTestContribution, deleteTestContribution, type TestContribution } from "@/lib/test-support";
import { GET } from "./route";

describe("GET /api/pixels/{pixelId} (docs/API.md §2.6.1)", () => {
  let fixture: TestContribution | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    fixture = undefined;
  });

  it("returns claimed:true with the documented fields for a published allocation", async () => {
    fixture = await createTestContribution({ status: "PUBLISHED", amountPaise: 500n });
    await prisma.pixelAllocation.create({
      data: { contributionId: fixture.contribution.id, startPixel: 9_000_000, endPixel: 9_000_005 },
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ pixelId: "9000002" }),
    });
    const body = await response.json();

    expect(Object.keys(body).sort()).toEqual(["pixelId", "claimed", "displayName", "anonymous", "contributionId"].sort());
    expect(body.claimed).toBe(true);
    expect(body.contributionId).toBe(fixture.contribution.publicCode);
  });

  it("returns claimed:false for an unclaimed pixel", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ pixelId: "1" }),
    });
    const body = await response.json();

    expect(Object.keys(body).sort()).toEqual(["pixelId", "claimed"].sort());
    expect(body.claimed).toBe(false);
  });

  it("rejects a non-numeric pixelId with 422", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ pixelId: "abc" }),
    });
    expect(response.status).toBe(422);
  });
});
