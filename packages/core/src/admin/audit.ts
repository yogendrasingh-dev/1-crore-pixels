// Append-only audit log writer — docs/SECURITY.md §6, docs/DATABASE.md §3.13. Every
// state-changing admin action calls this within its own DB transaction so the action and
// its audit trail can never exist independently of each other (CLAUDE.md §6).
import type { DbClient, Prisma } from "@1crore-pixels/db";

export interface AuditLogInput {
  adminUserId: bigint | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Prisma.InputJsonValue;
  afterState?: Prisma.InputJsonValue;
  ipAddress?: string;
}

export async function writeAuditLog(db: DbClient, input: AuditLogInput): Promise<void> {
  await db.auditLog.create({
    data: {
      adminUserId: input.adminUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeState: input.beforeState,
      afterState: input.afterState,
      ipAddress: input.ipAddress,
    },
  });
}
