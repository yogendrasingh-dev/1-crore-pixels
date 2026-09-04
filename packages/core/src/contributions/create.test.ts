import { prisma } from "@1crore-pixels/db";
import { afterEach, describe, expect, it } from "vitest";
import { createContribution } from "./create";

describe("createContribution (docs/API.md §2.1)", () => {
  const createdContributionIds: bigint[] = [];
  const createdContributorIds: bigint[] = [];
  const createdReferralIds: bigint[] = [];

  afterEach(async () => {
    await prisma.contribution.deleteMany({ where: { id: { in: createdContributionIds } } });
    await prisma.referral.deleteMany({ where: { id: { in: createdReferralIds } } });
    await prisma.contributor.deleteMany({ where: { id: { in: createdContributorIds } } });
    createdContributionIds.length = 0;
    createdContributorIds.length = 0;
    createdReferralIds.length = 0;
  });

  it("creates a CREATED contribution with a public code derived from its id", async () => {
    const contribution = await createContribution({
      displayName: "Rahul",
      anonymous: false,
      amountPaise: 10100n,
    });
    createdContributionIds.push(contribution.id);
    createdContributorIds.push(contribution.contributorId);

    expect(contribution.status).toBe("CREATED");
    expect(contribution.publicCode).toBe(`C_${contribution.id}`);
    expect(contribution.amountPaise).toBe(10100n);
    expect(contribution.displayName).toBe("Rahul");
  });

  it("is idempotent: the same Idempotency-Key returns the original contribution", async () => {
    const idempotencyKey = `test-key-${Date.now()}`;
    const first = await createContribution({
      displayName: "Priya",
      anonymous: false,
      amountPaise: 1100n,
      idempotencyKey,
    });
    createdContributionIds.push(first.id);
    createdContributorIds.push(first.contributorId);

    const second = await createContribution({
      displayName: "Someone Else",
      anonymous: false,
      amountPaise: 99900n,
      idempotencyKey,
    });

    expect(second.id).toBe(first.id);
    expect(second.displayName).toBe("Priya");
  });

  it("ignores an unknown referral code rather than rejecting the contribution", async () => {
    const contribution = await createContribution({
      displayName: "Amit",
      anonymous: false,
      amountPaise: 5100n,
      referralCode: "does-not-exist",
    });
    createdContributionIds.push(contribution.id);
    createdContributorIds.push(contribution.contributorId);

    expect(contribution.referralCodeUsed).toBeNull();
  });

  it("records a valid referral code on the contribution", async () => {
    const owner = await prisma.contributor.create({ data: { displayName: "Owner" } });
    createdContributorIds.push(owner.id);
    const referral = await prisma.referral.create({
      data: { code: `ref-${Date.now()}`, contributorId: owner.id },
    });
    createdReferralIds.push(referral.id);

    const contribution = await createContribution({
      displayName: "Sana",
      anonymous: false,
      amountPaise: 2100n,
      referralCode: referral.code,
    });
    createdContributionIds.push(contribution.id);
    createdContributorIds.push(contribution.contributorId);

    expect(contribution.referralCodeUsed).toBe(referral.code);
  });

  it("creates a contribution even when the display name fails moderation (never silently rejected)", async () => {
    const contribution = await createContribution({
      displayName: "aaaaaaaaaa",
      anonymous: false,
      amountPaise: 100n,
    });
    createdContributionIds.push(contribution.id);
    createdContributorIds.push(contribution.contributorId);

    expect(contribution.status).toBe("CREATED");
  });

  it("forces anonymous contributions to still store the real name server-side", async () => {
    const contribution = await createContribution({
      displayName: "Hidden Name",
      anonymous: true,
      amountPaise: 100n,
    });
    createdContributionIds.push(contribution.id);
    createdContributorIds.push(contribution.contributorId);

    expect(contribution.anonymous).toBe(true);
    expect(contribution.displayName).toBe("Hidden Name");
  });
});
