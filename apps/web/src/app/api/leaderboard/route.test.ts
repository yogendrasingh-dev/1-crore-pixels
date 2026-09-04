import { prisma } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { createTestContribution, deleteTestContribution, type TestContribution } from "@/lib/test-support";
import { GET } from "./route";

const ALLOWED_ITEM_FIELDS = ["rank", "displayName", "anonymous", "referralCount"].sort();

describe("GET /api/leaderboard (docs/API.md §2.10)", () => {
  const contributionFixtures: TestContribution[] = [];
  const contributorIds: bigint[] = [];
  const referralIds: bigint[] = [];

  afterEach(async () => {
    await Promise.all(contributionFixtures.splice(0).map(deleteTestContribution));
    await prisma.referralEvent.deleteMany({ where: { referralId: { in: referralIds } } });
    await prisma.referral.deleteMany({ where: { id: { in: referralIds } } });
    await prisma.contributor.deleteMany({ where: { id: { in: contributorIds.splice(0) } } });
    referralIds.length = 0;
  });

  it("ranks by referral conversion count with exactly the documented fields", async () => {
    const referrer = await prisma.contributor.create({ data: { displayName: "Leader Board" } });
    contributorIds.push(referrer.id);
    const referral = await prisma.referral.create({
      data: { code: `leaderboard-${Date.now()}`, contributorId: referrer.id },
    });
    referralIds.push(referral.id);

    const fixture = await createTestContribution({ status: "PUBLISHED" });
    contributionFixtures.push(fixture);
    await prisma.referralEvent.create({
      data: { referralId: referral.id, eventType: "CONTRIBUTION", contributionId: fixture.contribution.id },
    });

    const response = await GET(new NextRequest("http://localhost/api/leaderboard"));
    const body = await response.json();

    expect(response.status).toBe(200);
    const entry = body.items.find((item: { displayName: string }) => item.displayName === "Leader Board");
    expect(entry).toBeDefined();
    expect(Object.keys(entry).sort()).toEqual(ALLOWED_ITEM_FIELDS);
    expect(entry.referralCount).toBe(1);
  });
});
