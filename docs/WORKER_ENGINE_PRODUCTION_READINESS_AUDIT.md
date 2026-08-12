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
- `vibeschool-worker-engine-heartbeat` cron jobs: `0`.

Production also still exposes the legacy probation lifecycle to `service_role`:

- `hq_workforce_create_probation_worker(...)` — service-role EXECUTE = true;
- `hq_workforce_certify_probation_worker(...)` — service-role EXECUTE = true;
- `hq_workforce_certify_probation_workers()` — service-role EXECUTE = true.

Anon/authenticated do not have EXECUTE on these three functions. This is therefore not a public-client exposure, but it is a production governance drift: the legacy functions can create probation workers and directly promote qualifying workers to legacy `active` state outside the merged WE-L12/WE-L13 single-entrypoint lifecycle.

Production autonomy through the new governed Worker Engine is not active, but production does not yet satisfy the repository's final authority model.

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

## Promotion-separation blocker discovered

`20260812202600_worker_engine_scheduler_audit_hardening.sql` registers an active pg_cron job named `vibeschool-worker-engine-heartbeat` whenever `pg_cron` exists. The scheduled function itself remains fail-closed because `heartbeat_enabled` defaults to `false`, and later WE-L11 also requires `factory_enabled` or `heartbeat_enabled` before doing work.

That protects against autonomous execution, but it does **not** satisfy the stricter production policy that runtime promotion and scheduler activation must be mechanically separate. A runtime-only promotion should leave the final database with no active Worker Engine cron trigger.

Therefore production promotion is blocked until a **forward migration** (do not rewrite historical migrations) is generated through the normal Supabase migration workflow and verified to leave `vibeschool-worker-engine-heartbeat` unscheduled by default. A later protected activation change may register the cron job only after explicit approval.

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
3. `hq_workforce_scheduled_heartbeat()` returns disabled state while both switches are off.
4. final replay state has **zero active `vibeschool-worker-engine-heartbeat` cron jobs** until a separate activation change.
5. unknown/unapproved FactoryTemplates fail closed.
6. generated workers stop at SHADOW before independent qualification/certification.
7. service-role cannot execute legacy probation creation/certification or direct lifecycle/certification bypasses after promotion.
8. `hq_workforce_scheduled_heartbeat()` is the only positive service-role runtime orchestration entrypoint.
9. no migration statement sets the production activation flags to true.

## Production promotion sequence

1. Generate and review the forward scheduler-separation migration through the normal Supabase migration workflow.
2. Verify the exact migration set and OFF defaults in isolated clean replay.
3. Generate production preflight object/grant/job diff, including removal of legacy service-role worker activation paths.
4. Pass all repository and Worker Engine acceptance gates.
5. Apply the complete runtime promotion under a protected production change window with activation flags kept OFF and the Worker Engine cron job absent.
6. Immediately verify production objects, grants, RLS, zero Worker Engine cron jobs, both OFF switches, and legacy bypass revocations.
7. Stop. Do not activate autonomy as part of runtime promotion.
8. Open a separate protected activation decision only after production runtime verification evidence is accepted.

## Explicitly prohibited in this audit

- setting `heartbeat_enabled=true`;
- setting `factory_enabled=true`;
- registering/activating the Worker Engine production cron job;
- invoking autonomous production work;
- changing production Vercel behavior;
- bypassing external deployment safeguards tracked in issue #95;
- rewriting already-merged historical Worker Engine migrations;
- treating repository merge as evidence that production runtime is already promoted.
