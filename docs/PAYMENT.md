# Payment Architecture

**Source of truth:** `docs/PRD.md` §10–§13, §34, §35. This is the most sensitive subsystem in the product: PRD §38 explicitly instructs "never treat frontend payment state as payment proof" and "never allocate pixels twice." Every design decision here is subordinate to those two rules.

---

## 1. Critical Rules (restated from PRD §10)

- Never trust frontend payment-success state.
- Verify payment server-side.
- Verify webhook signatures when supported.
- Use idempotency.
- Never allocate pixels twice.
- Never publish an unverified contribution.
- Keep payment audit information private.

Everything below exists to satisfy these seven rules under concurrency and at scale.

---

## 2. Contribution State Machine

Exact states from PRD §13:

```text
CREATED
   ↓
PAYMENT_PENDING
   ↓
PAYMENT_SUBMITTED
   ↓
VERIFYING
   ↓
PAID
   ↓
PIXELS_ASSIGNED
   ↓
PUBLISHED
```

Failure states (PRD §13):

```text
PAYMENT_FAILED
PAYMENT_EXPIRED
VERIFICATION_FAILED
REFUND_PENDING
REFUNDED
```

### 2.1 Transition table

| From | To | Trigger | Server guard |
|---|---|---|---|
| — | `CREATED` | `POST /api/contributions` | Validation passes |
| `CREATED` | `PAYMENT_PENDING` | `POST /api/contributions/{id}/qr` | Contribution exists, not already paid |
| `PAYMENT_PENDING` | `PAYMENT_EXPIRED` | Expiry job/check | `now() > expires_at` and still unpaid |
| `PAYMENT_PENDING` | `PAYMENT_SUBMITTED` | `POST /api/contributions/{id}/utr` | Contribution in `PAYMENT_PENDING` |
| `PAYMENT_SUBMITTED` | `VERIFYING` | Automatic, same request as above | Queued for matching |
| `VERIFYING` | `PAID` | Admin verify (MVP) or webhook match (Phase 3) | **Conditional update**: `UPDATE contributions SET status='PAID' WHERE id=:id AND status='VERIFYING' RETURNING id` — zero rows affected means another process already transitioned it; abort without side effects. This single statement is the idempotency boundary (PRD §10, FR-09). |
| `VERIFYING` | `VERIFICATION_FAILED` | Admin reject, or no evidence found within policy window | Same conditional-update pattern |
| `PAID` | `PIXELS_ASSIGNED` | Same transaction as the `PAID` transition | Pixel allocation engine (`docs/PIXEL_SYSTEM.md`) runs inside the same DB transaction that sets `PAID` — these are never two separate transactions, to avoid a window where a contribution is `PAID` but not yet allocated and could be double-processed by a retry |
| `PIXELS_ASSIGNED` | `PUBLISHED` | Same transaction | Sets `published_at`; only `PUBLISHED` contributions appear on public wall/contributors list (PRD §35) |
| `PAID`/`PIXELS_ASSIGNED`/`PUBLISHED` | `REFUND_PENDING` | Admin refund action | See §6 (Open Decision on pixel treatment) |
| `REFUND_PENDING` | `REFUNDED` | Admin confirms refund processed | |
| `PAYMENT_FAILED` | (terminal) | Provider reports failure (Phase 3) or admin marks failed | No pixels ever allocated |

**Invariant enforced by design, not just convention:** a contribution can only ever reach `PIXELS_ASSIGNED` via the single code path in `packages/core` that (a) performs the conditional `PAID` update, (b) calls the pixel allocation engine, and (c) updates `campaign_totals` — all in one transaction. There is no second way to allocate pixels. This is what makes "never allocate pixels twice" true even if an admin double-clicks verify, a webhook fires twice, or two requests race (PRD §34's "concurrent payments" and "webhook before frontend response" edge cases).

---

## 3. Verification Matching (MVP: manual, UTR-assisted)

PRD §12 is explicit: the last-4 digits are an **assisted matching signal**, never sufficient proof by themselves, and ambiguous cases must remain `PENDING` for manual/assisted review.

**Evidence considered when an admin reviews a `VERIFYING` contribution** (PRD §12's list, applied literally):

1. Contribution amount (`contributions.amount_paise`) vs. what the admin observes in the actual bank/UPI statement.
2. Contribution ID (`public_code`) — since the UPI deep link encodes it as the transaction note/reference (`docs/API.md` §2.2), a matching note in the bank statement is strong evidence.
3. UTR/reference suffix (`utr_last4`) vs. the statement's transaction reference.
4. Approximate payment time (`payment_submitted_at` vs. statement timestamp).
5. Provider/bank payment evidence available to the admin (e.g. a UPI app screenshot, statement export — process detail, not an API contract).

**Matching outcomes:**

- **Clear match** (amount + reference/note + time window all align, no conflicting candidate): admin calls `POST /api/admin/contributions/{id}/verify` → `PAID`.
- **Ambiguous** (e.g. two pending contributions share the same amount and last-4 — PRD §34 edge case): contribution **stays `VERIFYING`**, surfaced in the admin queue with the conflicting candidates shown side by side, until an admin can disambiguate using the contribution ID/note or additional evidence. It is never auto-approved on partial evidence.
- **No evidence found within a policy window**: admin rejects → `VERIFICATION_FAILED`, with `rejection_reason` recorded.

**Explicitly forbidden implementation:** any code path that sets `status = 'PAID'` solely because `utr_last4` was submitted and non-null. The `utr` submission endpoint (`docs/API.md` §2.3) only ever moves a contribution to `VERIFYING` — it has no code path to `PAID`.

### 3.1 Duplicate/fraud signals surfaced to the admin queue

- Same `amount_paise` + same `utr_last4` across multiple `VERIFYING` contributions (PRD §34).
- Duplicate UTR suffix submitted for a contribution that already has a different `utr_last4` recorded (possible correction vs. possible fraud — surfaced, not auto-resolved).
- Multiple `CREATED`/`PAYMENT_PENDING` contributions from the same `ip_hash` in a short window (bot-created pending contributions, PRD §34) — a rate-limiting concern primarily (`docs/SECURITY.md`), but also visible to admins as a fraud signal.

---

## 4. Payment Provider Abstraction

To satisfy PRD Goal 7 ("payment infrastructure can later move from UTR-assisted verification to automated gateway webhooks without redesigning the product") and the instruction to keep provider-specific code behind an abstraction, `packages/payment-providers` defines one interface that both `apps/web` and `packages/core` depend on:

```ts
interface PaymentProvider {
  // Creates a payment attempt for a contribution and returns what the
  // client needs to pay (deep link / QR data). Always creates a `payments`
  // row with status PENDING.
  createPaymentRequest(contribution: Contribution): Promise<PaymentRequest>;

  // MVP (manual provider): no-op / not implemented — verification happens
  // via the admin action in §3, not via provider callback.
  // Phase 3 (gateway provider): verifies a webhook signature and returns
  // normalized evidence (amount, provider_payment_id, status) for the
  // shared verification transaction described in §2.
  handleWebhook?(rawRequest: RawWebhookRequest): Promise<NormalizedPaymentEvent>;

  // Optional active status check (Phase 3 gateways that support polling).
  checkStatus?(payment: Payment): Promise<PaymentStatus>;
}
```

### 4.1 `ManualUpiProvider` (MVP)

- `createPaymentRequest`: builds a UPI deep link (`upi://pay?pa=<payee-vpa>&pn=<payee-name>&am=<amount>&tr=<public_code>&cu=INR`) and a server-rendered QR image encoding that link. The transaction reference (`tr`) is the contribution's `public_code`, per PRD §11's distinction — the QR identifies the payment/contribution, not the person.
- No `handleWebhook` — there is no gateway to call back. Verification is entirely the admin flow in §3.
- Payee VPA/name are configuration (`docs/DEPLOYMENT.md` — secrets/env), not hardcoded.

### 4.2 `GatewayProvider` (Phase 3, e.g. Razorpay/Cashfree-class UPI aggregator)

- `createPaymentRequest`: calls the provider's order/intent API, returns the provider's hosted QR/deep link, stores `provider_payment_id`.
- `handleWebhook`: verifies the HMAC signature using the provider's webhook secret, rejects on mismatch (PRD §10, §25), normalizes the payload, and returns evidence that feeds the **same** conditional-transition transaction described in §2 — automated verification does not get a separate, looser code path than manual verification. This is what lets Phase 3 "not redesign the product": the state machine and allocation engine are unchanged; only the source of verification evidence changes.
- Idempotency: `payment_webhook_events` unique on `(provider, provider_event_id)` absorbs duplicate deliveries before they reach the state-transition code (`docs/DATABASE.md` §3.14, PRD §34 "duplicate webhook").

### 4.3 What must never depend on a concrete provider

- `packages/core`'s state machine and pixel allocation engine.
- Any public API response shape (`docs/API.md`).
- The admin verification UI's data model (it should render "evidence," not "Razorpay's specific field names").

---

## 5. Edge Cases (mapped from PRD §34)

| Edge case | Handling |
|---|---|
| Payment succeeds but browser closes | Irrelevant to server state — the contribution just sits in `PAYMENT_PENDING`/`VERIFYING` until the user returns and submits UTR, or an admin finds matching evidence independently. `GET /api/contributions/{id}` lets the frontend recover status on reload. |
| Wrong UTR suffix | Admin sees no match; contribution stays `VERIFYING` or is rejected; user can be prompted to re-submit (§`docs/API.md` §2.3 allows re-submission pre-verification). |
| Same amount + same UTR suffix for multiple users | Surfaced as an ambiguous case (§3.1); resolved manually using contribution ID/note, never auto-approved. |
| Duplicate UTR submission | Idempotent write to the same contribution's `utr_last4`; does not create a second `payments` row unless a genuinely new payment attempt (new QR) was made. |
| Amount mismatch | Evidence doesn't match `amount_paise`; admin rejects or investigates; never silently accepted at a different amount than requested (pixel count must match rupees paid, PRD §14). |
| Duplicate webhook (Phase 3) | Absorbed by `payment_webhook_events` unique constraint (§4.2). |
| Webhook before frontend response (Phase 3) | Fine — the webhook drives the same transaction the admin path would; the frontend's `GET /api/contributions/{id}` polling will simply reflect `PAID`/`PIXELS_ASSIGNED` whenever it next checks. |
| Payment pending indefinitely | `expires_at` + expiry transition to `PAYMENT_EXPIRED`; user can start a fresh payment attempt. |
| Payment refunded after allocation | See §6 — Open Decision. |
| Bot-created pending contributions | Rate limiting + bot protection at creation (`docs/SECURITY.md`); does not affect verification logic since unpaid contributions never reach `PAID`. |
| Pixel allocation race condition / concurrent payments | Handled by the DB-level guarantees in `docs/DATABASE.md` §5 and `docs/PIXEL_SYSTEM.md` §2 — not by application locking. |

---

## 6. Open Decisions

1. **Refund-after-allocation pixel policy.** PRD §34 lists this as an edge case to handle but does not state the product outcome. Two technically valid options:
   - (a) Revoke the pixel allocation (delete/void the `pixel_allocations` row, decrement `campaign_totals`, free the pixel range — though freed ranges complicate the "deterministic, gap-free" allocation model in `docs/PIXEL_SYSTEM.md` and would need a defined re-use policy).
   - (b) Keep the pixels allocated (contributor keeps their "mark on the wall") but flag the contribution `REFUNDED` and exclude the amount from `campaign_totals`/public financial totals only.
   This is a product/legal policy decision (ties into PRD §27/§36.5 refund policy), not an engineering one — engineering will implement whichever is chosen.
2. **Verification SLA / policy window** before an unmatched `VERIFYING` contribution is rejected — not specified in PRD.
3. **Minimum contribution enforced by the eventual payment provider** (PRD §36.9) may constrain the ₹1 hook technically; needs confirmation during provider onboarding (PRD Phase 0).
4. **Whether the manual `ManualUpiProvider` payee VPA is a personal or business UPI ID** — subject to PRD §27's "use an appropriate business/payment account... subject to professional advice."
