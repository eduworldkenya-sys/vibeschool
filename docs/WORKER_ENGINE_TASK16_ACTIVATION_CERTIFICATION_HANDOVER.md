# VibeSchool Task 16 — Worker Engine Controlled Activation & Deactivation Certification

Status: **SHARED-FOUNDATION HOLD — isolated implementation in progress; production unchanged**

Branch: `task16/worker-engine-activation-certification-20260819`
Base main at branch creation: `77051a4011d7712a275f76af41efed382f017398`
Current branch relation at latest review: 21 commits ahead / 0 behind that base.

## Hold-gate compliance

Task 16 has not:

- merged
- mutated production Supabase data
- applied production migrations
- changed production RLS/grants
- deployed or changed production Edge Functions
- repaired production data
- issued production capability authority
- disabled production Global Stop controls
- raised production autonomy or risk
- activated production Worker Engine runtime
- intentionally triggered Vercel

All production investigation recorded below was read-only.

## Starting production truth — 2026-08-19

`hq_workforce_engine_contract`:

- runtime execution: OFF
- autonomy: L0
- maximum risk: R0
- heartbeat: OFF
- factory: OFF
- shadow runtime: OFF
- shadow scheduler: OFF
- shadow Global Stop: ON

Authority / policy / budget truth:

- 27 capability-authority rows exist; all are `revoked`
- zero active capability-authority grants
- no active enabled global runtime policy
- execution budgets are `closed`; no active budget is available
- runtime capability allowlist contains four enabled capability/version contracts, but allowlisting alone grants no runtime authority

Scheduler / queue truth:

- production has an active one-minute cron calling `hq_workforce_scheduled_bounded_runtime_queue()`
- two research Worker Engine tasks are queued
- both queued tasks have `autonomous_authority_grant_id = NULL`
- the bounded queue checks runtime execution/autonomy/risk before claiming work and delegates consequential work through the governed gateway
- with runtime OFF, no active global policy, closed budgets and zero active authority, the cron is fail-closed/inert

Transport truth:

- anonymous/authenticated roles cannot call the queue executor or consequential gateway
- `service_role` can call the consequential gateway, as required for trusted execution transport
- owner runtime transition functions are not service-role callable

Production therefore remains safely non-operational. The presence of an active cron is not treated as proof of an active Worker Engine; trusted execution admission remains the security boundary.

## Findings

### P0 — activation RPC schema drift

Production `hq_workforce_owner_set_runtime(boolean,smallint,smallint,text)` references `capability_authority_grants.effective_from`.

That column does not exist. The authoritative lifecycle fields are `issued_at`, `certified_at`, `activated_at`, `expires_at`, `revoked_at`, `certified_by`, and `activated_by`.

Effect: controlled activation currently fails closed with a schema error. Safe OFF is preserved, but controlled activation is not operable.

Repair: Task 16 uses active status + activation identity + expiry and closes the old versionless activation path.

### P0/P1 safety boundary — service-role breaker reset

Production currently permits `service_role` to call the low-level circuit-breaker reset primitive.

A trusted runtime may need to **trip** a breaker automatically, but it must not be able to remove a safety prohibition or clear Global Stop authority on its own.

Repair:

- service transport retains fail-closed breaker trip authority
- direct breaker reset is revoked from service transport
- a new authenticated HQ-owner reset wrapper requires runtime version freshness
- Global Stop reset is allowed only from proven Safe OFF
- reset grants no runtime or capability authority

### P1 — unscoped runtime activation

The previous runtime switch did not bind runtime ON to an explicit set of capability-authority grants. Runtime ON therefore did not itself answer which exact authority set the owner intended to open.

Repair: activation now creates one explicit immutable activation envelope and actual runtime admission requires the task to intersect that envelope.

### P1 — queued work without authority binding

Authority is resolved lazily. Queued tasks can legitimately have no grant ID before execution. A shutdown algorithm that only cancels tasks already bound to revoked grants misses these queued tasks and could allow stale work to revive after a future activation.

Repair: every monotonic transition to Safe OFF centrally terminalizes **all** queued/running Worker Engine tasks, whether or not a grant was previously bound.

### P1 — domain work containment

A Worker Engine task can represent active domain work. Cancelling only the task row can leave a domain job and budget reservation ambiguous.

Repair currently covers the live Content Factory research bridge:

- running research job becomes `needs_human`
- claim identity is cleared
- budget reservation release is attempted
- release failure is preserved as evidence rather than hidden
- task/domain containment linkage is written into execution evidence

### P1 — authority drift during operation

Owner governance correctly permits revoking/suspending authority while runtime is active. Without envelope drift handling, the runtime label could remain operational after selected authority becomes invalid.

Repair:

- every execution checks that the complete selected authority set remains active/unexpired
- hidden active authority outside the selected envelope is denied
- scheduler authority watchdog trips the global breaker on authority drift
- the runtime watchdog then returns the engine to Safe OFF

## Authoritative state machine

Task 16 introduces two supported runtime states:

- `OFF`
- `CONTROLLED_OPERATING`

`hq_workforce_engine_contract.runtime_state` is the authoritative state. `runtime_execution_enabled` remains a compatibility projection and is constrained not to disagree with the state.

`runtime_state_version` is a monotonic optimistic-concurrency clock.

When operating, `runtime_activation_envelope_id` is mandatory. When OFF, it must be NULL.

Supported transitions:

- OFF -> CONTROLLED_OPERATING: versioned owner activation with explicit envelope
- CONTROLLED_OPERATING -> OFF: normal Stop
- OFF -> OFF: idempotent Stop or OFF-state emergency cleanup
- CONTROLLED_OPERATING -> OFF + global breaker: owner Global Stop or watchdog containment
- expired/invalid operating envelope -> OFF: system fail-closed watchdog

The authoritative answer to “can consequential execution occur now?” is therefore not a UI boolean. It requires:

1. state = CONTROLLED_OPERATING
2. runtime projection enabled
3. current active envelope matches runtime version
4. envelope not expired
5. selected authority set still active/unexpired
6. no active authority outside the envelope
7. task intersects an exact selected capability/version/worker/scope grant
8. global/runtime policy passes
9. Global Stop / scoped breakers clear
10. existing R1.4 autonomy/risk/budget/concurrency/rate/precondition/idempotency controls pass

## Explicit activation envelope

`hq_workforce_runtime_activation_envelopes` records the owner-authorized operating window:

- owner
- runtime version
- autonomy level
- maximum risk
- exact authority grant IDs
- immutable authority snapshot
- capability versions / operation / resource / scope data through the grant snapshot
- worker scope through `permitted_worker_key`
- global policy snapshot
- maximum concurrency
- maximum executions/minute
- active budget/resource snapshot
- activation time
- expiry time
- terminal status
- evidence
- activation transition-event linkage

Only one active envelope may exist.

Activation accepts a short duration of 1–60 minutes. Every selected grant must remain valid beyond the requested duration.

Envelope creation rejects:

- missing/empty authority set
- duplicate/unselected hidden active authority
- inactive/expired authority
- unbound worker authority for this minimum pilot envelope
- capability/version not in the runtime allowlist
- risk/autonomy outside allowlist or global policy
- no active budget capacity for a selected worker
- Global Stop
- stale runtime version
- non-owner caller
- unsafe background/shadow state

The old activation RPC and the first unscoped Task-16 activation shape are closed for activation. Task 15 must use the explicit-envelope v2 preflight/transition contract after shared foundations reconcile.

## Idempotency and stale state

Owner transition calls carry an owner-scoped `idempotency_key` plus expected runtime version.

Replay semantics:

1. activation commits
2. response is lost
3. owner retries with the same key and old version
4. previously committed result is returned
5. no duplicate envelope/grants/budgets/schedules are created

A different request using the same key fails as an idempotency conflict.

A genuinely stale request with a new key fails against `runtime_state_version`.

## Runtime enforcement

The explicit envelope is enforced inside `hq_workforce_assert_runtime_task_authorized`, which is already in the consequential authorization chain.

R1.4 resolves capability authority before it persists the grant ID onto a first-run task. Task 16 therefore handles both states safely:

- already-bound task: exact grant ID must be inside the envelope and still active/unexpired
- first-run unbound task: task capability/version/worker/operation/resource/scope must match a selected active grant

Because activation rejects active grants outside the envelope and new authority activation is prohibited while runtime is ON, the later canonical authority resolver cannot silently select hidden authority.

Existing lower-level enforcement remains intact for:

- worker identity/certification/lifecycle
- capability certification/version
- tool/skill binding
- plan/objective authorization
- autonomy
- risk
- scope
- budget reservation/consumption
- concurrency
- executions/minute
- preconditions
- idempotency
- verification
- compensation
- circuit breakers

## Scheduler / watchdog order

The minute scheduler is hardened to run safety reconciliation before queue work:

1. OFF-state Global Stop authority cleanup
2. active-envelope authority-drift watchdog
3. runtime/envelope expiry/integrity watchdog
4. bounded queue execution

Any scheduler exception returns `failed_closed` and does not proceed as successful consequential execution.

## Normal Stop

Normal Stop:

- moves runtime to OFF
- clears activation-envelope pointer
- returns autonomy/risk to L0/R0
- disables heartbeat/factory/shadow execution paths
- preserves shadow Global Stop ON
- revokes all active temporary capability authority
- proves zero active authority remains
- closes the activation envelope
- terminalizes all queued/running Worker Engine tasks, including tasks with no grant ID
- clears leases
- treats already-committed work as `runtime_shutdown_post_commit_verification_required`
- quarantines active Content Factory research work and records budget-release outcome
- writes immutable transition evidence

Repeated Stop remains safe. If no state/authority cleanup is required, it does not manufacture a new activation.

## Global Stop

Global Stop dominates every ordinary permission.

Owner Global Stop:

- trips the authoritative global R1.4 breaker
- performs normal shutdown in the same database transaction
- revokes active temporary authority
- contains queued/running work
- closes the envelope as `global_stopped`
- records evidence

A service-side safety system may trip a global breaker but cannot reset it. The scheduler then detects the breaker and returns operating runtime to Safe OFF.

If a global breaker is tripped while runtime is already OFF, the OFF-state cleanup watchdog revokes any staged active authority and contains stale queued/running work so that it cannot be reused on restart.

## Active-job policy

Task 16 does not use one unsafe universal “kill everything” assumption.

Current behavior:

- queued/pre-commit Worker Engine work: cancel
- running task with committed execution intent: fail into post-commit verification-required state
- running Content Factory research domain job: quarantine as `needs_human`; release budget reservation where possible; preserve release failure evidence
- future operation-specific compensators remain responsible for capabilities whose domain semantics require rollback/compensation instead of quarantine

No new consequential mutation step may begin after Global Stop because breaker checks exist at execution boundaries and the scheduler reconciles emergency state before queue work.

## Authority cleanup and restart

After normal Stop, Global Stop, expiry or authority-drift containment:

- active temporary grants are revoked
- stale task references are terminalized
- active envelope is closed/expired and detached
- consequential admission fails without a fresh envelope

Restart requires:

- Safe OFF
- Global Stop cleared by owner-only governed reset if applicable
- fresh active/certified authority
- valid worker identity/certification
- active global policy
- active budget capacity
- new preflight
- new explicit envelope
- new runtime version

Old revoked authority is never revived by runtime activation.

## Evidence

`hq_workforce_runtime_transition_events` records owner and system transitions:

- actor provenance (`owner` or `system`)
- owner ID when owner-triggered
- idempotency key
- action
- previous/resulting state
- previous/resulting version
- requested envelope
- authority revoked count
- jobs contained count
- outcome
- reason
- evidence payload
- timestamp

Rows are immutable to ordinary transports. System watchdog evidence uses NULL actor ID plus constrained `actor_kind='system'`; owner events require a non-NULL authenticated actor.

Activation envelopes are immutable after their one-time activation-event link is sealed, except for the governed terminal close fields. Budget snapshots are separately immutable.

## Regression coverage added

Task 16 currently adds static SQL contract suites for:

- state/version/projection
- safe OFF
- owner authorization
- stale-state rejection
- transition replay/idempotency
- explicit activation envelope
- capability/version allowlist
- worker/scope intersection
- hidden authority rejection
- authority expiry/drift
- budget/resource evidence
- scheduler fail-closed behavior
- Global Stop priority
- owner-only breaker reset
- expiry/integrity watchdog
- OFF-state Global Stop cleanup
- queued/running central containment
- domain research quarantine
- post-commit uncertainty
- authority cleanup proof
- service/anon attack boundaries
- immutable lifecycle evidence

Existing R1.4 suites remain required for:

- consequential gateway
- preconditions
- execution idempotency
- budget/rate/concurrency
- breaker denial
- approved-plan binding
- verification/compensation
- escalation/authority boundaries
- production closure

## Minimum pilot envelope

Task 16 deliberately keeps pilot operation narrow:

- authenticated owner activation only
- 1–60 minute envelope
- explicit exact authority grants only
- worker-bound authority only
- allowlisted exact capability versions only
- low autonomy and low risk bounded by global policy
- no widening of existing concurrency/rate ceilings
- active budget capacity required and snapshotted
- heartbeat/factory remain OFF
- strong preconditions/idempotency/verification/compensation
- Global Stop dominant
- immutable lifecycle evidence

Broader autonomous factory/scheduler authority is not opened by Task 16.

## Shared-foundation dependencies

Open/unresolved work observed during Task 16 includes Task 1/2/3/4/5/6/7/8 foundations, Task 12 observability PR #289, and Worker Engine commissioning-lineage PR #279. Task 15 HQ runtime-control integration is not present on the inspected `main` workforce page.

Task 12 is expected to provide the canonical `platform_events` observability contract. Task 16 will wire lifecycle telemetry to that merged contract rather than hardcode an incompatible parallel event system while PR #289 is still unresolved.

Task 15 must bind its Control Room actions to:

- authoritative runtime state/version read
- explicit-envelope preflight v2
- explicit-envelope transition v2
- owner Global Stop
- owner-only breaker reset
- resulting immutable evidence

## Required final gates after shared foundations merge

1. Fetch exact current `main`.
2. Confirm required shared foundations are merged.
3. Reconcile/rebase Task 16.
4. Inspect every changed Worker Engine/runtime/security contract.
5. Reinspect production read-only.
6. Reconcile migration ordering and repo/production schema contracts.
7. Wire Task 12 telemetry contract.
8. Reconcile Task 15 HQ Control Room contract.
9. Apply the Task 16 chain only to an isolated disposable database.
10. Run full lifecycle simulation: OFF -> preflight -> activate -> permitted execution -> excessive-risk denial -> Stop -> cleanup -> stale denial.
11. Repeat with Global Stop.
12. Inject authority expiry/revocation, stale state, retries, scheduler retry and crash/timeout scenarios.
13. Run Worker Engine acceptance/governance/security suites.
14. Run migration security and clean rebuild.
15. Run HQ authorization, observability and incident-control integration.
16. Run TypeScript and production build.
17. Certify exact candidate SHA.
18. Only then evaluate merge/deployment under the user’s release gate.

Old certification is invalidated by changed runtime dependencies.

## Disposable database status

No active healthy non-production Supabase branch is currently available. Existing development branches are inactive/migration-failed. Creating a fresh Supabase development branch has a provider cost workflow and therefore was not done autonomously under the user’s material-financial-authority exception.

Accordingly, Task 16 has written the migration and regression contracts but has **not** claimed executable lifecycle simulation, clean-rebuild SQL execution, TypeScript/build certification, or exact-current-main final certification yet.

## Current hold-gate certification status

Completed on isolated branch:

- production read-only runtime truth
- scheduler/queue truth
- activation schema-drift root cause
- breaker reset authority defect root cause
- authoritative runtime state/version model
- explicit activation envelope
- exact authority/capability-version/worker/scope binding
- budget/resource activation evidence
- owner-only activation and breaker reset boundaries
- optimistic stale-state protection
- replay-safe owner transitions
- Global Stop priority
- expiry/integrity fail-closed watchdog
- authority-drift fail-closed watchdog
- OFF-state Global Stop cleanup
- central queued/running task containment
- Content Factory research domain quarantine/budget-release evidence
- authority cleanup proof in transition logic
- static regression coverage
- production remains unchanged and fail-closed

Outstanding because of the shared-foundation hold and/or unavailable disposable execution environment:

- executable full lifecycle simulation
- executable Global Stop simulation
- clean rebuild with the Task 16 migration chain
- runtime failure/chaos execution against fixtures
- Task 12 telemetry integration after canonical observability merges
- Task 15 Control Room integration after its foundation is ready
- exact-current-main reconciliation after upstream merges
- TypeScript/production-build rerun on final reconciled candidate
- merge/deployment/production-safe post-deploy verification

**No final Task 16 production-ready certification is claimed while these gates remain outstanding.**