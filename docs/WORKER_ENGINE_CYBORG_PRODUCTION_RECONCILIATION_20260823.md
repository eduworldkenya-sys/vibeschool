# Worker Engine ↔ Cyborg production reconciliation — 2026-08-23

Status: READ-ONLY PRODUCTION EVIDENCE / NON-ACTIVATING

Repository baseline: `0b36e472613dbbb00e36fc00e2f03cb424808ebc`
Production Supabase project observed: `yauqsxggtuxuykcbrtzf`

## Purpose

Re-check the Worker Engine production authority topology against current production rather than relying on the older topology snapshot, and identify the exact remaining boundary between Worker Engine authorization and Cyborg-enforced model execution.

No runtime, scheduler, Shadow, publishing, payment, authority grant, or consequential execution was activated during this reconciliation.

## 1. Production remains fail-closed

Read-only production inspection on 2026-08-23 found:

- `heartbeat_enabled = false`
- `factory_enabled = false`
- `runtime_execution_enabled = false`
- `runtime_autonomy_level = 0`
- `runtime_max_risk = 0`
- `shadow_enabled = false`
- `shadow_scheduler_enabled = false`
- `shadow_global_stop = true`
- active capability-authority grants = `0`

This is evidence of the current stop posture only; it is not evidence that runtime would be safe if activated.

## 2. The old tool-gateway P0 finding is stale

The older mutation-topology document described production `hq_workforce_tool_gateway_execute(task_id)` as an independent legacy consequential mutator requiring P0 reconciliation.

Current production no longer matches that description.

The production function now delegates directly to:

`hq_workforce_consequential_execution_gateway(task_id)`

The canonical gateway enters the R1.4 approval-bound chain. The observed R1.4 path includes task authorization, authority-grant binding, approved tool contract enforcement, precondition/desired-state validation, execution-intent reservation/idempotency, stop checks, runtime ceilings, budget reservation, capability-execution limits, bounded mutation, committed execution evidence, and independent consequential verification support.

This means the historical name remains as a **compatibility bridge**, not as a second autonomous mutation implementation.

## 3. Legacy external authority is closed

Current repository migration `20260818112000_worker_engine_we_r1_4_11_legacy_authority_closure.sql` explicitly removes external `service_role` execution from superseded R1.2/R1.3/R1.3X authority surfaces and replaces historically referenced compatibility functions with fail-closed stubs where appropriate.

Current production privilege inspection confirms:

- `anon` cannot execute `hq_workforce_tool_gateway_execute`;
- `authenticated` cannot execute `hq_workforce_tool_gateway_execute`;
- `service_role` can execute the compatibility tool gateway, which delegates to the R1.4 canonical gateway;
- `anon` and `authenticated` cannot execute the R1.4 canonical gateway;
- `service_role` can execute the R1.4 canonical gateway;
- `service_role` cannot execute retired `hq_workforce_execute_safe_queue`;
- `service_role` cannot execute legacy `hq_workforce_enqueue_unrouted_work`;
- `service_role` cannot execute legacy `hq_workforce_create_gap_work_items`.

The repository adversarial test `worker_engine_we_r1_4_legacy_authority_closure.sql` permanently asserts the intended closure contract.

## 4. Direct Worker Engine writers classified

A production catalog scan of `hq_workforce_%` functions that directly insert/update/delete `hq_work_items` produced a bounded set. They separate into these planes:

| Function | Classification | Autonomous consequential bypass? |
|---|---|---|
| `hq_workforce_consequential_execution_gateway_r14_pre_approval_b` | canonical R1.4 consequential mutator | No — intended boundary |
| `hq_workforce_compensate_consequential_execution` | compensation after failed verification | No — recovery plane |
| `hq_workforce_verify_task` | independent verification/finalization | No — verification plane |
| `hq_workforce_create_gap_work_items` | orchestration creation | No; legacy external execution revoked |
| `hq_workforce_enqueue_unrouted_work` | route metadata/orchestration | No; legacy external execution revoked |
| `hq_workforce_escalate_waiting_approvals` | approval evidence/escalation | No business-resource mutation |
| `hq_workforce_assign_work_item` | authenticated HQ-owner assignment plane | Human authority, not worker autonomy |
| `hq_workforce_update_founder_assignment` | authenticated HQ-owner assignment/status plane | Human authority, not worker autonomy |

This closes the specific historical allegation that `hq_workforce_tool_gateway_execute` itself is an independent legacy mutator. It does **not** certify all future resource types or all runtime activation scenarios; regression proof must continue to prevent a second consequential gateway from being introduced.

## 5. Worker model authorization is strong but separate from Cyborg transport enforcement

The Worker Engine already has a deterministic-first model authorization contract through `hq_workforce_authorize_model_call(...)` and `hq_workforce_model_invocations`.

For the production source-grounded authoring path, `hq_content_authoring_claim(...)` currently requires, before a model invocation is authorized:

- Worker Engine runtime enabled and not anomaly-paused;
- queued task with the expected tool/capability semantics;
- R1.4 consequential-task authorization;
- worker identity and active certification;
- active lifecycle state;
- `paid_ai_allowed` on the worker;
- allowlisted model-use reason;
- deterministic failure/need evidence;
- bounded token budget and reserved model budget;
- task ↔ worker binding;
- durable `model_invocation_id` issuance.

This is a strong **Worker Engine authorization and accounting boundary**.

However, model-backed Supabase workers such as content authoring, critic and repair still contain direct Groq HTTP calls. The provider transport does not currently require a short-lived signed Cyborg capability issued by a central Cyborg admission service, nor does it physically traverse one sole Cyborg provider gateway.

Therefore the truthful integration state is:

- Worker Engine task/capability/authority/model-budget authorization: **IMPLEMENTED / production evidence observed**;
- R1.4 compatibility bridge for consequential work-item mutation: **IMPLEMENTED / production evidence observed**;
- independent consequential verification foundation: **IMPLEMENTED / production evidence observed**;
- Worker Engine model invocation physically forced through Cyborg: **NOT YET IMPLEMENTED/PROVEN**;
- `no signed Cyborg capability = no LLM`: **NOT YET IMPLEMENTED/PROVEN**.

## 6. Remaining P0 is now different

The remaining Worker Engine ↔ Cyborg P0 is **not** “replace `hq_workforce_tool_gateway_execute`.” That bridge already exists in current production.

The remaining integration target is:

`Worker task/model authorization → signed Cyborg capability → sole provider gateway → provider invocation → invocation lineage → Worker task evidence`

The provider gateway must validate at least mission/task identity, worker identity, model/provider, operation, expiry, nonce/replay protection and bounded authority/scope. Provider credentials must not remain usable by worker Edge Functions after migration.

CI must then scan all server and Edge Function surfaces, including `supabase/functions/**` and Groq endpoints/SDKs, and reject direct provider execution outside the canonical gateway.

## 7. Certification statement supported by this evidence

This reconciliation supports the narrower statement:

> **Worker Engine R1.4 work-item consequential compatibility bridge and legacy-authority closure are observed in current production while runtime remains fail-closed.**

It does not support:

- full autonomous Worker Engine runtime certification;
- full cross-resource consequential-mutation certification;
- Worker Engine ↔ Cyborg model-transport certification;
- production Cyborg persistence/restart certification;
- scheduler/runtime activation readiness.

Those remain separate exact-head and production-runtime proof programmes.