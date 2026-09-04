// Admin content management for updates + milestones — docs/API.md §4, PRD §17-§18.
// Every state-changing call writes its audit_logs row in the same transaction (CLAUDE.md §6).
import { prisma, type Milestone, type PrismaClient, type Update } from "@1crore-pixels/db";
import type {
  AdminMilestoneCreateRequest,
  AdminMilestoneEditRequest,
  AdminUpdateCreateRequest,
  AdminUpdateEditRequest,
} from "./schema";
import { writeAuditLog } from "./audit";
import type { AdminActor } from "./actions";

export async function createUpdate(
  input: AdminUpdateCreateRequest,
  actor: AdminActor,
  db: PrismaClient = prisma,
): Promise<Update> {
  return db.$transaction(async (tx) => {
    const update = await tx.update.create({
      data: {
        title: input.title,
        body: input.body,
        imageUrl: input.imageUrl,
        milestoneId: input.milestoneId,
        status: input.status,
        createdByAdminId: actor.adminUserId,
        publishedAt: input.status === "PUBLISHED" ? new Date() : null,
      },
    });

    await writeAuditLog(tx, {
      adminUserId: actor.adminUserId,
      action: "UPDATE_CREATED",
      entityType: "update",
      entityId: update.id,
      afterState: { title: update.title, status: update.status },
      ipAddress: actor.ipAddress,
    });

    return update;
  });
}

export async function editUpdate(
  id: string,
  input: AdminUpdateEditRequest,
  actor: AdminActor,
  db: PrismaClient = prisma,
): Promise<Update | null> {
  return db.$transaction(async (tx) => {
    const existing = await tx.update.findUnique({ where: { id } });
    if (!existing) return null;

    const publishing = input.status === "PUBLISHED" && existing.status !== "PUBLISHED";
    const updated = await tx.update.update({
      where: { id },
      data: {
        title: input.title,
        body: input.body,
        imageUrl: input.imageUrl,
        milestoneId: input.milestoneId,
        status: input.status,
        publishedAt: publishing ? new Date() : undefined,
      },
    });

    await writeAuditLog(tx, {
      adminUserId: actor.adminUserId,
      action: "UPDATE_EDITED",
      entityType: "update",
      entityId: updated.id,
      beforeState: { title: existing.title, status: existing.status },
      afterState: { title: updated.title, status: updated.status },
      ipAddress: actor.ipAddress,
    });

    return updated;
  });
}

function rupeesToPaise(rupees: number): bigint {
  return BigInt(rupees) * 100n;
}

export async function createMilestone(
  input: AdminMilestoneCreateRequest,
  actor: AdminActor,
  db: PrismaClient = prisma,
): Promise<Milestone> {
  return db.$transaction(async (tx) => {
    const milestone = await tx.milestone.create({
      data: {
        label: input.label,
        targetAmountPaise: input.targetAmountRupees !== undefined ? rupeesToPaise(input.targetAmountRupees) : null,
        phase: input.phase,
        sortOrder: input.sortOrder,
        achievedAt: input.achievedAt,
      },
    });

    await writeAuditLog(tx, {
      adminUserId: actor.adminUserId,
      action: "MILESTONE_CREATED",
      entityType: "milestone",
      entityId: milestone.id,
      afterState: { label: milestone.label, phase: milestone.phase },
      ipAddress: actor.ipAddress,
    });

    return milestone;
  });
}

export async function editMilestone(
  id: string,
  input: AdminMilestoneEditRequest,
  actor: AdminActor,
  db: PrismaClient = prisma,
): Promise<Milestone | null> {
  return db.$transaction(async (tx) => {
    const existing = await tx.milestone.findUnique({ where: { id } });
    if (!existing) return null;

    const updated = await tx.milestone.update({
      where: { id },
      data: {
        label: input.label,
        targetAmountPaise:
          input.targetAmountRupees === undefined
            ? undefined
            : input.targetAmountRupees === null
              ? null
              : rupeesToPaise(input.targetAmountRupees),
        phase: input.phase,
        sortOrder: input.sortOrder,
        achievedAt: input.achievedAt,
      },
    });

    await writeAuditLog(tx, {
      adminUserId: actor.adminUserId,
      action: "MILESTONE_EDITED",
      entityType: "milestone",
      entityId: updated.id,
      beforeState: { label: existing.label, phase: existing.phase, achievedAt: existing.achievedAt },
      afterState: { label: updated.label, phase: updated.phase, achievedAt: updated.achievedAt },
      ipAddress: actor.ipAddress,
    });

    return updated;
  });
}
