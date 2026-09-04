// Contribution amount validation — docs/SECURITY.md §2. Exact bounds are an unresolved
// product decision (docs/DATABASE.md §9.3) — kept configurable via env so that decision
// doesn't require a code change (docs/TASKS.md T2.8).
import { z } from "zod";

export interface AmountBounds {
  minPaise: bigint;
  maxPaise: bigint;
}

export function getAmountBounds(): AmountBounds {
  return {
    minPaise: BigInt(process.env.CONTRIBUTION_MIN_AMOUNT_PAISE ?? 100),
    maxPaise: BigInt(process.env.CONTRIBUTION_MAX_AMOUNT_PAISE ?? 10_000_000_00),
  };
}

export function rupeesToPaise(amountRupees: number): bigint {
  return BigInt(Math.round(amountRupees * 100));
}

/**
 * Accepts a decimal rupee amount with at most 2 places (docs/SECURITY.md §2) and converts
 * it to integer paise, but requires the result to be a whole number of rupees: ₹1 = 1 pixel,
 * always, exactly (docs/PIXEL_SYSTEM.md §1), so a fractional-rupee contribution would produce
 * a fractional pixel count. Out-of-range/fractional amounts are rejected, never clamped
 * (docs/API.md §2.1).
 */
export function amountRupeesSchema(bounds: AmountBounds = getAmountBounds()) {
  return z
    .number()
    .positive("Amount must be greater than zero")
    .multipleOf(0.01, "Amount may have at most 2 decimal places")
    .transform(rupeesToPaise)
    .refine((paise) => paise % 100n === 0n, {
      message: "Amount must be a whole number of rupees",
    })
    .refine((paise) => paise >= bounds.minPaise, {
      message: `Amount must be at least ₹${bounds.minPaise / 100n}`,
    })
    .refine((paise) => paise <= bounds.maxPaise, {
      message: `Amount must be at most ₹${bounds.maxPaise / 100n}`,
    });
}
