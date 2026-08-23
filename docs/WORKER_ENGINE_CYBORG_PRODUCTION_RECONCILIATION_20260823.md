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

## 4. Worker Engine model authorization and repository enforcement

Production `hq_workforce_authorize_model_call(...)` provides deterministic-first model authorization and accounting. Governed authoring paths require valid worker identity, current certification/lifecycle conditions, bounded model need/budget evidence, task ↔ worker binding, and a durable model-invocation identity.

The hard-enforcement branch binds Authoring and Semantic model calls to that exact durable `hq_workforce_model_invocations` source authority. The source authorization is one-time and cannot be replaced with generic service identity.

## 5. Chemistry shadow execution has a separate legitimate authority plane

Critic and Repair are deliberately usable for no-side-effect Chemistry shadow qualification even while normal autonomous Worker Engine lifecycle state is not active.

The Chemistry stage executor creates a durable leased attempt only after global runtime remains OFF, Shadow execution/scheduler remain OFF, Global Stop remains ON, the exact worker is currently certified, source/version/hash are bound, and side effects remain forbidden.

The hard-enforcement branch now requires Critic/Repair HTTP calls to provide the exact `attempt_id` and `lease_token`. Cyborg admission registers the `chemistry_stage_attempt` as the source authority, and the database verifies the claimed stage, worker, unexpired lease, token, fail-closed runtime posture, and one-time source authorization before a capability is usable.

Critic/Repair cannot downgrade to generic `service` authority.

## 6. Cyborg provider transport repository boundary

The hard-enforcement branch centralizes model-provider credentials and provider HTTP calls in `supabase/functions/cyborg-llm-gateway/index.ts`. Server and Edge callers use Cyborg admission, a short-lived request-bound signed capability, and one-time capability consumption before model transport.

The universal validator is expanded to scan `supabase/functions/**` for direct Groq/Anthropic/OpenAI/Google model endpoints and provider-secret access, with only the canonical provider gateway allowlisted. This makes a future direct-provider bypass an exact-head CI failure.

This is repository implementation evidence. It is not evidence that the new migrations/functions have been deployed to production.

## 7. Implemented integration target

The repository-side target is now implemented as:

`Worker task OR certified shadow-stage authorization`
`→ one-time source authority`
`→ Cyborg admission`
`→ short-lived signed request-bound capability`
`→ sole provider gateway`
`→ one-time capability consumption`
`→ provider invocation`
`→ durable response/receipt lineage`
`→ exact Worker task/stage evidence`

For normal governed Worker paths, the source authority is the Worker Engine model-invocation contract. For Chemistry shadow qualification, the source authority is the certified leased stage attempt. Neither path may be replaced with self-asserted caller JSON or service-role possession alone.

## 8. Certification boundary

After exact-head CI passes, this work can support a bounded **repository hard-enforcement certification** covering source-authority binding, request binding, replay prevention, sole-provider-gateway enforcement, caller migration, and fail-closed contracts.

It does not support:

- full autonomous Worker Engine runtime certification;
- full cross-resource consequential-mutation certification;
- production application of the new Cyborg migrations/functions;
- production Cyborg persistence/restart certification;
- scheduler/runtime activation readiness;
- independent certification by a distinct evaluator.
