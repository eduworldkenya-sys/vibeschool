# Worker Engine operator forensics and attention runbook

Status: WE-R1.4.21 / NON-ACTIVATING

## Purpose

Give VibeSchool operations one deterministic answer to four questions: what happened, was it authorized, is the evidence complete, and what must an owner do next. This runbook does not grant execution authority.

## Canonical forensic identity

The R1.4 task UUID is the canonical correlation identity for consequential execution. `hq_workforce_get_execution_dossier(task_id)` reconstructs task state, objective/approved-plan lineage, capability authority, execution intent, verifier assignment, verification, breaker events, dead-letter evidence and the telemetry-completeness verdict from that one identity.

The dossier is owner-only. Service transport cannot call it and cannot use it as a mutation path.

## Severity contract

`hq_workforce_list_execution_attention()` is the owner attention surface.

- **P0** — a task is marked completed but mandatory telemetry is incomplete, or independent verification failed. Treat this as a safety/integrity incident. Keep runtime stopped, preserve evidence, inspect the dossier, and do not manually bless the mutation.
- **P1** — execution failed, reached dead letter, or a lease expired while running. Keep automatic retry bounded. Inspect authorization, breaker state, resource precondition and compensation/recovery evidence before creating a new governed task.
- **P2** — non-terminal operational attention that is not currently evidence of an unsafe committed mutation. Investigate through the normal operating queue.

## Breaker trip

1. Do not reset merely to clear an alert.
2. Inspect the breaker scope, reason and immutable event history.
3. Use the task dossier for every `execution_blocked` event.
4. Confirm the denied attempt performed no mutation.
5. Resolve the underlying authority/resource/verifier problem.
6. Reset only through the owner-governed breaker control with a reason/evidence record.
7. A reset removes a prohibition; it does not grant runtime or capability authority.

## Completed task with incomplete telemetry

1. Treat as P0.
2. Keep fail-closed runtime posture.
3. Capture the dossier and exact task identity.
4. Determine which required stage is absent: approved-plan binding, authority, intent, execution evidence, verifier assignment, verification or outcome evidence.
5. Do not synthesize missing evidence after the fact.
6. Repair the producing contract, add a permanent regression test, and only then create a fresh governed execution where needed.

## Verification failure

1. Treat as P0 because a mutation may exist without a proven postcondition.
2. Do not let the executing worker verify itself or replace the assigned verifier.
3. Inspect expected vs observed outcome and approved-plan fingerprint.
4. Use the governed compensation/recovery path where the R1.4 contract requires it.
5. Preserve negative verification evidence; never delete or rewrite it.

## Dead letter / repeated failure

1. Treat as P1 unless the dossier shows an unverified committed mutation, which escalates to P0.
2. Inspect attempt count, last error and payload snapshot.
3. Check breaker status before retrying.
4. Revalidate authority expiry, runtime policy, budget, capability limits and resource preconditions.
5. Create a new governed task/recovery action; never mutate a terminal ledger row to fabricate success.

## Unexpected cost or rate pressure

1. Keep execution within existing budget/rate/concurrency ceilings.
2. Inspect the task's budget key/amount and capability-authority limits.
3. If the limit is wrong, change it only through the owner-governed configuration path with evidence.
4. Do not bypass a limit using service-role DML.

## Readiness scorecard

`hq_workforce_production_readiness_scorecard()` is machine-readable and service-diagnostic only. Green means the repository schema is structurally ready for a separately governed controlled-canary decision while still fail-closed. It does **not** mean production migrations are deployed, runtime is enabled, a capability grant is active, or autonomous operation is authorized.

A production-ready claim must remain false when the production database has not been reconciled to the certified schema or when observation/canary evidence required by the release decision is absent.
