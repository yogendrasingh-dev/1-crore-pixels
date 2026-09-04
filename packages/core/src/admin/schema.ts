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
