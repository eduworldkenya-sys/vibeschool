# Worker Engine Production Readiness Audit

Updated: 2026-08-13
Production project: `yauqsxggtuxuykcbrtzf`
Status: production runtime promotion complete and independently verified; autonomy remains OFF

## Decision boundary

Production promotion and production autonomy activation are separate protected decisions.

This audit now records the completed production-promotion evidence. It does **not** authorize Worker Engine autonomy.

## Production promotion result

**PRODUCTION RUNTIME PROMOTION: VERIFIED.**

Protected apply workflow run: `31690019768`.

The exact certified Worker Engine migration set was applied to production after protected dry-run verification and repair of the WE-L1 pgcrypto qualification defect.

The production runtime was then independently verified through a protected read-only workflow.

Successful production verification run: `31692743162`.

Evidence artifact: `9178052369`.
Artifact SHA-256: `197c4e347438606cf21abb088fb929265954d43b5e2eddbbd4ca2a8e6066a7e2`.

## Certified Worker Engine migration set

The production promotion unit was the complete Worker Engine sequence introduced by merged WE-L1 through WE-L13 work plus the promotion-separation migration.

1. `20260812191500_worker_engine_we_l1_authority_lifecycle.sql`
2. `20260812191600_worker_engine_we_l1_contract_hardening.sql`
3. `20260812193000_worker_engine_we_l2_execution_foundation.sql`
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
15. `20260812211500_worker_engine_we_l7_factory_v2.sql`
16. `20260812213000_worker_engine_we_l8_autonomous_demand_factory.sql`
17. `20260812214500_worker_engine_we_l9_autonomous_qualification_dispatch.sql`
18. `20260812215500_worker_engine_we_l10_factory_reuse_hardening.sql`
19. `20260812221000_worker_engine_we_l11_demand_sensor.sql`
20. `20260812222000_worker_engine_we_l12_single_entrypoint_hardening.sql`
21. `20260812223000_worker_engine_we_l13_lifecycle_bypass_closure.sql`
22. `20260813023028_worker_engine_promotion_separation.sql`

## Promotion blockers discovered and resolved

### Scheduler/promotion separation

The original readiness audit identified that historical replay could register the Worker Engine heartbeat cron job even while runtime switches were disabled.

Resolution:

- a forward promotion-separation migration was added;
- production promotion and scheduler activation were mechanically separated;
- final production verification confirms zero Worker Engine heartbeat cron jobs.

### WE-L1 pgcrypto function qualification

The first production apply attempt stopped safely because unqualified `digest()` was not resolvable under the restricted production search path.

Resolution:

- WE-L1 now uses `extensions.digest(...)`;
- a regression guard prevents unqualified pgcrypto calls from returning;
- a fresh protected dry-run certified the repaired 22-migration plan;
- the repaired apply succeeded.

### Read-only verifier transport

The first independent production-verification run was blocked by Cloudflare Error 1010 before executing SQL.

Resolution:

- the official read-only Supabase Management API boundary was retained;
- transport was changed from blocked Python `urllib` to `curl`;
- fail-closed regression coverage was added;
- the next production contract verification passed.

## Final production verification evidence

The successful protected read-only production verification proved:

- approved migrations: `22`;
- promoted tables verified: `21`;
- promoted function names verified: `52`;
- `heartbeat_enabled=false`;
- `factory_enabled=false`;
- Worker Engine heartbeat cron jobs: `0`;
- `production_ddl=false` during verification;
- `production_dml=false` during verification;
- `autonomous_activation=false`;
- evidence artifact generation succeeded.

Independent live catalog checks additionally confirmed:

- all certified migration ledger entries are present;
- the inspected `hq_workforce_*` tables have RLS enabled;
- anon/authenticated direct table DML is absent on the inspected workforce tables;
- legacy probation creation/certification bypass functions are not executable by anon, authenticated, or service_role;
- heartbeat and factory switches remain OFF.

## Production readiness conclusion

The Worker Engine production **foundation** is now ready:

- repository implementation complete for WE-L1 through WE-L13;
- certified migration set promoted;
- production database contracts present;
- production security boundary verified;
- promotion/runtime separation verified;
- autonomous scheduler absent;
- factory and heartbeat switches disabled;
- evidence preserved.

This means the production migration mission is complete.

It does **not** mean autonomous operation is approved.

## Runtime unlock boundary

The next phase must be treated as a new controlled mission: **Worker Engine Runtime Unlock / Shadow Certification**.

The system must not jump directly from installed foundation to broad autonomy.

Runtime capabilities will be unlocked one item at a time, each with its own branch, tests, evidence and explicit completion gate.

The first proposed item is **WE-R1.1 — Runtime Authority & Kill-Switch Audit**. No heartbeat, factory, cron or autonomous production execution is enabled by that item.

See `docs/WORKER_ENGINE_RUNTIME_UNLOCK_PLAN.md`.

## Explicitly prohibited until separately authorized

- setting `heartbeat_enabled=true`;
- setting `factory_enabled=true`;
- registering the Worker Engine production cron heartbeat;
- enabling autonomous production work;
- enabling automatic worker creation;
- expanding worker authority without certified contracts;
- combining multiple runtime-unlock stages into one uncontrolled change.

## Final status

```text
PRODUCTION FOUNDATION: VERIFIED
MIGRATION BLOCKERS: NONE KNOWN
AUTONOMOUS RUNTIME: OFF
NEXT PHASE: CONTROLLED RUNTIME UNLOCK, ONE ITEM AT A TIME
```
