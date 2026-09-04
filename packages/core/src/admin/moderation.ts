// Display-name moderation on a contribution — docs/API.md §4, PRD §9.1, §16. Overwrites the
// stored `display_name` snapshot only; the contributor's own record (used for referrals/
// leaderboards) is untouched, matching the endpoint's per-contribution scope.
import { prisma, type Contribution, type PrismaClient } from "@1crore-pixels/db";
import { displayNameSchema } from "../validation/display-name";
import type { AdminModerateNameRequest } from "./schema";
import { writeAuditLog } from "./audit";
import type { AdminActor } from "./actions";

export async function moderateContributionDisplayName(
  contributionId: bigint,
  input: AdminModerateNameRequest,
  actor: AdminActor,
  db: PrismaClient = prisma,
): Promise<Contribution | null> {
  const newDisplayName = input.action === "HIDE" ? "Anonymous" : displayNameSchema.parse(input.replacementName!);

  return db.$transaction(async (tx) => {
    const existing = await tx.contribution.findUnique({ where: { id: contributionId } });
    if (!existing) return null;

    const updated = await tx.contribution.update({
      where: { id: contributionId },
      data: { displayName: newDisplayName },
    });

    await writeAuditLog(tx, {
      adminUserId: actor.adminUserId,
      action: "DISPLAY_NAME_MODERATED",
      entityType: "contribution",
      entityId: String(contributionId),
      beforeState: { displayName: existing.displayName },
      afterState: { displayName: updated.displayName, moderationAction: input.action },
      ipAddress: actor.ipAddress,
    });

    return updated;
  });
}
