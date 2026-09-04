// Shared DB fixtures for packages/core's integration/concurrency tests. Not part of the
// package's public API (not re-exported from src/index.ts).
import { prisma, type Contribution, type ContributionStatus, type Contributor } from "@1crore-pixels/db";

let counter = 0;

export interface TestContributionOverrides {
  status: ContributionStatus;
  amountPaise?: bigint;
  expiresAt?: Date;
  utrLast4?: string;
}

export interface TestContribution {
  contributor: Contributor;
  contribution: Contribution;
}

export async function createTestContribution(
  overrides: TestContributionOverrides,
): Promise<TestContribution> {
  counter += 1;
  const label = `Test Contributor ${Date.now()}_${counter}`;
  const contributor = await prisma.contributor.create({ data: { displayName: label } });
  const contribution = await prisma.contribution.create({
    data: {
      publicCode: `C_TEST_${Date.now()}_${counter}_${Math.random().toString(36).slice(2)}`,
      displayName: label,
      amountPaise: overrides.amountPaise ?? 100n,
      status: overrides.status,
      contributorId: contributor.id,
      expiresAt: overrides.expiresAt,
      utrLast4: overrides.utrLast4,
    },
  });
  return { contributor, contribution };
}

export async function deleteTestContribution({ contributor, contribution }: TestContribution): Promise<void> {
  await prisma.pixelAllocation.deleteMany({ where: { contributionId: contribution.id } });
  await prisma.contribution.delete({ where: { id: contribution.id } });
  await prisma.contributor.delete({ where: { id: contributor.id } });
}
