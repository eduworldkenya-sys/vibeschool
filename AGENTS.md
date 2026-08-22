# VibeSchool Repository AI Operating Contract

This file is the model-neutral operating contract for any AI coding agent or LLM working in this repository. Read it before planning, editing, reviewing, certifying, or merging work. Model-specific instruction files may add constraints but must not weaken this contract.

## Mandatory startup sequence

1. Investigate current repository truth before changing anything: relevant code, tests, types, migrations, workflows, open PR state, and recent CI evidence.
2. Read the nearest repository instruction files and the relevant material under `skills/` when present. Treat repository skills as mandatory operating procedures, not optional suggestions.
3. Identify the canonical source of truth and repair root causes rather than downstream symptoms.
4. Check whether the task exposes a defect in earlier/foundation work. If verified, run the Dependency Integrity Loop before continuing dependent work.
5. Work on an isolated branch. Never mutate protected/default branch directly.

## Error and CI repair loop

A failing check is evidence, not an inconvenience.

1. Fetch the exact failing job/step/log and exact head SHA.
2. Reproduce or inspect the failure against the current code contract.
3. Classify the root cause: implementation, stale test/fixture, type contract, migration/schema drift, workflow/environment, security/governance, or unrelated pre-existing failure.
4. Repair the canonical cause. Never silence the error with `as any`, `@ts-ignore`, `@ts-nocheck`, skipped/disabled tests, disabled lint, weakened assertions, or removed safety gates unless the task explicitly proves that the gate itself is invalid.
5. Add or update a regression test that would have caught the defect when practical.
6. Run the narrow test first, then typecheck/lint/build and all applicable certification gates.
7. Any code commit invalidates older certification evidence. Re-check the new exact head.
8. Repeat until green or a genuine owner/external boundary is reached. Do not declare completion while a relevant gate is red, pending, stale, or unavailable.

## Truthful status vocabulary

- IMPLEMENTED: code exists, but current exact-head certification may be absent.
- VERIFIED: applicable automated checks passed on the exact current head.
- CERTIFIED: required independent assurance/review gates passed on the exact current head.
- MERGED: GitHub confirms the intended PR was merged.
- BLOCKED: a concrete external/owner boundary prevents safe continuation.

Never use CERTIFIED, DONE, COMPLETE, READY, or production-safe as synonyms. Never infer a merge or deployment from code existence.

## Dependency Integrity Loop

When later work reveals a verified earlier-layer defect:

1. Record the contrary evidence and invalidate stale COMPLETE/READY/CERTIFIED claims for affected components.
2. Determine blast radius and preserve unrelated concurrent work.
3. Repair the canonical earlier layer first.
4. Re-run its regression and certification gates.
5. Rebase/reconcile dependent work and re-run dependent gates.
6. Resume the interrupted mission only after the repaired dependency is independently verified.

Do not interrupt work for an unverified suspicion, but never ignore a verified foundation defect.

## Safety and authority

- Runtime, schedulers, automatic publishing, payments, destructive production operations, consequential authority, Global Stop changes, secrets, and production data mutations require the repository's explicit governance path and any applicable owner approval.
- Fail closed when telemetry, authorization, persistence, identity, or required evidence is missing/stale.
- Never self-certify a high-risk repair when independent assurance is required.
- Preserve school/tenant isolation, RLS, authorization boundaries, auditability, idempotency, replay safety, and rollback paths.
- Do not run destructive SQL or migration-history repair against production without explicit approval in the current session.

## Delivery and GitHub discipline

- Inspect current branch, diff, and PR before publishing changes.
- Do not mix unrelated work into a task branch.
- Prefer exact-head evidence. A new commit makes prior evidence stale.
- Merge only when required checks are green and the requested scope is satisfied; otherwise report the exact blocker.
- Conserve Vercel/deployment usage. Do not intentionally trigger deployments for intermediate work when local/CI proof is sufficient.
- After merge, verify the merge result and record the resulting main SHA when available.

## Definition of done

Work is not done merely because code was written. Done requires: canonical repair, regression protection, applicable security/governance checks, exact-head CI evidence, reconciliation of affected dependencies, truthful status reporting, and merge verification when merge was requested.
