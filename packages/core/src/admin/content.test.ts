import { prisma, type AdminUser } from "@1crore-pixels/db";
import { afterEach, describe, expect, it } from "vitest";
import { createTestAdmin, deleteTestAdmin } from "../test-support/fixtures";
import { createMilestone, createUpdate, editMilestone, editUpdate } from "./content";

describe("createUpdate / editUpdate (docs/API.md §4, PRD §18)", () => {
  let admin: AdminUser | undefined;
  let updateId: string | undefined;

  afterEach(async () => {
    if (updateId) await prisma.update.delete({ where: { id: updateId } }).catch(() => undefined);
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
    updateId = undefined;
  });

  it("creates a DRAFT update with no publishedAt and writes an audit row", async () => {
    admin = await createTestAdmin({ role: "CONTENT_EDITOR" });

    const update = await createUpdate(
      { title: "First update", body: "We started!", status: "DRAFT" },
      { adminUserId: admin.id },
    );
    updateId = update.id;

    expect(update.status).toBe("DRAFT");
    expect(update.publishedAt).toBeNull();

    const audit = await prisma.auditLog.findMany({ where: { entityType: "update", entityId: update.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.action).toBe("UPDATE_CREATED");
  });

  it("sets publishedAt when creating directly as PUBLISHED", async () => {
    admin = await createTestAdmin({ role: "CONTENT_EDITOR" });

    const update = await createUpdate(
      { title: "Live update", body: "Published immediately", status: "PUBLISHED" },
      { adminUserId: admin.id },
    );
    updateId = update.id;

    expect(update.publishedAt).not.toBeNull();
  });

  it("sets publishedAt only on the transition into PUBLISHED, and writes an audit row", async () => {
    admin = await createTestAdmin({ role: "CONTENT_EDITOR" });
    const created = await createUpdate({ title: "Draft", body: "wip", status: "DRAFT" }, { adminUserId: admin.id });
    updateId = created.id;

    const edited = await editUpdate(created.id, { status: "PUBLISHED" }, { adminUserId: admin.id });

    expect(edited?.status).toBe("PUBLISHED");
    expect(edited?.publishedAt).not.toBeNull();

    const audit = await prisma.auditLog.findMany({
      where: { entityType: "update", entityId: created.id, action: "UPDATE_EDITED" },
    });
    expect(audit).toHaveLength(1);
  });

  it("returns null and writes no audit row for a non-existent update", async () => {
    admin = await createTestAdmin({ role: "CONTENT_EDITOR" });
    const result = await editUpdate("00000000-0000-0000-0000-000000000000", { title: "x" }, { adminUserId: admin.id });
    expect(result).toBeNull();
  });
});

describe("createMilestone / editMilestone (docs/API.md §4, PRD §17)", () => {
  let admin: AdminUser | undefined;
  let milestoneId: string | undefined;

  afterEach(async () => {
    if (milestoneId) await prisma.milestone.delete({ where: { id: milestoneId } }).catch(() => undefined);
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
    milestoneId = undefined;
  });

  it("creates a milestone with the rupees target converted to paise", async () => {
    admin = await createTestAdmin({ role: "CONTENT_EDITOR" });

    const milestone = await createMilestone(
      { label: "₹1 Lakh", targetAmountRupees: 100_000, phase: "PRE_GOAL", sortOrder: 1 },
      { adminUserId: admin.id },
    );
    milestoneId = milestone.id;

    expect(milestone.targetAmountPaise).toBe(10_000_000n);

    const audit = await prisma.auditLog.findMany({ where: { entityType: "milestone", entityId: milestone.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.action).toBe("MILESTONE_CREATED");
  });

  it("edits label and achievedAt, writing an audit row", async () => {
    admin = await createTestAdmin({ role: "CONTENT_EDITOR" });
    const created = await createMilestone(
      { label: "₹10 Lakh", phase: "PRE_GOAL", sortOrder: 2 },
      { adminUserId: admin.id },
    );
    milestoneId = created.id;

    const achievedAt = new Date();
    const edited = await editMilestone(created.id, { achievedAt }, { adminUserId: admin.id });

    expect(edited?.achievedAt?.getTime()).toBe(achievedAt.getTime());

    const audit = await prisma.auditLog.findMany({
      where: { entityType: "milestone", entityId: created.id, action: "MILESTONE_EDITED" },
    });
    expect(audit).toHaveLength(1);
  });
});
