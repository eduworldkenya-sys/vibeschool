# Worker Engine Mutation + Authority Topology

Status: READ-ONLY RECONCILIATION / NON-ACTIVATING
Baseline: GitHub main `6a62101e455d956cd33026e2bf6dcb5c406a2ceb` + production Supabase `yauqsxggtuxuykcbrtzf`

## Mission

Prove which Worker Engine paths can create work, route work, execute work, verify work, mutate canonical business state, and change Worker Engine authority/state. The objective is to distinguish orchestration from consequential mutation and eliminate any assumption that a repository-level canonical gateway is automatically the only production mutation path.

## Core distinction

Not every write is consequential.

- **Control-plane/orchestration write:** creates or routes objectives, plans, tasks, runs, decisions, alerts, evidence or work items without changing the business resource the worker is meant to act upon.
- **Consequential mutation:** changes the authoritative target resource or state whose correctness matters outside the orchestration system.
- **Evidence mutation:** appends/updates verification, outcome, recovery, budget or operational evidence.
- **Authority mutation:** changes identity, certification, capability grant, policy, lifecycle or other permission-bearing state.

The production-readiness requirement is not "only one function may write anything." It is: **all consequential mutation must traverse one certified authority/execution/verification chain; other writers must be explicitly bounded to orchestration/evidence/authority governance and must not become alternate consequential gateways.**

## Production paths observed

### Legacy orchestration path

`hq_workforce_create_gap_work_items()`

- service-role executable;
- creates `hq_work_items` for evaluated workforce gaps;
- does not itself execute business-resource mutations;
- therefore currently classified **ORCHESTRATION / KEEP-UNDER-REVIEW**.

`hq_workforce_enqueue_unrouted_work()`

- service-role executable;
- selects active lane owner and certified legacy skill;
- creates legacy `hq_workforce_runs`;
- updates only work-item route metadata;
- does not itself perform a business-resource mutation;
- currently classified **LEGACY ROUTER / BRIDGE-OR-RETIRE** because it belongs to the pre-objective/capability routing model.

`hq_workforce_execute_safe_queue()`

- service-role executable;
- processes legacy runs whose skill method is `none` or `local_algorithm`;
- marks run completed and writes `internal_review_only`, `side_effects=none` evidence;
- updates `hq_work_items.action_taken`, `acted_at`, and `updated_at`;
- this is a real write to work-item operational state but explicitly declares no business side effects;
- currently classified **LEGACY INTERNAL-ONLY EXECUTION / QUARANTINE-AND-RETIRE OR FORMALLY BOUND**.

Reason: its safety relies on semantic convention (`internal_review_only`, `side_effects=none`) rather than the R1.4 consequential gateway's explicit capability/authority/precondition/idempotency/verification chain. It must never be extended to perform consequential resource mutation.

### Runtime task path

`hq_workforce_execute_task_queue(...)`

- not executable by public/anon/authenticated/service_role;
- checks `runtime_execution_enabled` and `runtime_anomaly_paused` before running tasks;
- therefore global runtime fail-closed behavior exists at the queue boundary;
- currently classified **R1.2/R1.3 INTERNAL RUNTIME ORCHESTRATOR / PRESERVE UNTIL REPLACED OR WRAPPED BY R1.4**.

`hq_workforce_tool_gateway_execute(task_id)` in production

- not executable by public/anon/authenticated/service_role;
- SECURITY DEFINER internal function;
- asserts runtime task authorization;
- reserves/consumes execution budget;
- can mutate `hq_work_items` through the older tool contract;
- predates repository WE-R1.4 consequential execution intent, capability-authority envelope, independent R1.4 verifier, compensation and breaker evidence;
- currently classified **LEGACY CONSEQUENTIAL GATEWAY / P0 RECONCILIATION TARGET**.

This is the most important production topology finding: production has a bounded internal consequential gateway, but it is the older runtime gateway, not the repository R1.4 gateway. Therefore production cannot yet claim the R1.4 canonical mutation chain.

### Verification path

`hq_workforce_verify_task(task_id, verifier_key)`

- not executable by public/anon/authenticated/service_role;
- requires independent verifier identity distinct from the executing worker;
- verifies completed tasks;
- currently classified **LEGACY TASK VERIFIER / PRESERVE AS HISTORICAL CONTRACT, RECONCILE WITH R1.4 VERIFIER**.

### Heartbeat path

`hq_workforce_autonomous_heartbeat(limit)`

- not executable by public/anon/authenticated/service_role;
- composes detection, task execution and verification;
- production engine contract has heartbeat disabled;
- currently classified **DORMANT ORCHESTRATION ENTRYPOINT / FAIL-CLOSED**.

Its function body need not independently test `heartbeat_enabled` if all reachable entrypoints are structurally non-executable and scheduler installation/heartbeat activation is separately governed; nevertheless activation certification must prove the actual scheduler/entry boundary tests the heartbeat flag before invocation.

## Authority/governance paths observed

Production includes identity, certification, worker transition, capability grant, runtime policy and authorization-event foundations. Several authority-mutating functions are internal-only rather than product-role executable.

These are not to be collapsed into the consequential mutation gateway. Authority governance is a separate privileged plane and must remain incapable of self-granting from Worker Engine execution.

## Initial classification

| Path | Type | Current status | Readiness action |
|---|---|---|---|
| gap work-item creation | orchestration | acceptable foundation | prove scope/idempotency |
| legacy enqueue router | orchestration | legacy | bridge or retire |
| legacy safe queue | internal state mutation | legacy semantic safety | quarantine/retire or hard-bound |
| task queue | runtime orchestrator | internally gated | preserve and reconcile |
| production tool gateway | consequential mutation | older canonical gateway | replace/reconcile to R1.4 before activation |
| task verifier | verification | older verifier | bridge/reconcile |
| autonomous heartbeat | scheduler/orchestrator | dormant | prove activation boundary |
| Shadow review | decision evidence | internal/service path | keep separate from authority |

## Root cause behind the topology gap

The Worker Engine evolved through multiple generations:

1. legacy lane/run/skill routing;
2. task contracts + runtime gateway;
3. Shadow governance;
4. R1.3X objective/planning/capability fabric;
5. R1.4 controlled consequential autonomy.

Each generation added safer abstractions while production intentionally remained fail-closed. This created **architectural overlap by design during migration**. The problem is not simply "old code exists." The problem is that production readiness now requires an explicit retirement/bridge boundary so older generations cannot later be reactivated or extended in ways that bypass newer invariants.

## Required solution, not patch

The solution is a **single consequential authority boundary with multiple non-consequential upstream producers**:

`signals / humans / schedulers / legacy bridges → objective/work request → plan → plan step → certified capability → authority envelope → canonical consequential gateway → independent verification → compensation/outcome/escalation`

Legacy producers may continue temporarily only if they terminate before consequential mutation and emit enough lineage to the canonical model.

No legacy execution function may be "made safer" by adding ad-hoc checks and then retained indefinitely. Either:

- it becomes an explicit compatibility adapter feeding the canonical chain, or
- it is revoked/retired.

## P0 closure criteria for topology

Before production canary readiness can be green:

1. Enumerate every function/trigger/cron/Edge Function/service-role path capable of consequential target mutation.
2. Prove ordinary product roles cannot invoke any Worker Engine control or mutation surface.
3. Prove every consequential target mutation is reachable only through the R1.4 canonical gateway after production reconciliation.
4. Classify every legacy writer KEEP / BRIDGE / DISABLE / RETIRE-LATER with reason and replacement.
5. Prove schedulers and heartbeat create demand/execution requests but do not confer authority.
6. Prove authority-governance functions cannot be invoked by worker execution to self-grant or widen authority.
7. Add permanent regression checks preventing a second consequential gateway from being introduced.

Until those criteria pass, the mutation topology gate remains OPEN.
