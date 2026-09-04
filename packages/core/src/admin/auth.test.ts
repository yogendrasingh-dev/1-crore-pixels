import { createHmac } from "node:crypto";
import { prisma, type AdminUser } from "@1crore-pixels/db";
import { afterEach, describe, expect, it } from "vitest";
import { createTestAdmin, deleteTestAdmin } from "../test-support/fixtures";
import { authenticateAdmin, hashPassword } from "./auth";
import { encryptTotpSecret, generateTotpSecret } from "./mfa";

const PASSWORD = "Sup3r-Secret-Password!";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(encoded: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of encoded.toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Independent RFC 6238 reference implementation, to cross-check `authenticateAdmin`'s MFA check. */
function referenceTotp(secretBase32: string): string {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const key = base32Decode(secretBase32);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (binary % 1_000_000).toString().padStart(6, "0");
}

describe("authenticateAdmin (docs/SECURITY.md §5)", () => {
  let admin: AdminUser | undefined;

  afterEach(async () => {
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
  });

  it("returns OK and records lastLoginAt + an audit row on correct credentials", async () => {
    admin = await createTestAdmin({ role: "VERIFIER" });

    const result = await authenticateAdmin(admin.email, PASSWORD, undefined, "203.0.113.1");

    expect(result.outcome).toBe("OK");
    if (result.outcome === "OK") {
      expect(result.admin.lastLoginAt).not.toBeNull();
    }

    const auditRows = await prisma.auditLog.findMany({ where: { adminUserId: admin.id, action: "ADMIN_LOGIN" } });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.ipAddress).toBe("203.0.113.1");
  });

  it("rejects a wrong password without revealing which part was wrong", async () => {
    admin = await createTestAdmin({ role: "VERIFIER" });

    const result = await authenticateAdmin(admin.email, "wrong-password", undefined, undefined);

    expect(result.outcome).toBe("INVALID_CREDENTIALS");
  });

  it("rejects an unknown email with the same outcome as a wrong password", async () => {
    const result = await authenticateAdmin("no-such-admin@test.local", PASSWORD, undefined, undefined);
    expect(result.outcome).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a disabled account", async () => {
    admin = await createTestAdmin({ role: "VERIFIER", status: "DISABLED" });

    const result = await authenticateAdmin(admin.email, PASSWORD, undefined, undefined);

    expect(result.outcome).toBe("ACCOUNT_DISABLED");
  });

  it("requires an MFA code when mfa_enabled and validates it via TOTP", async () => {
    const secret = generateTotpSecret();
    admin = await createTestAdmin({ role: "VERIFIER", mfaEnabled: true, mfaSecretEncrypted: encryptTotpSecret(secret) });

    const withoutCode = await authenticateAdmin(admin.email, PASSWORD, undefined, undefined);
    expect(withoutCode.outcome).toBe("MFA_REQUIRED");

    const correctCode = referenceTotp(secret);
    const wrongCode = correctCode === "000000" ? "000001" : "000000";
    const withWrongCode = await authenticateAdmin(admin.email, PASSWORD, wrongCode, undefined);
    expect(withWrongCode.outcome).toBe("MFA_INVALID");

    const withCorrectCode = await authenticateAdmin(admin.email, PASSWORD, correctCode, undefined);
    expect(withCorrectCode.outcome).toBe("OK");
  });
});

describe("hashPassword", () => {
  it("never stores the plaintext password", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash).not.toBe(PASSWORD);
    expect(hash.length).toBeGreaterThan(20);
  });
});
