# VibeSchool Task 12 — Pilot Observability / SLO / Measurement Kernel Final Certification

Status: RECONCILING / PRODUCTION-DISCONNECTED

## Canonical line

- Canonical base at loop start: `a8f3fc572934b00bfa8d565b940af169f00aef18`
- Canonical branch: `task12/final-production-certification-20260820`
- Historical PR #289 is CLOSED / UNMERGED / SUPERSEDED as an implementation branch.
- The reconciled Task-12 foundation already exists on main through `20260819183000_task12_pilot_observability_reconcile.sql` and remains the canonical repository foundation.

## Live production baseline — 2026-08-20

Production project: `yauqsxggtuxuykcbrtzf` (`ACTIVE_HEALTHY`).

Read-only inspection proved that production is still pre-Task-12 foundation:

- `platform_events` exists and has RLS enabled.
- Current production `platform_events` still exposes only the legacy columns: id, event_type, actor_id, actor_role, school_id, entity_type, entity_id, metadata, occurred_at, idempotency_key.
- Task-12 dimensions such as journey, surface, outcome, failure_class, error_code, latency_ms, correlation_id, session_id, source, authoritative, network_class and app_version are not yet deployed.
- `pilot_event_contract` does not exist in production.
- Task-12 ingress / HQ observability RPCs do not exist in production.
- 87 `platform_events` rows were observed in the preceding seven days, with zero in the preceding 24 hours at inspection time; freshest event was 2026-08-18T18:35:01.849664Z.
- Existing production event families remain domain-specific and include assessment audit/score events, commerce callback events, content learning events, HQ product traces, security events, Worker monitoring/runtime event families, Student learning events and health tables.
- Existing `hq_product_event_contract` remains a separate operations/routing contract and must not be replaced by Task 12.
- Existing `hq_incidents` remains Task-11 incident authority.
- Existing `hq_workforce_monitoring_alerts` remains Worker-specific alert authority; Task 12 must not turn it into a platform-wide parallel incident system.

## Canonical event authority

`public.platform_events` remains the shared operational/product event ledger. Domain tables remain authoritative for domain state. Task 12 may normalize operational observation but must not replace assessment, payment, learning, Worker, incident, authorization or school-domain authority.

## Security invariants already present on main

The reconciled Task-12 foundation already corrects the stale #289 assumptions:

- canonical School Admin profile role is `admin`, not `school_admin`;
- client telemetry role and school are derived server-side from `profiles`;
- client telemetry cannot emit authoritative events;
- authoritative ingress is service-role-only;
- event-contract metadata is allowlisted and sensitive key classes are stripped;
- the raw event contract is not directly readable by `anon` or `authenticated`;
- HQ scorecard/drill-down RPCs require platform-owner authority.

## Remaining final-certification work

1. Reconcile the foundation against the current Task 1–8 merged role/auth/privacy contracts and current Task 9–11/Worker interfaces.
2. Expand the event registry to the complete pilot journeys without duplicating existing domain event authority.
3. Wire representative client observations and authoritative commit events for Auth, Teacher, Student, Parent, Admin, VibeLearn, Homework and Assessment.
4. Add explicit SLI/SLO/error-budget/freshness semantics with `UNKNOWN` as a first-class state and counts alongside rates.
5. Reuse Task-11 incident lifecycle for actionable alert handoff; do not create a second incident system.
6. Add privacy/event-poisoning/clock-skew/deduplication/zero-denominator/low-volume certification coverage.
7. Prove clean reconstruction and upgrade safety before production DDL.
8. Reconcile against exact current main before final CI.
9. Apply only the certified migration set to production.
10. Run controlled positive/failure/privacy/alert production proof and postflight.

## Production mutation gate

No production Task-12 DDL or telemetry smoke writes are authorized until the candidate has passed repository reconstruction/security/integration gates against exact-current-main. Production remains read-only during reconciliation.

## Completion state

P0/P1 are not yet certified zero. Task 12 is not complete until exact-head CI, controlled production proof, merge, production postflight and final handover are all green.
