// Request-body schemas for `/api/admin/*` — docs/API.md §4, docs/SECURITY.md §5.
// Single source of truth for both compile-time types and runtime validation (CLAUDE.md §5).
import { ContributionStatus } from "@1crore-pixels/db";
import { z } from "zod";

export const adminLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});
export type AdminLoginRequest = z.infer<typeof adminLoginRequestSchema>;

export const adminRejectRequestSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type AdminRejectRequest = z.infer<typeof adminRejectRequestSchema>;

export const adminQueueFiltersSchema = z.object({
  status: z.enum(ContributionStatus).optional(),
  search: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type AdminQueueFilters = z.infer<typeof adminQueueFiltersSchema>;

// `Update.status` and `Milestone.phase` are plain string columns (docs/DATABASE.md §3.10-3.11,
// not Prisma enums), so the closed set of valid values is enforced here via zod instead.
export const updateStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);
export const milestonePhaseSchema = z.enum(["PRE_GOAL", "POST_GOAL"]);

export const adminUpdateCreateSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  imageUrl: z.url().optional(),
  milestoneId: z.uuid().optional(),
  status: updateStatusSchema.default("DRAFT"),
});
export type AdminUpdateCreateRequest = z.infer<typeof adminUpdateCreateSchema>;

export const adminUpdateEditSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).optional(),
  imageUrl: z.url().nullable().optional(),
  milestoneId: z.uuid().nullable().optional(),
  status: updateStatusSchema.optional(),
});
export type AdminUpdateEditRequest = z.infer<typeof adminUpdateEditSchema>;

export const adminMilestoneCreateSchema = z.object({
  label: z.string().min(1).max(200),
  targetAmountRupees: z.number().int().positive().optional(),
  phase: milestonePhaseSchema,
  sortOrder: z.number().int(),
  achievedAt: z.coerce.date().optional(),
});
export type AdminMilestoneCreateRequest = z.infer<typeof adminMilestoneCreateSchema>;

export const adminMilestoneEditSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  targetAmountRupees: z.number().int().positive().nullable().optional(),
  phase: milestonePhaseSchema.optional(),
  sortOrder: z.number().int().optional(),
  achievedAt: z.coerce.date().nullable().optional(),
});
export type AdminMilestoneEditRequest = z.infer<typeof adminMilestoneEditSchema>;

export const adminModerateNameRequestSchema = z
  .object({
    action: z.enum(["HIDE", "REPLACE"]),
    replacementName: z.string().optional(),
  })
  .refine((value) => value.action !== "REPLACE" || !!value.replacementName, {
    message: "replacementName is required when action is REPLACE",
    path: ["replacementName"],
  });
export type AdminModerateNameRequest = z.infer<typeof adminModerateNameRequestSchema>;

export const adminAuditLogFiltersSchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  adminUserId: z.coerce.bigint().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AdminAuditLogFilters = z.infer<typeof adminAuditLogFiltersSchema>;
