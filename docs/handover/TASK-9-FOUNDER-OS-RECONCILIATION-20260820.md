# Task 9 Founder OS Reconciliation — 2026-08-20

## Canonical line

Branch: `task9/founder-os-reconciliation-20260820`

Current exact base: `main` at `4a73e19c670fda6dc60cf8c27681d5deb693acf5` after Task 12 and Task 11 merged.

Historical Founder OS PR #298 is treated as seed evidence only. It was materially diverged from current main and is not safe to merge directly.

## Production-evolved contract preserved

Read-only production inspection proved the live Founder OS had evolved beyond #298. The canonical candidate therefore preserves, rather than overwrites:

- owner-only `hq_founder_os_snapshot_core()`
- owner-only production wrapper `hq_founder_os_snapshot()`
- owner-only `hq_revenue_operations_snapshot()`
- fail-closed `hq_workforce_get_r13x_certification_snapshot()`
- owner-only non-mutating `hq_workforce_runtime_readiness()`
- explicit LIVE / ATTENTION / DEGRADED / INCIDENT precedence
- revenue/content/business-integrity degradation semantics
- execution-integrity visibility across runs, intents, execution verification, task verification, heartbeat, scheduler and breakers
- canonical current run lineage using `task_id` / `execution_intent_id` with legacy `work_item_id` fallback
- explicit historical verification-gap semantics; no fabricated evidence
- canonical `/hq/operations` Founder surface
- activation-readiness visibility without an activation mutation path
- current Task-15 Workforce Control Room remains Worker control authority
- current HQ Intelligence, Schools, Task-8 authorization, merged Task-11 incident/recovery and merged Task-12 observability remain upstream truth

## Deliberately not replayed from #298

The stale branch's emergency-stop implementation and old HQ shell rewrites were not blindly replayed because current main contains newer Task-15 Global Stop/Worker control semantics and newer HQ navigation/intelligence/school contracts. Task 9 observes those authorities rather than creating competing controls.

## Production safety

No production mutation was performed by this reconciliation. Production was inspected read-only to prevent repository promotion from regressing the already-live Founder OS function contract.

No Worker activation, Global Stop release, capability grant activation, payment initiation, publication, communication or destructive repair is authorized by this branch.

## Promotion gate

Do not merge until Task-9 contract, TBL-011, Task-2 reconstruction, migration security, Task-8 authorization, HQ/Task-15 compatibility, Task-11/Task-12 compatibility, TypeScript/build, Engineering Control Plane and Engineering Integration Gate are green on the exact candidate and the branch is exact-current-main.
