| **description** | Execute all currently executable tasks in the current development phase from docs/TASKS.md, then validate the entire phase with tests, typecheck, and lint. |
| --------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |

# Run Phase

Execute every currently executable task belonging to the current development phase in `docs/TASKS.md`, one after another, following the process and autonomy rules in `CLAUDE.md`.

Do not ask for confirmation between tasks — proceed autonomously per `CLAUDE.md` §14.

Do **not** run tests, typecheck, or lint after every individual task.

First implement all executable tasks in the phase. After implementation is complete, run one consolidated validation pass for the entire phase:

1. relevant unit/integration tests
2. required payment/pixel concurrency tests
3. typecheck
4. lint
5. safe fixes
6. re-run failed validation commands
7. finalize task completion status

Stop only when the phase is complete or a blocking product/legal/payment/security decision prevents safe progress.

---

## 1. Load process rules

Read `CLAUDE.md` in full.

It governs everything below — the doc hierarchy (§2), architecture/coding/DB/API/payment/pixel/privacy rules (§3–§10), testing rules (§11), Definition of Done (§13), and autonomous execution rules (§14).

If anything in this command conflicts with `CLAUDE.md`, `CLAUDE.md` wins.

---

## 2. Identify the current phase and its executable tasks

Read `docs/TASKS.md` in full.

The current phase is the earliest phase, in file order, that still has at least one incomplete (`[ ]`) task.

Respect phase sequencing. Do not treat a later phase as current while an earlier phase has incomplete tasks unless `docs/TASKS.md` explicitly says phases can overlap.

Within the current phase, a task is **currently executable** if:

- it is not already marked `[x]`,
- it is not blocked by "Cross-Cutting: Do Not Start Without Resolving",
- or its referenced Open Decision has since been resolved,
- its explicit dependencies are complete,
- any earlier task it clearly depends on is complete.

Before implementation begins:

1. determine the current phase,
2. build the ordered list of executable tasks,
3. state the phase and task list briefly.

Implement tasks sequentially in the order listed.

Do not run the full test/typecheck/lint pipeline between individual tasks.

---

# 3. Per-task implementation loop

For each executable task identified in Step 2, execute the following process.

## 3.1 Read only what's relevant

Read only the documentation sections required by this task.

Do not load unrelated documentation into context.

Prefer targeted reads over entire files whenever possible.

The goal is to minimize unnecessary context and token usage.

---

## 3.2 Inspect existing code

Inspect the current state of the files/packages related to the task before modifying anything.

Determine whether the functionality:

- already exists,
- is partially implemented,
- or is genuinely new.

Do not blindly implement something only because the documentation says it should exist.

Repository state must be checked first.

---

## 3.3 Implement only this task

Implement only the current task.

Do not intentionally implement later tasks early.

Do not:

- modify `docs/PRD.md`,
- change product requirements,
- add unnecessary abstractions,
- add speculative configuration,
- add unrelated error handling,
- introduce unrelated refactors,
- bypass payment or pixel transactional rules,
- add phone/email/UPI ID fields,
- store plaintext UTR,
- expose sensitive payment data.

For payment or pixel state transitions, continue following the required transaction, conditional-update, idempotency, and concurrency rules defined by `CLAUDE.md`.

If the task requires a genuine product/legal/payment/security decision that cannot safely be resolved through an engineering default:

1. add the issue to `docs/OPEN_ISSUES.md`,
2. leave the task incomplete,
3. continue to another independent task only if doing so is safe.

See §7 for conditions that require stopping the entire run.

---

## 3.4 Perform lightweight implementation review

After implementation, inspect the changes for obvious problems.

Do **not** run the full test suite, typecheck, or lint here.

Check only that:

- the requested task appears implemented,
- there are no obvious syntax mistakes visible from the changed code,
- there are no unrelated changes,
- sensitive data was not introduced,
- PRD was not modified,
- payment/pixel transactional rules were not intentionally bypassed.

If an obviously incorrect issue can be fixed immediately without running validation tools, fix it.

---

## 3.5 Update related documentation

If this implementation changes or clarifies how an architecture/schema/API/pixel/security detail is implemented, update the corresponding `docs/*.md` file.

Never modify `docs/PRD.md`.

Documentation updates should explain **how** the existing requirement was implemented.

They must not alter **what** the product requirement means.

---

## 3.6 Record implementation progress

After implementation, update `docs/TASKS.md` using an intermediate state if the task format supports one.

Preferred behavior:

- Keep `[x]` reserved for fully validated tasks.
- Until phase validation passes, keep newly implemented tasks `[ ]` and optionally add an implementation note such as:

`Implemented — pending phase validation`

If `docs/TASKS.md` has an established status convention, follow that convention instead.

Do not mark a task `[x]` yet merely because the code was written.

A task becomes `[x]` only after the consolidated validation stage passes its Definition of Done.

---

## 3.7 Review the task diff

Before moving to the next task, inspect the changes attributable to this task.

Confirm:

- changes belong to the task,
- no unrelated feature was intentionally implemented,
- no public API gained undocumented fields,
- no sensitive payment data was exposed,
- no plaintext UTR was added,
- no secret was added,
- no payment/pixel state transition bypasses required transaction semantics,
- `docs/PRD.md` remains untouched.

Do not run tests/typecheck/lint yet.

---

## 3.8 Continue to next task

Move directly to the next executable task without asking for confirmation.

Before starting it, briefly re-check whether its dependencies are still satisfied.

Continue until all currently executable tasks in the phase have either:

- been implemented,
- or been explicitly deferred due to an Open Issue.

---

# 4. Consolidated phase validation

After all executable tasks in the current phase have been implemented, perform validation for the phase as a whole.

Do not start another phase.

---

## 4.1 Determine affected scope

Identify all packages/apps/files modified during this phase.

Run validation against the narrowest reliable scope that covers all phase changes.

Prefer package/app-level commands where they reliably cover the implementation.

Use workspace-wide validation if:

- shared packages changed,
- multiple applications depend on the changes,
- package-level validation would miss cross-package issues,
- or `CLAUDE.md` requires it.

---

## 4.2 Run tests

Run all relevant unit and integration tests covering the changes made during this phase.

Do not unnecessarily run unrelated expensive test suites if targeted commands provide sufficient coverage.

However, tests required by `CLAUDE.md` are mandatory.

If the phase touches:

- payment verification,
- payment state transitions,
- payment idempotency,
- pixel allocation,
- pixel state transitions,
- concurrent allocation,

run the required payment/pixel concurrency and idempotency tests now.

These tests must not be skipped merely to save tokens or execution time.

---

## 4.3 Run typecheck

Run typecheck once across the affected scope.

Prefer the smallest command that reliably validates all changed packages.

If shared TypeScript contracts or workspace packages changed, use workspace-wide typecheck when necessary.

---

## 4.4 Run lint

Run lint once across the affected scope.

Prefer targeted package/app linting where appropriate.

Use workspace-wide lint when shared changes require it.

---

## 4.5 Fix safe errors only

After the consolidated validation run, automatically fix safe problems.

Safe fixes include:

- formatting issues,
- lint auto-fixes,
- unused imports,
- trivial TypeScript mistakes,
- incorrect local type annotations where intent is unambiguous,
- obvious test fixture mistakes that do not alter product behavior.

Do not silently fix anything that could alter:

- product behavior,
- payment verification semantics,
- payment state transitions,
- pixel allocation semantics,
- concurrency behavior,
- privacy rules,
- security rules,
- public API contracts.

If a validation failure requires changing any of those semantics, treat it as a blocker or Open Issue instead of guessing.

---

## 4.6 Re-run failed validation

After applying safe fixes, re-run only the validation commands necessary to verify the fixes.

For example:

- tests failed → re-run affected tests,
- typecheck failed → re-run typecheck,
- lint failed → re-run lint.

Do not repeatedly run already-passing expensive commands unless the fix could have invalidated them.

If a safe fix changes production code covered by tests, re-run the relevant tests.

---

# 5. Finalize task statuses

After consolidated validation completes, revisit every task implemented during this phase.

Mark a task `[x]` only if:

- its implementation exists,
- its acceptance criteria are satisfied,
- relevant tests pass,
- relevant required concurrency tests pass,
- typecheck passes,
- lint passes,
- Definition of Done in `CLAUDE.md` §13 is satisfied.

If one validation failure affects several tasks, leave each affected task incomplete.

Add a concise blocking note where useful.

Do not mark tasks complete simply because most of the phase passed.

`docs/TASKS.md` must reflect actual validated state.

---

# 6. Phase completion

Re-scan the current phase in `docs/TASKS.md`.

If every task is `[x]`, the phase is complete.

Stop.

Do not automatically continue into the next phase.

If tasks remain incomplete because of:

- validation failures,
- unresolved dependencies,
- product decisions,
- legal decisions,
- payment decisions,
- security decisions,
- Open Issues,

report the phase as partially complete.

State precisely what remains and why.

---

# 7. Never do these

Never:

- deploy to any environment,
- perform a real-money transaction,
- issue a real refund,
- call a live payment gateway for a real transaction,
- commit,
- push,
- rewrite git history,
- modify `docs/PRD.md`,
- implement a live-provider payment webhook before the provider decision and appropriate phase,
- expose secrets,
- store plaintext UTR,
- expose sensitive payment information,
- build refund pixel-revocation logic unless explicitly permitted by the governing docs.

If refund pixel-revocation becomes necessary but remains prohibited, add it to `docs/OPEN_ISSUES.md`.

---

# 8. When to stop the entire run early

Stop the phase immediately if:

### 8.1 Product/legal/payment/security decision required

A task cannot safely continue without a decision involving:

- product behavior,
- legal/compliance behavior,
- payment verification,
- money handling,
- security,
- privacy.

Record the issue in `docs/OPEN_ISSUES.md` and stop if continuing could cause unsafe assumptions.

---

### 8.2 PRD conflict

Continuing requires deviating from `docs/PRD.md`.

Never silently reinterpret or modify the PRD.

Stop and report the conflict.

---

### 8.3 Code/document conflict with material risk

The code and governing documentation genuinely disagree and further reading cannot resolve the conflict.

If choosing either interpretation could cause:

- payment bugs,
- pixel allocation bugs,
- security problems,
- privacy problems,

stop.

---

### 8.4 Guardrail violation required

If completing a task would require violating any rule in §7, stop.

---

# 9. Token and context efficiency rules

To reduce unnecessary Claude Code token usage during this command:

1. Read `CLAUDE.md` and `docs/TASKS.md` once at the beginning.
2. For each task, read only the relevant documentation sections.
3. Do not repeatedly reload entire documents unless they changed materially.
4. Inspect only files/packages relevant to the current task.
5. Avoid repeatedly summarizing unchanged context.
6. Do not run tests after each task.
7. Do not run typecheck after each task.
8. Do not run lint after each task.
9. Batch validation at the end of the phase.
10. Prefer targeted validation commands over workspace-wide commands when coverage is equivalent.
11. Re-run only commands affected by a safe fix.
12. Do not perform unrelated refactoring.
13. Do not investigate later-phase tasks.
14. Do not produce verbose progress reports between tasks.
15. Keep internal task reports concise until the final report.

Correctness and payment/security safety take priority over token savings.

---

# 10. Final report

After the phase ends, report concisely:

- targeted phase,
- tasks implemented,
- tasks successfully validated and marked complete,
- tasks blocked or left incomplete,
- reason for every blocked task,
- files/packages changed, grouped by task where useful,
- consolidated test result,
- consolidated concurrency-test result if applicable,
- consolidated typecheck result,
- consolidated lint result,
- safe fixes applied after validation,
- entries added to `docs/OPEN_ISSUES.md`,
- documentation updated,
- whether the phase is fully complete.

Do not commit, push, deploy, or perform any real-money action.
