# 1 Crore Pixels — Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** 4 September 2026  
**Status:** Product Definition / MVP Planning

## 1. Executive Summary

**1 Crore Pixels** is a public web platform built around a simple challenge:

> **Can 1 crore people contribute small amounts toward a ₹1 crore dream?**

The platform uses a visual pixel wall as the core gamification mechanic. A verified contribution maps to an equivalent number of pixels. The contributor can display a first name/display name or remain anonymous.

The MVP removes account creation and login. A visitor enters a display name, chooses anonymous/public display, selects an amount, completes a UPI payment, provides the last four digits/characters of the transaction reference for assisted verification, and receives pixels after payment verification.

The product must **not** be positioned as an investment, equity sale, guaranteed-return product, or charity unless the legal structure explicitly supports that classification. The website must clearly communicate the campaign purpose, voluntary nature, relevant payment/legal disclosures, and the public business-building journey.

---

## 2. Product Vision

Turn a personal ₹1 crore business dream into a public, measurable internet challenge where every verified contributor can visibly become part of the journey.

### Core emotional proposition

**A ₹1 contribution. A ₹1 crore dream.**

### Core challenge proposition

**Can 1 crore people give ₹1 to a stranger?**

---

## 3. Product Goals

1. Create an extremely low-friction contribution flow with no signup/login.
2. Make ₹1 the memorable campaign hook while allowing larger voluntary contributions.
3. Make every verified contribution visible as pixels on a public wall.
4. Build trust through transparent progress and public journey updates.
5. Create a strong post-payment sharing loop.
6. Prevent fake/duplicate/unverified contributions from appearing as paid.
7. Build the MVP so payment infrastructure can later move from UTR-assisted verification to automated gateway webhooks without redesigning the product.

---

## 4. Non-Goals for MVP

- No user accounts/passwords/social login.
- No mandatory email or phone.
- No investment/equity/return promise.
- No recurring subscriptions.
- No marketplace or creator platform.
- No wallet/stored balance.
- No public display of full names, phone numbers, emails, UPI IDs, or full transaction IDs.
- No complex public financial reporting.
- No monetary referral commissions unless separately reviewed and legally approved.

---

# 5. Target Users

| User | Need | Desired Action |
|---|---|---|
| Casual visitor | Understand the challenge quickly | Contribute ₹1+ |
| Supporter | Feel part of the journey | Contribute + claim pixels |
| Social sharer | Share participation | Share contribution card/link |
| Returning supporter | Track progress | View updates/wall |
| Admin/owner | Manage campaign | Verify payments, moderate names, publish updates |

---

# 6. Brand & Messaging

## Campaign Name

**1 Crore Pixels**

## Recommended headline

**Can 1 Crore People Give ₹1 to a Stranger?**

## Supporting line

**I'm that stranger.**

## Tagline

**1 Crore People. ₹1 Each. One Big Dream.**

### Messaging Principles

- Be personal, honest, and specific.
- Explain that contributions are voluntary.
- Avoid guilt, fake urgency, fake scarcity, or guaranteed outcomes.
- Do not describe contributions as investments.
- Do not promise financial returns.
- Use “support/contribution” language unless legal review approves another classification.
- Do not silently invent claims.
- Clearly communicate what happens if the target is not reached once that policy is finalized.

---

# 7. Information Architecture

```text
/
├── Home
├── Our Story
├── Pixel Wall
├── Contributors
├── Progress / Journey
├── Updates
├── Campaign Information
├── FAQ
├── Contact
├── Contribution Flow
└── Admin
```

---

# 8. Homepage Requirements

## 8.1 Hero

The hero must immediately communicate:

- Campaign name
- ₹1 hook
- ₹1 crore goal
- Current amount
- Contributor count
- Primary CTA

### Example

**Can 1 Crore People Give ₹1 to a Stranger?**

> I'm that stranger.

**₹2,84,921 / ₹1,00,00,000**

Primary CTA:

**Claim My ₹1 Pixel**

Supporting text:

> No investment. No promised returns. Just one small contribution to a big experiment.

---

## 8.2 Live Progress

Display:

- Raised amount / ₹1,00,00,000
- Percentage funded
- Verified contributor count
- Pixels claimed
- Progress bar
- Last updated timestamp

Only **verified/confirmed contributions** may affect public totals.

---

## 8.3 Story

Explain:

- The founder comes from a middle/lower-middle-class family.
- ₹1 crore represents a major business dream.
- Instead of asking one person for a large amount, the experiment asks many people for small voluntary contributions.
- The campaign is about turning many small contributions into a visible public journey.

Do not exaggerate or fabricate the founder's background.

---

## 8.4 Pixel Wall Preview

Display a live/sample portion of the pixel wall.

Required interactions:

- Zoom
- Pan
- Tap/click claimed pixel
- Show public contributor information
- Anonymous handling

---

## 8.5 Journey

Show progress from:

**₹0 → ₹1 crore → business-building journey**

Later milestones can include:

- Business setup
- Product development
- MVP
- Launch
- First customer
- Revenue milestones

---

## 8.6 Contributors

Show recent verified contributors.

Examples:

```text
Rahul
Amit
Priya
Anonymous
```

Only public-safe display names may appear.

---

# 9. Contribution Flow

## Primary Flow

```text
Visitor
  ↓
Display Name
  ↓
Anonymous Option
  ↓
Contribution Amount
  ↓
Create Contribution
  ↓
Dynamic UPI QR
  ↓
User Pays
  ↓
UTR Last 4 Submission
  ↓
Payment Verification
  ↓
Pixel Allocation
  ↓
Success
  ↓
Share
```

---

## 9.1 Display Name

Fields:

```text
Your Name
[________________]

☐ Show me as Anonymous
```

Requirements:

- Name/display-name validation.
- Input sanitization.
- Offensive/spam-name moderation.
- Do not expose legal identity publicly.
- Anonymous contributions display as **Anonymous**.

Recommended public display:

**Yogendra**

rather than a full legal name.

---

## 9.2 Contribution Amount

Recommended presets:

```text
₹1
₹11
₹51
₹101
₹501
Custom
```

The ₹1 option must remain the main campaign hook.

Users may contribute more if comfortable.

---

# 10. Payment Architecture

## Preferred Production Flow

```text
Create Contribution
        ↓
Create Payment/QR Reference
        ↓
Display Dynamic QR
        ↓
User Pays
        ↓
Payment Provider / Bank Evidence
        ↓
Server Verification
        ↓
Mark PAID
        ↓
Allocate Pixels
        ↓
Publish Contributor
```

### Critical rules

- Never trust frontend payment-success state.
- Verify payment server-side.
- Verify webhook signatures when supported.
- Use idempotency.
- Never allocate pixels twice.
- Never publish an unverified contribution.
- Keep payment audit information private.

---

# 11. Dynamic UPI QR

Each contribution should have a unique contribution/payment reference.

Example:

```text
Contribution ID: C_82931
Name: Rahul
Amount: ₹101
```

The generated QR should be tied to that contribution/payment reference where supported.

### Important distinction

The QR identifies the **payment/contribution transaction**, not the person's name.

The name is already stored against the contribution record.

---

# 12. UTR Last-4 Verification

After payment:

```text
Payment completed?

Enter the last 4 digits of your transaction reference:

[ ____ ]

[ Verify Payment ]
```

### Important

The last four digits are only an **assisted matching signal**.

They are not sufficient proof of payment by themselves.

Matching should consider available evidence such as:

- Contribution amount
- Contribution ID
- UTR/reference suffix
- Approximate payment time
- Provider/bank payment evidence

Ambiguous cases must remain **PENDING** for manual/assisted review.

Never mark a contribution PAID solely because a user entered four digits.

Never publicly display a full UTR.

---

# 13. Contribution State Machine

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

Possible failure states:

```text
PAYMENT_FAILED
PAYMENT_EXPIRED
VERIFICATION_FAILED
REFUND_PENDING
REFUNDED
```

All state transitions should be server-controlled and auditable.

---

# 14. Pixel System

## Core Rule

**₹1 = 1 Pixel**

Examples:

| Contribution | Pixels |
|---:|---:|
| ₹1 | 1 |
| ₹11 | 11 |
| ₹101 | 101 |
| ₹1,001 | 1,001 |

### Requirements

- Pixel allocation only after verified PAID state.
- Allocation must be atomic.
- No overlapping allocations.
- No duplicate allocations.
- Each allocation belongs to a contribution.
- Pixel IDs/coordinates must be deterministic.
- System must support 10,000,000+ pixels.

---

# 15. Pixel Wall Technical Requirements

Do **not** render 10 million DOM elements.

Use:

- Canvas/WebGL, or
- Chunked/virtualized rendering.

Recommended model:

```text
Pixel Wall
├── Chunk 1
├── Chunk 2
├── Chunk 3
├── ...
└── Chunk N
```

Only visible chunks should be loaded/rendered.

### Pixel interactions

- Hover/tap pixel.
- Show public display name.
- Anonymous → Anonymous.
- Zoom.
- Pan.
- Search by contributor name/pixel ID subject to privacy rules.
- Deep-link to a pixel location.

---

# 16. Contributors Wall

Display:

- Recent verified contributors.
- First name/display name or Anonymous.
- Pixel count/range.
- Optional contribution amount depending on final privacy policy.
- Relative timestamp if desired.

Never display:

- Phone number
- Email
- UPI ID
- Full UTR
- Payment credentials

Provide reporting/moderation for inappropriate names.

---

# 17. Public Progress & Milestones

Initial milestones:

```text
₹1 Lakh
₹10 Lakh
₹25 Lakh
₹50 Lakh
₹75 Lakh
₹1 Crore
```

After reaching the goal:

```text
Business Setup
Product Development
MVP
Launch
First Customer
Revenue Milestones
```

Milestones must be configurable from admin.

---

# 18. Updates / Build in Public

Admin can publish:

- Title
- Body
- Date
- Optional image
- Optional milestone association

Example updates:

```text
Day 1 — Campaign launched
₹1 Lakh — First milestone
₹10 Lakh — 10% reached
MVP development started
First prototype launched
```

The goal is to show the journey from:

**₹1 → ₹1 crore → business**

---

# 19. Viral Sharing

After successful contribution:

```text
🎉 You're part of the journey!

101 Pixels Claimed

Pixel #184201 → #184301
```

Actions:

- View My Pixels
- Share My Contribution
- Copy Link

Share card should include:

- Campaign name
- First name/Anonymous
- Pixel count or ID
- Contribution number/pixel ID
- Campaign CTA

Share targets:

- WhatsApp
- X
- Copy link
- Image/share flow compatible with social platforms

---

# 20. Referral System

Each contribution/visitor may receive a referral URL:

```text
example.com/r/rahul
```

Track:

- Referral visit
- Contribution attributed
- Conversion
- Referrer

Do not implement cash referral commissions in MVP.

Use recognition instead:

- Badges
- Leaderboard
- Community Champion status

---

# 21. Gamification

| Mechanic | Example |
|---|---|
| Pixel ownership | ₹1 = 1 pixel |
| Founding badge | First 1,000 |
| Early Believer | First 10,000 |
| Dream Builder | First 1 lakh |
| Million Pixel Club | First 10 lakh |
| Community leaderboard | Most referrals |
| Milestones | ₹1L / ₹10L / ₹50L / ₹1Cr |
| Journey | ₹0 → ₹1Cr → Business |

---

# 22. Admin Dashboard

## Dashboard

Show:

- Total verified amount
- Pending amount
- Verified contributor count
- Pixel count
- Recent contributions
- Payment verification queue

## Contribution Management

- Search
- View details
- Verify
- Reject
- Refund/status handling
- Duplicate/fraud flags

## Content

- Publish updates
- Edit updates
- Manage milestones
- Manage homepage content

## Moderation

- Review names
- Hide inappropriate names
- Flag content

## Audit

Every sensitive admin action must be logged.

---

# 23. Database Model

Recommended entities:

```text
users / admin_users
contributors
contributions
payments
pixel_allocations
pixels
referrals
referral_events
badges
user_badges
updates
milestones
audit_logs
```

## Contribution

```text
id
display_name
anonymous
amount
status
payment_reference
utr_last4
created_at
paid_at
verified_at
```

## Payment

```text
id
contribution_id
provider
provider_payment_id
amount
status
reference_hash
created_at
updated_at
```

## Pixel Allocation

```text
id
contribution_id
start_pixel
end_pixel
pixel_count
created_at
```

---

# 24. API Sketch

```text
POST /api/contributions
POST /api/payments/qr
POST /api/payments/webhook
POST /api/contributions/{id}/utr

GET /api/contributions/{id}
GET /api/progress
GET /api/pixels
GET /api/contributors

GET /api/referrals/{code}

POST /api/admin/contributions/{id}/verify
POST /api/admin/updates
```

All payment-sensitive operations must be server-side.

---

# 25. Security Requirements

- HTTPS.
- Server-side input validation.
- Amount validation.
- Rate limiting.
- Webhook signature validation.
- Idempotency.
- Admin RBAC.
- Admin MFA-ready architecture.
- Audit logs.
- Secrets in environment/secret manager.
- No secrets in source control.
- XSS protection.
- CSRF protection where applicable.
- SQL injection protection.
- Bot protection on high-risk endpoints.
- Database backups.
- Tested restore process.
- No sensitive payment data in public APIs.

---

# 26. Privacy Requirements

- No mandatory signup.
- Collect minimum necessary data.
- Anonymous option.
- Do not publish full name by default.
- Do not publish phone/email/UPI ID/full UTR.
- Privacy policy.
- Consent language where required.
- Retention/deletion policy.
- Applicable Indian privacy/payment requirements must be reviewed before launch.

---

# 27. Legal & Trust Requirements

Before public launch, obtain India-specific professional advice for the exact campaign structure.

The platform must:

- Not promise financial returns.
- Not claim to sell investment/equity unless legally structured.
- Not misrepresent itself as a charity.
- Clearly state campaign purpose.
- Clearly state whether/how funds may be used if target is not reached.
- Publish terms.
- Publish privacy policy.
- Publish refund policy.
- Publish contact information.
- Use an appropriate business/payment account for large public collection, subject to professional advice.

---

# 28. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | View live progress | P0 |
| FR-02 | Enter display name | P0 |
| FR-03 | Anonymous option | P0 |
| FR-04 | Select amount | P0 |
| FR-05 | Create unique contribution ID | P0 |
| FR-06 | Generate payment QR/reference | P0 |
| FR-07 | Submit UTR last four | P0 |
| FR-08 | Server-side payment verification | P0 |
| FR-09 | Exactly-once pixel allocation | P0 |
| FR-10 | Public contributor wall | P0 |
| FR-11 | Share card/link | P1 |
| FR-12 | Admin payment verification | P0 |
| FR-13 | Admin updates | P1 |
| FR-14 | Admin milestones | P1 |
| FR-15 | Referral attribution | P1 |
| FR-16 | Advanced Canvas/WebGL wall | P1/P2 |

---

# 29. Non-Functional Requirements

- Mobile-first.
- Responsive desktop.
- Fast on Indian mobile networks.
- Minimal checkout friction.
- CDN/cache-friendly public pages.
- Server-authoritative payment state.
- Scalable to millions of contributors/pixels.
- Efficient aggregate counters.
- Structured logging.
- Error tracking.
- Payment webhook monitoring.
- Uptime monitoring.

---

# 30. Analytics

Track:

- Landing page visitors
- CTA clicks
- Contribution flow starts
- QR generated
- Payment completed
- UTR submitted
- Payment verified
- Conversion rate
- Average contribution
- Referral visits
- Referral conversion
- Share clicks
- Traffic source
- Funnel drop-off

Avoid unnecessary personal identifiers in analytics.

---

# 31. Success Metrics

Primary metrics:

1. Visitor → verified contributor conversion.
2. Average contribution.
3. Payment verification success.
4. Payment-to-pixel latency.
5. Share rate.
6. Referral conversion.
7. Returning visitors.
8. Fraud/duplicate rate.

---

# 32. MVP Release Plan

## Phase 0 — Validation

- Finalize campaign story.
- Finalize legal/payment structure.
- Confirm provider onboarding and permitted use case.
- Build landing page prototype.
- Test messaging with a small audience.

## Phase 1 — Core MVP

- Home.
- Story.
- Contribution flow.
- Dynamic QR.
- UTR-assisted verification.
- Admin verification queue.
- Pixel allocation.
- Progress.
- Contributors Wall.

## Phase 2 — Viral Layer

- Share cards.
- Referral links.
- Badges.
- Leaderboards.
- Milestones.

## Phase 3 — Scale

- Automated payment webhooks.
- Canvas/WebGL wall.
- Caching.
- Queues.
- Fraud detection.
- Advanced analytics.
- Public journey dashboard.

---

# 33. Recommended Tech Stack

| Layer | Recommendation |
|---|---|
| Frontend | Next.js + TypeScript |
| Backend | Node.js / NestJS or Next.js server APIs |
| Database | PostgreSQL |
| Cache/Queue | Redis-compatible service when needed |
| Payment | India-compatible UPI/payment provider |
| Pixel rendering | Canvas/WebGL + chunking |
| Hosting | Vercel/equivalent + managed backend/database |
| Monitoring | Error tracking + structured logs + uptime/webhook alerts |
| Package manager | pnpm |
| Repository style | pnpm monorepo |

---

# 34. Edge Cases

The system must handle:

- Payment succeeds but browser closes.
- Wrong UTR suffix.
- Same amount + same UTR suffix for multiple users.
- Duplicate UTR submission.
- Amount mismatch.
- Duplicate webhook.
- Webhook before frontend response.
- Payment pending.
- Payment refunded after allocation.
- Offensive display name.
- Unpaid abandoned contribution.
- Traffic spike.
- Bot-created pending contributions.
- Pixel allocation race condition.
- Concurrent payments.
- Extremely dense pixel wall.

---

# 35. Acceptance Criteria

MVP is complete when:

- Visitor can contribute without signup.
- Visitor can choose public name or Anonymous.
- Visitor can contribute ₹1.
- Unique contribution record is created before payment.
- Payment reference/QR is unique where supported.
- Verified payment cannot create duplicate pixels.
- UTR last-four can be submitted.
- Last-four alone cannot mark payment as paid.
- Admin can review pending verification.
- Only verified contributions affect public totals.
- Only verified contributions receive pixels.
- Public APIs never expose sensitive payment information.
- Admin actions are authenticated and audited.
- Site works on mobile and desktop.
- Concurrent contributions do not produce overlapping/duplicate pixel allocation.

---

# 36. Open Decisions Before Development

These must be finalized before public launch:

1. Exact legal structure.
2. Exact campaign classification.
3. Exact business purpose.
4. What happens if ₹1 crore is not reached.
5. Refund policy.
6. Whether contribution amount is public.
7. First-name vs shortened display name.
8. Payment provider and onboarding category.
9. Minimum contribution, if any provider requires one.
10. Campaign end date, if any.
11. Contributor name edit/removal policy.
12. Exact referral/badge rules.

---

# 37. Recommended Development Order

```text
1. Vision / final campaign messaging
2. Legal + payment validation
3. Architecture
4. Database
5. API contracts
6. Contribution state machine
7. Payment abstraction
8. Dynamic QR
9. Verification
10. Pixel allocation engine
11. Homepage
12. Contribution UI
13. Contributors Wall
14. Pixel Wall
15. Admin
16. Progress/milestones
17. Sharing/referrals
18. Automated tests
19. Security audit
20. Performance/load testing
21. Deployment
22. Closed beta
23. Public launch
```

---

# 38. Claude Code Development Principle

The project should be **PRD-driven and documentation-driven**.

Source of truth:

```text
docs/PRD.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API.md
docs/PAYMENT.md
docs/PIXEL_SYSTEM.md
docs/SECURITY.md
docs/TESTING.md
docs/DEPLOYMENT.md
CLAUDE.md
```

Claude Code should:

1. Read only relevant documentation for the current task.
2. Inspect existing code before modifying it.
3. Implement one task at a time.
4. Run tests.
5. Run typecheck.
6. Run lint.
7. Run build where appropriate.
8. Fix safe failures automatically.
9. Update relevant documentation.
10. Update task status.
11. Never silently change product requirements.
12. Never treat frontend payment state as payment proof.
13. Never allocate pixels twice.
14. Never expose sensitive payment data.

---

# 39. Product North Star

The core loop is:

```text
DISCOVER
   ↓
UNDERSTAND THE DREAM
   ↓
CONTRIBUTE ₹1+
   ↓
CLAIM PIXELS
   ↓
SHARE
   ↓
BRING ANOTHER PERSON
   ↓
WATCH THE PROGRESS
   ↓
FOLLOW THE BUSINESS JOURNEY
```

The product should make a contributor feel that they are not merely sending money; they are leaving a small, visible mark on a public journey.

**The ₹1 is the hook.  
The pixel is the proof of participation.  
The story is the reason to care.  
The public journey is the reason to return.**
