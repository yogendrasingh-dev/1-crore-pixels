import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptTotpSecret, encryptTotpSecret, generateTotpSecret, verifyTotpCode } from "./mfa";

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

/** Independent RFC 6238 reference implementation, to cross-check `verifyTotpCode`. */
function referenceTotp(secretBase32: string, atMillis: number): string {
  const counter = Math.floor(atMillis / 1000 / 30);
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

describe("MFA scaffolding (docs/SECURITY.md §5)", () => {
  it("round-trips an encrypted TOTP secret", () => {
    const secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptTotpSecret(encrypted)).toBe(secret);
  });

  it("accepts the code for the current time step and rejects an incorrect one", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const validCode = referenceTotp(secret, now);

    expect(verifyTotpCode(secret, validCode, now)).toBe(true);

    const wrongCode = validCode === "000001" ? "000002" : "000001";
    expect(verifyTotpCode(secret, wrongCode, now)).toBe(false);
  });

  it("tolerates one time-step of clock skew", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const nextStepCode = referenceTotp(secret, now + 30_000);

    expect(verifyTotpCode(secret, nextStepCode, now)).toBe(true);
  });

  it("rejects a malformed encrypted secret", () => {
    expect(() => decryptTotpSecret("not-a-valid-payload")).toThrow();
  });
});
