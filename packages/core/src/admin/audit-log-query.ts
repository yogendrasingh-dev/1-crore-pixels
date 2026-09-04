// GET /api/admin/audit-logs — docs/API.md §4, PRD §22 Audit. SUPER_ADMIN-only; audit_logs is
// append-only, so this is a pure read (`audit_logs` never mutated/deleted, CLAUDE.md §6).
import { Prisma, prisma, type AuditLog, type PrismaClient } from "@1crore-pixels/db";
import type { AdminAuditLogFilters } from "./schema";

export async function listAuditLogs(filters: AdminAuditLogFilters, db: PrismaClient = prisma): Promise<AuditLog[]> {
  const where: Prisma.AuditLogWhereInput = {
    entityType: filters.entityType,
    entityId: filters.entityId,
    adminUserId: filters.adminUserId,
  };

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  return db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filters.limit,
  });
}
