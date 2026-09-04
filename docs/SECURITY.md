# Security & Privacy

**Source of truth:** `docs/PRD.md` §25 (security), §26 (privacy), §27 (legal/trust — cross-referenced, not duplicated here). This document turns each PRD requirement into a concrete control. Where PRD requires "professional advice before launch" (§27), this document does not attempt to substitute for that advice — it is flagged under Open Decisions.

---

## 1. Transport & Infrastructure

- **HTTPS everywhere** (PRD §25) — enforced at the hosting/CDN edge; HTTP requests redirect, no plaintext endpoint exists, including the webhook URL (Phase 3).
- **Secrets in environment/secret manager, never in source control** (PRD §25) — payment provider keys, DB connection strings, admin session signing keys, webhook signing secrets. See `docs/DEPLOYMENT.md` for the concrete mechanism per environment.
- **Database backups + tested restore process** (PRD §25) — see `docs/DEPLOYMENT.md` §6.

---

## 2. Input Validation

- All request bodies validated server-side with schema validation (zod, in `packages/core`) before touching business logic — the frontend's validation is UX only, never trusted (consistent with PRD §38's "never treat frontend ... state as proof").
- **Amount validation** (PRD §25): `amountRupees` must be a positive integer (or decimal with at most 2 places, converted to integer paise), within a configured min/max (`docs/DATABASE.md` §9.3, Open Decision on exact bounds). Requests outside range are rejected with `422`, not silently clamped.
- **Display name validation** (PRD §9.1): length limits, allowed character set, HTML/script tag stripping, and a moderation check against an offensive/spam wordlist before the contribution is created. Names that fail automated moderation are held for admin review rather than silently rejected or silently accepted (mirrors the "ambiguous stays pending" philosophy applied to payments, PRD §12).
- **Referral code validation** (`docs/API.md` §2.1): unknown/malformed codes are ignored, not rejected — a broken referral link must never block a contribution.

---

## 3. Rate Limiting & Bot Protection

PRD §25: "Rate limiting," "Bot protection on high-risk endpoints." PRD §34 edge case: "Bot-created pending contributions," "Traffic spike."

| Endpoint | Risk | Control |
|---|---|---|
| `POST /api/contributions` | Bot-created pending contributions, spam names | Per-IP rate limit (Redis token bucket); CAPTCHA/challenge (e.g. Cloudflare Turnstile) on suspected-bot traffic; honeypot field |
| `POST /api/contributions/{id}/utr` | Brute-forcing last-4 against another user's contribution to falsely trigger a match | Per-IP + per-contribution rate limit; matching logic (`docs/PAYMENT.md` §3) never accepts last-4 alone regardless of attempt count, so brute force cannot itself produce a false `PAID` |
| `POST /api/referrals/{code}/visit` | Referral-count inflation | Per-IP + per-referral debounce window |
| `POST /api/admin/auth/login` | Credential stuffing | Per-IP + per-account lockout/backoff |
| `POST /api/payments/webhook` (Phase 3) | Forged webhook calls | Signature verification is the primary control (§4), not rate limiting, but basic rate limiting still applies as defense in depth |

Exact numeric thresholds are an Open Decision (§9) — they depend on expected legitimate traffic patterns not yet measured.

---

## 4. Webhook Security (Phase 3)

- Every incoming webhook's signature is verified against the provider's shared secret **before** the payload is parsed or persisted beyond the raw bytes needed for verification (PRD §25 "webhook signature validation").
- Invalid signatures are rejected (`401`) and logged, never processed.
- A timestamp/replay window check rejects webhook deliveries outside a reasonable clock-skew tolerance, mitigating replay of a captured valid payload.
- Duplicate deliveries are absorbed by the `payment_webhook_events` unique constraint (`docs/DATABASE.md` §3.14) before they can affect contribution state twice (PRD §34 "duplicate webhook").

---

## 5. Admin Authentication & Authorization

PRD §25: "Admin RBAC," "Admin MFA-ready architecture." PRD §22.

- Admin accounts (`admin_users`, `docs/DATABASE.md` §3.12) use password hashing (e.g. bcrypt/argon2) — never plaintext, never reversible encryption.
- **RBAC**: every admin endpoint declares the minimum role required (`docs/API.md` §4); role checks happen server-side on every request, not just hidden in the admin UI.
- **MFA-ready**: schema carries `mfa_enabled`/`mfa_secret_encrypted` from day one so TOTP-based MFA can be turned on without a schema migration, even if not enforced for the very first admin users.
- Admin sessions use secure, `HttpOnly`, `SameSite` cookies; session tokens are rotated on login and invalidated on logout.
- Admin login is rate-limited and lockout-protected (§3).

---

## 6. Audit Logging

PRD §22: "Every sensitive admin action must be logged." PRD §25.

- Every state-changing admin endpoint (`docs/API.md` §4) writes an `audit_logs` row (`docs/DATABASE.md` §3.13) in the **same transaction** as the effect it records — an action and its audit trail cannot exist independently of each other.
- `audit_logs` is append-only: the application's database role has no `UPDATE`/`DELETE` grant on it.
- Logged fields include actor (`admin_user_id`), action, affected entity, before/after state snapshot, and request IP — enough to reconstruct what happened and who did it, without logging payment secrets themselves (raw payloads that must be retained live in `payments.raw_provider_payload`, referenced by ID, not duplicated into the audit log).

---

## 7. Web Application Security

- **XSS** (PRD §25): React's default output escaping covers rendering; user-supplied `displayName` and update/milestone content are additionally sanitized server-side before storage (defense in depth — never rely solely on render-time escaping for content that may be reused in non-React contexts like share images or emails). A Content-Security-Policy header restricts script sources.
- **CSRF** (PRD §25, "where applicable"): the public contribution API is not cookie-authenticated, so classic CSRF (which relies on ambient cookie credentials) does not apply to it the same way — but `Origin`/`Referer` checks are still applied to state-changing public endpoints as defense in depth. The admin surface **is** cookie-session-authenticated, so it uses CSRF tokens on all state-changing admin forms/requests.
- **SQL injection** (PRD §25): all database access goes through Prisma's parameterized queries; the only raw SQL in the system is the pixel-allocation cursor statement (`docs/PIXEL_SYSTEM.md` §2.2) and range queries (`docs/PIXEL_SYSTEM.md` §3.3–3.4), which use parameter binding, never string concatenation of user input.

---

## 8. Payment-Data Exposure Boundary

PRD §25/§35: "No sensitive payment data in public APIs." This is enforced structurally, not by convention:

- Public endpoint response shapes are explicit allowlists defined in `docs/API.md`, never a serialization of the full database row (`docs/DATABASE.md` §7 lists exactly what must never appear).
- Full UTR/provider references are never stored in plaintext at all (`docs/DATABASE.md` §3.3) — there is no plaintext value to leak even if a public endpoint were misconfigured.
- Raw webhook payloads and admin-only payment evidence live in fields (`payments.raw_provider_payload`, full contribution detail) that only `GET /api/admin/contributions/{id}` reads — no public route selects those columns.
- Recommended process control: a lint rule or code-review checklist item requiring any new public API response type to be reviewed against `docs/DATABASE.md` §7 before merge (see `docs/TESTING.md` for the corresponding automated test).

---

## 9. Privacy

PRD §26.

- **No mandatory signup** — enforced by product design (no accounts exist at all for contributors).
- **Minimum necessary data**: no phone/email/UPI ID is ever collected from contributors (there is no form field for it) — this is a data-minimization decision baked into the schema (`docs/DATABASE.md` §7), not just a policy statement.
- **Anonymous option**: `contributions.anonymous` / `contributors.anonymous`, enforced at the query layer — any query that assembles a public-facing display name checks this flag and substitutes `"Anonymous"` before the row leaves the server; the real name is never sent to the client alongside `anonymous: true`.
- **IP/user-agent**: stored only as salted hashes (`ip_hash`, `user_agent_hash`), used only for fraud/rate-limit signals, retained for a bounded window (`docs/DATABASE.md` §8, Open Decision on exact duration).
- **Consent language / privacy policy / retention-deletion policy publication**: content requirements, not engineering controls — tracked as Open Decisions here because they gate what the engineering retention job actually does (§9 below), but the policy text itself is a legal/product deliverable (PRD §27).
- **Applicable Indian privacy/payment requirements** (PRD §26: "must be reviewed before launch," e.g. DPDP Act considerations) — explicitly deferred to professional legal review per PRD §27; not something this document can resolve.

---

## 10. Threat Model Summary (mapped to PRD §34 edge cases)

| Threat | Mitigation |
|---|---|
| Forged/duplicate payment claims | Server-authoritative state machine + evidence-based manual verification (`docs/PAYMENT.md`) |
| Double pixel allocation via retry/race | DB-level constraints, not application locking (`docs/PIXEL_SYSTEM.md` §2) |
| Bot flooding the contribution funnel | Rate limiting + bot challenge (§3) |
| Admin account compromise | RBAC + MFA-ready + audit trail + lockout (§5, §6) |
| Data leak via public API | Allowlisted response shapes, no plaintext sensitive fields exist to leak (§8) |
| Webhook forgery/replay (Phase 3) | Signature verification + replay window + idempotency (§4) |
| XSS via display name or admin-authored content | Server-side sanitization + CSP + React escaping (§7) |

---

## 11. Open Decisions

1. Exact rate-limit thresholds per endpoint (§3) — needs real traffic estimates.
2. IP/user-agent hash retention window (`docs/DATABASE.md` §8).
3. Whether the full UTR/reference is ever stored (encrypted) for manual reconciliation, vs. hash-only as currently designed (`docs/PAYMENT.md` §6, `docs/DATABASE.md` §9.2).
4. Exact CAPTCHA/bot-challenge provider — not specified in PRD, implementation detail.
5. Formal legal/compliance review of Indian privacy and payment-collection requirements (DPDP Act, RBI/UPI merchant category rules for the collection account) — explicitly required before public launch by PRD §26/§27 and out of scope for this engineering document.
6. Whether MFA is enforced for all admins at launch or only "ready" (architecture supports it either way, per §5).
