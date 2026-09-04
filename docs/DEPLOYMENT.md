# Deployment

**Source of truth:** `docs/PRD.md` §33 (recommended stack), §29 (non-functional requirements), §25 (backups/monitoring). PRD says "Vercel/equivalent + managed backend/database" — this document assumes a Vercel-class host + managed Postgres + managed Redis pattern without mandating a specific vendor, since none is specified in the PRD.

---

## 1. Environments

| Environment | Purpose | Notes |
|---|---|---|
| Local | Development | Local Postgres (Docker) + local Redis (Docker); `ManualUpiProvider` pointed at a sandbox/test VPA where possible |
| Staging | Pre-production verification | Mirrors production config; used to rehearse admin verification flow and, once it exists, gateway webhook integration (Phase 3) before it touches real money |
| Production | Live campaign | Real payment collection account (subject to PRD §27 professional advice) |

---

## 2. Hosting Topology

```text
apps/web  ──────►  Vercel-equivalent (or Node host) — SSR/ISR pages + API routes
                          │
                          ├──► Managed PostgreSQL (primary datastore)
                          ├──► Managed Redis-compatible store (rate limiting; Phase 3: queue)
                          └──► CDN edge (static assets + cached public GET responses)

apps/worker (Phase 3) ──►  Background worker process/service, consuming the same Redis queue
```

Both `apps/web` and, later, `apps/worker` connect to the same PostgreSQL instance and share `packages/db`'s schema — there is one source of truth for contribution/payment/pixel state regardless of which process is reading/writing it.

---

## 3. Secrets & Configuration

Per PRD §25 ("secrets in environment/secret manager," "no secrets in source control"):

- All secrets (DB connection string, Redis connection string, payment provider keys/VPA, webhook signing secret (Phase 3), admin session signing key, MFA encryption key) are injected via the hosting platform's environment variable / secret manager mechanism, never committed.
- `.env.example` (committed) documents required variable names with placeholder values only; `.env` / `.env.local` are gitignored.
- Config values that are not secret but environment-dependent (e.g. wall width constant `W`, chunk size, feature flags for enabling `GatewayProvider`) are also environment-driven, not hardcoded, so staging can validate Phase 3 payment code before it's enabled in production.

---

## 4. Database Migrations

- Managed via Prisma Migrate (`packages/db`); every schema change is a checked-in migration file, reviewed like any other code change.
- Migrations run as a deploy step before the new application version starts serving traffic, so the running code and schema are never mismatched.
- Because `pixel_allocations` and `pixel_cursor` carry correctness-critical constraints (`docs/DATABASE.md` §5), any migration touching those tables requires extra review and a staging dry-run before production — schema changes here are the highest-blast-radius change type in the system.
- Backward-compatible migration practice (additive changes deployed ahead of code that depends on them; destructive changes only after the old code path is fully retired) to support zero-downtime deploys (§7).

---

## 5. Caching Strategy

Per PRD §29 ("CDN/cache-friendly public pages") and `docs/ARCHITECTURE.md` §6:

| Route | Strategy |
|---|---|
| `/` (home), `/story`, `/faq`, `/campaign-information` | Static/ISR with periodic revalidation — content changes only via admin updates, not per-request |
| `GET /api/progress` | Short TTL (`s-maxage=10`, `stale-while-revalidate`) — correct within seconds, but shields the DB from per-visitor load during a spike |
| `GET /api/pixels?chunk=` | Cacheable with a short TTL; invalidated implicitly by TTL expiry rather than active invalidation (a few seconds of staleness on a just-claimed pixel is acceptable and consistent with PRD's non-real-time framing) |
| `GET /api/contributions/{id}` | Not cached — this is the individual user's own status polling and must reflect current server state |
| `/api/admin/*` | Never cached |

This is the primary defense against PRD §34's "traffic spike" edge case for read-heavy public pages — the database only needs to serve the aggregate/chunk queries once per cache TTL window, not once per visitor.

---

## 6. Backups & Restore

Per PRD §25 ("database backups," "tested restore process"):

- Automated, regular (e.g. daily, plus point-in-time recovery if the managed provider supports it) backups of the primary PostgreSQL database.
- A documented, periodically-rehearsed restore drill (restore a backup into a scratch environment and verify the app can boot against it) — an untested backup is not a real backup. Cadence is an Open Decision (§9).
- Backups are treated as containing payment-adjacent audit data and are protected with the same access controls as production secrets.

---

## 7. Release Process

- Standard PR → CI (lint, typecheck, tests — `docs/TESTING.md` §8) → merge → deploy pipeline.
- Zero-downtime deploys: since contributions can be mid-flow (`PAYMENT_PENDING`, `VERIFYING`) at the moment of a deploy, deploys must not drop in-flight requests or leave a contribution stuck in a transient state — favor rolling/blue-green deploys over a hard restart, and ensure any in-progress DB transaction either completes or cleanly rolls back rather than being killed mid-transaction.
- Rollback plan: the previous deployed version must be redeployable quickly if a release introduces a defect in the payment/allocation path in particular, given the correctness stakes described in `docs/PAYMENT.md` and `docs/PIXEL_SYSTEM.md`.

---

## 8. Monitoring & Observability

Per PRD §29 ("structured logging," "error tracking," "payment webhook monitoring," "uptime monitoring"):

- **Structured logging** across `apps/web` (and `apps/worker` in Phase 3), including contribution ID / admin ID in log context for traceability without logging sensitive payment fields.
- **Error tracking** (e.g. Sentry-class tool) capturing unhandled exceptions in both API routes and the pixel-wall rendering client.
- **Uptime monitoring** on the public site and, critically, on `POST /api/payments/webhook` once Phase 3 is live — a silently-down webhook endpoint would mean payments succeed but are never recorded as verified, a severe product failure.
- **Webhook delivery monitoring/alerting** (Phase 3): alert if webhook processing failures or signature-verification failures spike, since this is the automated equivalent of the manual verification queue silently backing up.
- **Admin verification queue depth** as an operational metric even in MVP — a growing backlog of `VERIFYING` contributions is a leading indicator of a process or staffing problem, not just a technical one.

---

## 9. Scaling Path (Phase 3)

Per PRD §29/§33 and `docs/ARCHITECTURE.md` §10:

- Introduce `apps/worker` + Redis-backed queue for async webhook processing once an automated payment gateway is added.
- Consider a read replica for PostgreSQL if pixel-wall/chunk read volume grows enough to compete with the write path (contribution/verification traffic) — not needed at MVP scale given the caching strategy in §5.
- Reconciliation job (`docs/ARCHITECTURE.md` §6) to periodically recompute `campaign_totals` from source tables as a consistency check against the transactional update path — a safety net, not the primary write path.

---

## 10. Open Decisions

1. Specific hosting vendor selection (Vercel vs. alternative; managed Postgres provider; managed Redis provider) — PRD says "equivalent," no vendor mandated.
2. Backup cadence and restore-drill frequency — not specified in PRD; propose as part of Phase 1 operational setup.
3. Whether staging uses a real (sandboxed) payment provider integration or a fully mocked `PaymentProvider` — depends on what the eventual gateway's sandbox offering supports (PRD §36.8, payment provider selection is itself an open decision).
