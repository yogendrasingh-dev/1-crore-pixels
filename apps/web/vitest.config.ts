import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // env.ts validates process.env eagerly at import time (docs/DEPLOYMENT.md §3);
    // these placeholders let the module load under test without a real .env.
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/one_crore_pixels",
      REDIS_URL: "redis://localhost:6379",
      UPI_VPA: "campaign@upi",
      UPI_PAYEE_NAME: "1 Crore Pixels",
      ADMIN_SESSION_SECRET: "a".repeat(32),
      MFA_ENCRYPTION_KEY: "b".repeat(32),
      IP_HASH_SALT: "c".repeat(16),
      PIXEL_WALL_WIDTH: "4000",
      PIXEL_CHUNK_ROWS: "25",
    },
  },
});
