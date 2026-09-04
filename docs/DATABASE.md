# Database Design

**Source of truth:** `docs/PRD.md` §23 (entity list), §13 (state machine), §14 (pixel rules). This document expands the PRD's entity list into a concrete PostgreSQL schema. Fields explicitly listed in PRD §23 are preserved; additional fields are engineering necessities (idempotency, auditing, fraud signals) and are called out as such.

Engine: **PostgreSQL** (PRD §33). ORM: Prisma (`packages/db`), with raw SQL permitted for the pixel-allocation hot path (see `docs/PIXEL_SYSTEM.md`).

---

## 1. Conventions

- Primary keys: `bigint identity` for high-volume tables (`contributions`, `payments`, `pixel_allocations`, `referral_events`, `audit_logs`); `uuid` acceptable for low-volume config-like tables (`milestones`, `updates`, `badges`, `admin_users`). Either is compatible with Prisma; pick `bigint` where insert volume is expected in the millions to keep indexes compact.
- Money is stored as **integer paise** (`amount_paise bigint`), never floating point. ₹1 = 100 paise.
- All timestamps are `timestamptz`, UTC.
- Nothing that PRD §16/§25/§26 forbids from public display (phone, email, UPI ID, full UTR, full name unless the contributor chose public display) is ever written in plaintext to a column that a public endpoint reads from. See §7 (Privacy-Sensitive Columns) below.
- Every table that participates in the money → pixel path has a status enum whose values are a closed set matching `docs/PAYMENT.md`'s state machine — no free-text status columns.

---

## 2. Entity-Relationship Overview

```text
admin_users            contributors 1───* contributions 1───1 pixel_allocations
     │                       │                  │1
     │ (verified_by)         │ (owner)          │
     ▼                       ▼                  *
audit_logs              referrals            payments
     ▲                       │1
     │                       *
     └──────────────────  referral_events

milestones ◄──── updates (optional milestone_id)
badges ────* contributor_badges *──── contributors
campaign_totals (single row, no FK — aggregate cache)
pixel_cursor (single row, no FK — allocation cursor)
payment_webhook_events (Phase 3; keyed by provider + provider_event_id)
```

**No physical `pixels` table.** PRD §23 lists `pixels` as a recommended entity, but materializing one row per pixel (10,000,000+ rows, growing) for what is otherwise a derived value is unnecessary write and storage cost. A pixel's owner is derived by a range-containment lookup against `pixel_allocations` (indexed via a GiST exclusion index — see §5). This is an engineering decision, not a product requirement change: the product-visible behavior (every pixel has exactly one owner or is unclaimed) is identical. See `docs/PIXEL_SYSTEM.md` §3 for the query pattern and rationale.

---

## 3. Core Tables

### 3.1 `contributions`

The transactional record of one attempt to contribute. Matches PRD §23's `Contribution` fields exactly, plus fields required for idempotency, fraud handling, and referral attribution.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint identity PK` | Internal id |
| `public_code` | `text UNIQUE NOT NULL` | e.g. `C_82931` (PRD §11 example). Server-generated, safe to expose publicly. |
| `display_name` | `text NOT NULL` | Sanitized/moderated snapshot at time of contribution (PRD §9.1). Immutable once set, independent of any later `contributors` edits. |
| `anonymous` | `boolean NOT NULL DEFAULT false` | PRD §9.1 |
| `amount_paise` | `bigint NOT NULL CHECK (amount_paise > 0)` | ₹1 minimum implied by PRD §9.2; exact minimum/maximum policy is an Open Decision (§9). |
| `currency` | `text NOT NULL DEFAULT 'INR'` | Fixed for MVP |
| `status` | `contribution_status ENUM NOT NULL` | See `docs/PAYMENT.md` §2 for the full state machine |
| `contributor_id` | `bigint FK → contributors.id NOT NULL` | See §3.2 |
| `referral_code_used` | `text FK → referrals.code, NULLABLE` | PRD §20 |
| `utr_last4` | `char(4) NULLABLE` | PRD §12. Assisted signal only — never sufficient proof alone. |
| `idempotency_key` | `text UNIQUE NULLABLE` | Client-supplied (or server-generated on first request) to make duplicate `POST /api/contributions` submissions safe. |
| `ip_hash` | `text NULLABLE` | Salted hash, not raw IP (PRD §26 minimum data collection) |
| `user_agent_hash` | `text NULLABLE` | Same rationale |
| `rejection_reason` | `text NULLABLE` | Set on `VERIFICATION_FAILED`/reject |
| `expires_at` | `timestamptz NULLABLE` | For `PAYMENT_PENDING` timeout → `PAYMENT_EXPIRED` (PRD §13, §34) |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `payment_submitted_at` | `timestamptz NULLABLE` | Set when UTR submitted |
| `paid_at` | `timestamptz NULLABLE` | Set on `PAID` transition |
| `verified_at` | `timestamptz NULLABLE` | Set when admin/system confirms |
| `published_at` | `timestamptz NULLABLE` | Set when contribution becomes publicly visible |

Indexes: `UNIQUE(public_code)`, `UNIQUE(idempotency_key)`, `INDEX(status)`, `INDEX(contributor_id)`, `INDEX(referral_code_used)`, `INDEX(created_at)` for admin queue ordering, `INDEX(display_name) WHERE status = 'PUBLISHED'` for public search.

### 3.2 `contributors`

A lightweight public-identity record, separate from the transactional `contributions` row, to support the referral/leaderboard/badge features (PRD §16, §20, §21) without introducing accounts/login.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint identity PK` | |
| `display_name` | `text NOT NULL` | Current public display name |
| `anonymous` | `boolean NOT NULL DEFAULT false` | |
| `referral_code` | `text UNIQUE NULLABLE` | PRD §20, e.g. `rahul-7f3a` (slug + random suffix to avoid collisions between same-name contributors) |
| `total_verified_amount_paise` | `bigint NOT NULL DEFAULT 0` | Denormalized cache, updated in the same transaction as pixel allocation |
| `total_pixels` | `bigint NOT NULL DEFAULT 0` | Denormalized cache |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

**MVP relationship: one `contributors` row per `contributions` row (1:1 at creation time).** Because there is no login, the system has no reliable way to recognize "the same person" across two separate contributions unless they reuse a referral code or browser state, which is not proof of identity. See Open Decisions (§9) for whether multiple contributions should ever be merged into one contributor identity.

### 3.3 `payments`

One row per **payment attempt** for a contribution (PRD §23's `Payment` entity). A contribution may have more than one attempt (e.g. QR expired, retried), but at most one attempt may ever reach `VERIFIED`.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint identity PK` | |
| `contribution_id` | `bigint FK → contributions.id NOT NULL` | |
| `provider` | `text NOT NULL` | e.g. `manual_upi`, `razorpay` — matches a registered `PaymentProvider` (`docs/PAYMENT.md`) |
| `provider_payment_id` | `text NULLABLE` | Set only when a real gateway is used (Phase 3) |
| `amount_paise` | `bigint NOT NULL` | Snapshot; must match `contributions.amount_paise` |
| `status` | `payment_status ENUM NOT NULL` | `PENDING, SUBMITTED, VERIFIED, FAILED, EXPIRED` |
| `reference_hash` | `text NULLABLE` | Salted hash of the full UTR/provider reference — **the full value is never stored in plaintext** (PRD §12: never publicly display full UTR; extended here to never store it unhashed either, since it is not needed once matched) |
| `utr_last4` | `char(4) NULLABLE` | Duplicate of the contribution-level value, scoped to this attempt |
| `verification_method` | `text NULLABLE` | `MANUAL_ADMIN`, `AUTOMATED_WEBHOOK` |
| `verified_by_admin_id` | `bigint FK → admin_users.id, NULLABLE` | |
| `raw_provider_payload` | `jsonb NULLABLE` | Phase 3 webhook evidence; private, admin/audit-only |
| `created_at` / `updated_at` | `timestamptz` | |

Indexes: `INDEX(contribution_id)`, `UNIQUE(provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL`, `INDEX(reference_hash, amount_paise)` to support the assisted-matching lookup described in `docs/PAYMENT.md`.

> Storing the full UTR only as a salted hash is stricter than the PRD's explicit requirement ("never publicly display" — PRD §12) and its "keep payment audit information private" instruction (PRD §10). It is flagged as a deliberate hardening choice in [Open Decisions](#9-open-decisions) in case an admin genuinely needs the raw value for manual bank-statement matching, in which case it must be stored encrypted-at-rest rather than hashed.

### 3.4 `pixel_allocations`

One row per contribution that has been allocated pixels (PRD §23's `Pixel Allocation` entity). See `docs/PIXEL_SYSTEM.md` for the allocation algorithm.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint identity PK` | |
| `contribution_id` | `bigint FK → contributions.id, UNIQUE NOT NULL` | **Uniqueness is the idempotency guard** — a second allocation attempt for the same contribution fails at the DB level (FR-09, PRD §14) |
| `start_pixel` | `bigint NOT NULL` | Inclusive, 0-based global pixel index |
| `end_pixel` | `bigint NOT NULL` | Exclusive |
| `pixel_count` | `bigint GENERATED ALWAYS AS (end_pixel - start_pixel) STORED` | Must equal the contribution's rupee amount (₹1 = 1 pixel, PRD §14) |
| `pixel_range` | `int8range GENERATED ALWAYS AS (int8range(start_pixel, end_pixel, '[)')) STORED` | Backing column for the exclusion constraint below |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

Constraints:
- `EXCLUDE USING gist (pixel_range WITH &&)` — **makes overlapping allocations impossible at the database level**, regardless of application-level bugs or concurrent transactions (PRD §14 "no overlapping allocations", §34 "pixel allocation race condition").
- `UNIQUE(contribution_id)` — exactly-once allocation per contribution.

### 3.5 `pixel_cursor`

Single-row table holding the global allocation watermark. Not in the PRD's entity list; required to make allocation atomic and gap-free. See `docs/PIXEL_SYSTEM.md` §2 for the exact update statement.

| Column | Type | Notes |
|---|---|---|
| `id` | `smallint PK CHECK (id = 1)` | Enforces single row |
| `next_index` | `bigint NOT NULL DEFAULT 0` | Next unallocated global pixel index |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

### 3.6 `campaign_totals`

Single-row aggregate cache, updated transactionally alongside pixel allocation (`docs/ARCHITECTURE.md` §6). Not in the PRD's entity list; required by PRD §29 "efficient aggregate counters."

| Column | Type | Notes |
|---|---|---|
| `id` | `smallint PK CHECK (id = 1)` | |
| `total_verified_amount_paise` | `bigint NOT NULL DEFAULT 0` | |
| `verified_contributor_count` | `bigint NOT NULL DEFAULT 0` | |
| `total_pixels_allocated` | `bigint NOT NULL DEFAULT 0` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

### 3.7 `referrals`

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint identity PK` | |
| `code` | `text UNIQUE NOT NULL` | e.g. `rahul-7f3a` (PRD §20 example: `example.com/r/rahul`) |
| `contributor_id` | `bigint FK → contributors.id NOT NULL` | Owner of the code |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

### 3.8 `referral_events`

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint identity PK` | |
| `referral_id` | `bigint FK → referrals.id NOT NULL` | |
| `event_type` | `referral_event_type ENUM NOT NULL` | `VISIT`, `CONTRIBUTION` (PRD §20) |
| `contribution_id` | `bigint FK → contributions.id, NULLABLE` | Set only for `CONTRIBUTION` events |
| `ip_hash` | `text NULLABLE` | For basic dedupe of repeated visit events, not identification |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

Indexes: `INDEX(referral_id, event_type)`.

### 3.9 `badges` / `contributor_badges`

PRD §21 (Founding, Early Believer, Dream Builder, Million Pixel Club, etc.).

```text
badges
  id            uuid PK
  code          text UNIQUE   -- e.g. 'FOUNDING_1000'
  name          text
  description   text
  criteria      jsonb          -- e.g. { "type": "contributor_rank", "max_rank": 1000 }
  created_at    timestamptz

contributor_badges
  id             bigint identity PK
  contributor_id bigint FK → contributors.id
  badge_id       uuid FK → badges.id
  awarded_at     timestamptz
  UNIQUE(contributor_id, badge_id)
```

Exact award rules are an Open Decision (PRD §36.12, tracked as [Open Decision #8](#9-open-decisions) below) — schema supports rule-based (`criteria` jsonb) evaluation without a migration once rules are finalized.

Named `contributor_badges` here rather than PRD §23's `user_badges`, for the same reason `contributors` is used instead of `users` throughout this schema: there are no user accounts (PRD §4), so the owning entity is a contributor, not a user. No behavior implied by the PRD changes — this is a naming consistency choice.

### 3.10 `updates`

PRD §18.

```text
id                uuid PK
title             text NOT NULL
body              text NOT NULL
image_url         text NULLABLE
milestone_id      uuid FK → milestones.id, NULLABLE
status            text NOT NULL  -- 'DRAFT' | 'PUBLISHED'
created_by_admin_id bigint FK → admin_users.id
published_at      timestamptz NULLABLE
created_at / updated_at  timestamptz
```

### 3.11 `milestones`

PRD §17.

```text
id             uuid PK
label          text NOT NULL         -- e.g. '₹10 Lakh', 'MVP Launched'
target_amount_paise bigint NULLABLE  -- NULL for post-goal, non-monetary milestones
phase          text NOT NULL         -- 'PRE_GOAL' | 'POST_GOAL'
sort_order     int NOT NULL
achieved_at    timestamptz NULLABLE
created_at / updated_at timestamptz
```

Admin-configurable per PRD §17 ("Milestones must be configurable from admin").

### 3.12 `admin_users`

PRD §22, §25 (RBAC, MFA-ready).

```text
id            bigint identity PK
email         text UNIQUE NOT NULL
password_hash text NOT NULL
role          admin_role ENUM NOT NULL   -- SUPER_ADMIN | VERIFIER | CONTENT_EDITOR
mfa_enabled   boolean NOT NULL DEFAULT false
mfa_secret_encrypted text NULLABLE        -- encrypted at rest, never logged
status        text NOT NULL DEFAULT 'ACTIVE'  -- ACTIVE | DISABLED
created_at    timestamptz
last_login_at timestamptz NULLABLE
```

Exact role set beyond the three implied by PRD §22's task list (verify contributions, publish content, manage everything) is an Open Decision (§9).

### 3.13 `audit_logs`

PRD §22 ("every sensitive admin action must be logged"), §25.

```text
id            bigint identity PK
admin_user_id bigint FK → admin_users.id, NULLABLE   -- NULL for system-initiated actions
action        text NOT NULL              -- e.g. 'CONTRIBUTION_VERIFIED', 'UPDATE_PUBLISHED'
entity_type   text NOT NULL
entity_id     text NOT NULL
before_state  jsonb NULLABLE
after_state   jsonb NULLABLE
ip_address    text NULLABLE
created_at    timestamptz NOT NULL DEFAULT now()
```

Append-only. No `UPDATE`/`DELETE` grants at the application-role level.

### 3.14 `payment_webhook_events` (Phase 3)

Required once an automated gateway is introduced, to make webhook processing idempotent (PRD §10 "verify webhook signatures," §34 "duplicate webhook").

```text
id                bigint identity PK
provider          text NOT NULL
provider_event_id text NOT NULL
payload           jsonb NOT NULL
signature_valid   boolean NOT NULL
processed_at      timestamptz NULLABLE
created_at        timestamptz NOT NULL DEFAULT now()
UNIQUE(provider, provider_event_id)
```

Not needed for MVP's manual-UTR flow; included now so the schema doesn't need a breaking change when Phase 3 lands.

---

## 4. Enums

```text
contribution_status:
  CREATED, PAYMENT_PENDING, PAYMENT_SUBMITTED, VERIFYING, PAID,
  PIXELS_ASSIGNED, PUBLISHED,
  PAYMENT_FAILED, PAYMENT_EXPIRED, VERIFICATION_FAILED,
  REFUND_PENDING, REFUNDED
  -- exact transition graph: docs/PAYMENT.md §2

payment_status:
  PENDING, SUBMITTED, VERIFIED, FAILED, EXPIRED

referral_event_type:
  VISIT, CONTRIBUTION

admin_role:
  SUPER_ADMIN, VERIFIER, CONTENT_EDITOR
```

---

## 5. Concurrency-Critical Constraints (summary)

These three database-level guarantees are what make PRD §14's "no overlapping/duplicate allocations" and FR-09 ("exactly-once pixel allocation") true regardless of application bugs, retries, or concurrent requests:

1. `pixel_allocations.contribution_id` is `UNIQUE` → a contribution cannot be allocated twice.
2. `pixel_allocations.pixel_range` has a `GIST EXCLUDE ... WITH &&` constraint → two allocations can never overlap.
3. `pixel_cursor.next_index` is advanced by a single atomic `UPDATE ... RETURNING` statement (see `docs/PIXEL_SYSTEM.md` §2), so concurrent allocation requests are serialized by Postgres's own row-level locking, not application-level locks.

Full algorithm and transaction boundaries: `docs/PIXEL_SYSTEM.md`.

---

## 6. Read Path for the Pixel Wall

`GET /api/pixels?chunk=...` (see `docs/API.md`) queries `pixel_allocations` for allocations whose `pixel_range` intersects the requested chunk's range, joins to `contributions`/`contributors` for display name (respecting `anonymous`), and returns per-sub-range ownership. This is a range-containment query against an indexed `int8range` column — it scales sublinearly with total pixel count. See `docs/PIXEL_SYSTEM.md` §3.

---

## 7. Privacy-Sensitive Columns

Per PRD §16, §25, §26, the following are **never** exposed by any public (non-admin) API response, regardless of which table they live in:

| Data | Where it lives | Public exposure |
|---|---|---|
| Full UTR / provider reference | `payments.reference_hash` (hashed) | Never. Only `utr_last4` exists elsewhere, and even that is not shown back publicly. |
| Phone number, email, UPI ID | Not collected at all (PRD §4 non-goals, §26) | N/A — schema has no column for these by design |
| Full legal name | Not collected; only `display_name` (self-chosen) is stored | `display_name` is shown only if `anonymous = false` |
| IP address | `contributions.ip_hash` / `referral_events.ip_hash` — salted hash only | Never |
| Admin credentials, MFA secrets | `admin_users` | Never (also excluded from admin-facing list views beyond the current user's own row) |
| Raw webhook payloads | `payments.raw_provider_payload`, `payment_webhook_events.payload` | Admin/audit only |

Public API response shapes are defined as explicit allowlists in `docs/API.md`, not derived by blocklisting fields off the full row — this is a deliberate defense against a future column addition accidentally leaking through a public endpoint.

---

## 8. Data Retention

PRD §26 requires a retention/deletion policy but does not specify durations. Recommended default (pending legal review, PRD §27):

- `ip_hash`/`user_agent_hash` on `contributions`/`referral_events`: retained only as long as needed for fraud/duplicate detection, then nulled out by a scheduled job (exact window is an Open Decision, §9).
- `payments.raw_provider_payload`: retained per payment-provider/financial recordkeeping requirements (Open Decision, §9 — needs legal/finance input, PRD §27).
- `audit_logs`: retained indefinitely (append-only compliance trail); no deletion path in MVP.

---

## 9. Open Decisions

1. **Contributor identity model.** Should a `contributors` row ever represent more than one contribution from the same real person (e.g. recognized via a referral code they claim, or a repeat visit), or does MVP strictly keep 1 contribution : 1 contributor row? PRD has no login to establish identity, so this is a product policy question, not just schema.
2. **Full UTR/reference storage.** Store only a salted hash (current design, stricter than PRD's minimum), or store the full value encrypted-at-rest because an admin needs it for manual bank-statement reconciliation? Affects `payments.reference_hash`.
3. **Minimum/maximum contribution amount.** PRD §9.2 lists presets starting at ₹1 with a "Custom" option and no stated ceiling; a payment-provider technical minimum may apply (PRD §36.9). Affects the `CHECK` constraint on `contributions.amount_paise`.
4. **Refund-after-allocation policy.** PRD §34 lists "payment refunded after allocation" as an edge case to handle but does not state the pixel outcome. Schema supports either (revoke the `pixel_allocations` row, or keep it and only flag the contribution `REFUNDED` for financial-totals purposes) — see `docs/PAYMENT.md` §6 for the same open question from the state-machine angle.
5. **IP/user-agent hash retention window** and **raw provider payload retention window** — needs legal/finance input (PRD §27).
6. **Exact `admin_role` set** — PRD §22 implies verification, content, and moderation duties but does not enumerate roles; `SUPER_ADMIN / VERIFIER / CONTENT_EDITOR` is a reasonable starting split, subject to change.
7. **Whether contribution amount is public** (PRD §36.6) determines whether `contributions.amount_paise` is ever exposed via `GET /api/contributors` or only `pixel_count` is shown.
8. **Exact badge/referral award rules** (PRD §36.12) — e.g. thresholds for Founding/Early Believer/Dream Builder/Million Pixel Club (PRD §21). Affects the `criteria` populated on each `badges` row (§3.9); the schema does not need to change once rules are set, only the seeded data.
