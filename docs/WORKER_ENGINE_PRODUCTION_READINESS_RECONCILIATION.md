# Worker Engine Production Readiness — Initial Reconciliation

Status: READ-ONLY EVIDENCE SNAPSHOT
Baseline date: 2026-08-16
GitHub main: `6a62101e455d956cd33026e2bf6dcb5c406a2ceb`
Production Supabase: `yauqsxggtuxuykcbrtzf`

## Purpose

Prevent duplicate engineering and false claims of completion by recording what is already present in production, what exists only in repository engineering, and what still needs proof.

## Production foundations already present

Production currently contains substantial Worker Engine foundations including:

- `hq_workforce_workers`
- `hq_workforce_worker_certifications`
- `hq_workforce_worker_competencies`
- `hq_workforce_capability_grants`
- `hq_workforce_runtime_policies`
- `hq_workforce_runtime_authorization_events`
- `hq_workforce_objectives`
- `hq_workforce_plans`
- `hq_workforce_plan_steps`
- `hq_workforce_resources`
- `hq_workforce_skill_resources`
- `hq_workforce_task_contracts`
- `hq_workforce_task_verifications`
- `hq_workforce_outcome_verifications`
- `hq_workforce_execution_budgets`
- `hq_workforce_recovery_actions`
- `hq_workforce_replay_results`
- `hq_workforce_dead_letters`
- `hq_workforce_shadow_traces`
- `hq_workforce_shadow_events`
- `hq_workforce_shadow_decisions`
- `hq_workforce_shadow_resource_usage`
- `hq_workforce_shadow_anomalies`
- `hq_workforce_monitoring_alerts`
- `hq_workforce_worker_performance`

Production also contains the R1.3/R1.3X planning, Shadow, capability-fabric, memory/context and Control Room-era migrations.

These objects are foundations only. Their presence does not prove complete consequential production readiness.

## Repository-only/newer consequential contracts

GitHub main after WE-R1.4.10 contains the newer controlled-autonomy engineering chain. Production migration history does not currently show that R1.4 series.

A direct production lookup confirmed the newer R1.4 capability authority relation `public.hq_workforce_capability_authority_grants` is absent.

Therefore repository R1.4 certification and production runtime capability are not equivalent states.

## Existing Control Room boundary

The deployed Control Room-era read model exposes engine state, counts, workers, jobs, Shadow candidates/runs/decisions, skills, runtime authorization events, evidence, anomalies, dead letters and Shadow resource usage.

It predates the full R1.4 consequential execution chain and therefore is not sufficient as the final execution-forensics interface.

## Current engine posture

At initial audit, production engine contract remains fail-closed for autonomous Worker Engine operation:

- heartbeat disabled;
- Factory disabled;
- runtime execution disabled;
- runtime autonomy level 0;
- runtime max risk 0;
- Shadow disabled;
- Shadow scheduler disabled;
- Shadow global stop enabled.

This safe posture must be preserved throughout readiness engineering unless a separate explicit production activation authorization is given.

## Reconciliation rule

For every future work item:

1. Search repository and production first.
2. If an existing invariant already satisfies the requirement, mark it `REUSE / PROVE`, not `BUILD`.
3. If repository and production differ, classify the difference as deployment drift, schema drift, runtime drift, or intentional non-activation.
4. Never alter production merely to make it resemble repository engineering without a separate deployment decision.
5. Every new defect found becomes either a new permanent regression test or an explicitly documented non-code operational requirement.

## Initial conclusion

The next highest-value implementation work is not another Worker Engine redesign. It is to prove the true mutation and authority topology, then close the missing cross-cutting production-observability contract around the already-built R1.3X/R1.4 architecture.
