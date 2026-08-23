# Worker Engine ↔ Cyborg production reconciliation — 2026-08-23

Status: READ-ONLY PRODUCTION EVIDENCE / NON-ACTIVATING

Repository baseline at reconciliation start: `4cff2080be2f40cbcd761eaee9628784ae1b2ab9`
Production Supabase project observed: `yauqsxggtuxuykcbrtzf`

## Purpose

Re-check current Worker Engine production authority against live production, supersede stale topology claims, and identify the exact remaining boundary between Worker Engine authorization and Cyborg-enforced model execution.

No runtime, scheduler, Shadow, publishing, payment, authority grant, production mutation, or worker model invocation was activated during this reconciliation.

## 1. Current production is fail-closed

Read-only production inspection found:

- heartbeat: OFF
- Factory: OFF
- runtime execution: OFF
- runtime autonomy level: 0
- runtime max risk: 0
- Shadow: OFF
- Shadow scheduler: OFF
- Shadow Global Stop: ON
- active capability-authority grants: 0

This proves current stop posture only. It does not prove runtime would be safe if activated.

## 2. Historical tool-gateway P0 is stale

The older mutation-topology record described production `hq_workforce_tool_gateway_execute(task_id)` as an independent legacy consequential mutator.

Current production no longer matches that description. The function is now a compatibility wrapper that delegates to `hq_workforce_consequential_execution_gateway(task_id)`, entering the canonical R1.4 approval-bound chain.

Production and repository evidence also show the legacy external-authority closure is applied. `anon` and `authenticated` cannot execute the compatibility or canonical consequential gateways. Retired safe-queue and older enqueue/gap-creator authority surfaces are not externally executable by `service_role`. The repository carries adversarial regression proof for that closure.

Therefore the specific historical allegation that the named compatibility gateway is a competing autonomous mutator is closed for the observed work-item path.

## 3. Direct work-item writers are classified

A production catalog scan of `hq_workforce_%` functions that directly mutate `hq_work_items` reduced to a bounded set covering:

- canonical R1.4 consequential execution;
- compensation after failed verification;
- independent verification/finalization;
- orchestration/routing metadata with legacy external execution revoked;
- authenticated HQ-owner assignment/status controls.

No second currently observed autonomous work-item consequential gateway was found.

This is not a claim that every possible business-resource mutation in the whole platform is certified. Broader resource-level mutation topology remains a separate runtime certification requirement.

## 4. Worker Engine model authorization already exists, but coverage is uneven

Production `hq_workforce_authorize_model_call(...)` provides deterministic-first model authorization and accounting. For governed authoring paths it requires, among other controls:

- valid worker identity;
- current certification/lifecycle conditions for the governed path;
- `paid_ai_allowed`;
- allowlisted reason;
- deterministic-failure/need evidence;
- bounded token and budget reservation;
- task ↔ worker binding;
- durable model-invocation identity.

Source-grounded content authoring binds this authorization to an R1.4 task before a provider call.

However, not all model-backed workers consume that contract. In particular, current Critic/Repair Edge runtimes accept service-role transport identity and call Groq directly without consuming the normal Worker Engine model-authorization ledger.

## 5. Chemistry shadow execution has a separate legitimate authority plane

Critic and Repair are deliberately usable for no-side-effect Chemistry shadow qualification even while normal autonomous Worker Engine lifecycle state is not active.

The Chemistry stage executor correctly creates a durable leased attempt only after:

- global runtime remains OFF;
- Shadow execution/scheduler remain OFF;
- Global Stop remains ON;
- `content_convergence_assert_certified_worker(...)` proves current professional worker certification;
- exact source/version/hash, worker key, stage, lease token and idempotency are recorded;
- side effects remain forbidden.

Therefore the correct repair is **not** to turn those workers active or weaken the lifecycle model.

The defect is that the Critic/Repair HTTP runtimes do not currently require or atomically validate that durable stage attempt/lease before provider execution. Service-role possession alone can reach the model call. That leaves the control-plane lease disconnected from the data-plane model runtime.

## 6. Cyborg provider transport is not yet universal

The repository has a canonical Cyborg gateway contract, but the current universal validator does not cover `supabase/functions/**` or Groq provider URLs/credentials. Multiple Edge Functions still perform direct Groq HTTP calls.

Current `twin-chat` carries a mission identity and has a production-observed mission boundary, but current-main does not yet establish the stronger invariant:

> no valid short-lived Cyborg capability = no provider execution

The hard-enforcement programme must centralize provider credentials/calls and enforce signed request-bound capabilities with expiry, nonce/replay protection, model/provider/operation scope and durable lineage.

## 7. Remaining P0 integration target

The remaining Worker Engine ↔ Cyborg P0 is now:

`Worker task OR certified shadow-stage authorization`
`→ Cyborg admission`
`→ short-lived signed request-bound capability`
`→ sole provider gateway`
`→ one-time capability consumption`
`→ provider invocation`
`→ durable response/receipt lineage`
`→ exact Worker task/stage evidence`

For normal governed runtime, the source authority should be the Worker Engine task/model-invocation contract. For Chemistry shadow qualification, the source authority should be the certified leased stage attempt. Neither path may be replaced with self-asserted caller JSON or service-role possession alone.

## 8. Certification statement supported now

This reconciliation supports the bounded statements:

> Worker Engine R1.4 work-item compatibility bridge and legacy-authority closure are observed in current production while runtime remains fail-closed.

> Chemistry shadow control-plane leasing/certified-worker admission exists, but Critic/Repair model runtimes are not yet bound to that lease.

It does not support:

- full autonomous Worker Engine runtime certification;
- full cross-resource consequential-mutation certification;
- Worker Engine ↔ Cyborg model-transport certification;
- production Cyborg persistence/restart certification;
- scheduler/runtime activation readiness;
- independent certification.