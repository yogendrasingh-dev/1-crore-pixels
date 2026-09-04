-- CreateTable
-- docs/DATABASE.md §3.13, CLAUDE.md §6: append-only. The REVOKE UPDATE/DELETE grant
-- on the application DB role is deferred until that role is provisioned (docs/OPEN_ISSUES.md)
-- — local/deployment infra today has a single Postgres superuser (docker-compose.yml).
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "admin_user_id" BIGINT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
