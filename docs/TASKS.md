# Development Tasks

**Source of truth:** `docs/PRD.md` §37 (recommended development order), §32 (MVP release plan), and all other `docs/*.md` files, which this task list implements. Each task is scoped to be independently executable (roughly one PR). Tasks within a phase are mostly parallelizable unless a dependency is noted; phases are mostly sequential.

No application feature described here should be implemented before its governing doc section is read. Each task lists the doc section(s) that define it.

Legend: `[ ]` not started · task IDs are stable identifiers for tracking, not a priority order beyond phase sequence.

---

## Phase 0 — Foundation

Goal: a working, empty monorepo with tooling, schema, and CI in place. No product features yet.

- [x] **T0.1** Initialize pnpm monorepo structure (`apps/web`, `packages/core`, `packages/db`, `packages/payment-providers`, `packages/ui`, `packages/config`) per `docs/ARCHITECTURE.md` §3.
- [x] **T0.2** Set up shared TypeScript/ESLint/Prettier config in `packages/config`, consumed by all other packages.
- [x] **T0.3** Scaffold `apps/web` as a Next.js + TypeScript app with the route groups implied by `docs/PRD.md` §7 (public pages, contribution flow, admin route group).
- [x] **T0.4** Set up CI pipeline: lint, typecheck, build on every PR (`docs/TESTING.md` §8). No tests yet — added as they exist.
- [x] **T0.5** Provision local dev Postgres + Redis via Docker Compose; document setup in a root README.
- [x] **T0.6** Set up `packages/db` with Prisma, pointed at local Postgres; verify `prisma migrate` works end-to-end with an empty schema.
- [x] **T0.7** Create `.env.example` documenting all required environment variables per `docs/DEPLOYMENT.md` §3 (values as placeholders only).

---

## Phase 1 — Data Layer

Goal: the full schema from `docs/DATABASE.md` exists, migrated, and typed — no API or UI yet.

- [x] **T1.1** Define Prisma schema for `contributions` + `contributors` (`docs/DATABASE.md` §3.1–3.2), including the `contribution_status` enum (§4).
- [x] **T1.2** Define Prisma schema for `payments`, including `payment_status` enum (`docs/DATABASE.md` §3.3, §4).
- [x] **T1.3** Define Prisma schema for `pixel_allocations` with the `int8range` generated column and GiST exclusion constraint (`docs/DATABASE.md` §3.4) — this constraint likely needs a raw SQL migration since Prisma does not natively express `EXCLUDE USING gist`; confirm and write it explicitly.
- [x] **T1.4** Define `pixel_cursor` and `campaign_totals` single-row tables with seed rows (`docs/DATABASE.md` §3.5–3.6).
- [x] **T1.5** Define `referrals` + `referral_events` (`docs/DATABASE.md` §3.7–3.8).
- [x] **T1.6** Define `badges` + `contributor_badges` (`docs/DATABASE.md` §3.9).
- [x] **T1.7** Define `updates` + `milestones` (`docs/DATABASE.md` §3.10–3.11).
- [x] **T1.8** Define `admin_users` + `admin_role` enum (`docs/DATABASE.md` §3.12).
- [x] **T1.9** Define `audit_logs`, append-only (no `UPDATE`/`DELETE` grant at the app DB role level) (`docs/DATABASE.md` §3.13). DB-role grant restriction itself deferred — see `docs/OPEN_ISSUES.md` OI-1 (no application DB role is provisioned yet to revoke from).
- [x] **T1.10** Define `payment_webhook_events` (`docs/DATABASE.md` §3.14) — schema only, unused until Phase 11.
- [x] **T1.11** Write and run the initial migration; verify all indexes/constraints listed in `docs/DATABASE.md` §3 exist as specified.
- [x] **T1.12** Write a unit/integration test asserting the GiST exclusion constraint actually rejects an overlapping insert (`docs/TESTING.md` §4) — proves T1.3 before anything depends on it.

---

## Phase 2 — Domain Logic (`packages/core`)

Goal: state machine, allocation engine, and validation exist as pure, tested logic, independent of any HTTP layer. Depends on Phase 1.

- [x] **T2.1** Implement the contribution state machine transition functions per the transition table in `docs/PAYMENT.md` §2.1, each performing its documented conditional DB update.
- [x] **T2.2** Unit test every transition and every guard-rejection case (`docs/TESTING.md` §2.1).
- [x] **T2.3** Implement the pixel allocation transaction exactly as specified in `docs/PIXEL_SYSTEM.md` §2.3 (single DB transaction: conditional PAID transition → cursor reservation → allocation insert → totals update → publish).
- [x] **T2.4** Implement the global index ↔ `(row, col)` ↔ `chunkId` mapping functions per `docs/PIXEL_SYSTEM.md` §3.1–3.2, as pure functions.
- [x] **T2.5** Unit test the mapping functions across representative indices (wall start, chunk boundary, row boundary) (`docs/TESTING.md` §2.2).
- [x] **T2.6** Write the concurrency test suite from `docs/TESTING.md` §4 (duplicate verify race, concurrent contributions, cursor correctness) against the Phase 2 implementation.
- [x] **T2.7** Implement display-name validation + sanitization + moderation-flagging logic per `docs/SECURITY.md` §2 and PRD §9.1.
- [x] **T2.8** Implement amount validation per `docs/SECURITY.md` §2 (bounds pending Open Decision resolution — use a configurable min/max, not a hardcoded one, so the eventual decision doesn't require code changes).
- [x] **T2.9** Unit test validation logic (`docs/TESTING.md` §2.3).

---

## Phase 3 — Payment Provider Abstraction

Goal: the `PaymentProvider` interface and the MVP manual provider exist. Depends on Phase 2.

- [x] **T3.1** Define the `PaymentProvider` TypeScript interface in `packages/payment-providers` exactly as specified in `docs/PAYMENT.md` §4.
- [x] **T3.2** Implement `ManualUpiProvider.createPaymentRequest` — builds the UPI deep link and triggers QR image generation, per `docs/PAYMENT.md` §4.1 and `docs/API.md` §2.2.
- [x] **T3.3** Unit test `ManualUpiProvider` deep-link construction (correct `pa`/`pn`/`am`/`tr`/`cu` fields, `tr` = contribution's `public_code`).
- [x] **T3.4** Wire provider selection via configuration/DI so `apps/web` never imports a concrete provider directly, only the interface (`docs/PAYMENT.md` §4.3).

---

## Phase 4 — Public API

Goal: all public endpoints from `docs/API.md` §2 exist, tested, and response-allowlisted. Depends on Phases 2–3.

- [x] **T4.1** `POST /api/contributions` — validation, idempotency-key handling, contribution + contributor creation (`docs/API.md` §2.1). Display-name moderation hold gap tracked as `docs/OPEN_ISSUES.md` OI-2.
- [x] **T4.2** `POST /api/contributions/{id}/qr` — payment attempt creation via `PaymentProvider`, state transition to `PAYMENT_PENDING` (`docs/API.md` §2.2).
- [x] **T4.3** `POST /api/contributions/{id}/utr` — records last-4, transitions to `VERIFYING`; must have **no code path** to `PAID` (`docs/API.md` §2.3, `docs/PAYMENT.md` §3).
- [x] **T4.4** `GET /api/contributions/{id}` — status polling with the exact allowlisted response shape (`docs/API.md` §2.4).
- [x] **T4.5** `GET /api/progress` — reads `campaign_totals` only, O(1) (`docs/API.md` §2.5).
- [x] **T4.6** `GET /api/pixels?chunk=` — range-intersection query per `docs/PIXEL_SYSTEM.md` §3.3 (`docs/API.md` §2.6).
- [x] **T4.7** `GET /api/pixels/{pixelId}` — single-pixel lookup per `docs/PIXEL_SYSTEM.md` §3.4 (`docs/API.md` §2.6.1).
- [x] **T4.8** `GET /api/contributors` — paginated public list + name search, `PUBLISHED`-only (`docs/API.md` §2.7).
- [x] **T4.9** `GET /api/referrals/{code}` + `POST /api/referrals/{code}/visit` (`docs/API.md` §2.8–2.8.1).
- [x] **T4.10** `GET /api/updates`, `GET /api/milestones` (`docs/API.md` §2.9).
- [x] **T4.11** Write the response-allowlisting integration test for every endpoint above (`docs/TESTING.md` §3) — must fail if an undocumented field appears in any response.
- [x] **T4.12** Apply rate limiting to the endpoints listed in `docs/SECURITY.md` §3.
- [x] **T4.13** Apply cache headers per `docs/DEPLOYMENT.md` §5 to the applicable public GET endpoints.

---

## Phase 5 — Admin Authentication & Core Admin API

Goal: admin login, RBAC, and the verification queue exist. Depends on Phase 2 (state machine) and Phase 1 (`admin_users`).

- [x] **T5.1** Implement admin password hashing + login/logout (`POST /api/admin/auth/login`, `/logout`) per `docs/SECURITY.md` §5.
- [x] **T5.2** Implement MFA-ready fields/flow scaffolding (TOTP secret storage encrypted-at-rest; enforcement toggle) — MFA can be enabled without a later migration (`docs/DATABASE.md` §3.12, `docs/SECURITY.md` §5).
- [x] **T5.3** Implement RBAC middleware checking `admin_role` against each endpoint's declared minimum role (`docs/API.md` §4).
- [x] **T5.4** Implement `audit_logs` writer helper that any admin action calls within its own transaction (`docs/SECURITY.md` §6).
- [x] **T5.5** `GET /api/admin/contributions` — verification queue with filters (`docs/API.md` §4, `docs/PRD.md` §22).
- [x] **T5.6** `GET /api/admin/contributions/{id}` — full detail view including payment evidence.
- [x] **T5.7** `POST /api/admin/contributions/{id}/verify` — invokes the Phase 2 allocation transaction; role `VERIFIER`+.
- [x] **T5.8** `POST /api/admin/contributions/{id}/reject` — transitions to `VERIFICATION_FAILED` with reason; role `VERIFIER`+.
- [x] **T5.9** Implement ambiguous-match surfacing in the queue (same amount + same UTR-last-4 across multiple pending contributions) per `docs/PAYMENT.md` §3.1.
- [x] **T5.10** `GET /api/admin/dashboard` — totals/pending/queue summary (PRD §22).
- [x] **T5.11** Security tests: unauthenticated/under-privileged access rejected on every admin route (`docs/TESTING.md` §7).

---

## Phase 6 — Homepage & Contribution Flow UI

Goal: the visitor-facing flow from PRD §8–§9 works end-to-end against the Phase 3–4 APIs.

- [x] **T6.1** Hero section: campaign name, ₹1 hook, goal, live totals, contributor count, primary CTA (PRD §8.1), backed by `GET /api/progress`.
- [x] **T6.2** Live progress display: raised amount, % funded, verified contributor count, pixels claimed, progress bar, last-updated timestamp (PRD §8.2).
- [x] **T6.3** Story section content block (PRD §8.3) — static content, admin-editable later if in scope (see Phase 8).
- [x] **T6.4** Display-name + anonymous-toggle step of the contribution flow (PRD §9.1), client-side validation mirroring `docs/SECURITY.md` §2 (server remains authoritative).
- [x] **T6.5** Amount selection step with presets + custom amount (PRD §9.2), ₹1 kept as the visually primary option.
- [x] **T6.6** Contribution creation call (`POST /api/contributions`) + transition to QR display.
- [x] **T6.7** Dynamic QR display screen, rendering `upiDeepLink`/`qrImageUrl` from `POST /api/contributions/{id}/qr`, with an expiry countdown reflecting `expiresAt` (PRD §11).
- [x] **T6.8** UTR last-4 submission screen (PRD §12), calling `POST /api/contributions/{id}/utr`, followed by a "waiting for verification" state that polls `GET /api/contributions/{id}`.
- [x] **T6.9** Success screen: pixel range/count display, "View My Pixels," share actions entry points (PRD §19) — share mechanics themselves are Phase 8.
- [x] **T6.10** Handle every non-happy-path UI state: `PAYMENT_EXPIRED`, `VERIFICATION_FAILED`, still-`VERIFYING` after reload (PRD §34 "browser closes" case).

---

## Phase 7 — Contributors Wall & Pixel Wall

Goal: PRD §8.4, §8.6, §15, §16 are implemented. Depends on Phase 4.

- [x] **T7.1** Contributors list component consuming `GET /api/contributors`, rendering display name/Anonymous + pixel count (PRD §8.6, §16), never rendering any field outside `docs/API.md` §2.7's shape.
- [x] **T7.2** Canvas/WebGL pixel wall renderer: viewport-based chunk loading using `GET /api/pixels?chunk=` per `docs/PIXEL_SYSTEM.md` §3.2 — must not create one DOM node per pixel (PRD §15 hard requirement).
- [x] **T7.3** Zoom and pan interactions on the wall (PRD §15, §8.4).
- [x] **T7.4** Tap/click a pixel → show public contributor info via the already-loaded chunk data, falling back to `GET /api/pixels/{pixelId}` for deep links (`docs/PIXEL_SYSTEM.md` §3.4, §4).
- [x] **T7.5** Search by contributor name/pixel ID (PRD §15), using `GET /api/contributors?search=` and the pixel lookup endpoint respectively.
- [x] **T7.6** Deep-link support: a URL that opens the wall centered on a specific pixel/chunk.
- [x] **T7.7** Homepage pixel wall preview (a bounded viewport of the full wall) per PRD §8.4.
- [x] **T7.8** Performance validation: confirm smooth interaction with a densely-populated chunk (simulate many small allocations in one chunk) per `docs/TESTING.md` §5's dense-wall edge case.

---

## Phase 8 — Admin Content Management

Goal: PRD §22's Content/Moderation admin capabilities exist. Depends on Phase 5.

- [x] **T8.1** `POST /api/admin/updates` / `PATCH /api/admin/updates/{id}` — publish/edit updates (PRD §18).
- [x] **T8.2** `POST /api/admin/milestones` / `PATCH /api/admin/milestones/{id}` — manage milestones (PRD §17).
- [x] **T8.3** `POST /api/admin/contributions/{id}/moderate-name` — hide/replace inappropriate display names (PRD §9.1, §16).
- [x] **T8.4** Admin UI screens for the above three (list/edit forms), RBAC-gated per role.
- [x] **T8.5** Public Updates page and Progress/Journey/Milestones page consuming `GET /api/updates` / `GET /api/milestones` (PRD §18, §8.5, §17).
- [x] **T8.6** `GET /api/admin/audit-logs` viewer, `SUPER_ADMIN`-only (PRD §22 Audit).

---

## Phase 9 — Viral Layer

Goal: PRD §19–§21 (sharing, referrals, gamification). Depends on Phases 6–7. Matches PRD Phase 2 scope.

- [x] **T9.1** Share card generation (campaign name, first name/Anonymous, pixel count/ID, CTA) per PRD §19.
- [x] **T9.2** Share actions: WhatsApp, X, copy link (PRD §19).
- [x] **T9.3** Referral link generation per contributor (`referrals.code`) and `/r/{code}` landing route calling `GET /api/referrals/{code}` + `POST .../visit` (PRD §20).
- [x] **T9.4** Referral attribution: pass `referralCode` through to `POST /api/contributions` and record a `CONTRIBUTION` referral event as a best-effort step immediately after the contribution's allocation transaction commits — not as an added step inside that transaction (`docs/API.md` §2.1, §2.8; `docs/PIXEL_SYSTEM.md` §2.3 "Non-critical side effects").
- [ ] **T9.5** Badge award evaluation (Founding/Early Believer/Dream Builder/Million Pixel Club) against `badges.criteria`, triggered on contribution publish (PRD §21) — **exact thresholds/rules depend on `docs/DATABASE.md` §9's Open Decision #8 (PRD §36.12) being resolved first.** Not started — blocked, see Cross-Cutting gate below.
- [x] **T9.6** Leaderboard (most referrals) (PRD §20, §21). New endpoint `GET /api/leaderboard` documented at `docs/API.md` §2.10.
- [ ] **T9.7** Badge/leaderboard display on contributor-facing UI. Leaderboard display implemented and validated (`/leaderboard` page). Left incomplete: no badges exist to display until T9.5's Open Decision resolves, so the "Badge ... display" half of this task cannot be done yet.

---

## Phase 10 — Testing & Hardening

Goal: close remaining gaps in `docs/TESTING.md` before considering the MVP release-ready. Runs continuously alongside Phases 4–9 but is called out explicitly so it isn't skipped.

- [ ] **T10.1** Complete the Edge Case Coverage Checklist in `docs/TESTING.md` §5 — one test per unchecked row.
- [ ] **T10.2** Complete the Security Test Cases in `docs/TESTING.md` §7.
- [ ] **T10.3** Run a manual mobile/responsive pass across the contribution flow, pixel wall, and admin dashboard (PRD §29 mobile-first).
- [ ] **T10.4** Set up error tracking and structured logging across `apps/web` per `docs/DEPLOYMENT.md` §8.
- [ ] **T10.5** Set up uptime monitoring for the public site (PRD §29).
- [ ] **T10.6** Security review pass against `docs/SECURITY.md` in full (treat as a checklist, not a one-off).

---

## Phase 11 — Deployment & Launch Readiness

Goal: PRD §37 steps 21–23. Depends on Phase 10.

- [ ] **T11.1** Provision staging and production environments per `docs/DEPLOYMENT.md` §1–§3 (vendor selection pending Open Decision).
- [ ] **T11.2** Configure automated backups + run one full restore drill (`docs/DEPLOYMENT.md` §6).
- [ ] **T11.3** Configure CDN/cache headers in production and load-test the public read path (`docs/TESTING.md` §6, `docs/DEPLOYMENT.md` §5).
- [ ] **T11.4** Publish legally-reviewed Terms, Privacy Policy, Refund Policy, Contact page content (PRD §27) — content/legal deliverable, blocks public launch, does not block closed beta of the technical system in staging.
- [ ] **T11.5** Closed beta: invite a small audience, monitor the full flow end-to-end with real (small) payments, verify payment-to-pixel latency and verification workflow under real usage (PRD §37 step 22).
- [ ] **T11.6** Public launch readiness review against the full Acceptance Criteria list in `docs/PRD.md` §35.

---

## Phase 12 — Post-MVP Scale (PRD Phase 3)

Goal: PRD §32 "Phase 3 — Scale." Not required for MVP acceptance criteria; sequenced after a successful beta/launch.

- [ ] **T12.1** Implement `GatewayProvider` (`docs/PAYMENT.md` §4.2) against a chosen payment gateway, including webhook signature verification.
- [ ] **T12.2** Implement `POST /api/payments/webhook` for real (`docs/API.md` §3), including `payment_webhook_events` idempotency handling.
- [ ] **T12.3** Stand up `apps/worker` + Redis-backed queue for async webhook processing (`docs/ARCHITECTURE.md` §10).
- [ ] **T12.4** Implement the `campaign_totals` reconciliation job (`docs/DEPLOYMENT.md` §9) as a consistency safety net.
- [ ] **T12.5** Advanced fraud detection beyond the manual signals in `docs/PAYMENT.md` §3.1.
- [ ] **T12.6** Advanced analytics implementation per PRD §30's tracked-events list.
- [ ] **T12.7** Public journey dashboard (post-goal milestones: Business Setup, Product Development, MVP, Launch, First Customer, Revenue Milestones — PRD §17, §8.5).

---

## Cross-Cutting: Do Not Start Without Resolving

Some tasks above are explicitly gated on an Open Decision in another doc. Do not implement past the gate until product/legal input resolves it:

- **T2.8 / amount bounds** — `docs/DATABASE.md` §9.3.
- **T9.5 / badge rules** — `docs/DATABASE.md` §9, Open Decision #8, PRD §36.12.
- **T11.4 / legal content** — PRD §27, §36.1–§36.5.
- Any refund-related task (not separately numbered above; part of T5.x when refund admin action is built) — `docs/PAYMENT.md` §6.
