# Task 11 — Production Reliability, Failure Recovery, Incident Resilience & Safe Rollback

Status: FINAL INTEGRATION CERTIFICATION

## Canonical lineage

- Base/current-main certification anchor: `a8f3fc572934b00bfa8d565b940af169f00aef18`
- Branch: `task11/production-reliability-recovery-20260820`
- Canonical PR: `#331`
- Production mutation before merge: none

## Mission

Prove that consequential VibeSchool operations fail safely, preserve authoritative truth, retry idempotently where appropriate, recover deterministically, retain evidence, and never widen authorization during failure.

## Architecture classification

Task 11 converges existing machinery; it does not create a second reliability platform.

- `hq_incidents` is the canonical incident surface. Resolution is owner-gated and requires independently verified recovery evidence.
- `hq_workforce_dead_letters` and `hq_workforce_recovery_actions` remain Task-10/Worker primitives. Task 11 consumes their failure evidence and does not create a competing queue/recovery gateway.
- Student identity/enrollment recovery tables remain Task-3 evidence/quarantine surfaces. Ambiguous legacy cases are not auto-repaired.
- `system_health_logs` is LEGACY/PARTIAL job-run evidence, not global health authority.
- `platform_events` + Task-12 event contracts provide cross-platform reliability signal semantics. Task 11 remains incident/recovery authority.
- Founder OS consumes incident/degraded/unresolved evidence; Task 11 does not create a second Founder state machine.

## Failure taxonomy / policy

Fail closed: authorization, identity, payments/settlement, result publication, privileged Worker execution, role changes and school-membership mutation.

May fail soft: optional recommendation, non-critical analytics, secondary dashboard metrics and optional Twin suggestions.

UNKNOWN is never HEALTHY. Queued/started/requested is never durable success.

## Durable reliability contracts verified

### Commerce / M-Pesa

- Orders have `(purchaser_profile_id,idempotency_key)` uniqueness.
- Payment attempts have `(payer_profile_id,idempotency_key)` uniqueness.
- Provider checkout IDs and receipts are unique.
- Purchase creation takes a transaction-scoped advisory lock across product/beneficiary decisions.
- Exact retries recover the original order.
- An existing pending order is reused instead of creating a second charge.
- `reconciliation_required` blocks a second charge while provider state is uncertain.
- Callback event keys are unique.
- Both M-Pesa callback handlers persist immutable evidence before successful acknowledgement.
- Duplicate callback delivery recovers the existing event on unique violation.
- A processing failure after durable persistence is acknowledged as accepted-for-reconciliation rather than causing an uncontrolled provider retry storm.

### Incidents / recovery

- Incident fingerprinting/dedup exists.
- `hq_verify_incident_recovery` requires non-empty recovery evidence.
- `hq_resolve_incident` refuses resolution unless `verification_status='verified'`.
- Emergency recovery verifies propagation postconditions before incident resolution.
- Resolved incidents without verified recovery in production: **0** at certification sweep.

### Notifications / async delivery

- External notification outbox distinguishes queued/sent/failed/cancelled.
- Dedupe keys are unique.
- Repository contract explicitly states queued does not mean delivered.
- Escalation processing uses row locking/skip-locked semantics.

### PWA / weak network

- Auth and API requests bypass service-worker caching.
- Only explicit public routes are navigation-cache eligible.
- Teacher, Student, Parent, Admin and HQ protected workspaces are not public-cache authority.
- Offline fallback therefore cannot expose another authenticated user's workspace as cached truth.

### Observability handoff

Task-12 event contracts preserve explicit failed/denied outcomes, timeout/offline/unknown network states, authoritative-vs-client distinction, correlation and idempotency. Task 11 consumes those signals; it does not redefine telemetry authority.

## P1 discovered by failure inventory — repaired on candidate

Production cron history exposed a real repeated-failure defect:

- job: `vibeschool-hq-company-intelligence`
- schedule: every 15 minutes
- failures in the observed prior 24h: **96**
- last successful execution before repair: **2026-08-16 18:00 UTC**
- repeated root cause: `hq_run_operating_cycle()` invoked retired `hq_workforce_execute_safe_queue()`, which correctly raises `legacy_worker_execution_retired_use_we_r1_4_gateway`.

This was a reliability/integration defect, not a reason to revive the retired executor. Worker execution remains Task-10-owned.

Candidate repair: `20260820041500_task11_hq_operating_cycle_reliability_repair.sql`.

The repair:

1. removes retired Worker execution from the HQ deterministic operating cycle;
2. leaves Worker execution explicitly governed separately by WE-R1.4;
3. redirects the historical company-intelligence cron row to `hq_run_company_intelligence_v2()` directly;
4. fails closed if production contains the cron but not the canonical intelligence function;
5. is conditional/portable when the production-only historical cron row does not exist in clean reconstruction;
6. preserves owner assertion on interactive `hq_run_operating_cycle()` and does not widen the service-only intelligence function.

A transaction-rolled-back production preflight proved `cron.alter_job(...)` accepts the intended command and resolves the target job without persisting the pre-merge change.

Production execute authority observed before promotion:

- `hq_run_company_intelligence_v2()`: anon=false, authenticated=false, service_role=true
- `hq_run_operating_cycle()`: anon=false, authenticated=true with server-side `hq_assert_owner()`, service_role=true

## Production read-only integrity sweep

Observed during Task-11 certification:

- duplicate order idempotency groups: **0**
- duplicate payment-attempt idempotency groups: **0**
- duplicate provider checkout IDs: **0**
- duplicate provider receipts: **0**
- duplicate commerce callback event keys: **0**
- resolved incidents without verified recovery: **0**
- open incidents: **0**
- payment attempts stuck >2h in created/submitting/awaiting_customer: **0**
- payment attempts in reconciliation-required: **0**
- callback events pending >30m: **0**
- failed external-delivery outbox items in prior 24h: **0**
- queued external-delivery outbox items >1h: **0**
- unresolved signup provisioning failures: **0**
- other inspected HQ reliability crons (`hq-founder-opportunities-r3`, `hq-notification-signals-r2`, `hq-signal-escalations-r3`, `vibeschool-hq-policy-reconcile`): current success, **0 failures in prior 24h**

## Governed historical recovery evidence — not auto-repaired

- Worker dead letters: **1**, `CONTENT_SEMANTIC_VERIFY_FAILED`, attempts=1. This is retained evidence from the historical Content Factory path, not an infinite-retry loop. Worker replay/authority remains Task-10-owned.
- Student identity recovery: **9** open cases, all `legacy_missing_canonical_learner`. These are intentional fail-closed legacy quarantine cases; no weak identity match is authorized.
- Student enrollment recovery: **22** open cases, all `historical_unenrolled_without_authoritative_owner`. These are evidence-based quarantine cases; Task 11 does not guess enrollment.

These records are not Task-11 P0/P1 defects because the safe behavior is to retain unresolved ambiguous evidence rather than fabricate recovery.

## Permanent regression gate

Task 11 adds:

- `scripts/test-task11-reliability-contract.mjs`
- `.github/workflows/task11-reliability-contract.yml`

The workflow uses the repository's canonical `./.github/actions/production-build-contract` and runs the Task-11 contract, TypeScript, lint and production build on one exact head. An initial workflow version correctly failed the repository production-build drift guard because it duplicated build logic; the workflow was repaired to consume the canonical build contract rather than bypass the control plane.

The permanent contract also rejects any Task-11 regression that reintroduces `hq_workforce_execute_safe_queue()` into the repaired HQ cycle or points the intelligence cron back at the mixed operating cycle.

## Release / rollback contract

### Bad application release

Prefer code rollback/re-promotion of the last known-good immutable revision. Verify application health and authoritative database compatibility after rollback; a Git revert alone is not proof of recovery.

### Bad migration

Do not assume schema/data rollback is safe. Applied migration history is immutable evidence. Prefer a forward repair migration, preserving data and compatibility. Destructive `DROP`, destructive `ALTER`, bulk rewrite or data repair requires explicit preservation proof.

### Safe release ordering

Prefer: expand schema → deploy backward-compatible code → backfill/reconcile → contract schema. Avoid a one-shot destructive migration that makes the currently deployed application incompatible.

### Kill switches

Worker Global Stop, payment initiation OFF and other domain-specific stop controls remain owned by their respective systems. Task 11 validates that failure handling does not bypass those controls; it does not activate them.

## PR collision classification

- `#331`: **CANONICAL Task 11**
- `#330` Task 12: **DEPENDENCY / PARALLEL**, telemetry/SLO owner; not absorbed
- Worker/Autopilot reconciliation PRs (`#328/#322`): **DEPENDENCY**, execution/recovery primitives remain Worker-owned
- historical auth/Student/Worker recovery PRs: **ABSORBED/MERGED HISTORY** where their contracts are already present on main; not revived

No second open Task-11 reliability PR was discovered.

## P0/P1 register

Owned Task-11 P0: **0 observed**.

Owned Task-11 P1 discovered: **1** (repeated HQ company-intelligence cron failure).

Owned Task-11 P1 remaining on candidate: **0**, subject to exact-head CI and post-merge production application/proof of the forward repair.

Final completion remains gated on exact-head clean reconstruction, migration security, authorization/build/integration gates, current-main freshness, merge SHA verification, production migration promotion, and a successful post-repair cron/operating-cycle smoke.

## Production boundary

No production repair was persisted before candidate certification. No Worker activation, Global Stop release, payment activation, ambiguous data repair or destructive chaos was performed.
