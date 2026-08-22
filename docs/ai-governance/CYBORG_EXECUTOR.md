# VibeSchool Cyborg Executor

`vibeschool-cyborg-executor` is the mandatory vendor-neutral execution orchestrator for AI-assisted engineering in this repository.

It does not replace the mandatory skills. It decides which skills apply, in what order, what evidence is required, when work must stop, when an earlier dependency must be repaired first, and when a claim such as VERIFIED or CERTIFIED is permitted.

## Mandatory entry

Any LLM, coding agent, autonomous worker, or human+AI workflow that proposes or performs engineering work must:

1. Read `AGENTS.md`.
2. Read this file.
3. Read `docs/ai-governance/SKILL_REGISTRY.json` and `docs/ai-governance/MANDATORY_SKILLS.md`.
4. Read `.github/control-plane/policy.json`.
5. Inspect current repository and CI truth before acting.

Model-specific files may point to this executor but may not weaken it.

## Execution contract

For every mission, the executor MUST establish:

- mission and bounded scope;
- exact base SHA and current candidate head SHA;
- changed and potentially affected shared contracts;
- upstream/downstream dependencies;
- production and authority risk;
- required core skills and VibeSchool domain skills;
- preflight evidence;
- independent assurance requirement;
- completion state using the canonical state meanings below.

## Canonical execution loop

`BOOT -> TRUTH -> CLASSIFY -> DEPENDENCY MAP -> SELECT SKILLS -> PLAN -> IMPLEMENT -> PREFLIGHT -> ADVERSARIAL VERIFY -> SECURITY/DATA VERIFY -> UI/RUNTIME VERIFY WHEN APPLICABLE -> EXACT-HEAD CI -> INDEPENDENT ASSURANCE WHEN REQUIRED -> MERGE GATE -> MERGE -> POST-MERGE VERIFY -> LEARN`

A stage may only be skipped when it is demonstrably inapplicable and the reason is recorded. A skipped stage must never weaken a required repository gate.

## Skill selection law

The following core skills are mandatory for every engineering mission:

- `repo-truth-first`
- `contract-integrity`
- `preflight-before-ci`
- `evidence-and-certification`
- `dependency-integrity-loop`
- `escape-hatch-auditor`
- `merge-certification-gate`
- `regression-learning`
- `resource-conservation`

The following are mandatory when their trigger applies:

- `test-the-test` for newly added or materially changed behavioral/regression tests.
- `ci-failure-repair-loop` whenever any required CI/check fails, cancels unexpectedly, or produces contradictory evidence.
- `security-authority-gate` whenever auth, authorization, RLS, grants, service role, secrets, destructive operations, tenant boundaries, payments, publishing, runtime or consequential authority may be affected.

Applicable VibeSchool domain modules from `SKILL_REGISTRY.json` are also mandatory.

## Dependency integrity

If work on priority N reveals a verified defect in an earlier dependency:

1. Record the contradiction.
2. Invalidate stale READY/CERTIFIED evidence that depends on the defect.
3. Preserve unrelated concurrent work.
4. Repair the canonical earlier layer first.
5. Re-run its required verification and independent assurance.
6. Re-certify affected dependents.
7. Resume the interrupted mission from the last still-valid checkpoint.

Never patch only the later symptom when the root contract is defective.

## CI repair loop

On a failed required check:

1. Fetch the exact failed run, job and log for the current head.
2. Classify the failure as product/code, test, contract, environment, flaky infrastructure, stale evidence, or external provider failure.
3. Repair the canonical cause. Do not weaken tests or gates to obtain green status.
4. Run the narrowest meaningful local/preflight proof first.
5. Re-run only the necessary failed job/check when possible.
6. Continue until green or a genuine owner/external boundary is documented.

Repeated blind reruns are forbidden.

## Test integrity

New tests must protect behavior rather than decorate the change. Where practical, prove the test can fail by temporarily violating the protected behavior or by using a negative/positive control. Do not commit the deliberate break.

Forbidden shortcuts include unreviewed `as any`, `as unknown`, `@ts-ignore`, skipped tests, disabled lint, swallowed exceptions, weakened assertions, mocks that bypass the real contract, and flags that disable safety controls. Existing uses must be evaluated in changed/affected paths rather than blindly expanded.

## Evidence states

- `IMPLEMENTED`: code/config change exists on the stated exact SHA. No verification claim implied.
- `VERIFIED`: required direct tests/checks for the stated exact SHA passed.
- `CERTIFIED`: all required verification plus required independent assurance and control-plane conditions passed for the stated exact SHA.
- `MERGE READY`: certified where required, exact-head required checks green, review obligations satisfied, no unresolved blocking contradiction.
- `MERGED`: GitHub confirms merge and the merged SHA is known.
- `POST-MERGE VERIFIED`: required checks on resulting main/production state passed.
- `BLOCKED`: a specific unresolved boundary prevents progression; evidence and next owner/action are recorded.

Never infer one state from another.

## Authority and production safety

The executor is non-activating by default. Runtime, schedulers, automatic publishing, payments and consequential worker authority remain OFF unless separately and explicitly commissioned through the repository's owner/control-plane gates.

Destructive production SQL, migration-history repair, RLS/grant weakening, secret exposure, cross-tenant access, payment activation, publishing activation, scheduler activation or authority expansion require explicit current authorization and the applicable security/production gates.

## Merge law

Do not merge merely because implementation looks correct. The executor must verify:

- exact PR head has not moved since evidence was collected;
- all required checks for that exact head are green;
- required reviews/independent assurance are satisfied;
- no unresolved blocking review thread or contradiction remains;
- merge target/base assumptions are still valid;
- the merge operation is constrained to the expected head SHA;
- resulting merge/main SHA is recorded and post-merge verification is performed when required.

## Resource conservation

Prefer repository inspection, narrow tests, local/static verification and targeted CI before deploys or expensive external runs. Do not trigger repeated Vercel/Netlify deployments, paid AI calls, production mutations or destructive actions merely to gather evidence available more safely elsewhere.

## Learning loop

Every preventable failure must be assessed for permanent prevention. When practical, add or strengthen one or more of:

- regression test;
- contract validator;
- preflight check;
- CI guard;
- static scan;
- governance rule;
- observability/watchdog signal.

The objective is not only to repair the current failure but to reduce recurrence across future models and chats.

## Handover contract

If work ends before POST-MERGE VERIFIED, record at minimum:

- mission;
- branch/PR;
- exact head SHA;
- current state;
- checks and evidence already obtained;
- checks still pending/failed;
- unresolved findings and dependency impact;
- production/runtime activation state;
- exact next action.

A new agent must re-check current truth rather than trusting the handover blindly.
