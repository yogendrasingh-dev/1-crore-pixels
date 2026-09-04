import { z } from "zod";

// Validated once at process boot via src/instrumentation.ts — docs/DEPLOYMENT.md §3.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PAYMENT_PROVIDER: z.enum(["manual", "gateway"]).default("manual"),
  UPI_VPA: z.string().min(1),
  UPI_PAYEE_NAME: z.string().min(1),
  PAYMENT_WEBHOOK_SIGNING_SECRET: z.string().optional(),
  ADMIN_SESSION_SECRET: z.string().min(32),
  MFA_ENCRYPTION_KEY: z.string().min(32),
  PIXEL_WALL_WIDTH: z.coerce.number().int().positive(),
  PIXEL_CHUNK_ROWS: z.coerce.number().int().positive(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}

export const env: Env = loadEnv();
