# Worker Engine R1.4 production recovery handover — 2026-08-18

## Executive decision

The recovery is no longer treated as a sequence of isolated migration defects. Direct production inspection established a dual-generation Worker Engine lineage: an earlier production-only WE-R1.3X generation and a later repository-canonical WE-R1.3X generation reused several public relation/function names with different semantics.

The approved solution is one historical-lineage convergence boundary, followed by the canonical repository chain and then R1.4 closure. The previous one-off capability-edge patch is retired.

## Genesis

Production records an early WE-R1.3X series that is absent from current repository migration source history:

- `20260815053502_worker_engine_we_r1_3x_capability_fabric_foundation`
- `20260815053548_worker_engine_we_r1_3x_planning_intelligence`
- `20260815053608_worker_engine_we_r1_3x_learning_memory`
- `20260815053706_worker_engine_we_r1_3x_legacy_reconciliation`
- `20260815053724_worker_engine_we_r1_3x_control_room_intelligence`
- `20260815053732_worker_engine_we_r1_3x_retire_legacy_entrypoint`
- `20260815053812_worker_engine_we_r1_3x_composition_planner`
- `20260815053834_worker_engine_we_r1_3x_objective_semantics_hardening`
- `20260815053857_worker_engine_we_r1_3x_planning_quality`
- `20260815053922_worker_engine_we_r1_3x_measurement_certification`
- `20260815053936_worker_engine_we_r1_3x_certification_semantics`
- `20260815054004_worker_engine_we_r1_3x_shadow_capability_bootstrap`

Later repository-canonical WE-R1.3X begins with X1/X2 at `20260815080000` / `20260815090000` and X3+ at `20260815091000`. Several later migrations used `CREATE TABLE IF NOT EXISTS`, so a same-name object from the earlier generation could survive without being semantically compatible.

`20260818111900_worker_engine_we_r1_3x_production_reconciliation_bridge` already solved this class of problem for legacy objectives/plans. Protected R1.4 recovery later proved the drift extended beyond objective/planning state.

## Production fingerprints discovered

The early generation still owns these superseded public objects:

- `hq_workforce_capability_edges`: legacy skill-manifest edges (`from_skill_manifest_id`, `to_skill_manifest_id`), 0 rows. Canonical X3 requires capability IDs.
- `hq_workforce_resources`: legacy resource contract (`resource_type`, `trust_tier`, `cost_profile`, `latency_profile`, etc.), 2 rows. Canonical X4 requires `resource_kind`, `cost_per_unit`, `latency_class`, `interface_contract`, etc.
- `hq_workforce_worker_competencies`: legacy scope/capacity contract, 13 certified rows. Canonical X3 uses `scope_types` and `sample_count`.
- `hq_workforce_collaborations`: legacy trace/authority-snapshot contract, 0 rows. Canonical X6 uses objective/plan-step identity and forbids authority transfer.
- historical mapping/evidence tables: `hq_workforce_competency_capabilities` (5 rows), `hq_workforce_skill_resources` (7 rows), `hq_workforce_evaluations`, `hq_workforce_architecture_components` (17 rows), `hq_workforce_calibration`, `hq_workforce_skill_candidates`, `hq_workforce_factory_recommendations`, and `hq_workforce_memory`.

The old resource table is referenced by historical `hq_workforce_skill_resources` and `hq_workforce_evaluations`, proving that archiving only the first failing relation would leave a split lineage.

Production also contains legacy functions bound to these superseded relations. Examples include resource discovery, capability-gap diagnosis, R1.3X metrics, intelligence snapshot and resource/competency resolution functions.

## Convergence architecture

Two real repository migrations now represent the repair; no staged SQL injection and no fabricated ledger history are used.

### `20260815090500_worker_engine_we_r1_3x_historical_lineage_convergence.sql`

Runs after X2 and before canonical X3.

It:

1. requires engine state heartbeat OFF / Factory OFF / runtime OFF / autonomy L0 / risk 0 / Shadow OFF / scheduler OFF / global stop ON;
2. fingerprints every known superseded table by exact ordered column set;
3. treats already-canonical or absent objects as no-op;
4. fails closed on any unknown third schema generation;
5. requires all historically zero-row relations to remain zero-row;
6. moves the complete superseded overlay into private `worker_engine_legacy_archive` rather than dropping data;
7. records every archived object in `worker_engine_legacy_archive.r13x_lineage_manifest`;
8. quarantines public functions whose definitions bind the superseded overlay;
9. revokes public/anon/authenticated/service access to the archive.

### `20260815092500_worker_engine_we_r1_3x_historical_lineage_data_bridge.sql`

Runs after canonical X3 and X4 exist.

It deterministically preserves only semantics with a one-to-one mapping:

- legacy worker competencies → canonical worker competencies, preserving IDs, proficiency, reliability, certification, evidence, scope and timestamps; legacy capacity evidence is retained inside provenance/evidence;
- legacy resources → canonical Resource Registry, preserving IDs, keys, versions, scope, classification, risk/autonomy, health, enabled/shadow state and full legacy metadata. No synthetic reliability value is invented.

Ambiguous historical mappings are *not* auto-promoted. `competency -> skill` and `skill -> resource` are not equivalent to canonical `capability -> competency` / `capability -> resource`; those records remain immutable archive evidence until a separately certified semantic mapping exists.

## Disposable-production proof

`scripts/sql/worker_engine_r13x_legacy_production_fixture.sql` now reconstructs the superseded production overlay, including populated resource/competency evidence and a legacy public function. The protected recovery CI then:

1. resets to repository state at X2;
2. reproduces objective drift plus the full production-only R1.3X overlay;
3. applies the legitimate `20260818111900` objective/plan bridge;
4. late-backfills the real repository migrations beginning at `20260815090500`;
5. requires canonical ontology tables and archived lineage to coexist;
6. proves deterministic preservation of resource and worker-competency evidence;
7. proves ambiguous mappings remain archived;
8. proves the legacy public function is quarantined;
9. runs the complete R1.4 production-closure adversarial suite;
10. reasserts fail-closed engine state.

## Production mutation boundary

Only `.github/workflows/worker-engine-we-r1-4-production-recovery.yml` may apply the convergence/recovery to production. Its production job remains protected by `production-migration-repair`, targets only Supabase project `yauqsxggtuxuykcbrtzf`, requires exact ledger-aligned dry-run equivalence, applies the certified pending versions, verifies every ledger entry afterward, and requires zero pending recovery.

Development of this convergence occurs only on `fix/worker-engine-r1-3x-lineage-convergence`. No production DDL is authorized from the development branch.

## Runtime boundary

Recovery does not activate the Worker Engine. Until post-recovery verification succeeds, the required production state is:

- heartbeat OFF;
- Factory OFF;
- runtime execution OFF;
- autonomy L0;
- maximum risk 0;
- Shadow OFF;
- Shadow scheduler OFF;
- global stop ON.

Only after the canonical R1.4 ledger and schema are proven may the operational sequence continue: Global Shadow Trial → bounded `internal.work_queue.prioritize` canary → one Content Factory remediation job → operational certification → evidence-based autonomy expansion.
