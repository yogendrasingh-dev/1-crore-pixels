// Request-body schema for `POST /api/contributions` — docs/API.md §2.1, docs/SECURITY.md §2.
// The single source of truth for both the compile-time request type and its runtime
// validation (CLAUDE.md §5) — route handlers must not hand-write a parallel interface.
import { z } from "zod";
import { amountRupeesSchema } from "../validation/amount";

export const createContributionRequestSchema = z.object({
  displayName: z.string(),
  anonymous: z.boolean().default(false),
  // Wire key is `amountRupees` (docs/API.md §2.1); `amountRupeesSchema()` transforms the
  // parsed value to integer paise, so `CreateContributionRequest.amountRupees` is paise,
  // not rupees — map it to `amountPaise` at the call site (see `createContribution`).
  amountRupees: amountRupeesSchema(),
  referralCode: z.string().optional(),
});

export type CreateContributionRequest = z.infer<typeof createContributionRequestSchema>;
