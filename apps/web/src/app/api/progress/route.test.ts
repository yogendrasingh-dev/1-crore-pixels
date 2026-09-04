import { prisma } from "@1crore-pixels/db";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

const ALLOWED_FIELDS = [
  "totalRaisedRupees",
  "goalRupees",
  "percentFunded",
  "verifiedContributorCount",
  "pixelsClaimed",
  "updatedAt",
].sort();

describe("GET /api/progress (docs/API.md §2.5)", () => {
  it("returns exactly the documented fields, backed by campaign_totals", async () => {
    const totals = await prisma.campaignTotals.findUniqueOrThrow({ where: { id: 1 } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(ALLOWED_FIELDS);
    expect(body.goalRupees).toBe(10_000_000);
    expect(body.verifiedContributorCount).toBe(Number(totals.verifiedContributorCount));
    expect(response.headers.get("Cache-Control")).toContain("s-maxage");
  });
});
