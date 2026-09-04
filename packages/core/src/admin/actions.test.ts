import { prisma, type AdminUser } from "@1crore-pixels/db";
import { afterEach, describe, expect, it } from "vitest";
import {
  createTestAdmin,
  createTestContribution,
  deleteTestAdmin,
  deleteTestContribution,
  type TestContribution,
} from "../test-support/fixtures";
import { adminRejectContribution, adminVerifyContribution } from "./actions";

describe("adminVerifyContribution (docs/API.md §4, docs/SECURITY.md §6)", () => {
  let fixture: TestContribution | undefined;
  let admin: AdminUser | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    if (admin) await deleteTestAdmin(admin);
    fixture = undefined;
    admin = undefined;
  });

  it("verifies, allocates pixels, and writes an audit row in the same transaction", async () => {
    fixture = await createTestContribution({ status: "VERIFYING", amountPaise: 500n });
    admin = await createTestAdmin({ role: "VERIFIER" });

    const result = await adminVerifyContribution(fixture.contribution.id, {
      adminUserId: admin.id,
      ipAddress: "203.0.113.5",
    });

    expect(result?.contribution.status).toBe("PUBLISHED");

    const audit = await prisma.auditLog.findMany({
      where: { entityType: "contribution", entityId: String(fixture.contribution.id), action: "VERIFY_CONTRIBUTION" },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.adminUserId).toBe(admin.id);
    expect(audit[0]?.ipAddress).toBe("203.0.113.5");
  });

  it("is a no-op with no audit row when the contribution is not VERIFYING", async () => {
    fixture = await createTestContribution({ status: "PAYMENT_PENDING" });
    admin = await createTestAdmin({ role: "VERIFIER" });

    const result = await adminVerifyContribution(fixture.contribution.id, { adminUserId: admin.id });

    expect(result).toBeNull();
    const audit = await prisma.auditLog.findMany({
      where: { entityType: "contribution", entityId: String(fixture.contribution.id) },
    });
    expect(audit).toHaveLength(0);
  });

  it("records a best-effort referral CONTRIBUTION event when the contribution used a referral code (T9.4)", async () => {
    const owner = await prisma.contributor.create({ data: { displayName: "Referral Owner" } });
    const referral = await prisma.referral.create({
      data: { code: `ref-attribution-${Date.now()}`, contributorId: owner.id },
    });
    fixture = await createTestContribution({ status: "VERIFYING", referralCodeUsed: referral.code });
    admin = await createTestAdmin({ role: "VERIFIER" });

    const result = await adminVerifyContribution(fixture.contribution.id, { adminUserId: admin.id });

    expect(result?.contribution.status).toBe("PUBLISHED");
    const events = await prisma.referralEvent.findMany({ where: { referralId: referral.id, eventType: "CONTRIBUTION" } });
    expect(events).toHaveLength(1);
    expect(events[0]?.contributionId).toBe(fixture.contribution.id);

    await prisma.referralEvent.deleteMany({ where: { referralId: referral.id } });
    await prisma.referral.delete({ where: { id: referral.id } });
    await prisma.contributor.delete({ where: { id: owner.id } });
  });
});

describe("adminRejectContribution (docs/API.md §4, docs/SECURITY.md §6)", () => {
  let fixture: TestContribution | undefined;
  let admin: AdminUser | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    if (admin) await deleteTestAdmin(admin);
    fixture = undefined;
    admin = undefined;
  });

  it("rejects and writes an audit row with the reason", async () => {
    fixture = await createTestContribution({ status: "VERIFYING" });
    admin = await createTestAdmin({ role: "VERIFIER" });

    const result = await adminRejectContribution(fixture.contribution.id, "No matching UTR found", {
      adminUserId: admin.id,
      ipAddress: "203.0.113.9",
    });

    expect(result?.status).toBe("VERIFICATION_FAILED");
    expect(result?.rejectionReason).toBe("No matching UTR found");

    const audit = await prisma.auditLog.findMany({
      where: { entityType: "contribution", entityId: String(fixture.contribution.id), action: "REJECT_CONTRIBUTION" },
    });
    expect(audit).toHaveLength(1);
  });

  it("is a no-op with no audit row when the contribution is not VERIFYING", async () => {
    fixture = await createTestContribution({ status: "PUBLISHED" });
    admin = await createTestAdmin({ role: "VERIFIER" });

    const result = await adminRejectContribution(fixture.contribution.id, "too late", { adminUserId: admin.id });

    expect(result).toBeNull();
    const audit = await prisma.auditLog.findMany({
      where: { entityType: "contribution", entityId: String(fixture.contribution.id) },
    });
    expect(audit).toHaveLength(0);
  });
});
