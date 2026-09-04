# Open Issues

Genuinely ambiguous items surfaced during implementation that need product/legal/security/deployment input before they can be fully resolved. Not a duplicate of each doc's own "Open Decisions" sections — this file tracks items discovered while executing `docs/TASKS.md`, per `CLAUDE.md` §14 rule 10.

---

## OI-1: `audit_logs` append-only DB-role grant restriction not yet enforceable (T1.9)

`docs/DATABASE.md` §3.13 and `CLAUDE.md` §6 require that the application DB role have no `UPDATE`/`DELETE` grant on `audit_logs`, enforced at the database level. Today's local/dev infra (`docker-compose.yml`) provisions a single Postgres superuser (`postgres`) with no separate, lower-privileged application role — there is no role to `REVOKE` from, and no `docs/DEPLOYMENT.md` section defines what that role should be named or how it's provisioned in staging/production.

**Needs:** a decision (from whoever owns deployment/infra) on the application DB role name and provisioning process, likely as part of `docs/DEPLOYMENT.md` §1–§3 (Phase 11, T11.1). Once that role exists, add a migration with `REVOKE UPDATE, DELETE ON audit_logs FROM <role>;`.

**Current state:** the table is created (T1.9 migration `20260904165001_add_audit_logs`) with application-level discipline only (no code path is written that updates/deletes an audit row) — the DB-level guarantee is deferred, not silently dropped.
