# Open Issues

Genuinely ambiguous items surfaced during implementation that need product/legal/security/deployment input before they can be fully resolved. Not a duplicate of each doc's own "Open Decisions" sections — this file tracks items discovered while executing `docs/TASKS.md`, per `CLAUDE.md` §14 rule 10.

---

## OI-1: `audit_logs` append-only DB-role grant restriction not yet enforceable (T1.9)

`docs/DATABASE.md` §3.13 and `CLAUDE.md` §6 require that the application DB role have no `UPDATE`/`DELETE` grant on `audit_logs`, enforced at the database level. Today's local/dev infra (`docker-compose.yml`) provisions a single Postgres superuser (`postgres`) with no separate, lower-privileged application role — there is no role to `REVOKE` from, and no `docs/DEPLOYMENT.md` section defines what that role should be named or how it's provisioned in staging/production.

**Needs:** a decision (from whoever owns deployment/infra) on the application DB role name and provisioning process, likely as part of `docs/DEPLOYMENT.md` §1–§3 (Phase 11, T11.1). Once that role exists, add a migration with `REVOKE UPDATE, DELETE ON audit_logs FROM <role>;`.

**Current state:** the table is created (T1.9 migration `20260904165001_add_audit_logs`) with application-level discipline only (no code path is written that updates/deletes an audit row) — the DB-level guarantee is deferred, not silently dropped.

---

## OI-2: Display-name moderation "hold for admin review" has no schema field yet (T4.1, T2.7)

`docs/SECURITY.md` §2 requires that a display name failing automated moderation be "held for admin review rather than silently rejected or silently accepted." `packages/core`'s `moderateDisplayName` (T2.7) already computes an `OK`/`FLAGGED` status, but no table has a moderation-status column to persist "this contribution's name needs admin review before it's shown publicly" — `contributions`/`contributors` schema (Phase 1) has no such field, and the admin moderate-name endpoint (T8.3) doesn't exist until Phase 8.

**Needs:** a product/schema decision on where a flagged name is held — e.g. a `display_name_moderation_status` enum column, or reusing `contribution_status`/an admin queue filter — likely scoped alongside T8.3.

**Current state:** `createContribution` (T4.1, `packages/core/src/contributions/create.ts`) calls `validateDisplayName` for sanitization/character validation (rejecting truly invalid input with `422`) but does **not** block or hold contribution creation on a `FLAGGED` moderation result — the contribution proceeds normally through the payment flow, same as an `OK` name. This means a flagged name is not yet actually held for review anywhere; it is stored as-is and would reach `PUBLISHED` like any other. Never silently rejecting was preserved; the "hold" half of the requirement is not yet implemented.

---

## OI-3: `dotenv-cli` breaks Next.js/Turbopack builds — do not wrap `next` scripts with it

Discovered while validating Phase 4: wrapping `apps/web`'s `build`/`dev`/`start` scripts with `dotenv -e ../../.env -- next ...` (the same pattern `packages/db`/`packages/core` use for their own scripts) causes `next build` to fail prerendering `/_global-error` with `TypeError: Cannot read properties of null (reading 'useContext')`, even on a route-handler-free build. Bisected by toggling only this one change with everything else held constant. Root cause not fully diagnosed (suspected: `dotenv-cli`'s subprocess wrapping interferes with Turbopack's build-worker IPC), but the trigger is unambiguous.

**Resolution applied:** `apps/web/next.config.ts` now loads the monorepo-root `.env` in-process via the `dotenv` package's `config()` call at the top of the config file, instead of wrapping the npm script. `apps/web`'s `dev`/`build`/`start` scripts are plain `next dev`/`next build`/`next start` again. This is not an Open Decision to resolve — it's a known landmine for future contributors: **do not re-introduce `dotenv-cli` around any `next` command in this package.**
