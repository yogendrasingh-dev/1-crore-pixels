---
description: Pick the highest-priority incomplete task from docs/TASKS.md and implement it end-to-end, following CLAUDE.md rules.
---

# Run Next Task

Execute exactly one task from `docs/TASKS.md` — the highest-priority incomplete one — start to finish, following the process and autonomy rules in `CLAUDE.md`. Do not ask for confirmation for normal implementation work; proceed autonomously per `CLAUDE.md` §14.

Work through these steps in order. Do not skip steps or reorder them.

## 1. Load process rules

Read `CLAUDE.md` in full. It governs everything below — the doc hierarchy (§2), architecture/coding/DB/API/payment/pixel/privacy rules (§3–§10), testing rules (§11), Definition of Done (§13), and autonomous execution rules (§14). If anything in this command conflicts with `CLAUDE.md`, `CLAUDE.md` wins.

## 2. Select the task

Read `docs/TASKS.md`. Identify the highest-priority incomplete task, respecting:

- Phase ordering (don't pick a Phase 3 task while Phase 1/2 tasks remain, unless `docs/TASKS.md` explicitly says phases can overlap).
- The "Cross-Cutting: Do Not Start Without Resolving" section — skip (and do not attempt) any task gated on an unresolved Open Decision. Note it and move to the next eligible task instead.
- Explicit priority/ordering markers already in the file (numbering, priority labels, dependency notes).

State which task you selected and why it's next, in one or two sentences, before doing anything else.

## 3. Read only what's relevant

From `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md`, `docs/PAYMENT.md`, `docs/PIXEL_SYSTEM.md`, `docs/SECURITY.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`, read only the section(s) the selected task references or clearly requires. Do not read unrelated docs in full — keep context focused on this task. If the task's doc references are ambiguous, read just enough surrounding context in the referenced doc to resolve the ambiguity.

## 4. Inspect existing code

Before writing anything, look at the current state of the relevant packages/files (`packages/core`, `packages/db`, `packages/payment-providers`, `apps/web`, as applicable). Docs describe intent; the repository is what actually exists. Confirm whether related code already exists, is partially done, or is genuinely new.

## 5. Implement

Implement only the selected task — nothing else. Do not:

- Touch unrelated tasks, even ones that look quick or adjacent.
- Modify `docs/PRD.md` under any circumstance.
- Add abstractions, config flags, comments, or error handling beyond what §4–§10 of `CLAUDE.md` call for.
- Bypass the single-transaction/conditional-update pattern for any payment or pixel state change (`CLAUDE.md` §8–§9).
- Add phone/email/UPI ID fields, plaintext UTR storage, or any other privacy-rule violation (`CLAUDE.md` §10).

If the task turns out to require a product decision not covered by the docs (a genuine ambiguity, not just under-specification an engineering default can resolve), stop implementing that portion, record it in `docs/OPEN_ISSUES.md` with enough context to resolve later, and continue with whatever part of the task is unblocked. If the *entire* task is blocked this way, say so clearly and do not fake completion.

## 6. Test

Run the unit and integration tests relevant to the change. If the change touches the payment or pixel allocation path, this must include the required concurrency tests (`CLAUDE.md` §11) — do not skip these as "optional."

## 7. Typecheck

Run typecheck for the affected package(s).

## 8. Lint

Run lint for the affected package(s).

## 9. Fix safe errors only

Auto-fix lint issues and obviously-correct type errors. Per `CLAUDE.md` §14 rule 6: only fix what cannot change product or payment/pixel behavior. Anything touching those semantics gets flagged to the user instead of silently patched.

## 10. Update docs/TASKS.md

Mark the task complete only if its acceptance criteria actually pass (tests, typecheck, lint, and the Definition of Done in `CLAUDE.md` §13). If something doesn't pass, leave the task incomplete/in-progress and say exactly what's blocking it — do not mark it done anyway.

## 11. Update related documentation

If the implementation changed or clarified an architecture/schema/API/pixel/security detail described in a `docs/*.md` file (other than the PRD), update that doc in the same change so docs and code don't drift (`CLAUDE.md` §14 rule 8). This documents *how* something was built — never adjust `docs/PRD.md`'s *what* to match the implementation.

## 12. Review the diff

Review the full diff for this task before reporting completion:

- Confirm every change belongs to the selected task — nothing unrelated slipped in.
- Confirm no public endpoint response includes an undocumented field (`docs/API.md` allowlist).
- Confirm no payment/pixel change bypasses the required transactional pattern.
- Confirm no secrets, plaintext UTRs, or other sensitive payment data appear in code, tests, fixtures, or logs.

## 13. Report

Report concisely:

- Which task was completed (or partially completed/blocked, and why).
- What changed (files/packages touched).
- Test/typecheck/lint results.
- Any entries added to `docs/OPEN_ISSUES.md`.
- Any docs updated alongside the code.

Do not commit to git, push, deploy, or perform any real-money action — this command only implements, tests, and documents the task locally.
