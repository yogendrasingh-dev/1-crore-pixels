# API Design

**Source of truth:** `docs/PRD.md` §24 (API sketch), §25 ("all payment-sensitive operations must be server-side," "no sensitive payment data in public APIs"). This document expands the sketch into concrete contracts. It does not add endpoints beyond what the PRD's flows require.

All endpoints are served from `apps/web` (see `docs/ARCHITECTURE.md`). All request/response bodies are JSON unless noted. All amounts in requests/responses are in **rupees** (integer or decimal-safe string) at the API boundary for readability; internally they are stored as paise (`docs/DATABASE.md`).

---

## 1. Conventions

- **Auth:** Public endpoints require no authentication (PRD §4/§9 — no signup/login). Admin endpoints (`/api/admin/*`) require an authenticated admin session and are RBAC-checked per action (`docs/SECURITY.md`).
- **Idempotency:** Any endpoint that creates a money- or pixel-affecting record accepts an `Idempotency-Key` header. A repeated request with the same key returns the original result rather than creating a duplicate (PRD §10 "use idempotency," §34 duplicate-submission edge cases).
- **Rate limiting:** High-risk public endpoints (contribution creation, UTR submission, referral visit logging) are rate-limited per IP (`docs/SECURITY.md`).
- **Public response allowlisting:** Every public endpoint's response shape is defined explicitly below. No public endpoint returns a full database row. Fields not listed here are never included, per PRD §25/§35.
- **Errors:** Standard shape `{ "error": { "code": "STRING_CODE", "message": "human-readable" } }` with an appropriate HTTP status. Validation errors use `422`; auth/authz failures use `401`/`403`; rate-limit failures use `429`.

---

## 2. Public Endpoints

### 2.1 `POST /api/contributions`

Creates a contribution record before any payment happens (PRD §9, §35 "unique contribution record is created before payment").

**Request**
```json
{
  "displayName": "Rahul",
  "anonymous": false,
  "amountRupees": 101,
  "referralCode": "rahul-7f3a"
}
```
Headers: `Idempotency-Key: <client-generated-uuid>` (recommended; server generates one if omitted, tied to the response only, not to retries).

**Server behavior:**
- Validates `displayName` (length, character set, offensive/spam moderation queue per PRD §9.1), `amountRupees` (positive, within configured min/max — Open Decision, `docs/DATABASE.md` §9.3), `referralCode` (must exist if provided; invalid codes are ignored, not rejected, so a bad/stale referral link never blocks a contribution).
- Creates `contributions` row with `status = CREATED`, creates a matching `contributors` row (`docs/DATABASE.md` §3.2).
- If `referralCode` is valid, records a `referral_events(event_type = VISIT)` at the time of landing (see §2.7) and will record `CONTRIBUTION` once payment is verified — not at creation time, since creation alone is not a conversion.

**Response `201`**
```json
{
  "contributionId": "C_82931",
  "status": "CREATED",
  "amountRupees": 101,
  "displayName": "Rahul",
  "anonymous": false
}
```

Never returned: internal bigint id, `ip_hash`, `idempotency_key`, anything payment-related (no payment exists yet).

---

### 2.2 `POST /api/contributions/{id}/qr`

Generates the payment attempt and dynamic UPI QR (PRD §11, §24 `POST /api/payments/qr`, scoped to a contribution). `{id}` is the public code (e.g. `C_82931`).

**Request:** empty body.

**Server behavior:**
- Contribution must be in `CREATED` or `PAYMENT_PENDING` (re-requesting QR for an unpaid, non-expired contribution is allowed — e.g. user refreshed the page).
- Calls `PaymentProvider.createPaymentRequest()` (`docs/PAYMENT.md`) to create a `payments` row (`status = PENDING`) tied to this contribution, with a UPI deep link encoding the contribution's `public_code` as the transaction note/reference (PRD §11 — "QR identifies the payment/contribution transaction, not the person's name").
- Transitions contribution to `PAYMENT_PENDING`, sets `expires_at`.

**Response `200`**
```json
{
  "contributionId": "C_82931",
  "status": "PAYMENT_PENDING",
  "upiDeepLink": "upi://pay?pa=...&pn=...&am=101.00&tr=C_82931&cu=INR",
  "qrImageUrl": "https://.../qr/C_82931.png",
  "amountRupees": 101,
  "expiresAt": "2026-09-04T21:10:00Z"
}
```

Never returned: `provider`, `provider_payment_id`, any raw payment-provider payload.

---

### 2.3 `POST /api/contributions/{id}/utr`

Submits the assisted-matching signal (PRD §12).

**Request**
```json
{ "utrLast4": "4821" }
```

**Server behavior:**
- Contribution must be in `PAYMENT_PENDING` (or `PAYMENT_SUBMITTED`, to allow correction of a mistyped value before verification starts — exact re-submission policy is an implementation detail, not a product one, as long as the invariant below holds).
- Stores `utrLast4` on the contribution and the active `payments` row, transitions contribution to `PAYMENT_SUBMITTED` then `VERIFYING` once queued for review.
- **Never transitions to `PAID` from this endpoint.** This endpoint only records a signal; matching/verification happens per `docs/PAYMENT.md` §3, either by an admin (MVP) or an automated webhook (Phase 3) — never by the mere presence of four digits (PRD §12, FR-08, Acceptance Criteria §35).

**Response `202`**
```json
{
  "contributionId": "C_82931",
  "status": "VERIFYING"
}
```

---

### 2.4 `GET /api/contributions/{id}`

Status polling for the contribution flow's UI (so the frontend can show "waiting for verification" without trusting its own prior state).

**Response `200`**
```json
{
  "contributionId": "C_82931",
  "status": "PIXELS_ASSIGNED",
  "displayName": "Rahul",
  "anonymous": false,
  "amountRupees": 101,
  "pixelRange": { "start": 184201, "end": 184302, "count": 101 }
}
```

`pixelRange` is present only once `status` is `PIXELS_ASSIGNED` or later. Never returned: `utrLast4`, `payment_reference`/provider fields, `rejectionReason` detail beyond a generic user-facing message if `VERIFICATION_FAILED` (the detailed reason is for admins only).

---

### 2.5 `GET /api/progress`

Homepage/live-progress data (PRD §8.2). Backed by `campaign_totals` (`docs/DATABASE.md` §3.6) — O(1) read.

**Response `200`**
```json
{
  "totalRaisedRupees": 284921,
  "goalRupees": 10000000,
  "percentFunded": 2.85,
  "verifiedContributorCount": 1942,
  "pixelsClaimed": 284921,
  "updatedAt": "2026-09-04T21:00:00Z"
}
```

Cache-Control: short TTL (e.g. `s-maxage=10, stale-while-revalidate=30`) — safe because the underlying value only changes on verified payment events (`docs/DEPLOYMENT.md`).

---

### 2.6 `GET /api/pixels?chunk={chunkId}`

Chunked pixel wall data (PRD §15). See `docs/PIXEL_SYSTEM.md` for chunk addressing.

**Response `200`**
```json
{
  "chunkId": "chunk_3",
  "bounds": { "chunkIndex": 3, "rowStart": 75, "rowEnd": 100, "pixelStart": 300000, "pixelEnd": 400000 },
  "allocations": [
    { "start": 300010, "end": 300111, "displayName": "Rahul", "anonymous": false },
    { "start": 300500, "end": 300501, "displayName": "Anonymous", "anonymous": true }
  ]
}
```

Only claimed sub-ranges are returned; everything else in the chunk is unclaimed. `anonymous: true` entries always carry `displayName: "Anonymous"` — the real stored name is never sent to this endpoint's response.

### 2.6.1 `GET /api/pixels/{pixelId}`

Deep-link support (PRD §15 "deep-link to a pixel location").

**Response `200`**
```json
{ "pixelId": 300010, "claimed": true, "displayName": "Rahul", "anonymous": false, "contributionId": "C_82931" }
```

---

### 2.7 `GET /api/contributors`

Public contributors wall (PRD §8.6, §16). Paginated, most-recent-first by default; supports name search subject to privacy rules (PRD §15).

Query params: `?limit=&cursor=&search=`

**Response `200`**
```json
{
  "items": [
    { "displayName": "Rahul", "anonymous": false, "pixelCount": 101, "contributedAgo": "2m ago" },
    { "displayName": "Anonymous", "anonymous": true, "pixelCount": 11, "contributedAgo": "5m ago" }
  ],
  "nextCursor": "..."
}
```

Only `status = PUBLISHED` contributions are eligible. Whether `amountRupees` appears here at all is gated by PRD §36.6 (Open Decision) — until decided, it is omitted.

---

### 2.8 `GET /api/referrals/{code}`

Resolves a referral code for landing-page personalization (PRD §20). Side-effect-free and cacheable.

**Response `200`**
```json
{ "code": "rahul-7f3a", "ownerDisplayName": "Rahul" }
```

### 2.8.1 `POST /api/referrals/{code}/visit`

Records a visit event (kept separate from the `GET` above so the `GET` stays cacheable/side-effect-free).

**Request:** empty body. **Response `204`.**

---

### 2.9 `GET /api/updates`, `GET /api/milestones`

Public content listings (PRD §18, §17). Standard paginated read endpoints returning only `PUBLISHED` updates and configured milestones. No request/response detail beyond the fields in `docs/DATABASE.md` §3.10–3.11 is prescribed by the PRD.

---

## 3. Payment Webhook (Phase 3)

### `POST /api/payments/webhook`

Not active in MVP (manual UTR-assisted flow has no gateway to call back). Reserved now so the contract is stable when Phase 3 lands (PRD Phase 3, Goal 7).

- Verifies the provider's signature header before parsing the body (PRD §25).
- Looks up/creates a `payment_webhook_events` row keyed by `(provider, provider_event_id)`; if it already exists and `processed_at` is set, returns `200` immediately without reprocessing (idempotent — PRD §10, §34 "duplicate webhook").
- On first processing, resolves the associated `payments`/`contributions` row via `provider_payment_id`, and if the evidence is sufficient, drives the same conditional state transition + pixel allocation transaction described in `docs/PAYMENT.md` §4 — the same code path a manual admin verification uses, not a separate one.
- Always returns `200` quickly (per typical gateway conventions) even if downstream processing is deferred to a queue (`docs/ARCHITECTURE.md` §10); the gateway should not retry-storm on a slow synchronous handler.

---

## 4. Admin Endpoints

All under `/api/admin/*`. All require an authenticated admin session; each action is checked against the caller's `admin_role` (`docs/DATABASE.md` §3.12, `docs/SECURITY.md`). Every state-changing call here writes an `audit_logs` row in the same transaction as the effect (PRD §22 "every sensitive admin action must be logged").

| Endpoint | Purpose |
|---|---|
| `POST /api/admin/auth/login` | Admin login (credentials + MFA if enabled) |
| `POST /api/admin/auth/logout` | Ends admin session |
| `GET /api/admin/contributions` | Verification queue; filters: `status`, `search`, date range |
| `GET /api/admin/contributions/{id}` | Full detail including payment evidence, audit trail — the only place this data is ever returned |
| `POST /api/admin/contributions/{id}/verify` | Conditional transition to `PAID` → triggers pixel allocation (`docs/PAYMENT.md` §4). Role: `VERIFIER`+ |
| `POST /api/admin/contributions/{id}/reject` | Transition to `VERIFICATION_FAILED` with a reason. Role: `VERIFIER`+ |
| `POST /api/admin/contributions/{id}/refund` | Transition to `REFUND_PENDING`/`REFUNDED` (policy per `docs/PAYMENT.md` §6, Open Decision). Role: `SUPER_ADMIN` |
| `POST /api/admin/contributions/{id}/moderate-name` | Hide/replace an inappropriate display name (PRD §9.1, §16). Role: `CONTENT_EDITOR`+ |
| `POST /api/admin/updates` / `PATCH /api/admin/updates/{id}` | Publish/edit updates (PRD §18). Role: `CONTENT_EDITOR`+ |
| `POST /api/admin/milestones` / `PATCH /api/admin/milestones/{id}` | Manage milestones (PRD §17). Role: `CONTENT_EDITOR`+ |
| `GET /api/admin/audit-logs` | Audit trail viewer. Role: `SUPER_ADMIN` |
| `GET /api/admin/dashboard` | Totals, pending amount, verified contributor count, pixel count, recent contributions (PRD §22) |

**Response shapes for admin endpoints are not allowlisted as strictly as public ones** — admins are trusted, authenticated, and audited — but raw secrets (password hashes, MFA secrets, other admins' credentials) are still never returned by any endpoint, admin or not.

---

## 5. Endpoints Explicitly Not Built for MVP

Per PRD non-goals (§4) and Phase 3 scoping:
- No login/signup endpoints for contributors.
- No wallet/balance endpoints.
- No cash-referral payout endpoints (PRD §20 — recognition only, not commissions).
- `POST /api/payments/webhook` exists as a contract placeholder but is not wired to a live provider until Phase 3.

---

## 6. Open Decisions

1. Exact pagination style (`cursor` vs `offset`) — not a product concern, left to implementation, but noted so it isn't assumed elsewhere.
2. Whether `GET /api/contributors` / `GET /api/pixels/{id}` ever expose `amountRupees` — depends on PRD §36.6.
3. Rate-limit thresholds per endpoint — see `docs/SECURITY.md` Open Decisions.
4. Whether admin login supports SSO in addition to password+MFA — not specified in PRD; password+MFA-ready is the documented minimum (PRD §25).
