import { prisma, type AdminUser } from "@1crore-pixels/db";
import { afterEach, describe, expect, it } from "vitest";
import { createTestAdmin, deleteTestAdmin } from "../test-support/fixtures";
import { listAuditLogs } from "./audit-log-query";
import { writeAuditLog } from "./audit";

describe("listAuditLogs (docs/API.md §4, PRD §22 Audit)", () => {
  let admin: AdminUser | undefined;
  const entityId = `test-entity-${Date.now()}`;

  afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId } });
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
  });

  it("filters by entityType and returns matching rows newest-first", async () => {
    admin = await createTestAdmin({ role: "SUPER_ADMIN" });

    await writeAuditLog(prisma, { adminUserId: admin.id, action: "MILESTONE_CREATED", entityType: "milestone", entityId });
    await writeAuditLog(prisma, { adminUserId: admin.id, action: "MILESTONE_EDITED", entityType: "milestone", entityId });

    const logs = await listAuditLogs({ entityType: "milestone", entityId, limit: 50 });

    expect(logs).toHaveLength(2);
    expect(logs[0]?.action).toBe("MILESTONE_EDITED");
  });
});
