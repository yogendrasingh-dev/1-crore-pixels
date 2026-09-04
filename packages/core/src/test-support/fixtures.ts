// Shared DB fixtures for packages/core's integration/concurrency tests. Not part of the
// package's public API (not re-exported from src/index.ts).
import { prisma, type AdminRole, type AdminUser, type Contribution, type ContributionStatus, type Contributor } from "@1crore-pixels/db";
import { hashPassword } from "../admin/auth";

let counter = 0;

export interface TestAdminOverrides {
  role: AdminRole;
  status?: string;
  mfaEnabled?: boolean;
  mfaSecretEncrypted?: string;
}

export async function createTestAdmin(overrides: TestAdminOverrides): Promise<AdminUser> {
  counter += 1;
  const passwordHash = await hashPassword("Sup3r-Secret-Password!");
  return prisma.adminUser.create({
    data: {
      email: `admin_${Date.now()}_${counter}_${Math.random().toString(36).slice(2)}@test.local`,
      passwordHash,
      role: overrides.role,
      status: overrides.status ?? "ACTIVE",
      mfaEnabled: overrides.mfaEnabled ?? false,
      mfaSecretEncrypted: overrides.mfaSecretEncrypted,
    },
  });
}

export async function deleteTestAdmin(admin: AdminUser): Promise<void> {
  await prisma.auditLog.deleteMany({ where: { adminUserId: admin.id } });
  await prisma.adminUser.delete({ where: { id: admin.id } });
}

export interface TestContributionOverrides {
  status: ContributionStatus;
  amountPaise?: bigint;
  expiresAt?: Date;
  utrLast4?: string;
  referralCodeUsed?: string;
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
      referralCodeUsed: overrides.referralCodeUsed,
    },
  });
  return { contributor, contribution };
}

export async function deleteTestContribution({ contributor, contribution }: TestContribution): Promise<void> {
  await prisma.pixelAllocation.deleteMany({ where: { contributionId: contribution.id } });
  await prisma.contribution.delete({ where: { id: contribution.id } });
  await prisma.contributor.delete({ where: { id: contributor.id } });
}
