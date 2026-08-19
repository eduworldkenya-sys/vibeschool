# VibeSchool Task 16 — Worker Engine Controlled Activation & Deactivation Certification

Status: **SHARED-FOUNDATION HOLD — implementation in isolated branch, production unchanged**

Branch: `task16/worker-engine-activation-certification-20260819`
Base main at branch creation: `77051a4011d7712a275f76af41efed382f017398`

## Starting truth

Read-only production inspection on 2026-08-19 established:

- `runtime_execution_enabled = false`
- `runtime_autonomy_level = 0`
- `runtime_max_risk = 0`
- `heartbeat_enabled = false`
- `factory_enabled = false`
- `shadow_enabled = false`
- `shadow_scheduler_enabled = false`
- `shadow_global_stop = true`
- capability-authority rows are currently `revoked`; no active authority was observed
- no global R1.4 execution-breaker row is currently tripped

Production therefore remains in the stronger fail-closed posture required by the hold gate. No production mutation, migration, RLS/grant change, Edge Function deployment, capability issuance, Global Stop weakening, autonomy/risk increase, runtime activation, repair, or Vercel deployment was performed by Task 16.

## P0 finding

The production definition of `hq_workforce_owner_set_runtime(boolean,smallint,smallint,text)` checks active grants using `effective_from <= clock_timestamp()`.

`public.hq_workforce_capability_authority_grants` has no `effective_from` column. Its lifecycle fields are `issued_at`, `certified_at`, `activated_at`, `expires_at`, `revoked_at`, `certified_by`, and `activated_by`.

Result: controlled activation currently fails closed with a schema error. This is safe but not operable.

Task 16 replaces this activation predicate with the authoritative lifecycle contract: `status='active'`, identity-bound activation evidence present, and `expires_at > now()`.

## State machine

Authoritative states introduced by Task 16:

- `OFF`
- `CONTROLLED_OPERATING`

`hq_workforce_engine_contract.runtime_state` is authoritative. The legacy `runtime_execution_enabled` boolean remains a compatibility projection and is constrained so it cannot disagree with `runtime_state`.

`runtime_state_version` is monotonic and is required by every consequential owner transition. This closes stale-tab overwrite races.

Supported transitions:

- `OFF -> CONTROLLED_OPERATING` via versioned owner activation
- `CONTROLLED_OPERATING -> OFF` via normal Stop
- `OFF -> OFF` via idempotent Stop
- `CONTROLLED_OPERATING -> OFF + global breaker` via Global Stop
- `OFF -> OFF + global breaker` via Global Stop when emergency containment is requested before runtime starts

Global Stop is a prohibition and dominates ordinary runtime authority. Restart after Global Stop requires the breaker to be governed/reset separately, fresh authority, successful preflight, and a new versioned activation.

## Activation preflight

`hq_workforce_owner_runtime_preflight` evaluates:

- authenticated HQ owner
- expected state version
- current OFF state
- Global Stop clear
- shadow runtime stopped and shadow Global Stop preserved
- anomaly pause clear
- background heartbeat/factory paths disabled
- explicit enabled global runtime policy
- requested autonomy/risk within that policy
- active, unexpired, identity-bound capability authority compatible with the requested envelope

Any failed condition prevents activation.

## Activation transaction

`hq_workforce_owner_transition_runtime('activate', ...)` performs the transition inside one PostgreSQL transaction and one advisory-locked control-plane critical section.

Activation is rejected when:

- the caller is not the authenticated owner
- the expected version is stale
- the idempotency key conflicts with a different request
- runtime is not OFF
- a Global Stop breaker is active
- anomaly pause is active
- shadow/background execution paths are not safely stopped
- no enabled global policy exists
- autonomy/risk exceeds policy
- no compatible active authority exists

Successful activation:

- moves authoritative state to `CONTROLLED_OPERATING`
- increments `runtime_state_version`
- enables only the consequential runtime gate
- keeps heartbeat and factory paths OFF
- preserves the existing server-side runtime, capability, risk, scope, budget, concurrency, rate, breaker, precondition and idempotency enforcement stack
- emits immutable transition evidence atomically

The previous versionless activation RPC is deliberately closed. The compatibility RPC retains Stop, but activation now requires the versioned transition API. Task 15 must consume this versioned contract before Task 16 can be considered integrated.

## Idempotency and stale-state protection

Owner transitions require an `idempotency_key` scoped to the authenticated owner. Replaying the same request returns the previously recorded result. Reusing a key for a different request fails.

The idempotency record is checked before the state-version check, so this sequence is deterministic:

1. activation commits
2. network response is lost
3. owner retries the same request with the old expected version and same idempotency key
4. the committed result is returned instead of creating a second transition

A different stale request fails with `runtime_transition_stale_state`.

## Normal Stop

Normal Stop is fail-safe and owner-governed:

- blocks new consequential execution by moving runtime to OFF
- resets autonomy/risk to L0/R0
- disables heartbeat/factory/shadow execution paths
- preserves shadow Global Stop ON
- revokes all active temporary capability-authority grants
- contains queued and running tasks bound to those grants
- queued or pre-commit running work becomes `cancelled`
- running work with an already committed execution intent becomes `failed` with `runtime_shutdown_post_commit_verification_required`, preserving the fact that a timeout/stop is not proof that nothing happened
- writes immutable transition evidence

Repeated Stop remains safe and becomes an idempotent OFF transition when no additional cleanup is required.

## Global Stop

Global Stop performs normal shutdown plus an authoritative global R1.4 execution-breaker trip in the same transaction.

This gives priority ordering:

`Global Stop > runtime ON > valid authority > capability > risk > budget`

The existing consequential gateway checks breakers before reservation and again immediately before mutation. A worker, queue retry, stale authority reference, or already-planned action therefore cannot begin a new consequential mutation step after the global breaker becomes authoritative.

## Authority cleanup

Normal Stop and Global Stop revoke all active temporary R1.4 capability-authority grants. Bound queued/running tasks are contained in the same transaction.

A subsequent activation cannot reuse those revoked grants. It requires newly active, unexpired authority plus a new successful preflight and a new runtime version.

## Evidence

`hq_workforce_runtime_transition_events` records:

- authenticated actor
- idempotency key
- action
- previous/resulting state
- previous/resulting state version
- requested envelope
- authority revoked count
- jobs contained count
- outcome
- reason
- evidence payload
- timestamp

Rows are immutable. `anon`, `authenticated`, and `service_role` cannot insert/update/delete them directly. Service transport has read-only access for diagnostics.

## Regression coverage added

`supabase/tests/worker_engine_task16_activation_lifecycle.sql` statically certifies:

- authoritative state + compatibility projection
- version clock
- owner gate
- stale-state protection
- transition idempotency
- removal of the invalid `effective_from` activation predicate
- authority freshness checks
- Global Stop activation denial
- operating-envelope policy gate
- closure of versionless activation
- preservation of Stop
- authority cleanup
- queued/running job containment
- post-commit shutdown treatment
- global breaker integration
- execution-boundary breaker enforcement
- immutable evidence
- denial of service-role/anon owner transitions
- non-activating safe-OFF candidate posture

## Minimum pilot envelope

Task 16 intentionally does not enable heartbeat/factory autonomy. The minimum pilot runtime remains:

- explicit owner activation only
- narrow pre-certified capability authority
- low autonomy/risk bounded by global policy
- existing runtime concurrency/rate ceilings, never widened by activation
- existing budget/resource limits
- mandatory preconditions/idempotency/verification/compensation contracts for consequential capability authority
- Global Stop available and dominant
- strong evidence

Broader scheduler/factory autonomy is outside this activation certification unless separately governed.

## Shared-foundation dependencies

Before final certification:

1. Fetch exact current `main`.
2. Confirm all shared foundations ahead of Task 16 are merged.
3. Reconcile Task 15 HQ Control Room with the versioned activation/preflight/state contract.
4. Inspect every Worker Engine migration/runtime/security change since base `77051a4011d...`.
5. Reinspect production read-only.
6. Reconcile migration order and production schema contracts.
7. Run disposable full lifecycle simulation.
8. Run Global Stop simulation.
9. Run Worker Engine acceptance/governance/security suites.
10. Run migration security and clean rebuild.
11. Run HQ authorization, telemetry and incident-control integration.
12. Run TypeScript and production build.
13. Certify the exact candidate SHA.

Old evidence is invalidated by any changed runtime dependency.

## Hold-gate certification status

Completed on isolated branch:

- repository/runtime truth inspection
- production read-only safe-OFF verification
- P0 activation schema-drift identification
- authoritative two-state runtime model implementation
- stale-state/version enforcement
- replay-safe transition idempotency
- owner-bound activation path
- preflight contract
- explicit activation envelope binding
- normal Stop cleanup semantics
- Global Stop integration
- active-job containment policy
- authority revocation on shutdown
- immutable transition evidence
- static regression suite

Still blocked by the shared-foundation hold and/or unavailable disposable database execution:

- applying this migration anywhere production-like
- transactional activation simulation with real fixtures
- shutdown/Global Stop end-to-end simulation
- clean-build SQL execution of the new migration
- exact-current-main final certification after upstream merges
- Task 15 UI contract reconciliation
- merge/deploy/production verification

No final production-ready certification is claimed while these gates remain outstanding.
