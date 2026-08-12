# Worker Engine Implementation Log

Updated: 2026-08-12
Active branch: `feat/worker-engine-we-l7-worker-factory-v2-20260812`
Stacked PRs: #92 -> #91 -> #90

## Current mission

Build one governed autonomous Worker Engine that can detect sustained workforce need from Vibeschool telemetry, diagnose whether a new worker is actually justified, create a bounded digital worker only when earlier remedies are insufficient, qualify/certify it safely, activate it, route real work through the existing execution kernel, independently verify the outcome, and prefer reuse/rebalancing before creating duplicates.

**Mission status: ✅ FUNCTIONALLY ACHIEVED ON WORK BRANCH / ISOLATED VALIDATION DATABASE**

This does not mean unrestricted worker generation is enabled. The engine is intentionally template-governed and defaults OFF for autonomous scheduling/factory activation.

## WE-L1 — Authority & Lifecycle Convergence
Status: ✅ VERIFIED COMPLETE ON WORK BRANCH

Implemented: canonical contracts, Blueprint + WorkerCreationContract authority ceilings, canonical lifecycle ledger, expiring/revocable WorkerIdentity, enforceable capabilities, transactional budgets, immutable authority contracts, negative transition/identity/capability/budget tests.

## WE-L2 — Governed Execution Foundation
Status: ✅ VERIFIED FOR REFERENCE-WORKER SCOPE

Implemented: TaskContract, ToolContract, idempotency, lease timeout, bounded retry/backoff, dead-letter handling, transactional budget reserve/consume/release, Tool Gateway, real deterministic `work_item.triage_and_own` side effect, independent verification requirement.

## WE-L3 — Shadow, Certification & Remediation
Status: ✅ VERIFIED

Implemented: no-side-effect SHADOW evidence, 3 independently verified outcomes, no self-verification, certification/expiry/revocation, suspension/remediation, fresh-evidence recertification, wall-clock ordering, UUID-backed certification keys.

## WE-L4 — Autonomous Heartbeat
Status: ✅ VERIFIED FOR BOUNDED OPERATIONS LOOP

Implemented: deterministic eligible-work detection, idempotent task issuance, detect -> execute -> verify cycle, approval/non-Operations exclusion, scheduler entrypoint, default-OFF contract.

## WE-L5 — Deterministic-First Model Gateway
Status: ✅ VERIFIED FOR AUTHORIZATION/ACCOUNTING

Implemented: model use only after deterministic insufficiency evidence, active identity/certification checks, allowlisted reasons, token-budget reserve/release/consume, immutable model invocation state.

## WE-L6 — Reference Operations Worker
Status: ✅ VERIFIED

Proved full lifecycle and adversarial recovery: bootstrap -> SHADOW -> certify -> ACTIVE -> real work -> independent verification; revocation/suspension/remediation/recertification; wrong scope/budget/self-verification/approval-required failures all fail closed.

## WE-L7 — Governed Worker Factory V2
Status: ✅ VERIFIED

Implemented sealed DemandEvidence, deterministic quantified diagnosis, creation allowed only for `create_digital_worker_probation`, bounded Blueprint/creation contract, paid-AI-off generation, allowlisted tool adapter, SHADOW-only creation, no live authority before certification, eliminate/train-existing paths create no worker.

## WE-L8 — Telemetry-Driven Factory
Status: ✅ VERIFIED

Implemented immutable approved FactoryTemplate registry, authoritative demand metrics from runtime state, deterministic worker keys, factory default OFF, fail-closed behavior when no approved template exists.

## WE-L9 — Autonomous Qualification + Generic Dispatch
Status: ✅ VERIFIED

Implemented immutable qualification cases, deterministic shadow executor, governance qualification heartbeat, independent certification, identity/capability/budget provisioning, generic capability-based Operations dispatch, independent verification of completed work.

## WE-L10 — Reuse Before Create
Status: ✅ VERIFIED

Adversarial test exposed duplicate creation despite existing capable worker. Repaired by making active certified capacity authoritative evidence for `rebalance_capacity` and enforcing FactoryTemplate `max_live_workers`. Retest produced `rebalance_lanes` and zero new worker creation.

## WE-L11 — Sustained Demand Sensor
Status: ✅ VERIFIED

Implemented deterministic backlog sensor from real `hq_work_items`: 5+ eligible items, oldest >=15 minutes, 3 observations within 15 minutes, 60-minute emission cooldown, one-off spike rejection, sustained backlog -> capacity gap with provenance.

Full autonomous chain proven: real backlog -> sensor -> gap -> diagnosis -> worker -> SHADOW -> qualification -> certification -> ACTIVE -> real work -> independent verification -> resolved.

## WE-L12 — Single Runtime Entrypoint
Status: ✅ VERIFIED

Positive service-role orchestration is reduced to `hq_workforce_scheduled_heartbeat()`. Low-level factory/diagnosis/qualification/dispatch/sensor/lifecycle functions are not directly executable by service_role.

## WE-L13 — Legacy Lifecycle Bypass Closure
Status: ✅ VERIFIED

Legacy `hq_workforce_certify_probation_workers()` service-role bypass closed. Direct lifecycle transition, shadow evidence insertion, certification issuance and reference bootstrap are also denied to service_role. Canonical CERTIFIED/ACTIVE transition requires valid certification.

## Final access/security audit

In isolated validation state:
- `hq_workforce_scheduled_heartbeat()` service_role EXECUTE: true
- direct lifecycle transition: false
- direct shadow record: false
- direct certification issue: false
- legacy probation certifier: false
- reference bootstrap: false

All six autonomous-factory tables audited are RLS-on with zero direct policies.

Three externally callable non-runtime-authority helpers were reviewed:
- `hq_workforce_decide(...)`: authenticated but calls `hq_assert_owner()` before mutation;
- `hq_workforce_list_decisions(...)`: authenticated but calls `hq_assert_owner()` before reading decisions;
- `hq_workforce_test_context_health(...)`: immutable pure calculation, no DB reads/side effects.

They do not grant worker creation/lifecycle/certification/execution authority.

## Repository evidence

Runtime hardening head: `5d59e724f4a3f0d3c12e893802e420e488f05dd1`.
Exact PR head before this log update: `bda6d045fccb31c728ecd7d85f7a23a47fe137f0`.

On exact PR head `bda6d045...`:
- TBL-011 Isolated Clean Rebuild: ✅ PASS, run 394 (`31624268245`).
- TBL-012 M(repo) extractor: ✅ PASS, run 69 (`31624268165`).

The earlier TBL-011 failure on `5d59e724...` was GitHub/Supabase CLI download infrastructure (`socket hang up`), not PostgreSQL. Its rerun passed.

## Production status

**NOT MERGED / NOT DEPLOYED.**

- PR #92 remains draft.
- main untouched by this Worker Engine mission.
- production Supabase untouched by this Worker Engine mission.
- Vercel untouched.
- autonomous scheduler/factory remain default OFF.

## Boundary after WE-L13

The engine now satisfies the original bounded autonomy target for the approved Operations FactoryTemplate. The next distinct expansion is not more kernel architecture; it is controlled scale-out: additional approved worker templates/certified tool adapters/qualification suites, workforce forecasting/retirement/capacity policy, and eventual protected promotion. Unknown worker types continue to fail closed.
