import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const validEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/one_crore_pixels",
  REDIS_URL: "redis://localhost:6379",
  UPI_VPA: "campaign@upi",
  UPI_PAYEE_NAME: "1 Crore Pixels",
  ADMIN_SESSION_SECRET: "a".repeat(32),
  MFA_ENCRYPTION_KEY: "b".repeat(32),
  IP_HASH_SALT: "c".repeat(16),
  PIXEL_WALL_WIDTH: "4000",
  PIXEL_CHUNK_ROWS: "25",
};

describe("env validation", () => {
  it("parses a complete, valid environment", () => {
    const result = loadEnv(validEnv);
    expect(result.PIXEL_WALL_WIDTH).toBe(4000);
    expect(result.PAYMENT_PROVIDER).toBe("manual");
  });

  it("rejects a missing required variable", () => {
    const { DATABASE_URL: _DATABASE_URL, ...rest } = validEnv;
    expect(() => loadEnv(rest)).toThrow();
  });

  it("rejects an admin secret shorter than 32 characters", () => {
    expect(() => loadEnv({ ...validEnv, ADMIN_SESSION_SECRET: "too-short" })).toThrow();
  });
});
