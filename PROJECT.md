# PROJECT.md — 1 Crore Pixels (Complete Project Overview)

> Yeh file poore project ka ek single-page map hai — kaunsa folder/file kya karta hai, kaise sab connect hota hai. Product/engineering ka **detailed** spec `docs/*.md` mein hai; process/rules `CLAUDE.md` mein hain. Yeh file sirf **navigation + orientation** ke liye hai.

---

## 1. Project kya hai (one-liner)

Public pixel-wall website jahan ₹1 contribution = 1 pixel, ₹1 crore ke campaign goal ki taraf. Koi login/signup nahi. Visitor naam(ya Anonymous) + amount dalta hai, UPI se pay karta hai, transaction ke last 4 digits submit karta hai (assisted signal), aur **server-side verification ke baad hi** pixels milte hain.

Full detail: `docs/PRD.md`.

---

## 2. Repo type & tooling

- **pnpm monorepo** (workspaces: `apps/*`, `packages/*`), Node >=22, pnpm >=11.
- Framework: **Next.js 16** (App Router) + **React 19** + **TypeScript (strict)**.
- DB: **PostgreSQL via Prisma**.
- Cache/rate-limit: **Redis** (`ioredis`).
- Validation: **Zod**.
- Tests: **Vitest** (per-package `vitest.config.ts`).
- Lint/format: shared **ESLint + Prettier** config from `packages/config`.
- Root scripts (`package.json`): `dev`, `build`, `typecheck`, `lint`, `lint:fix`, `format`, `test`, `db:generate`, `db:migrate`.

---

## 3. Top-level folder structure

```
1-crore-pixels/
├── apps/
│   └── web/                 # Only deployable app (Next.js): public site + admin UI + API routes
├── packages/
│   ├── core/                # Business logic: state machine, pixel allocation, validation, admin logic
│   ├── db/                  # Prisma schema, migrations, query layer
│   ├── payment-providers/   # PaymentProvider abstraction (ManualUpi today, Gateway = Phase 3 stub)
│   ├── ui/                  # Shared UI components (currently minimal, e.g. Button)
│   └── config/              # Shared eslint/tsconfig/prettier config, consumed by every package
├── docs/                    # Source-of-truth documentation (PRD, architecture, API, etc.)
├── .github/workflows/       # CI pipeline
├── docker-compose.yml       # Local Postgres/Redis for dev
├── CLAUDE.md                # Process rules for AI-assisted development in this repo
└── PROJECT.md                # ← this file
```

`apps/worker` is **Phase 3 only** and does not exist yet (per `docs/ARCHITECTURE.md`).

---

## 4. `docs/` — source of truth (read in this order of authority)

| File | Kya define karta hai |
|---|---|
| `docs/PRD.md` | Product requirements — the "what/why". Ultimate authority. |
| `docs/ARCHITECTURE.md` | System design — how pieces fit (monorepo layout, provider abstraction, etc.) |
| `docs/DATABASE.md` | Prisma schema rationale, money-as-paise rule, retention rules |
| `docs/API.md` | Every endpoint's request/response contract, public response allowlists |
| `docs/PAYMENT.md` | Payment state machine, verification flow, provider interface |
| `docs/PIXEL_SYSTEM.md` | Pixel allocation algorithm, wall geometry (4000 cols, 100k/chunk), rendering |
| `docs/SECURITY.md` | Auth, rate-limiting, privacy controls, hashing rules |
| `docs/TESTING.md` | What must be tested, concurrency test requirements, edge-case checklist |
| `docs/DEPLOYMENT.md` | Environments, secrets, release/migration process |
| `docs/TASKS.md` | Phased task backlog — current build progress lives here |
| `docs/OPEN_ISSUES.md` | Ambiguous/unresolved decisions logged instead of guessed |

Recent commits show phases completed: Phase 5 (Admin Auth) → Phase 6 (Homepage/Contribution UI) → Phase 7 (Contributors/Pixel Wall) → Phase 8 (Admin Content Mgmt) → Phase 9 (Viral/Referral Layer).

---

## 5. `packages/db` — Database layer

- `prisma/schema.prisma` — single source of DB schema. Key models:
  - **`Contributor`** — contributor profile (display name, badges).
  - **`Contribution`** — one contribution request; drives the state machine (`ContributionStatus` enum: created → verifying → paid → pixels_assigned → published / rejected, etc. — exact transitions in `docs/PAYMENT.md`).
  - **`Payment`** — payment attempt tied to a contribution (`PaymentStatus` enum).
  - **`PixelAllocation`** — the *only* record of pixel ownership. No physical `pixels` table — ownership derived via range-containment queries on `pixel_range` (Postgres GiST exclusion constraint prevents overlap).
  - **`PixelCursor`** — single-row cursor advanced atomically to hand out the next pixel range.
  - **`CampaignTotals`** — single-row cache of aggregate totals (raised amount, pixels used), updated transactionally — never recomputed by summing on request.
  - **`AdminUser`** (+ `AdminRole` enum), **`AuditLog`** (append-only, no UPDATE/DELETE), **`PaymentWebhookEvent`** (Phase 3 placeholder).
  - **`Referral`**, **`ReferralEvent`** (+ `ReferralEventType` enum) — viral/referral tracking.
  - **`Badge`**, **`ContributorBadge`** — gamification badges.
  - **`Milestone`**, **`Update`** — admin-managed content shown publicly (progress milestones, campaign updates).
- `prisma/migrations/` — one migration per schema evolution step (contributions → payments → pixel allocations → cursor/totals → referrals → badges → updates/milestones → admin users → audit logs → webhook events).
- `src/index.ts` — exported Prisma client / query helpers.
- `src/pixel-allocations.test.ts` — tests for the range-containment queries.

**Rule of thumb:** raw SQL only for the pixel-cursor `UPDATE...RETURNING` and range queries; everything else goes through Prisma.

---

## 6. `packages/core` — Business logic (the "brain")

Organized by domain, each with an `index.ts` barrel export:

- **`state-machine/`** — the contribution status transition graph + guards. Highest-risk code in the repo.
- **`contributions/`** — `create.ts` (new contribution), `submit-utr.ts` (UTR signal → `VERIFYING`, never → `PAID`), `qr.ts` (UPI QR generation), `schema.ts` (Zod schemas = single source of truth for types + validation).
- **`pixel/`** — `allocation.ts` (the one atomic allocation transaction), `geometry.ts` (index → row/col → chunkId, pure & deterministic), `concurrency.test.ts` (race-condition tests — required, not optional).
- **`campaign/`** — `goal.ts` — ₹1 crore goal / progress math.
- **`referrals/`** — `attribution.ts`, `leaderboard.ts` — referral-code tracking and ranking.
- **`admin/`** — `auth.ts`/`mfa.ts` (admin login + MFA), `rbac.ts` (role checks), `actions.ts`, `moderation.ts` (name moderation), `content.ts` (milestones/updates CRUD), `dashboard.ts`, `audit.ts`/`audit-log-query.ts`, `queue.ts` (verification queue).
- **`security/`** — `hashing.ts` — salted hashing helpers (IP, user-agent, UTR — never stored plaintext).
- **`validation/`** — `amount.ts`, `display-name.ts` — shared input validators.
- **`test-support/fixtures.ts`** — shared test fixtures.

**Rule:** `apps/web` route handlers call into this package; business logic never lives in a route handler.

---

## 7. `packages/payment-providers` — Payment abstraction

- `types.ts` — the single `PaymentProvider` interface that `core`/`apps/web` depend on.
- `manual-upi/index.ts` — **MVP provider**: static UPI QR + manual UTR-based verification (current implementation).
- `gateway/index.ts` — **Phase 3 stub only** — do not wire to a live gateway yet (per `CLAUDE.md` §7).
- Swapping providers = config/DI change, never a rewrite of calling code.

---

## 8. `packages/ui` & `packages/config`

- `ui/` — shared React components (currently `Button.tsx`); grows as more shared UI is extracted.
- `config/` — shared `eslint/base.js`, `prettier.config.js`, `tsconfig/{base,nextjs,react-library}.json`. Every package's own `eslint.config.js`/`tsconfig.json` extends these instead of redefining rules.

---

## 9. `apps/web` — The Next.js app

### 9.1 Route groups (`src/app/`)

- **`(public)/`** — public-facing pages, no auth:
  - `page.tsx` — homepage (assembles `Hero`, `LiveProgressSection`, `StorySection`, pixel wall preview, etc.)
  - `layout.tsx` — public layout wrapping `SiteHeader`/`SiteFooter`
  - `contribute/` — the contribution flow: `ContributionFlow.tsx` orchestrates steps — `NameStep` → `AmountStep` → `QrStep` → `UtrStep` → `WaitingStep` → `SuccessStep`/`TerminalStep` (`types.ts` defines the flow's shared types)
  - `pixel-wall/` — `PixelWallExplorer.tsx` + `_components/pixel-wall/` (canvas renderer `PixelWallCanvas.tsx`, `geometry.ts`, `usePixelChunks.ts` chunked fetching — never one DOM node per pixel)
  - `contributors/`, `leaderboard/`, `progress/`, `updates/` — public listing pages backed by their matching API routes
  - `r/[code]/` — referral landing page (`ReferralLanding.tsx`) — logs referral visits
  - `campaign-information/`, `contact/`, `faq/`, `story/` — static/content pages
  - `_components/` — shared building blocks: `Hero`, `LiveProgressSection`, `ScrollReveal`, `SiteHeader`, `SiteFooter`, `useCountUp.ts`, `useProgress.ts`, `StorySection`, `PixelWallPreview`
- **`(admin)/admin/`** — authenticated admin UI (RBAC-checked server-side):
  - `page.tsx` — admin dashboard
  - `moderation/` — `ModerationAdmin.tsx` — verify/reject contributions, moderate display names
  - `milestones/`, `updates/` — content management UIs
  - `audit-logs/` — `AuditLogsViewer.tsx` — read-only audit trail viewer
  - `_lib/admin-fetch.ts` — authenticated fetch helper for admin API calls
- **`api/`** — route handlers (thin — parse/validate → call `packages/core`/`packages/db` → shape response). Each has a co-located `route.test.ts`:
  - Public: `contributions/` (create, get, `utr` submit, `qr`), `contributors/`, `leaderboard/`, `milestones/`, `updates/`, `progress/`, `pixels/` (+ `[pixelId]`), `referrals/[code]` (+ `visit`)
  - Admin (`api/admin/`): `auth/login`, `auth/logout`, `contributions` (list/get/`verify`/`reject`/`moderate-name`), `dashboard`, `milestones`, `updates`, `audit-logs`

### 9.2 `src/lib/` — app-level infrastructure helpers

- `admin-auth.ts`, `admin-session.ts` — admin session/cookie handling
- `api-response.ts` — standard response shaping (enforces public allowlists)
- `payment-provider.ts` — wires the configured `PaymentProvider` into the app (DI point)
- `rate-limit.ts`, `redis.ts` — Redis-backed rate limiting for high-risk endpoints
- `request-context.ts` — per-request context (e.g. IP/UA hashing inputs)
- `format.ts` — display formatting helpers (money, dates)
- `env.ts` (+ `env.test.ts`) — validated environment variable access
- `test-support.ts` — shared test utilities for route tests

### 9.3 Config files

- `next.config.ts`, `eslint.config.js`, `tsconfig.json`, `vitest.config.ts` — all extend `packages/config`.
- `AGENTS.md` / `CLAUDE.md` (inside `apps/web`) — app-scoped agent instructions, if any override/add to root `CLAUDE.md`.

---

## 10. Request flow example (contribution → pixels)

1. Visitor hits `(public)/contribute` → `ContributionFlow.tsx` steps through name/amount.
2. `POST /api/contributions` (route handler) → validates via Zod schema in `packages/core/src/contributions/schema.ts` → calls `packages/core/src/contributions/create.ts` → `packages/db` inserts `Contribution` + `Payment` rows.
3. `QrStep` calls `GET /api/contributions/{id}/qr` → `packages/core/src/contributions/qr.ts` generates UPI QR via the active `PaymentProvider`.
4. User pays externally, then `UtrStep` calls `POST /api/contributions/{id}/utr` → `submit-utr.ts` records the last-4-digit signal, moves status to `VERIFYING` only (never further).
5. Admin reviews in `(admin)/admin/moderation` → `POST /api/admin/contributions/{id}/verify` → `packages/core/src/admin/actions.ts` runs the conditional `VERIFYING → PAID` update, then the single atomic transaction in `packages/core/src/pixel/allocation.ts`: cursor reservation → `PixelAllocation` insert → `CampaignTotals` update → publish.
6. Public pixel wall (`pixel-wall/PixelWallExplorer.tsx`) fetches chunks via `GET /api/pixels` and renders them on canvas.

---

## 11. Where to look for X

| Kaam | Kahan dekhein |
|---|---|
| Pixel wall rendering/geometry change | `packages/core/src/pixel/geometry.ts`, `apps/web/.../_components/pixel-wall/` |
| Payment verification logic | `packages/core/src/admin/actions.ts`, `packages/payment-providers/`, `docs/PAYMENT.md` |
| New public API field | `docs/API.md` first, then `apps/web/src/app/api/**/route.ts` + `src/lib/api-response.ts` |
| DB schema change | `packages/db/prisma/schema.prisma` + new migration, `docs/DATABASE.md` |
| Admin permission rule | `packages/core/src/admin/rbac.ts` |
| Referral/viral logic | `packages/core/src/referrals/`, `apps/web/.../r/[code]/` |
| Rate limiting | `apps/web/src/lib/rate-limit.ts`, `docs/SECURITY.md` §3 |
| Current task backlog / progress | `docs/TASKS.md` |
| Unresolved ambiguous decisions | `docs/OPEN_ISSUES.md` |

---

## 12. Rules snapshot (see `CLAUDE.md` for full detail)

- ₹1 = 1 pixel, always. No physical `pixels` table.
- Money is always integer paise in domain/DB code.
- No signup/login for contributors; no phone/email/UPI ID ever collected.
- Full UTR/IP/user-agent stored only as salted hashes, never plaintext.
- Payment state changes only via server-side conditional `UPDATE...WHERE status=...RETURNING`.
- `POST /api/contributions/{id}/utr` can never directly reach `PAID`.
- Never commit/push/deploy without explicit user request.
