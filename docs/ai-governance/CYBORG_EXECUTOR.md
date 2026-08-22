# VibeSchool Cyborg Executor

`vibeschool-cyborg-executor` is the mandatory vendor-neutral execution orchestrator and **authoritative owner of the VibeSchool engineering skill system**.

All repository engineering skills operate under Cyborg authority. Individual skill modules remain modular definitions, but they do not independently control mission execution, sequencing, certification, escalation, or merge admission.

## Ownership model

Cyborg owns:

- the mandatory skill inventory and registry contract;
- skill discovery and applicability classification;
- skill selection, ordering and invocation;
- skill dependencies, prerequisites and conflict resolution;
- required evidence and pass/fail interpretation;
- failure routing and repair/resume behavior;
- certification-state transitions;
- authority escalation and owner-only boundaries;
- merge admission and post-merge verification;
- regression learning and permanent guard creation;
- resource-conservation decisions.

`docs/ai-governance/SKILL_REGISTRY.json` is the machine-readable inventory controlled by Cyborg. `docs/ai-governance/MANDATORY_SKILLS.md` contains modular skill definitions controlled by Cyborg. Neither may weaken or bypass this executor.

The control hierarchy is:

`LLM / AGENT / HUMAN+AI -> CYBORG -> SKILL MODULES -> EVIDENCE + EXECUTABLE GATES -> CI / CONTROL PLANE -> MERGE / RELEASE`

No skill may self-certify, self-promote, bypass another required skill, or authorize production activation outside this hierarchy.

## Mandatory entry

Any LLM, coding agent, autonomous worker, or human+AI workflow that proposes or performs engineering work must:

1. Read `AGENTS.md`.
2. Enter through this Cyborg executor.
3. Load `docs/ai-governance/SKILL_REGISTRY.json` and applicable definitions from `docs/ai-governance/MANDATORY_SKILLS.md`.
4. Read `.github/control-plane/policy.json`.
5. Inspect current repository and CI truth before acting.

Model-specific files may point to this executor but may not weaken it or invoke repository skills outside Cyborg governance.

## Execution contract

For every mission, Cyborg MUST establish and record:

- mission and bounded scope;
- exact base SHA and current candidate head SHA;
- changed and potentially affected shared contracts;
- upstream/downstream dependencies;
- production and authority risk;
- selected core and VibeSchool domain skills plus selection reasons;
- execution order and prerequisites;
- evidence required from each selected skill;
- pass/fail/blocking result from each selected skill;
- unresolved findings and dependency consequences;
- independent assurance requirement;
- completion state using the canonical state meanings below.

## Mandatory skill execution record

Every significant engineering mission must maintain an execution record logically equivalent to:

`skill -> trigger/reason -> prerequisites -> evidence -> result(PASS|FAIL|BLOCKED|NOT_APPLICABLE) -> unresolved findings -> next action`

A skill name appearing in a prompt or checklist is not proof that the skill ran. Evidence is required.

Cyborg may mark a conditional skill `NOT_APPLICABLE` only with a concrete reason. Mandatory universal skills cannot be opted out of by a model.

## Canonical execution loop

`BOOT -> TRUTH -> CLASSIFY -> DEPENDENCY MAP -> SELECT SKILLS -> ORDER SKILLS -> PLAN -> IMPLEMENT -> PREFLIGHT -> TEST INTEGRITY -> SECURITY/DATA VERIFY -> ESCAPE-HATCH AUDIT -> ADVERSARIAL VERIFY -> UI/RUNTIME VERIFY WHEN APPLICABLE -> EXACT-HEAD CI -> CI REPAIR LOOP IF NEEDED -> INDEPENDENT ASSURANCE WHEN REQUIRED -> CERTIFICATION DECISION -> MERGE GATE -> MERGE -> POST-MERGE VERIFY -> LEARN`

A stage may only be skipped when it is demonstrably inapplicable and the reason is recorded. A skipped stage must never weaken a required repository gate.

## Cyborg-owned skill execution matrix

### Universal core — always selected

- `repo-truth-first` — runs first and establishes current truth.
- `contract-integrity` — validates canonical interfaces/contracts before implementation and again when changed contracts require it.
- `preflight-before-ci` — runs after implementation and before expensive/external CI.
- `evidence-and-certification` — owns evidence semantics throughout the mission and evaluates state transitions.
- `dependency-integrity-loop` — remains armed throughout the mission and activates on verified upstream contradiction.
- `escape-hatch-auditor` — runs before certification on changed/affected paths.
- `merge-certification-gate` — runs only after all prerequisite evidence is current.
- `regression-learning` — runs after material failures/repairs and before mission closure.
- `resource-conservation` — applies continuously to execution choices.

### Triggered core

- `test-the-test` — mandatory for new or materially changed behavioral/regression tests.
- `ci-failure-repair-loop` — mandatory when a required CI/check fails, unexpectedly cancels, or contradicts other evidence.
- `security-authority-gate` — mandatory for auth, authorization, RLS, grants, service-role, secrets, tenant boundaries, destructive operations, payments, publishing, runtime, scheduler, worker authority, or other consequential authority impact.

### VibeSchool domains

Cyborg MUST select every matching domain module from the registry. Multiple domains may run in one mission; choosing one does not suppress another.

- `worker-engine-governance` — Worker Engine/runtime/authority/commissioning/watchdog/retry/fallback work.
- `supabase-rls-security` — schema/migration/RLS/grant/auth/data-boundary work.
- `content-factory-quality` — curriculum/content/publication/quality/review work.
- `hq-ux-operational-truth` — HQ state, control-room, operational evidence and UX work.
- `journey-integrity` — Teacher/Student/Parent/Admin end-to-end journeys and shared identity/data contracts.
- `production-readiness` — deployment, rollout, rollback, environment, migration or release work.
- `observability-watchdog-reliability` — telemetry, heartbeat, watchdog, failure visibility and recovery work.

## Skill conflict and precedence law

When skill recommendations conflict, Cyborg resolves them using this precedence:

1. Safety, security, tenant isolation and owner-authority boundaries.
2. Current production/repository truth and executable control-plane gates.
3. Canonical contract/dependency integrity.
4. Exact-head verification and independent assurance requirements.
5. Functional implementation goals.
6. Resource conservation and optimization.

A lower-precedence skill cannot weaken a higher-precedence requirement. Cyborg must record material conflicts and their resolution.

## Failure propagation law

A failed required skill blocks every downstream state that depends on it. Cyborg must not continue toward certification merely because unrelated skills passed.

On failure Cyborg must:

1. preserve the failure evidence;
2. identify affected dependencies and stale states;
3. select the appropriate repair skill/loop;
4. repair the canonical cause;
5. rerun the failed skill and all invalidated dependent skills;
6. resume only from the last still-valid checkpoint.

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

Only Cyborg may determine these repository mission states from the collected evidence. A subordinate skill or model response cannot promote itself.

## Authority and production safety

Cyborg is non-activating by default. Runtime, schedulers, automatic publishing, payments and consequential worker authority remain OFF unless separately and explicitly commissioned through the repository's owner/control-plane gates.

Destructive production SQL, migration-history repair, RLS/grant weakening, secret exposure, cross-tenant access, payment activation, publishing activation, scheduler activation or authority expansion require explicit current authorization and the applicable security/production gates.

## Merge law

Do not merge merely because implementation looks correct. Cyborg must verify:

- exact PR head has not moved since evidence was collected;
- every required selected skill is PASS or legitimately NOT_APPLICABLE;
- all required checks for that exact head are green;
- required reviews/independent assurance are satisfied;
- no unresolved blocking review thread or contradiction remains;
- merge target/base assumptions are still valid;
- the merge operation is constrained to the expected head SHA;
- resulting merge/main SHA is recorded and post-merge verification is performed when required.

## Resource conservation

Prefer repository inspection, narrow tests, local/static verification and targeted CI before deploys or expensive external runs. Do not trigger repeated Vercel/Netlify deployments, paid AI calls, production mutations or destructive actions merely to gather evidence available more safely elsewhere.

## Learning loop

Every preventable failure must be assessed for permanent prevention. When practical, Cyborg must add or strengthen one or more of:

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
- selected skills and their PASS/FAIL/BLOCKED/NOT_APPLICABLE states;
- checks and evidence already obtained;
- checks still pending/failed;
- unresolved findings and dependency impact;
- production/runtime activation state;
- exact next action.

A new agent must re-enter through Cyborg and re-check current truth rather than trusting the handover blindly.
