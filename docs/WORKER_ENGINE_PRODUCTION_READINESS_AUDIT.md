# Worker Engine Production Readiness Audit

Updated: 2026-08-12
Issue: #96
Base main: `1bc4e6aa4a146bc8386e5b72f67427cb8eb8abb5`
Production project: `yauqsxggtuxuykcbrtzf`

## Decision boundary

This audit prepares a future production runtime promotion. It does **not** authorize or enable Worker Engine autonomy.

Production promotion and production autonomy activation are separate protected decisions.

## Current production evidence

Read-only production inspection on 2026-08-12 shows the production workforce runtime is older than the merged WE-L1 through WE-L13 repository state:

- `hq_workforce_engine_contract` currently has only `singleton`, `mission`, `responsibilities`, `exclusions`, `routine_paid_ai_required`, and `updated_at`.
- `heartbeat_enabled` and `heartbeat_limit` are absent.
- `hq_workforce_scheduled_heartbeat()` is absent.
- legacy `hq_workforce_certify_probation_workers()` is still present in the production function catalog.
- `vibeschool-worker-engine-heartbeat` cron jobs: `0`.

This is fail-safe with respect to autonomous execution: the governed scheduler/factory runtime has not been promoted and therefore cannot be active in production.

## Canonical Worker Engine migration set

The production promotion unit is the complete Worker Engine migration sequence introduced by merged PRs #90, #91 and #92. Do not cherry-pick a partial subset.

### PR #90 — WE-L1 / WE-L2

1. `20260812191500_worker_engine_we_l1_authority_lifecycle.sql`
2. `20260812191600_worker_engine_we_l1_contract_hardening.sql`
3. `20260812193000_worker_engine_we_l2_execution_foundation.sql`

### PR #91 — WE-L3 through WE-L6 and runtime hardening

4. `20260812194000_worker_engine_we_l3_shadow_certification.sql`
5. `20260812195000_worker_engine_we_l4_heartbeat.sql`
6. `20260812200000_worker_engine_we_l5_model_gateway.sql`
7. `20260812201000_worker_engine_we_l6_reference_worker.sql`
8. `20260812202000_worker_engine_reference_loop_hardening.sql`
9. `20260812202100_worker_engine_reference_governance_hardening.sql`
10. `20260812202200_worker_engine_verification_recertification_hardening.sql`
11. `20260812202300_worker_engine_recertification_clock_hardening.sql`
12. `20260812202400_worker_engine_certification_key_hardening.sql`
13. `20260812202500_worker_engine_live_time_authority_hardening.sql`
14. `20260812202600_worker_engine_scheduler_audit_hardening.sql`

### PR #92 — WE-L7 through WE-L13

15. `20260812211500_worker_engine_we_l7_factory_v2.sql`
16. `20260812213000_worker_engine_we_l8_autonomous_demand_factory.sql`
17. `20260812214500_worker_engine_we_l9_autonomous_qualification_dispatch.sql`
18. `20260812215500_worker_engine_we_l10_factory_reuse_hardening.sql`
19. `20260812221000_worker_engine_we_l11_demand_sensor.sql`
20. `20260812222000_worker_engine_we_l12_single_entrypoint_hardening.sql`
21. `20260812223000_worker_engine_we_l13_lifecycle_bypass_closure.sql`

## Required acceptance suites

The migration promotion is not ready until the exact promotion head passes:

- TBL-011 isolated clean database replay;
- TBL-012 repository/production mutation parity;
- Supabase migration-security contract;
- `supabase/tests/worker_engine_we_l1_authority_lifecycle.sql`;
- `supabase/tests/worker_engine_we_l2_execution_foundation.sql`;
- `supabase/tests/worker_engine_reference_loop.sql`;
- `supabase/tests/worker_engine_we_l7_factory_v2.sql`;
- `supabase/tests/worker_engine_we_l8_l10_autonomous_factory.sql`;
- `supabase/tests/worker_engine_we_l11_demand_sensor.sql`;
- TypeScript;
- ESLint;
- Next.js production build;
- zero unresolved blocking review threads.

## Mandatory fail-closed promotion invariants

Before any production migration is applied, isolated verification must prove:

1. `heartbeat_enabled` defaults to `false` and remains `false` after migration replay.
2. `factory_enabled` defaults to `false` and remains `false` after migration replay.
3. `hq_workforce_scheduled_heartbeat()` returns disabled state while heartbeat is off.
4. unknown/unapproved FactoryTemplates fail closed.
5. generated workers stop at SHADOW before independent qualification/certification.
6. direct service-role lifecycle/certification/factory bypasses remain revoked.
7. `hq_workforce_scheduled_heartbeat()` is the only positive service-role runtime orchestration entrypoint.
8. no migration statement sets the production activation flags to true.

## Production promotion sequence

1. Verify exact migration set and defaults in isolated clean replay.
2. Generate production preflight object/grant/job diff.
3. Pass all repository and Worker Engine acceptance gates.
4. Apply the complete runtime promotion under a protected production change window with activation flags kept OFF.
5. Immediately verify production objects, grants, RLS, cron registration and both OFF switches.
6. Stop. Do not activate autonomy as part of runtime promotion.
7. Open a separate protected activation decision only after production runtime verification evidence is accepted.

## Explicitly prohibited in this audit

- setting `heartbeat_enabled=true`;
- setting `factory_enabled=true`;
- invoking autonomous production work;
- changing production Vercel behavior;
- bypassing external deployment safeguards tracked in issue #95;
- treating repository merge as evidence that production runtime is already promoted.
