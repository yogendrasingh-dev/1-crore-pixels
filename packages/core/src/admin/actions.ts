// Admin-triggered state transitions with their audit trail — docs/API.md §4,
// docs/SECURITY.md §6. `adminVerifyContribution` is a thin pass-through since
// `verifyAndAllocatePixels` already writes its own audit row inside its single
// transaction (packages/core/src/pixel/allocation.ts); `adminRejectContribution` wraps
// the plain conditional update in a transaction here because rejection has no other
// transactional home.
import { prisma, type Contribution, type PrismaClient } from "@1crore-pixels/db";
import { verifyAndAllocatePixels, type PixelAllocationResult } from "../pixel/allocation";
import { recordReferralConversion } from "../referrals/attribution";
import { rejectVerification } from "../state-machine/index";
import { writeAuditLog } from "./audit";

export interface AdminActor {
  adminUserId: bigint;
  ipAddress?: string;
}

export async function adminVerifyContribution(
  contributionId: bigint,
  actor: AdminActor,
  db: PrismaClient = prisma,
): Promise<PixelAllocationResult | null> {
  const result = await verifyAndAllocatePixels(contributionId, db, actor);
  // Best-effort, post-commit referral attribution (docs/PIXEL_SYSTEM.md §2.3, T9.4) —
  // only reached once per contribution, since a raced/duplicate verify returns null above.
  if (result) await recordReferralConversion(result.contribution, db);
  return result;
}

export async function adminRejectContribution(
  contributionId: bigint,
  reason: string,
  actor: AdminActor,
  db: PrismaClient = prisma,
): Promise<Contribution | null> {
  return db.$transaction(async (tx) => {
    const rejected = await rejectVerification(contributionId, reason, tx);
    if (!rejected) return null;

    await writeAuditLog(tx, {
      adminUserId: actor.adminUserId,
      action: "REJECT_CONTRIBUTION",
      entityType: "contribution",
      entityId: String(contributionId),
      afterState: { status: rejected.status, rejectionReason: reason },
      ipAddress: actor.ipAddress,
    });

    return rejected;
  });
}
