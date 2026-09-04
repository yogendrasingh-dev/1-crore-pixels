# CLAUDE.md — 1 Crore Pixels

This file governs how Claude Code works in this repository. It does not restate product/engineering detail already covered in `docs/*.md` — it defines the rules for how to read those docs, how to write code against them, and how to behave autonomously. When this file and a doc disagree, stop and ask; do not silently pick one.

---

## 1. Project Purpose

**1 Crore Pixels** is a public web platform: a visual pixel wall where a verified monetary contribution maps to an equivalent number of pixels (₹1 = 1 pixel), toward a public ₹1 crore campaign goal. No signup/login for contributors. A visitor picks a display name (or Anonymous), an amount, pays via UPI, submits the last 4 digits of the transaction reference as an assisted signal, and receives pixels only after **server-side** payment verification.

This is not an investment product, not a charity (unless legally structured as one), and not a guaranteed-return scheme. Full product vision: `docs/PRD.md` §1–2, §39.

---

## 2. Source of Truth

Documentation-driven development. In order of authority:

```text
docs/PRD.md            — product requirements (what/why)
docs/ARCHITECTURE.md   — system design (how, at the system level)
docs/DATABASE.md       — schema
docs/API.md            — endpoint contracts
docs/PAYMENT.md        — payment state machine, verification, provider abstraction
docs/PIXEL_SYSTEM.md   — pixel allocation algorithm, wall geometry, rendering
docs/SECURITY.md       — security & privacy controls
docs/TESTING.md        — what must be tested and at what level
docs/DEPLOYMENT.md     — environments, secrets, release process
docs/TASKS.md          — the task backlog, phased, with doc-section references
CLAUDE.md              — this file: process rules, not product/engineering content
```

Rules for using this hierarchy:

- Read only the doc(s) relevant to the current task, plus `docs/TASKS.md` to confirm scope and phase-gating.
- The PRD is the ultimate product authority. `ARCHITECTURE.md`/`DATABASE.md`/`API.md`/`PAYMENT.md`/`PIXEL_SYSTEM.md`/`SECURITY.md` translate the PRD into engineering decisions and label anything not directly specified by the PRD as an engineering choice or an Open Decision.
- Every doc has an **Open Decisions** section. A task gated on an unresolved Open Decision (see `docs/TASKS.md` "Cross-Cutting: Do Not Start Without Resolving") must not be implemented past that gate — see §14 (autonomous execution rules) and `docs/OPEN_ISSUES.md`.
- Inspect existing code before modifying it. Docs describe intent; the repository state is what actually exists right now.

---

## 3. Architecture Rules

Full detail: `docs/ARCHITECTURE.md`.

- pnpm monorepo. `apps/web` (Next.js: public site, contribution flow, pixel wall, admin UI, API route handlers) is the only deployable app in MVP; `apps/worker` is Phase 3 only.
- Business logic lives in `packages/core` (state machine, pixel allocation engine, validation/moderation) and `packages/db` (schema, migrations, query layer) — never in a route handler. Route handlers in `apps/web` are thin: parse/validate the request, call into `packages/core`/`packages/db`, shape the response.
- `packages/payment-providers` exposes one `PaymentProvider` interface. `apps/web` and `packages/core` depend only on the interface, never on a concrete provider (`ManualUpiProvider` today, `GatewayProvider` in Phase 3). Swapping providers must be a config/DI change, not a rewrite.
- No physical `pixels` table — pixel ownership is derived from `pixel_allocations` range-containment queries. Do not reintroduce a per-pixel row model.
- Aggregate reads (`GET /api/progress`) hit the single-row `campaign_totals` cache, updated transactionally alongside allocation — never recomputed by summing transactional tables on request.
- The pixel wall is never rendered as one DOM node per pixel. Canvas/WebGL + chunked fetching only (`docs/PIXEL_SYSTEM.md` §3).
- Every state transition with money or pixel consequences happens in exactly one server-side transaction, gated by a conditional update. Never trust client-reported payment state.

---

## 4. Coding Conventions

- Match the existing style of the file/package you're editing before introducing a new pattern.
- No abstractions, config flags, or generalized helpers beyond what the current task requires. Three similar lines beat a premature abstraction.
- No comments explaining *what* code does. A short comment is only warranted for a non-obvious *why* (a hidden invariant, a workaround, a subtle constraint) — e.g. the kind already present in the docs (cursor atomicity, GiST exclusion rationale).
- Don't add error handling/fallbacks for scenarios that can't occur given the state machine's guards. Validate at system boundaries (API request bodies, webhook payloads); trust internal calls between `packages/core` functions.
- No backwards-compatibility shims, `_unused` renames, or "removed" comments for deleted code — delete cleanly.
- Public API response shapes are explicit allowlists (`docs/API.md`). Never serialize a full DB row from a public endpoint, even by accident via a generic serializer.

---

## 5. TypeScript Rules

- Strict mode. No `any` used to bypass a type error — fix the type or narrow it.
- Shared config lives in `packages/config`; every package consumes it rather than defining its own `tsconfig`/`eslint`/`prettier` rules.
- Validation schemas (zod, per `docs/SECURITY.md` §2) are the single source of truth for both compile-time types and runtime validation of request bodies — don't hand-write a parallel interface that can drift from the schema.
- Domain types (`Contribution`, `Payment`, `PixelAllocation`, contribution/payment status enums, etc.) are defined once in `packages/core`/`packages/db` and imported, never redeclared per-package.
- Money is always an integer (paise) in domain/DB code; conversion to/from rupees for API boundaries happens at the API layer only (`docs/DATABASE.md` §1, `docs/API.md` intro). Never use floating point for money anywhere in the codebase.

---

## 6. Database Rules

Full detail: `docs/DATABASE.md`, `docs/PIXEL_SYSTEM.md` §2.

- PostgreSQL via Prisma (`packages/db`). Raw SQL is permitted only for the pixel-allocation cursor statement and range-containment queries, and only with parameter binding — never string-concatenated user input.
- `pixel_allocations.contribution_id` must stay `UNIQUE`; `pixel_range` must keep its `GIST EXCLUDE ... WITH &&` constraint. These are the primary guarantee against duplicate/overlapping allocation — do not weaken, remove, or work around them at the application level.
- `pixel_cursor` advances only via the single atomic `UPDATE ... RETURNING` statement in `docs/PIXEL_SYSTEM.md` §2.2. No `SELECT` + application-side increment, no separate lock.
- The full pixel allocation transaction (conditional `PAID` transition → cursor reservation → allocation insert → `campaign_totals` update → publish) is one DB transaction, triggered from exactly one code path. Never split it, never call it twice for the same contribution.
- Every table on the money → pixel path uses a closed enum for status, never a free-text column.
- Any migration touching `pixel_allocations` or `pixel_cursor` requires extra review and a staging dry-run before production (`docs/DEPLOYMENT.md` §4) — this is the highest-blast-radius schema surface in the system.
- `audit_logs` is append-only. Never grant `UPDATE`/`DELETE` on it at the application DB role, and never write code that mutates or deletes an existing audit row.
- Full UTR/provider references are stored only as salted hashes, never plaintext (`docs/DATABASE.md` §3.3). Do not add a plaintext column for this without an explicit Open Decision resolution.

---

## 7. API Rules

Full detail: `docs/API.md`.

- Public endpoints require no auth; admin endpoints (`/api/admin/*`) require an authenticated session and are RBAC-checked server-side on every request, per `docs/SECURITY.md` §5.
- Any endpoint creating a money- or pixel-affecting record must support idempotency via `Idempotency-Key`.
- Every public response shape is the explicit allowlist documented in `docs/API.md` §2 — adding a field to a public response requires updating that doc in the same change, and adding a new public endpoint requires defining its shape there first.
- `POST /api/contributions/{id}/utr` has no code path to `PAID`, ever. It only records a signal and moves the contribution to `VERIFYING`. Do not add a shortcut here under any circumstance, including "just for testing."
- High-risk public endpoints (contribution creation, UTR submission, referral visit logging, admin login) are rate-limited per `docs/SECURITY.md` §3.
- `POST /api/payments/webhook` is a Phase 3 contract placeholder — do not wire it to a live provider or build `GatewayProvider` logic until Phase 3 is reached and the payment provider is selected.

---

## 8. Payment Security Rules

Full detail: `docs/PAYMENT.md`, restated from PRD §10/§38 because violating any of these is the single most severe class of bug possible in this codebase:

1. **Never trust frontend payment-success state.** The client's belief that payment succeeded is not evidence.
2. **Verify payment server-side, always**, via the conditional `UPDATE ... WHERE status = 'VERIFYING' ... RETURNING` pattern — zero rows affected means abort with no side effects.
3. **Verify webhook signatures** before parsing payload (Phase 3) — invalid signature is rejected and logged, never processed.
4. **Idempotency everywhere on this path** — duplicate requests, duplicate webhooks, and double-clicks must all be safe no-ops, not errors that imply partial state corruption.
5. **Never allocate pixels twice**, for any contribution, under any concurrency scenario. This is guaranteed by the DB constraints in §6 plus the single-transaction allocation code path — never build a second way to reach `PIXELS_ASSIGNED`.
6. **Never publish an unverified contribution.** Only `PUBLISHED` contributions may appear on any public endpoint or affect `campaign_totals`.
7. **Keep payment audit information private.** Full UTR, provider payloads, and admin verification evidence are admin/audit-only — never returned by a public endpoint, never logged in a way a public log aggregator could expose.
8. **Ambiguous verification evidence stays `VERIFYING`.** The last-4 UTR digits are an assisted signal only; matching amount + reference note + time window together is required for a clear match. Never auto-approve on partial evidence.
9. **Refund-after-allocation is an unresolved Open Decision** (`docs/PAYMENT.md` §6) — do not implement refund pixel-revocation logic until it is resolved; log it in `docs/OPEN_ISSUES.md` if a task requires it.

---

## 9. Pixel Allocation Rules

Full detail: `docs/PIXEL_SYSTEM.md`.

- **₹1 = 1 pixel**, always, exactly. `pixel_count` on an allocation must equal the contribution's rupee amount.
- Allocation happens only inside the single atomic transaction described in `docs/PIXEL_SYSTEM.md` §2.3, triggered only from the code path gated by the `VERIFYING → PAID` conditional update (§8 above). There is no second way to allocate.
- The global pixel index is assigned in order of verification, not creation or payment time. Do not reorder this.
- Wall geometry constants (`W = 4000` columns, 25-row/100,000-pixel chunks) must not change once real allocations exist — changing them reshuffles every previously-allocated pixel's visual position. Treat this as a frozen constant unless explicitly told otherwise by the user, and flag any such request before touching it.
- The index → `(row, col)` → `chunkId` mapping is a pure, deterministic function with no randomness — any change here needs the reversibility/determinism unit tests in `docs/TESTING.md` §2.2 updated alongside it.
- Never materialize a physical per-pixel row/table. Ownership is always derived via range queries against `pixel_allocations`.

---

## 10. Privacy Rules

Full detail: `docs/SECURITY.md` §9, `docs/DATABASE.md` §7, PRD §26.

- No phone, email, or UPI ID is ever collected from contributors — there must be no form field, no DB column, no API field for these. If a task seems to need one, stop and flag it rather than adding it.
- `anonymous: true` always forces `displayName` to `"Anonymous"` at the point a response is assembled — the real stored name must never leave the server in the same payload as `anonymous: true`. Test this at the serialization layer, not just storage.
- Full UTR/transaction reference is never displayed publicly, and never stored in plaintext at all (only as a salted hash).
- IP address and user agent are stored only as salted hashes (`ip_hash`, `user_agent_hash`), used only for fraud/rate-limit signals, never displayed, and retention window is bounded (exact duration is an Open Decision — don't invent one; use a configurable value).
- Admin credentials, MFA secrets, and other admins' details are never returned by any endpoint, admin or public.
- Any new public response type must be checked against `docs/DATABASE.md` §7's "never exposed" table before merge.

---

## 11. Testing Rules

Full detail: `docs/TESTING.md`.

- The contribution state machine, pixel allocation engine, and payment verification matching are the highest-risk code in this repository. Every transition and every guard condition in `docs/PAYMENT.md` §2.1's transition table needs a corresponding test — not just the happy path.
- Concurrency tests (duplicate verify race, concurrent contributions with no overlap, cursor correctness under load) are **required**, not optional, and must actually race concurrent requests/transactions rather than asserting on sequential calls.
- Every public endpoint needs a response-allowlisting test that fails if an undocumented field appears — this is the automated enforcement of the payment-data exposure boundary (§8, §10 above).
- Every row in the Edge Case Coverage Checklist (`docs/TESTING.md` §5) needs at least one automated test before the corresponding feature is considered done.
- Run unit + integration tests relevant to the change automatically before considering a task complete (see §14).

---

## 12. Git Rules

- Never commit unless the user explicitly asks. When asked, follow the repo's existing commit message style; stage specific files by name, not `-A`/`.`; never commit secrets, `.env`, or credential files.
- Never amend a published/previous commit — create a new commit unless the user explicitly requests `--amend`.
- Never force-push, `reset --hard`, or run other destructive git operations without explicit confirmation for that specific action.
- Never push to a remote or open/modify a PR without being asked.
- One task = one coherent, reviewable change. Don't bundle unrelated work into the same commit/PR.

---

## 13. Definition of Done

A task is done only when **all** of the following hold:

1. The implementation matches the relevant `docs/*.md` section(s) exactly — no invented behavior, no dropped requirement.
2. Relevant unit and integration tests exist and pass, including concurrency tests if the change touches the payment/allocation path (§11).
3. `typecheck` passes with no new errors.
4. `lint` passes with no new errors (auto-fixable issues fixed automatically; see §14).
5. `build` passes where applicable (per `docs/TESTING.md` §8 / `docs/PRD.md` §38).
6. No public endpoint response includes a field outside its documented allowlist (`docs/API.md`).
7. No payment/pixel change bypasses the single-transaction, conditional-update pattern (§8, §9).
8. Any documentation whose described architecture changed as a result of the implementation has been updated in the same change (§14 rule 8).
9. `docs/TASKS.md` reflects the task's completion.
10. Any genuinely ambiguous requirement encountered was recorded in `docs/OPEN_ISSUES.md`, not silently resolved by guessing.

---

## 14. Autonomous Execution Rules

1. Do not ask for confirmation for normal coding tasks. Proceed.
2. Complete the current task fully — per its `docs/TASKS.md` entry and referenced doc sections — before moving to the next one.
3. Run relevant tests automatically after implementation changes.
4. Run typecheck automatically.
5. Run lint automatically.
6. Fix safe errors (lint autofixes, obvious type errors, clearly-correct test fixes) automatically. "Safe" means the fix cannot change product behavior or payment/pixel semantics — anything touching those paths gets flagged, not silently patched.
7. Update `docs/TASKS.md` (mark the task complete) after finishing a task.
8. Update the relevant `docs/*.md` file when an implementation detail changes the architecture/schema/API/etc. described there — keep docs and code from drifting apart. This is not the same as changing product requirements (rule 9): documenting *how* something was actually built is expected; changing *what* was asked for is not.
9. Never silently change PRD requirements. If an implementation would require deviating from the PRD, stop and surface it explicitly rather than adjusting the requirement to fit the implementation.
10. If a requirement is genuinely ambiguous (not just under-specified in a way an engineering default can resolve, per how each doc already labels its own Open Decisions), record it in `docs/OPEN_ISSUES.md` with enough context to resolve later, and continue with other independent tasks rather than blocking.
11. Never perform real-money production actions automatically (issuing refunds, calling a live payment gateway in production, moving funds) — these require explicit human action, always.
12. Never deploy to production automatically.
13. Never delete production data automatically.
14. Never expose sensitive payment information — not in a public response, not in a log line, not in an error message, not in a test fixture committed to the repo.

**Scope note:** this file governs process and rules. It does not implement application features itself — feature work happens per `docs/TASKS.md`, guided by the doc set in §2.
