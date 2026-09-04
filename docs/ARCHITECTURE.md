# Architecture

**Source of truth:** `docs/PRD.md`. This document translates the PRD into a concrete system design. It does not add product scope; where the PRD is silent, this document makes an engineering choice and labels it, or defers to [Open Decisions](#12-open-decisions).

---

## 1. Guiding Constraints (from PRD)

These constraints shape every decision below:

- No signup/login for contributors (PRD §4, §9). Admin is the only authenticated surface (PRD §22, §25).
- Payment state is **server-authoritative**; the frontend's belief that a payment succeeded is never trusted (PRD §10, §38).
- Pixel allocation must be **exactly-once, atomic, and concurrency-safe** at a scale of 10,000,000+ pixels (PRD §14, FR-09).
- Payment provider must be swappable — MVP uses UTR-assisted manual verification, later phases move to automated gateway webhooks, **without redesigning the product** (PRD §10, Goal 7).
- Public APIs must never leak payment-sensitive data (PRD §25, §35).
- The pixel wall must never render 10M DOM nodes; it must use canvas/WebGL or chunked/virtualized rendering (PRD §15).
- The system must survive traffic spikes and be efficient for aggregate counters (PRD §29).

---

## 2. High-Level System Diagram

```text
                              ┌─────────────────────┐
                              │      Visitors        │
                              └──────────┬────────────┘
                                         │ HTTPS
                              ┌──────────▼────────────┐
                              │   apps/web (Next.js)   │
                              │  - Public pages (SSR/ISR)
                              │  - Contribution flow UI
                              │  - Pixel Wall (canvas)
                              │  - Admin UI (auth-gated)
                              │  - API route handlers   │
                              └──────────┬────────────┘
                                         │
              ┌──────────────────────────┼───────────────────────────┐
              │                          │                           │
   ┌──────────▼─────────┐   ┌────────────▼───────────┐   ┌───────────▼──────────┐
   │  packages/core      │   │  packages/payment-      │   │  packages/db          │
   │  - Contribution      │   │  providers               │   │  - Prisma schema      │
   │    state machine     │   │  - PaymentProvider       │   │  - Migrations         │
   │  - Pixel allocation  │   │    interface              │   │  - Query layer        │
   │    engine             │   │  - ManualUpiProvider      │   └───────────┬──────────┘
   │  - Validation/DTOs    │   │  - (later) GatewayProvider│               │
   └──────────┬─────────┘   └────────────┬───────────┘               │
              │                          │                           │
              └──────────────────────────┴───────────────────────────┘
                                         │
                              ┌──────────▼────────────┐
                              │   PostgreSQL (primary)  │
                              └──────────┬────────────┘
                                         │
                              ┌──────────▼────────────┐
                              │ Redis-compatible store  │
                              │ - Rate limiting          │
                              │ - Phase 3: job queue     │
                              └────────────────────────┘

              ┌─────────────────────────────────────────┐
              │   Phase 3: apps/worker (queue consumer)   │
              │   - Payment gateway webhook processing    │
              │   - Async verification / fraud checks     │
              └─────────────────────────────────────────┘
```

---

## 3. Repository Layout (pnpm monorepo)

Per PRD §33 (pnpm monorepo, Next.js, PostgreSQL). A single Next.js app hosts the public site, the contribution flow, and the admin UI (as auth-gated routes) for MVP, so the product ships as one deployable unit. Business logic is isolated in packages so it is not entangled with framework/routing code — this is what allows Phase 3 to introduce a separate worker process or split the backend into a standalone service later without rewriting domain logic.

```text
1-crore-pixels/
├── apps/
│   ├── web/                    # Next.js app: public site, contribution flow,
│   │                            #   pixel wall, admin UI, API route handlers
│   └── worker/                  # Phase 3 only: queue consumer for async
│                                 #   webhook processing / fraud checks
├── packages/
│   ├── core/                    # Framework-agnostic domain logic:
│   │   │                        #   - contribution state machine
│   │   │                        #   - pixel allocation engine
│   │   │                        #   - validation schemas (zod)
│   │   │                        #   - moderation rules for display names
│   │   └── ...
│   ├── db/                      # Prisma schema, migrations, typed client,
│   │                            #   repository-style query functions
│   ├── payment-providers/       # PaymentProvider interface + adapters
│   │   ├── manual-upi/          #   MVP: dynamic UPI QR + UTR-assisted match
│   │   └── gateway/              #   Phase 3: Razorpay/Cashfree-style adapter
│   ├── ui/                       # Shared React components (design system)
│   └── config/                   # Shared tsconfig, eslint, prettier config
├── docs/                          # This documentation set (source of truth)
└── CLAUDE.md
```

**Rule:** `apps/web` route handlers are thin — they parse/validate the request, call into `packages/core` and `packages/db`, and shape the response. No business logic (state transitions, allocation math, verification matching) lives in a route handler.

**`packages/core` depends on `packages/db`** (the Prisma client and its generated types), since the state machine transitions and the pixel allocation transaction *are* conditional DB updates (`docs/PAYMENT.md` §2.1, `docs/PIXEL_SYSTEM.md` §2.3) — "framework-agnostic" above means independent of Next.js/HTTP, not independent of persistence. `apps/web` never talks to Prisma directly for anything on the money/pixel path; it only calls the `packages/core` functions.

---

## 4. Why Next.js Server APIs (not a separate NestJS service) for MVP

PRD §33 lists both options. Next.js API route handlers are chosen for MVP because:

- No signup/login means the API surface is small and mostly CRUD + a few workflow endpoints (PRD §24).
- One deployable unit reduces operational overhead for a solo/small-team MVP (PRD Phase 0–1 urgency).
- Domain logic already lives in `packages/core`/`packages/db`, decoupled from Next.js — if load or team size later justifies a standalone NestJS/Node backend, that logic moves with minimal rewrite.

This is an engineering choice, not a product requirement. Revisit if admin/API complexity grows significantly (see [Open Decisions](#12-open-decisions)).

---

## 5. Contribution Lifecycle (system view)

The full state machine, verification rules, and allocation algorithm are specified in `docs/PAYMENT.md` and `docs/PIXEL_SYSTEM.md`. At the architecture level, the important property is:

**Every state transition that has money or pixel consequences happens in exactly one server-side transaction, gated by a conditional update, never by trusting client input.**

```text
Client                      Server (apps/web API routes)              Database
  │                                    │                                   │
  │  POST /api/contributions           │                                   │
  ├───────────────────────────────────►│  validate, create record          │
  │                                    ├──────────────────────────────────►│ CREATED
  │  POST /api/contributions/:id/qr    │                                   │
  ├───────────────────────────────────►│  create payment attempt via       │
  │                                    │  PaymentProvider, generate QR      │
  │                                    ├──────────────────────────────────►│ PAYMENT_PENDING
  │  (user pays via UPI app)           │                                   │
  │  POST /api/contributions/:id/utr   │                                   │
  ├───────────────────────────────────►│  record last-4, flag for review   │
  │                                    ├──────────────────────────────────►│ PAYMENT_SUBMITTED → VERIFYING
  │                                    │                                   │
  │            (admin verifies, or Phase 3 webhook auto-verifies)          │
  │                                    │  conditional transition to PAID   │
  │                                    │  + atomic pixel allocation        │
  │                                    │  + atomic aggregate update        │
  │                                    ├──────────────────────────────────►│ PAID → PIXELS_ASSIGNED → PUBLISHED
```

---

## 6. Aggregate Counters & Public Read Path

PRD §29 requires efficient aggregate counters and CDN/cache-friendly public pages. Summing `contributions`/`pixel_allocations` on every homepage load does not scale to millions of rows. Design:

- A single-row `campaign_totals` table (see `docs/DATABASE.md`) holds `total_verified_amount`, `verified_contributor_count`, `total_pixels_allocated`, `updated_at`.
- It is updated **in the same transaction** that transitions a contribution to `PAID`/`PIXELS_ASSIGNED` — never recomputed by a separate batch job for the MVP (batch reconciliation is a Phase 3 hardening task, see `docs/TASKS.md`).
- `GET /api/progress` reads this single row — O(1) regardless of contributor count.
- Public pages (`/`, `/progress`, `/contributors`, `/updates`) are served with short-TTL cache headers / ISR revalidation so a traffic spike hits the CDN, not the database (see `docs/DEPLOYMENT.md`).

---

## 7. Pixel Wall Rendering (summary)

Full detail in `docs/PIXEL_SYSTEM.md`. Architecturally: the wall is never sent to the client as 10M individual objects. The client requests **chunks** (`GET /api/pixels?chunk=...`), each chunk is a fixed-size block of pixels rendered as a single canvas/WebGL texture, and only chunks intersecting the current viewport are fetched/rendered (PRD §15).

---

## 8. Payment Provider Abstraction (summary)

Full detail in `docs/PAYMENT.md`. Architecturally: `packages/payment-providers` exposes one `PaymentProvider` interface. `apps/web` and `packages/core` depend only on this interface, never on a concrete provider. Swapping `ManualUpiProvider` for a `GatewayProvider` in Phase 3 is a configuration/DI change, not a rewrite (PRD Goal 7).

---

## 9. Admin Surface

Admin is the only part of the system with authentication (PRD §22, §25). It is served from the same `apps/web` deployment under an auth-gated route group (e.g. `/admin/*`), backed by `admin_users` with RBAC roles and MFA-ready fields (see `docs/DATABASE.md`, `docs/SECURITY.md`). Every sensitive admin action writes to `audit_logs` in the same transaction as the action itself.

---

## 10. Background Processing

MVP (Phase 1–2) is fully synchronous: contribution creation, QR generation, UTR submission, and admin verification are all request/response — there is no queue in the critical path, keeping the system simple while verification is manual.

Phase 3 introduces `apps/worker` + Redis-backed queue (BullMQ or equivalent) for:
- Ingesting and processing payment gateway webhooks asynchronously (so webhook delivery is fast/idempotent and retried on failure).
- Async fraud/duplicate-detection scans.
- Reconciliation jobs that recompute `campaign_totals` from source tables as a consistency check (not the primary write path).

The `PaymentProvider` interface (see `docs/PAYMENT.md`) is designed today so this can be added without changing its contract.

---

## 11. Technology Choices

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js + TypeScript | PRD §33 |
| Backend | Next.js API route handlers (MVP); Node/NestJS-extractable later | §4 above |
| Database | PostgreSQL | PRD §33; range types + row-level locking fit pixel allocation exactly (`docs/PIXEL_SYSTEM.md`) |
| Cache/Rate-limit store | Redis-compatible (e.g. Upstash) | PRD §33; needed from MVP for rate limiting even before queues exist |
| Queue (Phase 3) | Redis-backed (e.g. BullMQ) | PRD Phase 3 |
| Payment | Abstracted; MVP = manual UPI + UTR-assisted verification; Phase 3 = gateway | PRD §10, Goal 7 |
| Pixel rendering | Canvas/WebGL, chunked | PRD §15 |
| ORM | Prisma | Type-safe schema shared via `packages/db`; supports raw SQL for the allocation hot path where needed |
| Hosting | Vercel-equivalent (web) + managed Postgres + managed Redis | PRD §33 |
| Monitoring | Structured logs + error tracking + uptime/webhook alerting | PRD §29, `docs/DEPLOYMENT.md` |
| Package manager | pnpm | PRD §33 |

---

## 12. Open Decisions

1. Whether `apps/web` stays a single Next.js deployment through Phase 3, or the API is split into a standalone service once admin/verification/fraud logic grows — not specified in PRD; revisit based on real load/team size.
2. Whether `contributors` is a normalized identity distinct from `contributions`, given there is no login to link multiple contributions to one person (see `docs/DATABASE.md` §Open Decisions — same question, product-facing).
3. Exact managed-hosting vendors (Vercel/Neon/Supabase/Upstash/etc.) — PRD says "equivalent," no vendor is mandated; a decision is needed before `docs/DEPLOYMENT.md` provisioning steps can be executed, but the architecture is vendor-agnostic.
