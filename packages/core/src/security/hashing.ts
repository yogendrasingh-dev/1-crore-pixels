// Salted hashing for privacy-sensitive fraud/rate-limit signals — docs/DATABASE.md §7,
// CLAUDE.md §10 ("IP address and user agent are stored only as salted hashes"). Never
// store or return the raw value; the salt makes the hash infeasible to reverse/rainbow-table.
import { createHash } from "node:crypto";

function getSalt(): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) {
    throw new Error("IP_HASH_SALT must be configured to hash IP/user-agent values");
  }
  return salt;
}

function saltedHash(domain: string, value: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${domain}:${value}`).digest("hex");
}

export function hashIp(ip: string, salt: string = getSalt()): string {
  return saltedHash("ip", ip, salt);
}

export function hashUserAgent(userAgent: string, salt: string = getSalt()): string {
  return saltedHash("ua", userAgent, salt);
}
