-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('SUPER_ADMIN', 'VERIFIER', 'CONTENT_EDITOR');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" BIGSERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "admin_role" NOT NULL,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret_encrypted" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- AddForeignKey
ALTER TABLE "updates" ADD CONSTRAINT "updates_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_admin_id_fkey" FOREIGN KEY ("verified_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
