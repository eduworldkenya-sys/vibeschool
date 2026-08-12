# Worker Engine Autonomous Factory — Convergence Log

Updated: 2026-08-12
Branch: `feat/worker-engine-we-l7-worker-factory-v2-20260812`
Stack: PR #92 -> PR #91 -> PR #90
Production/main/Vercel: untouched

## Locked mission

Prove one governed engine can detect sustained workforce demand from real Vibeschool telemetry, diagnose the correct response in deterministic order, create a digital worker only when creation is justified, qualify it without production side effects, certify and provision it through a separate governance path, activate it, route real work to it, independently verify the outcome, and reuse existing capable workers before creating another one.

## Status

**FUNCTIONAL MISSION: PASS in isolated Supabase validation project.**

**EXACT PR HEAD DATABASE REPLAY: PASS.**

Current PR head at audit: `bda6d045fccb31c728ecd7d85f7a23a47fe137f0`.
Runtime-hardening head: `5d59e724f4a3f0d3c12e893802e420e488f05dd1`.
The only commit between them is documentation-only (`docs(worker-engine): record autonomous factory convergence audit`), so runtime evidence remains attributable to the hardened runtime head while TBL-011/TBL-012 also pass on the exact PR head.

## Canonical autonomous trace proven

```text
real HQ Operations backlog
-> demand sensor observation
-> sustained-threshold gate (3 observations)
-> workforce gap signal
-> approved FactoryTemplate lookup
-> authoritative demand metrics
-> quantified deterministic diagnosis
-> eliminate/redesign/automate/train/rebalance/temp/human/create decision tree
-> create_digital_worker_probation only when earlier options fail
-> sealed DemandEvidence
-> Blueprint + WorkerCreationContract
-> deterministic paid-AI-off worker
-> SHADOW only; no live identity/capability/budget
-> certified deterministic qualification cases
-> 3 independent shadow outcomes
-> governance certification
-> CERTIFIED -> ACTIVE
-> expiring WorkerIdentity
-> scoped capability grant
-> transactional tool-call budget
-> generic capability-based Operations dispatch
-> TaskContract
-> Tool Gateway
-> real hq_work_items mutation
-> independent task verification
-> task verified
-> work item resolved + verified
```

## WE-L7 — Governed Worker Factory V2

Implemented and verified:
- sealed `hq_workforce_demand_evidence` with pgcrypto hash;
- immutable `hq_workforce_factory_runs`;
- deterministic quantified HR diagnosis reuse;
- worker creation accepted only for `create_digital_worker_probation`;
- Blueprint/creation authority ceiling;
- generated workers have paid AI disabled;
- allowlisted tool adapter only;
- duplicate demand guard;
- factory stops at SHADOW;
- factory grants no live identity/capability/budget;
- direct SHADOW -> ACTIVE bypass fails;
- eliminate-task and train-existing-worker paths produce no worker.

Defect found and repaired during validation: `digest()` was unavailable under the restricted function search path because pgcrypto lives in `extensions`; WE-L7 now explicitly calls `extensions.digest`.

## WE-L8 — Telemetry-driven Factory

Implemented and verified:
- approved immutable `FactoryTemplate` registry;
- authoritative demand metrics derive worker availability/certified capability from runtime state;
- factory heartbeat scans candidate/accepted gaps;
- no approved template => fail closed / skip;
- generated worker key is deterministic from gap identity;
- factory automation is disabled by default through `factory_enabled=false`;
- scheduled factory never certifies or activates its own worker.

## WE-L9 — Autonomous Qualification + Generic Dispatch

Implemented and verified:
- immutable approved qualification cases;
- deterministic no-side-effect shadow tool executor;
- separate governance qualification heartbeat;
- 3 passing certified cases required;
- certification performed with `governance_factory_verifier_v1`, never the worker itself;
- post-certification identity/capability/budget provisioning;
- generic Operations dispatcher selects any ACTIVE, certified, live-identity, correctly-capable, budget-available worker rather than hardcoding `operations_reference_v1`;
- generic heartbeat independently verifies all completed pending tasks;
- scheduled heartbeat composes factory -> qualification -> runtime.

## WE-L10 — Reuse-before-create Hardening

Adversarial test initially FAILED: a second sustained capacity gap could create a second worker even when the first generated worker was already active and capable.

Repair:
- certified/active capable worker is authoritative evidence for `rebalance_capacity=true`;
- FactoryTemplate `max_live_workers` is mechanically enforced;
- capacity ceiling forces the deterministic diagnosis to `rebalance_lanes` instead of creating another worker.

Retest: PASS — second gap created zero new workers and recorded `rebalance_lanes`.

## WE-L11 — Sustained Demand Sensor

Implemented and verified deterministic sensor policy:
- source: real `hq_work_items` Operations backlog;
- ignores approval-required/already-acted work;
- default threshold: at least 5 eligible open items;
- oldest item at least 15 minutes old;
- requires 3 observations inside a 15-minute window;
- 60-minute gap-emission cooldown;
- priority-weighted impact evidence;
- a one-off spike does not emit a workforce gap;
- sustained backlog emits a `capacity_gap` with provenance.

End-to-end acceptance proved: real backlog -> sensor -> gap -> worker -> qualification -> activation -> verified real work in one governed scheduled control path after sustained evidence exists.

## WE-L12 — Single Runtime Entrypoint

External `service_role` positive-authority orchestration is reduced to one entrypoint:

`hq_workforce_scheduled_heartbeat()`

Low-level factory functions are no longer directly executable by service_role, including demand sealing, factory diagnosis, caller-supplied worker creation, authoritative metric building, shadow execution, qualification, Operations detection and demand sensing.

This prevents a service client from bypassing telemetry/evidence and injecting an invented diagnosis path.

## WE-L13 — Legacy Lifecycle Bypass Closure

Audit found a real legacy alternate path: `service_role` could execute `hq_workforce_certify_probation_workers()`, which directly changed legacy probation workers to `active` outside the canonical lifecycle.

Repaired and reverified:
- legacy probation certifier: service_role EXECUTE = false;
- direct reference-worker bootstrap: false;
- direct lifecycle transition: false;
- direct shadow evidence insertion: false;
- direct certification issuance: false;
- governed scheduled heartbeat: true.

The full sensor -> factory -> qualification -> activation -> verified-job loop still passed after these revocations because internal SECURITY DEFINER functions execute through the governed orchestration boundary.

## Final access/exposure audit

New autonomous-factory tables inspected in the isolated validation project are all RLS enabled with zero direct policies:
- `hq_workforce_demand_evidence`
- `hq_workforce_factory_runs`
- `hq_workforce_factory_templates`
- `hq_workforce_factory_qualification_cases`
- `hq_workforce_demand_sensor_policies`
- `hq_workforce_demand_observations`

No anon/authenticated access is intentionally granted to the autonomous creation/qualification/runtime authority path.

A broad `hq_workforce_%` execute scan found three externally callable non-runtime-authority functions:
- `hq_workforce_decide(...)` — authenticated, but immediately enforces `hq_assert_owner()` before mutation;
- `hq_workforce_list_decisions(...)` — authenticated, but immediately enforces `hq_assert_owner()` before reading HQ decisions;
- `hq_workforce_test_context_health(...)` — immutable pure calculation only, with no database reads or side effects.

These do not provide worker creation, lifecycle, certification, capability, budget or execution authority and therefore do not violate the single positive-authority runtime-entrypoint invariant.

## Repository proof

Exact PR head `bda6d045fccb31c728ecd7d85f7a23a47fe137f0`:
- TBL-011 Isolated Clean Rebuild — PASS, run 394 (`31624268245`).
- TBL-012 M(repo) extractor — PASS, run 69 (`31624268165`).

The prior TBL-011 infrastructure failure on runtime head `5d59e724...` was caused by GitHub runner/Supabase CLI download `socket hang up`; rerun succeeded. It was not a migration defect.

## Acceptance suites committed

- `supabase/tests/worker_engine_we_l7_factory_v2.sql`
- `supabase/tests/worker_engine_we_l8_l10_autonomous_factory.sql`
- `supabase/tests/worker_engine_we_l11_demand_sensor.sql`

They cover positive and negative paths including create justification, eliminate, train existing worker, SHADOW-only creation, independent certification, first verified real job, existing-worker reuse, sustained-demand requirement and transient-spike rejection.

## Deliberate boundaries

This is not an unrestricted AI agent factory. Autonomous generation is only allowed for an approved FactoryTemplate with a certified deterministic tool adapter and qualification suite. Unknown worker types fail closed until governance defines/certifies their template and tools. This preserves the one-engine and deterministic-first architecture.

AI is not used to decide workforce authority. Worker creation/qualification/routing remain deterministic; the bounded Model Gateway remains a separate optional semantic capability.

## Promotion state

- PR #92 remains draft and stacked on PR #91.
- main untouched by this mission.
- production Supabase untouched by this mission.
- Vercel untouched.
- scheduler/factory defaults remain OFF.
- isolated validation functional target: PASS.
- exact-head TBL-011/TBL-012: PASS.
- promotion/merge remains a separate protected-workflow decision; this log does not authorize production activation.
