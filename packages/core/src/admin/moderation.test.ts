import { prisma, type AdminUser } from "@1crore-pixels/db";
import { afterEach, describe, expect, it } from "vitest";
import {
  createTestAdmin,
  createTestContribution,
  deleteTestAdmin,
  deleteTestContribution,
  type TestContribution,
} from "../test-support/fixtures";
import { moderateContributionDisplayName } from "./moderation";

describe("moderateContributionDisplayName (docs/API.md §4, PRD §9.1, §16)", () => {
  let admin: AdminUser | undefined;
  let fixture: TestContribution | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
    fixture = undefined;
  });

  it("HIDE forces the display name to Anonymous and writes an audit row with before/after state", async () => {
    admin = await createTestAdmin({ role: "CONTENT_EDITOR" });
    fixture = await createTestContribution({ status: "PUBLISHED" });

    const result = await moderateContributionDisplayName(
      fixture.contribution.id,
      { action: "HIDE" },
      { adminUserId: admin.id, ipAddress: "203.0.113.1" },
    );

    expect(result?.displayName).toBe("Anonymous");

    const audit = await prisma.auditLog.findMany({
      where: { entityType: "contribution", entityId: String(fixture.contribution.id), action: "DISPLAY_NAME_MODERATED" },
    });
    expect(audit).toHaveLength(1);
    expect((audit[0]?.beforeState as { displayName: string }).displayName).toBe(fixture.contribution.displayName);
  });

  it("REPLACE sanitizes and stores the replacement name", async () => {
    admin = await createTestAdmin({ role: "CONTENT_EDITOR" });
    fixture = await createTestContribution({ status: "PUBLISHED" });

    const result = await moderateContributionDisplayName(
      fixture.contribution.id,
      { action: "REPLACE", replacementName: "  Clean Name  " },
      { adminUserId: admin.id },
    );

    expect(result?.displayName).toBe("Clean Name");
  });

  it("returns null and writes no audit row for a non-existent contribution", async () => {
    admin = await createTestAdmin({ role: "CONTENT_EDITOR" });

    const result = await moderateContributionDisplayName(999_999_999n, { action: "HIDE" }, { adminUserId: admin.id });

    expect(result).toBeNull();
  });
});
