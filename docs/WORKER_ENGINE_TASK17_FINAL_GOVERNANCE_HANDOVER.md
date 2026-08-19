# Worker Engine Task 17 — Final Governance Certification Handover

## Status

**HOLD-GATED / NOT MERGED / NOT PRODUCTION-CERTIFIED**

Task 17 branch: `cert/worker-engine-task17-final-governance-20260819`

Starting `main`: `77051a4011d7712a275f76af41efed382f017398`

Upstream blocking dependency observed at task start: PR #279, **Repair Worker Engine commissioning lineage and certification**, remained open. Tasks 15 and 16 also own the HQ control-plane and activation/deactivation contracts that Task 17 must reconcile before final exact-current-main certification.

No production mutation, migration application, RLS/grant change, Edge Function deployment, runtime activation, authority issuance, autonomy increase, risk increase, Global Stop disablement, or intentional Vercel deployment was performed by this Task 17 work.

## Starting production posture — read-only inspection

Production project inspected read-only: `yauqsxggtuxuykcbrtzf`.

The live database exposes the R1.4 governance stack: versioned capability authority, objective/plan/plan-step lineage, consequential gateway, precondition/idempotency intents, budget controls, execution breakers, bounded runtime queue, verification, compensation and owner runtime controls.

## Trust-boundary findings

### T17-P0-001 — service-role breaker reset side door

**Attack:** call `hq_workforce_reset_execution_breaker` directly from a service-role Worker Engine execution path.

**Observed:** production granted `service_role` EXECUTE on the raw reset function. The function accepted caller-controlled `actor` and `reason` text and performed no owner assertion.

**Impact:** a compromised or defective worker/service path could clear a circuit breaker without owner governance. This violates the mandatory invariant that a worker cannot reset a breaker and that recovery requires governed action.

**Repair on Task 17 branch:** revoke raw breaker-reset execution from `service_role` and all application roles; introduce `hq_workforce_owner_reset_execution_breaker` with `hq_assert_owner`, authenticated-owner identity binding, reason/evidence requirements and explicit evidence that no worker authority is granted.

### T17-P0-002 — service-role raw shadow-decision side door

**Attack:** call `hq_workforce_shadow_review_decision` directly from a service-role worker path.

**Observed:** production granted `service_role` EXECUTE on the raw state transition, which did not assert owner authority. An owner-gated wrapper already existed but could be bypassed.

**Impact:** a worker/service path could approve/reject/revise an owner-review item without traversing the HQ owner control plane.

**Repair on Task 17 branch:** revoke raw shadow-review execution from `service_role` and all application roles; retain the existing authenticated, owner-gated `hq_workforce_owner_review_shadow_decision` as the only application entrypoint.

## Existing controls confirmed during read-only trace

The current effective consequential authorization path binds execution to a running task, approved tool contract, plan step, selected plan, approved objective, exact certified capability version, certified skill/tool relationship, objective/task scope equality, authoritative autonomy/risk maxima and an active unexpired authority grant. The resolved risk is the maximum of plan-step, capability, skill and objective risk rather than worker-supplied risk alone.

The current execution-intent layer binds task, authority grant, plan step, capability/version, operation, resource type and scope; refuses inactive/expired authority; fingerprints resource identity and desired state for deduplication; and returns a committed prior result rather than duplicating the effect after a lost acknowledgement.

The current breaker assertion uses transaction/advisory locks and checks global, capability-version and authority-grant breaker scopes before execution. The bounded runtime queue is fail-closed when runtime is disabled or anomaly-paused and serializes scheduler execution with an advisory transaction lock.

## Task 17 branch changes

- `supabase/migrations/20260819081000_worker_engine_task17_final_governance_side_door_closure.sql`
- `supabase/tests/worker_engine_task17_final_governance.sql`
- `docs/WORKER_ENGINE_TASK17_FINAL_GOVERNANCE_HANDOVER.md`

The migration is non-activating and authority-neutral. It changes only function EXECUTE boundaries and adds one owner-gated recovery wrapper.

## Regression contract

The Task 17 regression test asserts:

- `service_role` cannot execute the raw breaker reset.
- `service_role` cannot execute the raw shadow review transition.
- `service_role` cannot execute either owner control surface.
- authenticated callers can reach only the owner wrappers, which still enforce `hq_assert_owner` internally.
- the owner breaker reset records authenticated owner identity and never grants worker authority.
- internal raw primitives remain SECURITY DEFINER with an explicit `public,pg_temp` search path.
- the test fixture remains non-activating with zero active capability authority.

## Remaining certification work after shared foundations merge

Task 17 is not complete while the shared-foundation gate is active. Before final certification:

1. Fetch/reconcile exact current `main` after PR #279 and Tasks 15/16 foundation changes land.
2. Re-run consequential-path inventory against repository + production effective functions/grants.
3. Reconcile the new owner breaker reset with the HQ Control Room recovery UI and Task 16 stop lifecycle.
4. Run clean rebuild from empty disposable PostgreSQL/Supabase state.
5. Run Worker Engine acceptance, capability-version, skills, authority expiry/revocation, preconditions, idempotency/crash recovery, concurrency/locks, budget, breaker, cross-lane/privacy, decision replay, Global Stop/normal Stop, zero-lingering-authority, factory, service-role, database-security, evidence, telemetry and chaos gates.
6. Run the complete Task 17 adversarial scenario end-to-end.
7. Run TypeScript and production build.
8. Reinspect production read-only and certify the exact candidate SHA.

## Certification verdict

**Current verdict: NOT READY TO MERGE.**

Reason: shared foundation remains unresolved and two P0 governance side doors were found. The branch contains repairs and permanent regression protection, but exact-current-main/disposable/chaos/full adversarial certification must occur after upstream convergence.
