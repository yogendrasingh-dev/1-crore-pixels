import { prisma } from "@1crore-pixels/db";
import { afterEach, describe, expect, it } from "vitest";
import { createTestContribution, deleteTestContribution, type TestContribution } from "../test-support/fixtures";
import { getReferralLeaderboard } from "./leaderboard";

describe("getReferralLeaderboard (PRD §20/§21, docs/API.md §2.10)", () => {
  const contributorIds: bigint[] = [];
  const referralIds: bigint[] = [];
  const contributionFixtures: TestContribution[] = [];

  afterEach(async () => {
    await Promise.all(contributionFixtures.splice(0).map(deleteTestContribution));
    await prisma.referralEvent.deleteMany({ where: { referralId: { in: referralIds } } });
    await prisma.referral.deleteMany({ where: { id: { in: referralIds } } });
    await prisma.contributor.deleteMany({ where: { id: { in: contributorIds.splice(0) } } });
    referralIds.length = 0;
  });

  it("ranks contributors by CONTRIBUTION referral events, ignoring VISIT-only referrals", async () => {
    const topReferrer = await prisma.contributor.create({ data: { displayName: "Top Referrer" } });
    const quietReferrer = await prisma.contributor.create({ data: { displayName: "Quiet Referrer" } });
    contributorIds.push(topReferrer.id, quietReferrer.id);

    const topReferral = await prisma.referral.create({
      data: { code: `top-${Date.now()}`, contributorId: topReferrer.id },
    });
    const quietReferral = await prisma.referral.create({
      data: { code: `quiet-${Date.now()}`, contributorId: quietReferrer.id },
    });
    referralIds.push(topReferral.id, quietReferral.id);

    for (let i = 0; i < 2; i++) {
      const fixture = await createTestContribution({ status: "PUBLISHED" });
      contributionFixtures.push(fixture);
      await prisma.referralEvent.create({
        data: { referralId: topReferral.id, eventType: "CONTRIBUTION", contributionId: fixture.contribution.id },
      });
    }
    await prisma.referralEvent.create({ data: { referralId: quietReferral.id, eventType: "VISIT" } });

    const leaderboard = await getReferralLeaderboard(10);

    const top = leaderboard.find((entry) => entry.displayName === "Top Referrer");
    expect(top).toMatchObject({ rank: 1, referralCount: 2, anonymous: false });
    expect(leaderboard.some((entry) => entry.displayName === "Quiet Referrer")).toBe(false);
  });
});
