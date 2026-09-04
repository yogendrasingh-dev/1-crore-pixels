// Shared DB fixtures for apps/web's route-handler integration tests — mirrors
// packages/core/src/test-support/fixtures.ts's pattern, kept local since packages/core
// doesn't publish a test-support subpath export.
import { hashPassword } from "@1crore-pixels/core";
import { prisma, type AdminRole, type AdminUser, type Contribution, type ContributionStatus, type Contributor } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { ADMIN_CSRF_COOKIE, ADMIN_SESSION_COOKIE, createAdminSession } from "./admin-session";

let counter = 0;

export interface TestContributionOverrides {
  status: ContributionStatus;
  amountPaise?: bigint;
  expiresAt?: Date;
  utrLast4?: string;
  anonymous?: boolean;
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
  const contributor = await prisma.contributor.create({
    data: { displayName: label, anonymous: overrides.anonymous ?? false },
  });
  const contribution = await prisma.contribution.create({
    data: {
      publicCode: `C_TEST_${Date.now()}_${counter}_${Math.random().toString(36).slice(2)}`,
      displayName: label,
      anonymous: overrides.anonymous ?? false,
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
  await prisma.auditLog.deleteMany({ where: { entityType: "contribution", entityId: String(contribution.id) } });
  await prisma.payment.deleteMany({ where: { contributionId: contribution.id } });
  await prisma.pixelAllocation.deleteMany({ where: { contributionId: contribution.id } });
  await prisma.contribution.delete({ where: { id: contribution.id } });
  await prisma.contributor.delete({ where: { id: contributor.id } });
}

export async function createTestAdmin(role: AdminRole): Promise<AdminUser> {
  counter += 1;
  return prisma.adminUser.create({
    data: {
      email: `admin_${Date.now()}_${counter}_${Math.random().toString(36).slice(2)}@test.local`,
      passwordHash: await hashPassword("Sup3r-Secret-Password!"),
      role,
      status: "ACTIVE",
    },
  });
}

export async function deleteTestAdmin(admin: AdminUser): Promise<void> {
  await prisma.auditLog.deleteMany({ where: { adminUserId: admin.id } });
  await prisma.adminUser.delete({ where: { id: admin.id } });
}

export interface AuthenticatedAdminRequestInit extends RequestInit {
  admin: AdminUser;
}

/** Builds a `NextRequest` carrying a real admin session + matching CSRF cookie/header. */
export async function adminRequest(url: string, init: AuthenticatedAdminRequestInit): Promise<NextRequest> {
  const { admin, headers, ...rest } = init;
  const session = await createAdminSession(admin.id, admin.role);
  const method = init.method ?? "GET";
  const requestHeaders = new Headers(headers);
  requestHeaders.set("cookie", `${ADMIN_SESSION_COOKIE}=${session.token}; ${ADMIN_CSRF_COOKIE}=${session.csrfToken}`);
  if (method !== "GET" && method !== "HEAD" && !requestHeaders.has("x-csrf-token")) {
    requestHeaders.set("x-csrf-token", session.csrfToken);
  }
  return new NextRequest(url, { ...rest, method, headers: requestHeaders, signal: rest.signal ?? undefined });
}
