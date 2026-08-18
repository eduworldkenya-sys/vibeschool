# Worker Engine R1.4 production recovery handover — 2026-08-18

## Incident

The first protected WE-R1.4 production promotion legitimately applied `20260818111900_worker_engine_we_r1_3x_production_reconciliation_bridge.sql`, then failed closed before `20260818112000_worker_engine_we_r1_4_11_legacy_authority_closure.sql`.

Read-only production inspection showed the closure failure was caused by historical partial-production drift: the repository's later R1.3X planning/capability foundations had never been applied. Missing objects included `hq_workforce_capabilities`, `hq_workforce_skill_capabilities`, `hq_workforce_plans`, `hq_workforce_plan_steps`, `hq_workforce_plan_step_capabilities`, `hq_workforce_task_contracts`, and `hq_workforce_capability_authority_grants`.

No migration ledger entry was fabricated and no raw production DDL was used. `20260818111900` remains legitimate production history.

## Second production recovery finding

Protected recovery run #7 passed its disposable lineage certification but failed during `Apply certified recovery only` on the first historical backfill migration, `20260815091000_worker_engine_we_r1_3x_capability_competency_graph.sql`.

The concrete error was that `from_capability_id` did not exist on `public.hq_workforce_capability_edges`.

Direct read-only inspection established the reason: production already contains an older table with the same relation name but a different semantic model. Its columns are `id`, `from_skill_manifest_id`, `to_skill_manifest_id`, `relation_type`, `input_mapping`, `output_mapping`, `condition_contract`, `priority`, `enabled`, `created_at`, and `updated_at`. The table contains zero rows. Its indexes also occupy the names `hq_workforce_capability_edges_from_idx` and `hq_workforce_capability_edges_to_idx`.

The later R1.3X capability migration uses `CREATE TABLE IF NOT EXISTS public.hq_workforce_capability_edges (...)`. Because the legacy table already exists, creation is skipped and the migration then fails when it attempts to index canonical columns that are absent.

This is a historical relation-name collision, not a Supabase outage, authorization failure, or migration-ledger defect.

## Acceptance gap

The original WE-R1.4 acceptance workflow reproduced the partial X1/X2 production boundary and certified the `20260818111900` bridge, but then reset to a clean full-chain database before exercising `20260818112000`. It therefore never tested the exact partial-production lineage that failed in production.

The first recovery workflow then reproduced the missing-foundation lineage, but did not reproduce the legacy `hq_workforce_capability_edges` name collision. The second recovery repair closes that acceptance gap by creating the exact observed zero-row legacy shape in the disposable database before historical backfill.

## Recovery rule

Recovery is a late backfill of the repository's actual Worker Engine migration versions, not synthetic replacement schema and not ledger repair.

The bounded recovery source set is every migration whose filename contains `worker_engine` and whose version is between `20260815091000` and `20260818113000`, inclusive. The live ledger removes versions already present; in the observed production state `20260818111900` is parity and therefore is not re-applied. Unrelated school, Twin, reader, commerce, and production-only migrations are outside the approved set.

A single explicit recovery transform is now authorized inside the staged copy of pending version `20260815091000`: if and only if the existing `hq_workforce_capability_edges` relation exactly matches the observed legacy skill-manifest shape and contains zero rows, it is renamed to `hq_workforce_skill_capability_edges_legacy`, its schema-global index names are freed, RLS remains enabled, and anon/authenticated/public grants are revoked. The canonical repository migration then runs under its original version and creates the real capability graph.

The repair fails closed if the relation has rows, has any unexpected column shape, is partially canonical, or the archive name already exists. No synthetic migration version is added to the ledger and the original repository migration remains the authoritative canonical schema definition.

The recovery acceptance job reproduces both observed production drifts, applies the existing `20260818111900` bridge, applies the exact legacy-collision reconciliation, then executes every missing repository Worker Engine migration in canonical version order on that same disposable database. It requires the canonical and archived relations to coexist, zero active capability-authority grants, the production-closure adversarial suite, and the fail-closed engine state to pass.

## Production mutation boundary

Only `.github/workflows/worker-engine-we-r1-4-production-recovery.yml` may perform this recovery. Its apply job is protected by `production-migration-repair`, links only project `yauqsxggtuxuykcbrtzf`, builds a ledger-aligned ephemeral stage, requires an exact dry-run match, applies the certified pending set, verifies every version in the post-apply ledger, and requires zero remaining staged work.

This recovery does **not** activate Worker Engine execution. Heartbeat, Factory, runtime execution, Shadow, Shadow scheduler and autonomous operation remain outside scope. The target state remains autonomy L0, maximum risk 0, and global stop ON.
