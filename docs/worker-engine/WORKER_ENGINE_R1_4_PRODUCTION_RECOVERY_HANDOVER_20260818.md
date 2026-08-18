# Worker Engine R1.4 production recovery handover — 2026-08-18

## Incident

The first protected WE-R1.4 production promotion legitimately applied `20260818111900_worker_engine_we_r1_3x_production_reconciliation_bridge.sql`, then failed closed before `20260818112000_worker_engine_we_r1_4_11_legacy_authority_closure.sql`.

Read-only production inspection showed the closure failure was caused by historical partial-production drift: the repository's later R1.3X planning/capability foundations had never been applied. Missing objects included `hq_workforce_capabilities`, `hq_workforce_skill_capabilities`, `hq_workforce_plans`, `hq_workforce_plan_steps`, `hq_workforce_plan_step_capabilities`, `hq_workforce_task_contracts`, and `hq_workforce_capability_authority_grants`.

No migration ledger entry was fabricated and no raw production DDL was used. `20260818111900` remains legitimate production history.

## Acceptance gap

The original WE-R1.4 acceptance workflow reproduced the partial X1/X2 production boundary and certified the `20260818111900` bridge, but then reset to a clean full-chain database before exercising `20260818112000`. It therefore never tested the exact partial-production lineage that failed in production.

## Recovery rule

Recovery is a late backfill of the repository's actual Worker Engine migrations, not synthetic replacement schema and not ledger repair.

The bounded recovery source set is every migration whose filename contains `worker_engine` and whose version is between `20260815091000` and `20260818113000`, inclusive. The live ledger removes versions already present; in the observed production state `20260818111900` is parity and therefore is not re-applied. Unrelated school, Twin, reader, commerce, and production-only migrations are outside the approved set.

The recovery acceptance job reproduces the observed production drift, applies `20260818111900`, then executes every missing repository Worker Engine migration in canonical version order on that same disposable database and requires the production-closure adversarial suite plus the fail-closed engine state to pass.

## Production mutation boundary

Only `.github/workflows/worker-engine-we-r1-4-production-recovery.yml` may perform this recovery. Its apply job is protected by `production-migration-repair`, links only project `yauqsxggtuxuykcbrtzf`, builds a ledger-aligned ephemeral stage, requires an exact dry-run match, applies the certified pending set, verifies every version in the post-apply ledger, and requires zero remaining staged work.

This recovery does **not** activate Worker Engine execution. Heartbeat, Factory, runtime execution, Shadow, Shadow scheduler and autonomous operation remain outside scope. The target state remains autonomy L0, maximum risk 0, and global stop ON.
