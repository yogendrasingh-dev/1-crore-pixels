// Admin password hashing + credential check — docs/SECURITY.md §5. Passwords are hashed
// with bcrypt, never stored plaintext or reversibly encrypted.
import bcrypt from "bcryptjs";
import { prisma, type AdminUser, type PrismaClient } from "@1crore-pixels/db";
import { writeAuditLog } from "./audit";
import { decryptTotpSecret, verifyTotpCode } from "./mfa";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export type AdminAuthResult =
  | { outcome: "OK"; admin: AdminUser }
  | { outcome: "INVALID_CREDENTIALS" }
  | { outcome: "ACCOUNT_DISABLED" }
  | { outcome: "MFA_REQUIRED" }
  | { outcome: "MFA_INVALID" };

/**
 * Checks credentials and, if `mfa_enabled`, the TOTP code, then records `last_login_at`.
 * Never distinguishes "unknown email" from "wrong password" in its result to avoid
 * account enumeration (docs/SECURITY.md §5).
 */
export async function authenticateAdmin(
  email: string,
  password: string,
  mfaCode: string | undefined,
  ipAddress: string | undefined,
  db: PrismaClient = prisma,
): Promise<AdminAuthResult> {
  const admin = await db.adminUser.findUnique({ where: { email } });
  if (!admin) {
    await bcrypt.hash(password, BCRYPT_ROUNDS);
    return { outcome: "INVALID_CREDENTIALS" };
  }

  const passwordOk = await verifyPassword(password, admin.passwordHash);
  if (!passwordOk) return { outcome: "INVALID_CREDENTIALS" };

  if (admin.status !== "ACTIVE") return { outcome: "ACCOUNT_DISABLED" };

  if (admin.mfaEnabled) {
    if (!mfaCode) return { outcome: "MFA_REQUIRED" };
    if (!admin.mfaSecretEncrypted) return { outcome: "MFA_INVALID" };
    const secret = decryptTotpSecret(admin.mfaSecretEncrypted);
    if (!verifyTotpCode(secret, mfaCode)) return { outcome: "MFA_INVALID" };
  }

  const updated = await db.$transaction(async (tx) => {
    const withLogin = await tx.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    await writeAuditLog(tx, {
      adminUserId: admin.id,
      action: "ADMIN_LOGIN",
      entityType: "admin_user",
      entityId: String(admin.id),
      ipAddress,
    });
    return withLogin;
  });
  return { outcome: "OK", admin: updated };
}
