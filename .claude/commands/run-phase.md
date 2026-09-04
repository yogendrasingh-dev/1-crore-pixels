---
description: Execute all currently executable tasks in the current development phase from docs/TASKS.md, end-to-end, following CLAUDE.md rules.
---

# Run Phase

Execute every currently executable task belonging to the current development phase in `docs/TASKS.md`, one after another, following the process and autonomy rules in `CLAUDE.md`. Do not ask for confirmation between tasks — proceed autonomously per `CLAUDE.md` §14. Stop only when the phase is complete or a blocking product/legal/payment/security decision prevents safe progress (see §6).

Work through these steps in order.

## 1. Load process rules

Read `CLAUDE.md` in full. It governs everything below — the doc hierarchy (§2), architecture/coding/DB/API/payment/pixel/privacy rules (§3–§10), testing rules (§11), Definition of Done (§13), and autonomous execution rules (§14). If anything in this command conflicts with `CLAUDE.md`, `CLAUDE.md` wins.

## 2. Identify the current phase and its executable tasks

Read `docs/TASKS.md` in full.

- The current phase is the earliest phase (in file order) that still has at least one incomplete (`[ ]`) task, respecting phase sequencing — do not treat a later phase as current while an earlier phase has incomplete tasks, unless `docs/TASKS.md` explicitly says phases can overlap.
- Within that phase, a task is **currently executable** if:
  - it is not already marked `[x]`,
  - it is not listed under "Cross-Cutting: Do Not Start Without Resolving" (or is, but the Open Decision it's gated on has since been resolved — verify against the referenced doc's Open Decisions section before assuming so),
  - its stated dependencies (explicit dependency notes, or tasks in an earlier phase it clearly relies on) are already complete.
- Build the ordered list of executable tasks for this phase before starting work. State the phase and the list, in a few sentences, before doing anything else.
- Tasks within a phase are mostly independent/parallelizable per the file's own legend — but implement them **sequentially, one at a time**, in the order listed, to keep each change reviewable and to avoid interference between tasks touching overlapping files.

## 3. Per-task loop

For each executable task identified in step 2, in order:

### 3.1 Read only what's relevant

From the docs referenced by this specific task, read only the section(s) it requires. Do not read unrelated docs in full.

### 3.2 Inspect existing code

Look at the current state of the relevant packages/files before writing anything. Docs describe intent; the repository is what actually exists — confirm whether related code already exists, is partially done, or is genuinely new.

### 3.3 Implement

Implement only this task — nothing else. Do not:

- Touch other tasks, even ones that look quick or adjacent — they get their own loop iteration.
- Modify `docs/PRD.md` under any circumstance.
- Add abstractions, config flags, comments, or error handling beyond what `CLAUDE.md` §4–§10 call for.
- Bypass the single-transaction/conditional-update pattern for any payment or pixel state change (`CLAUDE.md` §8–§9).
- Add phone/email/UPI ID fields, plaintext UTR storage, or any other privacy-rule violation (`CLAUDE.md` §10).

If the task turns out to require a product/legal/payment/security decision not covered by the docs (genuine ambiguity, not just under-specification an engineering default can resolve), do not guess. Record it in `docs/OPEN_ISSUES.md` with enough context to resolve later (create the file with a short header if it doesn't exist yet), leave the task incomplete in `docs/TASKS.md`, and move to the next independent task in this phase rather than blocking the whole run. See §6 for when this must instead stop the entire phase run.

### 3.4 Test

Run the unit and integration tests relevant to this change. If the change touches the payment or pixel allocation path, this must include the required concurrency tests (`CLAUDE.md` §11) — never skip these as "optional."

### 3.5 Typecheck

Run typecheck for the affected package(s).

### 3.6 Lint

Run lint for the affected package(s).

### 3.7 Fix safe errors only

Auto-fix lint issues and obviously-correct type errors. Per `CLAUDE.md` §14 rule 6: only fix what cannot change product or payment/pixel behavior. Anything touching those semantics gets flagged in the task's report instead of silently patched.

### 3.8 Update docs/TASKS.md

Mark this task `[x]` only if its acceptance criteria actually pass (tests, typecheck, lint, and the Definition of Done in `CLAUDE.md` §13). If something doesn't pass, leave it incomplete and note exactly what's blocking it — do not mark it done anyway. Do this immediately after finishing the task, before moving to the next one, so `docs/TASKS.md` is always an accurate snapshot if the run stops early.

### 3.9 Update related documentation

If the implementation changed or clarified an architecture/schema/API/pixel/security detail described in a `docs/*.md` file (other than the PRD), update that doc in the same change (`CLAUDE.md` §14 rule 8). This documents *how* something was built — never adjust `docs/PRD.md`'s *what* to match the implementation.

### 3.10 Review the diff for this task

Before moving on, confirm:

- Every change belongs to this task — nothing unrelated slipped in.
- No public endpoint response includes an undocumented field (`docs/API.md` allowlist).
- No payment/pixel change bypasses the required transactional pattern.
- No secrets, plaintext UTRs, or other sensitive payment data appear in code, tests, fixtures, or logs.

### 3.11 Continue

Move to the next executable task in the phase's list without asking for confirmation. Re-check step 2's executability conditions for remaining tasks first — completing this task may have unblocked or changed the shape of a later one (e.g. resolved a dependency, or revealed a task was already partially done).

## 4. Phase completion

Once every task in the phase's executable list from step 2 is either done or explicitly deferred to `docs/OPEN_ISSUES.md`, re-scan `docs/TASKS.md` for the phase: if all its tasks are now `[x]`, the phase is complete — stop and report. If some tasks remain incomplete because they were blocked (not just skipped for ordering reasons), the phase is not complete; report the phase as partially done and say precisely what's outstanding and why.

## 5. Never do these, at any point in the run

- Never deploy to any environment.
- Never perform a real-money operation (issuing refunds, calling a live payment gateway, moving funds) — these require explicit human action, always.
- Never commit, push, or otherwise change git history — this command only implements, tests, and documents locally.
- Never implement `POST /api/payments/webhook` against a live provider, or otherwise start Phase 3 (PRD)/live-gateway work, before it's reached and the provider is selected (`CLAUDE.md` §7).
- Never build refund pixel-revocation logic (`CLAUDE.md` §8 rule 9) — log it in `docs/OPEN_ISSUES.md` if a task in this phase requires it, and treat that task as blocked.

## 6. When to stop the entire run early

Stop the whole phase run (not just one task) immediately, before making further changes, if you hit any of:

- A task cannot proceed without a product, legal, payment, or security decision that isn't yours to make, and working around it would mean guessing at money-handling, payment-verification, security, or legal/compliance behavior (as opposed to an ordinary engineering default). Record it in `docs/OPEN_ISSUES.md` and report exactly what decision is needed and from whom.
- Continuing would require deviating from a PRD requirement. Never silently adjust the requirement — stop and surface the conflict explicitly (`CLAUDE.md` §14 rule 9).
- The doc set and the existing code genuinely disagree in a way that can't be resolved by reading more context, and picking either interpretation risks a payment/pixel/security bug.
- Any of the guardrails in §5 would otherwise be violated to make a task "complete."

When stopping early, leave `docs/TASKS.md` accurately reflecting whatever was actually finished, and report clearly which task triggered the stop and why.

## 7. Final report

After the loop ends (phase complete or stopped early), report concisely:

- Which phase was targeted, and which tasks were completed vs. skipped/blocked, and why for each blocked one.
- What changed (files/packages touched), grouped by task.
- Test/typecheck/lint results per task (or a summary if uniform).
- Any entries added to `docs/OPEN_ISSUES.md`.
- Any docs updated alongside the code.
- Whether the phase is now fully complete in `docs/TASKS.md`.

Do not commit to git, push, deploy, or perform any real-money action.
