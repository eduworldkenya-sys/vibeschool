# Worker Engine Service-Role + Scheduler Disposition

Status: P0 TOPOLOGY CLOSURE / NON-ACTIVATING
Branch: `worker-engine/production-readiness-program-20260816`
Production: `yauqsxggtuxuykcbrtzf`

## Why this exists

The production-readiness problem is not that service-role or scheduled functions exist. VibeSchool needs privileged orchestration. The risk is that a privileged orchestration path can silently become a second consequential mutation gateway, or that repository rebuild behavior differs from the live production contract.

This document classifies the currently observed paths by what they are allowed to do and what must happen before R1.4 consequential activation.

## Governing rule

Upstream systems may create demand, objectives, work items, plans, evidence, alerts and review state. They may not confer consequential execution authority. Any path that changes authoritative target business state on behalf of a worker must terminate in the canonical R1.4 authority/execution/verification chain.

## Active scheduler inventory

Live production `pg_cron` currently has one scheduled HQ job that touches Worker Engine behavior:

- job 8: `*/15 * * * *` → `select public.hq_run_operating_cycle();`

There is no active cron invoking `hq_workforce_scheduled_heartbeat()` or `hq_workforce_scheduled_factory_heartbeat()`.

`hq_run_operating_cycle()` is owner-gated for normal calls and permits the postgres cron session through the explicit `hq_assert_owner()` system path. It composes intelligence, reconciliation, routing, legacy safe-queue execution, product verification and control journeys.

### Disposition: BRIDGE THEN RETIRE LEGACY EXECUTION MEMBER

The operating cycle itself is useful orchestration and should remain conceptually. Its direct call to `hq_workforce_execute_safe_queue()` is the legacy boundary that must not survive as a parallel execution model after R1.4 activation.

The target shape is:

`operating cycle → demand/work-item/objective creation + evidence → canonical planning/authority path`

not:

`operating cycle → legacy run executor → work-item action state`

## Function dispositions

### KEEP — orchestration/evidence only

`hq_route_work_items()`
- assigns HQ work-item owners from department accountability;
- does not confer Worker Engine capability authority;
- may remain as HQ orchestration if its writes are never interpreted as execution authorization.

`hq_run_company_intelligence_v2()`
- creates findings/work items from deterministic company intelligence;
- routes work items;
- does not itself execute a consequential worker capability;
- KEEP as demand producer.

`hq_reconcile_findings()` / `hq_detect_security_signals()` / `hq_reconcile_product_event_verifications()` / `hq_run_control_journeys()`
- evidence, monitoring, reconciliation and control-health functions;
- KEEP outside the consequential gateway, subject to normal least-privilege and evidence-integrity rules.

`hq_workforce_create_gap_work_items()`
- creates work items from workforce-gap evidence;
- KEEP as orchestration producer.

### BRIDGE — legacy routing model

`hq_workforce_enqueue_unrouted_work()`
- creates legacy `hq_workforce_runs` and route metadata;
- does not itself perform the target business mutation;
- must either become an adapter that creates canonical objective/plan/task lineage or be retired after all legacy work is drained.

### QUARANTINE + RETIRE — legacy semantic executor

`hq_workforce_execute_safe_queue()`

Live production behavior is currently narrowed to:
- certified legacy skill execution method `none` or `local_algorithm`;
- `internal_review_only`;
- `side_effects = none`;
- updates only legacy run completion evidence and HQ work-item action metadata.

That is safer than the historical repository migration, but its safety is semantic rather than constitutional. It must never be extended to change arbitrary business resources.

Final disposition: **QUARANTINE now; RETIRE from scheduled execution once the canonical R1.4 path is available in production.**

### REPLACE/RECONCILE — older consequential runtime

`hq_workforce_tool_gateway_execute(task_id)`
- older bounded consequential mutation gateway;
- internal-only and protected by runtime authorization and budget checks;
- predates R1.4 execution-intent/precondition/idempotency/authority-envelope/verifier/compensation/breaker chain;
- must not coexist as an independently activatable consequential gateway once R1.4 is production-reconciled.

Disposition: **REPLACE or turn into a compatibility wrapper that delegates exclusively to the R1.4 canonical gateway.**

`hq_workforce_verify_task(task_id, verifier_key)`
- independent-verifier property is useful;
- legacy verification record is not the final R1.4 evidence contract;
- preserve historical rows, bridge new execution to the R1.4 verifier.

### KEEP DORMANT UNTIL ACTIVATION CERTIFICATION

`hq_workforce_scheduled_heartbeat()`
- checks `runtime_execution_enabled`;
- checks `runtime_anomaly_paused`;
- requires heartbeat/factory enablement before invoking respective autonomous paths;
- no active production cron currently invokes it.

`hq_workforce_scheduled_factory_heartbeat()`
- checks `factory_enabled` before invocation;
- no active production cron currently invokes it.

These scheduler wrappers are correctly shaped as request/orchestration boundaries. Activation certification must still prove they cannot grant authority and that all consequential work invoked downstream reaches only the canonical R1.4 gateway.

## Critical repository/production drift

The historical repository migration `20260809151801_hq_work_bus_and_worker_runtime.sql` defines `hq_workforce_execute_safe_queue()` with `triage_and_own` work-item action semantics.

Live production has a stricter evolved definition: `internal_review_only`, `side_effects=none`, and execution is restricted to legacy skill methods `none` / `local_algorithm`.

This means production is currently safer than a clean replay of the historical migration alone.

### Root cause

Production received later hardening/evolution that is not represented by a discoverable forward migration in the current repository search. The repository therefore cannot yet prove clean-rebuild parity for this safety boundary.

### Required solution

Do not edit the old historical migration. Add an additive forward hardening migration on this isolated branch that:

1. deterministically redefines `hq_workforce_execute_safe_queue()` to the live-safe internal-review-only contract;
2. explicitly documents it as non-consequential and transitional;
3. preserves current grants/revocations;
4. prevents widening to arbitrary target-resource mutation;
5. adds regression certification that a clean database rebuild ends at the hardened definition;
6. later removes the operating-cycle dependency on it when canonical R1.4 production reconciliation occurs.

This closes rebuild drift without mutating production now.

## Authority-plane warning

Service-role callable authority-related helpers (identity/certification revocation, learning promotion, budget handling, objective transitions, shadow decisions) are privileged governance functions, not worker execution authority. The production-readiness contract must keep them on a separate control plane and prove no worker task/gateway can invoke them to self-grant, self-certify, expand scope or reset a stop.

## P0 topology status

- public/anon direct Worker Engine execution: BLOCKED
- authenticated direct runtime gateway: BLOCKED
- service-role direct older runtime gateway: BLOCKED
- active Worker Engine heartbeat cron: NONE
- active HQ cron calling legacy safe executor: PRESENT, non-consequential by current live semantics
- older consequential gateway present: YES, internal/dormant but must reconcile
- repository/live safe-queue definition parity: FAIL

Therefore the topology gate remains OPEN, but the remaining problem is now bounded and actionable.
