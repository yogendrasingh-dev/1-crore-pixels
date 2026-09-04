# Testing Strategy

**Source of truth:** `docs/PRD.md` §34 (edge cases), §35 (acceptance criteria), §29 (non-functional requirements). This document defines what must be tested and at what level, so that PRD §35's acceptance criteria are verifiable, not just aspirational.

---

## 1. Test Levels

| Level | Scope | Tooling (suggested, not prescribed by PRD) |
|---|---|---|
| Unit | Pure logic in `packages/core`: state machine transitions, pixel index↔coordinate mapping, validation schemas, moderation rules | Vitest/Jest |
| Integration | API route handlers against a real (test) PostgreSQL instance, exercising full request/response cycles | Vitest/Jest + a disposable Postgres (e.g. Testcontainers or a CI service container) |
| Concurrency | Deliberately racing concurrent requests against the same contribution/allocation to prove DB-level guarantees hold | Integration harness spawning parallel requests/transactions |
| Security | Rate limiting, webhook signature rejection, RBAC enforcement, XSS/sanitization | Integration tests + targeted security test cases |
| Load/Performance | Traffic-spike behavior on hot public endpoints | k6/Artillery (Phase 3, pre-launch) |
| Manual/Exploratory | Mobile responsiveness, visual pixel wall interaction, admin UX | Manual pass before each release, per PRD §29 "mobile-first" |

**Principle:** the state machine, pixel allocation engine, and payment verification matching (`docs/PAYMENT.md`, `docs/PIXEL_SYSTEM.md`) are the highest-risk code in the system per PRD §38's explicit warnings ("never allocate pixels twice," "never treat frontend payment state as proof"). These modules require the most thorough test coverage in the codebase — every transition and every guard condition in their transition tables should have a corresponding test, not just the happy path.

---

## 2. Unit Test Requirements

### 2.1 Contribution state machine (`docs/PAYMENT.md` §2)
- Every listed transition succeeds under its documented guard.
- Every transition is rejected when the guard condition is false (e.g. attempting `VERIFYING → PAID` when status is already `PAID` is a no-op, not an error that corrupts state).
- Terminal/failure states (`PAYMENT_FAILED`, `PAYMENT_EXPIRED`, `VERIFICATION_FAILED`, `REFUNDED`) cannot transition back into the money/pixel path.

### 2.2 Pixel allocation math (`docs/PIXEL_SYSTEM.md` §2–3)
- `pixel_count` always equals the contribution's rupee amount.
- Global index → `(row, col)` mapping is deterministic and reversible for a range of representative indices (start of wall, end of a chunk, across a chunk boundary, across a row boundary).
- Chunk ID derivation is deterministic and consistent between the write-side allocation and the read-side chunk query.

### 2.3 Validation (`docs/SECURITY.md` §2)
- Amount validation accepts the documented presets (₹1, ₹11, ₹51, ₹101, ₹501) and valid custom amounts, rejects zero/negative/out-of-range/non-numeric input.
- Display name validation accepts normal names, strips/rejects HTML and script content, flags offensive/spam content for moderation rather than crashing or silently passing it through.
- Anonymous flag correctly forces `displayName` to `"Anonymous"` in every code path that assembles a public-facing view — this should be tested at the serialization layer, not just the flag's storage.

---

## 3. Integration Test Requirements

Each of these is a full flow through real route handlers and a real test database:

- `POST /api/contributions` → `PAYMENT_PENDING` → `POST .../utr` → `VERIFYING` → admin `verify` → `PAID` → `PIXELS_ASSIGNED` → `PUBLISHED`, asserting at each step that `GET /api/contributions/{id}` and `GET /api/progress` reflect exactly the current state, and that pre-publication states never leak into `GET /api/contributors` or `GET /api/pixels`.
- Admin `reject` path: `VERIFYING → VERIFICATION_FAILED`, and the contribution never appears on any public endpoint.
- Idempotency: sending the same `POST /api/contributions` request twice with the same `Idempotency-Key` produces exactly one contribution record.
- Public response allowlisting: for every public endpoint, assert the response JSON contains **only** the documented fields (`docs/API.md`) — a snapshot/shape test that fails loudly if a new sensitive field is accidentally added to a serializer. This directly operationalizes `docs/SECURITY.md` §8.

---

## 4. Concurrency Tests (critical — maps to PRD §34 & Acceptance Criteria §35)

These tests must actually race requests, not just call functions sequentially and assert on intermediate state:

- **Duplicate verify race**: fire N concurrent `POST /api/admin/contributions/{id}/verify` calls for the same `VERIFYING` contribution. Assert: exactly one `pixel_allocations` row is created, `campaign_totals` is incremented exactly once, and N-1 calls observe the "already processed" outcome rather than an error that implies partial state corruption.
- **Concurrent contributions, no overlap**: fire N concurrent contributions through to `PAID` simultaneously. Assert: the resulting `pixel_allocations` ranges are pairwise non-overlapping and contiguous with respect to allocation order, and the sum of `pixel_count` across all N matches the sum credited to `campaign_totals.total_pixels_allocated`.
- **Cursor correctness under load**: repeatedly allocate from a fresh `pixel_cursor` under concurrency and assert the final `next_index` equals the sum of all `pixel_count`s allocated, with no gaps and no double-issued index.
- **Duplicate webhook delivery (Phase 3)**: deliver the same webhook event twice; assert the second delivery is a no-op (`payment_webhook_events` unique constraint) and does not double-allocate or double-credit totals.
- **Same amount + same UTR-last-4 for two different contributions**: assert both remain `VERIFYING` (or are surfaced as an ambiguous pair to the admin queue) and neither is auto-approved.

These tests exist specifically to prove the claims made in `docs/DATABASE.md` §5 and `docs/PIXEL_SYSTEM.md` §2.4 under real concurrency, not just by code inspection.

---

## 5. Edge Case Coverage Checklist (from PRD §34)

Every row below must have at least one corresponding automated test:

- [ ] Payment succeeds but browser closes (contribution recoverable via `GET /api/contributions/{id}` after reload)
- [ ] Wrong UTR suffix (no false match)
- [ ] Same amount + same UTR suffix for multiple users (ambiguous, not auto-approved)
- [ ] Duplicate UTR submission (idempotent, no duplicate `payments` row)
- [ ] Amount mismatch (rejected/flagged, not silently accepted)
- [ ] Duplicate webhook (Phase 3 — no double effect)
- [ ] Webhook before frontend response (Phase 3 — state still converges correctly)
- [ ] Payment pending indefinitely (expires correctly)
- [ ] Payment refunded after allocation (behaves per whichever policy is chosen — `docs/PAYMENT.md` §6)
- [ ] Offensive display name (flagged/moderated, not published as-is)
- [ ] Unpaid abandoned contribution (never appears on public wall/totals)
- [ ] Traffic spike (see §6 Load Testing)
- [ ] Bot-created pending contributions (rate-limited)
- [ ] Pixel allocation race condition (§4)
- [ ] Concurrent payments (§4)
- [x] Extremely dense pixel wall / large chunk (chunk query stays performant with a large number of small allocations in one chunk) — `apps/web/src/app/api/pixels/route.test.ts`

---

## 6. Load & Performance Testing (Phase 3, pre-launch)

Per PRD §29 ("scalable to millions of contributors/pixels," "fast on Indian mobile networks") and §34 ("traffic spike"):

- Simulate burst traffic against `GET /api/progress` and `GET /api/pixels` (the two hottest public reads) and confirm CDN/cache headers (`docs/API.md` §2.5, `docs/DEPLOYMENT.md`) keep database load flat under spike, not linear with request volume.
- Simulate a burst of concurrent `POST /api/contributions` and confirm rate limiting engages correctly without rejecting legitimate distinct users sharing a network (e.g. campus/office NAT) — a false-positive-rate check, not just a throughput check.
- Measure payment-to-pixel latency (PRD §31 success metric) under the manual-verification flow to establish a baseline before any automation is added.

---

## 7. Security Test Cases

Mapped to `docs/SECURITY.md`:

- Requests without a valid admin session are rejected (`401`) on every `/api/admin/*` route.
- A `VERIFIER`-role admin token is rejected (`403`) on `SUPER_ADMIN`-only actions (e.g. refund, audit log access).
- Webhook requests with an invalid signature are rejected and not processed (Phase 3).
- Rate limits trip after the configured threshold and recover after the window.
- Injecting `<script>`/HTML into `displayName` and update/milestone content never renders unescaped and is stripped/rejected server-side.
- Every admin state-changing action produces a corresponding `audit_logs` row within the same test transaction.

---

## 8. CI Expectations

Per `docs/PRD.md` §38 (Claude Code development principle: run tests, typecheck, lint, build):

- Every PR runs: lint, typecheck, unit tests, integration tests (against an ephemeral Postgres) as required gates.
- Concurrency tests (§4) run in CI as part of the standard suite, since they are what guarantees the exactly-once allocation property — they are not treated as optional/manual.
- Load tests (§6) are not run on every PR (too slow/expensive); they run pre-release and after any change to the allocation, cursor, or public-read-path code.

---

## 9. Open Decisions

1. No specific numeric coverage percentage is mandated by the PRD. Recommendation: treat the state machine, pixel allocation, and payment-verification modules as requiring coverage of every branch in their transition tables (§1 principle), rather than adopting an arbitrary blanket percentage target — this is a testing-quality bar, not a product requirement, and can be revisited by the team.
2. Exact load-testing targets (requests/sec, concurrent users) are not specified in the PRD and should be set once real traffic expectations exist (e.g. from a launch marketing estimate).
