# Worker Engine Autonomous Factory — Convergence Log

Updated: 2026-08-12
Branch: `feat/worker-engine-we-l7-worker-factory-v2-20260812`
Stack: PR #92 -> PR #91 -> PR #90
Production/main/Vercel: untouched

## Locked mission

Prove one governed engine can detect sustained workforce demand from real Vibeschool telemetry, diagnose the correct response in deterministic order, create a digital worker only when creation is justified, qualify it without production side effects, certify and provision it through a separate governance path, activate it, route real work to it, independently verify the outcome, and reuse existing capable workers before creating another one.

## Status

**FUNCTIONAL MISSION: PASS in isolated Supabase validation project.**

Promotion remains separate: exact-head repository replay/security gates must be green before merge consideration.

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

Implemented:
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

Implemented:
- approved immutable `FactoryTemplate` registry;
- authoritative demand metrics derive worker availability/certified capability from runtime state;
- factory heartbeat scans candidate/accepted gaps;
- no approved template => fail closed / skip;
- generated worker key is deterministic from gap identity;
- factory automation is disabled by default through `factory_enabled=false`;
- scheduled factory never certifies or activates its own worker.

## WE-L9 — Autonomous Qualification + Generic Dispatch

Implemented:
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

Implemented deterministic sensor policy:
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

Low-level factory functions are no longer directly executable by service_role:
- demand sealing;
- factory diagnosis;
- factory create-shadow-worker;
- caller-supplied factory cycle;
- authoritative metric builder;
- autonomous factory primitive;
- shadow tool executor;
- qualification primitive;
- Operations detector;
- demand sensor primitive;
- runtime heartbeat primitive.

This prevents a service client from bypassing telemetry/evidence and injecting an invented diagnosis path.

## WE-L13 — Legacy Lifecycle Bypass Closure

Audit found a real legacy alternate path: `service_role` could execute `hq_workforce_certify_probation_workers()`, which directly changed legacy probation workers to `active` outside the canonical lifecycle.

Repaired:
- revoked service-role execution of legacy probation certifier;
- revoked service-role direct reference-worker bootstrap;
- revoked direct lifecycle transition, shadow evidence insertion and certification issuance;
- canonical transition to CERTIFIED/ACTIVE now mechanically requires a valid active certification;
- emergency negative-authority controls (revocation/suspension/remediation) remain available where already granted.

Post-hardening grant proof:
- scheduled heartbeat: service_role EXECUTE = true;
- lifecycle transition = false;
- shadow record = false;
- certification issue = false;
- legacy probation certifier = false;
- reference bootstrap = false.

The full sensor -> factory -> qualification -> activation -> verified-job loop still passed after these revocations because internal SECURITY DEFINER functions execute through the governed orchestration boundary.

## Security evidence

New autonomous-factory tables inspected in preview are RLS enabled with zero direct policies:
- `hq_workforce_demand_evidence`
- `hq_workforce_factory_runs`
- `hq_workforce_factory_templates`
- `hq_workforce_factory_qualification_cases`
- `hq_workforce_demand_sensor_policies`
- `hq_workforce_demand_observations`

No anon/authenticated access is intentionally granted. Approved templates/policies and evidence histories have tamper guards in repository migrations.

## Acceptance suites committed

- `supabase/tests/worker_engine_we_l7_factory_v2.sql`
- `supabase/tests/worker_engine_we_l8_l10_autonomous_factory.sql`
- `supabase/tests/worker_engine_we_l11_demand_sensor.sql`

They prove positive and negative paths including create justification, eliminate, train existing worker, SHADOW-only creation, independent certification, first verified real job, existing-worker reuse, sustained-demand requirement and transient-spike rejection.

## Deliberate boundaries

This is not an unrestricted AI agent factory. Autonomous generation is only allowed for an approved FactoryTemplate with a certified deterministic tool adapter and qualification suite. Unknown worker types fail closed until governance defines/certifies their template and tools. This preserves the one-engine and deterministic-first architecture.

AI is not used to decide workforce authority. Worker creation/qualification/routing remain deterministic; the bounded Model Gateway remains a separate optional semantic capability.

## Promotion state

- PR #92 remains draft and stacked on PR #91.
- main untouched.
- production Supabase untouched.
- Vercel untouched.
- scheduler/factory defaults remain OFF.
- isolated validation functional target: PASS.
- exact latest repository clean-replay gates: pending at time of this log; do not mark promotion-ready until they pass.
