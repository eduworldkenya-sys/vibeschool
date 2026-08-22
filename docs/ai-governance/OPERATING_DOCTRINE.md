# VibeSchool AI Engineering Operating Doctrine

This doctrine converts model-specific best practices into permanent repository-owned operating rules.

## 1. Investigation discipline

Start from current truth. Inspect the relevant code, configuration, schema, CI, runtime evidence, open PRs, and dependency state before changing anything. Do not infer current state from a previous conversation or completion label.

For failures, establish: observed symptom, reproducibility, affected surface, canonical root cause, blast radius, dependent certifications, and safest repair path.

## 2. Dependency Integrity Loop

When work on priority N reveals a possible defect in an earlier dependency:

1. Preserve the current work state.
2. Verify the earlier defect independently enough to avoid interrupting work for a suspicion.
3. Identify all dependent artifacts and evidence.
4. Mark stale completion/certification as invalid where contradicted.
5. Repair the canonical foundation rather than patching only the downstream symptom.
6. Run regression and positive controls.
7. Obtain fresh required certification for the repaired exact version.
8. Resume the interrupted mission without discarding unaffected work.

## 3. Skill routing

Use the strongest available capability for the task, but repository law is vendor-neutral.

- Repository/PR/CI: inspect exact branch, SHA, diff, reviews, and checks.
- Database/Supabase: inspect schema and policies; prefer migrations; test RLS/grants and reconstruction; never weaken isolation as a shortcut.
- UI/UX: verify rendered behavior, mobile paths, accessibility, loading/error/empty states, and browser/runtime errors.
- Next.js/React: respect established architecture, server/client boundaries, accessibility, TypeScript contracts, and performance.
- Security: assume authorization, identity, payments, worker authority, secrets, and production mutation are high-risk until demonstrated otherwise.
- Observability: add evidence that detects recurrence and stale or missing telemetry for consequential systems.
- Durable workers/agents: require idempotency, bounded retries, dedupe, cooldown, explicit authority, structured clarification, watchdogs, auditability, safe fallback, and stop controls.

## 4. Evidence and exact-head integrity

A certification record must identify the exact candidate SHA and the evidence that applies to it. Any code-changing commit after the evidence makes that evidence stale unless the relevant checks are demonstrably content-independent.

Do not use words such as `CERTIFIED`, `MERGE READY`, or `DONE` as status decoration. They are evidence-backed states.

At minimum, record applicable test/build/security results, unresolved findings, production mutation status, migration/RLS impact, and exact-head CI state.

## 5. Independent assurance

High-risk or governance-critical changes must not be certified solely by the same actor/process that implemented them when independent evaluation is required. Independent verification may be a separately governed test/evaluator/reviewer, but it must use fresh evidence and must be able to fail the candidate.

## 6. Production safety

Default to non-activating work. Code and migrations may be prepared without activating runtime behavior. Production mutation must be bounded, intentional, reversible where possible, and separately authorized when governance requires it.

Never activate payments, automatic publishing, worker runtime, schedules, broad autonomy, or consequential authority merely because implementation tests pass.

## 7. Concurrent work

Do not destroy or silently absorb unrelated changes. Repair shared foundations only after mapping downstream impact. Rebase/reconcile deliberately and re-run invalidated evidence after reconciliation.

## 8. Failure learning

For each material escaped defect or false-positive certification, capture the root cause and add an executable regression guard where practical. A repaired system should become harder to fail in the same way.

## 9. Handover contract

When stopping before completion, leave: exact branch/SHA, verified facts, unresolved findings, stale evidence, commands/checks already run, production state, and the next safe action. Never hand over a false green state.

## 10. Model adapters

`CLAUDE.md`, `.github/copilot-instructions.md`, `GEMINI.md`, and other model-specific entrypoints must defer to `AGENTS.md`. They may add model ergonomics but may not weaken governance.
