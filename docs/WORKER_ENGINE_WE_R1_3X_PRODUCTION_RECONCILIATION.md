# WE-R1.3X Production Reconciliation

This control document exists to force a fresh production-baseline preview for the already-certified WE-R1.3X migration chain before production promotion.

## Canonical source

GitHub `main` is authoritative for the migration contents. Production Supabase is authoritative for the live migration ledger and schema state.

## Certified reconciliation migrations

- 20260815080000_worker_engine_we_r1_3x_objective_kernel.sql
- 20260815090000_worker_engine_we_r1_3x_memory_context_fabric.sql
- 20260815091000_worker_engine_we_r1_3x_capability_competency_graph.sql
- 20260815092000_worker_engine_we_r1_3x_resource_registry_resolver.sql
- 20260815093000_worker_engine_we_r1_3x_planning_graph.sql
- 20260815094000_worker_engine_we_r1_3x_plan_simulation_selection.sql
- 20260815095000_worker_engine_we_r1_3x_competency_routing_collaboration.sql
- 20260815110000_worker_engine_r1_3x_scheduler_reconciliation.sql
- 20260815111000_worker_engine_r1_3x_context_binding_repair.sql
- 20260815120000_worker_engine_r1_3x_factory_reconciliation.sql
- 20260815130000_worker_engine_r1_3x_calibration_learning.sql

## Production safety invariant

Promotion must remain infrastructure-only. It must not enable heartbeat, Factory, runtime execution, Shadow activation or autonomy. The required postflight state is heartbeat OFF, Factory OFF, runtime execution OFF, Shadow OFF, autonomy L0, risk R0 and global stop ON.

No migration-ledger entry may be fabricated. If production schema drift prevents replay, the drift must be repaired additively from real production evidence and the certified repository contracts before promotion proceeds.
