import { Prisma, PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

// Single connection pool shared across hot-reloads in dev — docs/ARCHITECTURE.md §3.
export const prisma = globalThis.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export { Prisma, PrismaClient } from "@prisma/client";
export type {
  Contribution,
  ContributionStatus,
  Contributor,
  Payment,
  PaymentStatus,
  PixelAllocation,
} from "@prisma/client";

// A DB client that can run queries — either the top-level PrismaClient or an
// interactive-transaction callback's `tx` — so packages/core can compose its own
// conditional updates into a caller's transaction (docs/PIXEL_SYSTEM.md §2.3).
export type DbClient = Prisma.TransactionClient;
