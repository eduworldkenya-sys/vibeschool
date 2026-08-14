# Worker Engine WE-R1.2 — Production Certification

Date: 2026-08-14
Status: PRODUCTION PROMOTION VERIFIED — RUNTIME REMAINS L0/OFF
Production project: `yauqsxggtuxuykcbrtzf`
Repository main at promotion: `661249e6e1050dce0012775e20b2cdc6bc4d4dec`

## Certified migration

`20260814094000_worker_engine_we_r1_2_runtime_policy_kernel.sql`

This migration adds the WE-R1.2 runtime policy kernel and circuit-breaker foundation. Its production promotion does not authorize shadow scheduling or autonomous execution.

## Protected apply evidence

GitHub workflow: `Worker Engine Production Promotion Apply`
Run: `31793143313`
Result: `success`

The protected workflow proved:

- exact confirmation and `main` ref accepted;
- production project link resolved to the expected project;
- TBL-013 read-only ledger classification completed;
- the ledger-aligned preflight contained exactly the single pending certified migration `20260814094000`;
- the production apply completed successfully;
- the post-apply remote ledger contained the certified migration;
- `autonomous_activation=false` remained part of the evidence contract;
- evidence artifact upload completed.

Evidence artifact:

- artifact id: `9216304206`
- artifact name: `worker-engine-production-promotion-apply-31793143313`
- SHA-256: `207499204f49e7b61cf48f0b6dd8906ad0b34f5091578dc61c465012692e2764`
- retention expiry reported by GitHub: 2026-11-12

## Independent live production verification

A separate read-only Supabase recheck after the protected apply confirmed:

- migration ledger contains `20260814094000`;
- `heartbeat_enabled=false`;
- `factory_enabled=false`;
- `runtime_execution_enabled=false`;
- `runtime_autonomy_level=0`;
- `runtime_max_risk=0`;
- `runtime_anomaly_paused=false`;
- `runtime_max_concurrency=1`;
- `runtime_max_executions_per_minute=10`;
- Worker Engine heartbeat cron job count is `0`.

The three WE-R1.2 policy tables were also verified in production:

- `hq_workforce_runtime_policies`
- `hq_workforce_skill_manifests`
- `hq_workforce_runtime_authorization_events`

For all three, RLS is enabled and direct `anon` / `authenticated` DML is absent.

At the time of certification, no certified skill manifests existed in production. This is an additional fail-closed state: the runtime policy kernel is installed, but no WE-R1.2 skill has been granted executable certified authority.

## Certification decision

WE-R1.2 production promotion is **VERIFIED**.

The production state is deliberately:

- policy kernel installed;
- runtime execution OFF;
- autonomy L0;
- maximum autonomous risk R0;
- heartbeat OFF;
- Factory OFF;
- no Worker Engine heartbeat cron;
- no certified WE-R1.2 executable skills.

This certification does **not** authorize L1 shadow scheduling, L2 recommendations, L3 execution, heartbeat activation, or Worker Factory activation.

## Next engineering mission

Proceed to the next controlled runtime-certification work only from this preserved boundary. Observability/audit, human decision gating, budgets/resource governance, and a distinct non-mutating shadow path must be certified before requesting the next autonomy promotion.
