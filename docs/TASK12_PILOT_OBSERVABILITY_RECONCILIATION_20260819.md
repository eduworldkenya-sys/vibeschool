# VibeSchool Task 12 — Telemetry / Observability Reconciliation

## Canonical base

Reconciled from canonical main `6d04e9323139236db1076b525dce8002231ea001`, after Worker-lineage PR #313 merged.

The stale PR #289 foundation was used only as design input. This replacement is rebuilt on current main so Phase 3 does not promote a branch certified against obsolete auth, School Admin, authorization/privacy, HQ, or Worker contracts.

## Reconciliation corrections

- Canonical School Admin profile role is `admin`; stale `school_admin` telemetry role references were removed.
- `pilot_event_contract` is internal-only. `anon` and `authenticated` have no direct table access.
- Client telemetry actor role and school are server-derived from `profiles`; callers cannot spoof school identity into HQ analytics.
- Client telemetry cannot emit authoritative events.
- Authoritative ingress is service-role-only and rejects event contracts that are not marked authoritative.
- Metadata remains allowlisted and strips sensitive key classes.
- `platform_events` remains the canonical ledger; no parallel analytics warehouse was introduced.
- Worker telemetry is represented by the authoritative `worker.execution_verified` contract and is compatible with the merged Worker lineage boundary.

## Production boundary

Production Supabase was inspected read-only for the current `platform_events` shape, indexes and owner function presence. No production DDL, migration, RLS, grants, telemetry writes, worker activation, or production repair was performed.

## Certification required before merge

The exact candidate must pass clean database reconstruction, migration/security checks, Task 12 SQL certification, TypeScript/build, Engineering Control Plane, Engineering Integration Gate, and exact-current-main freshness.

This Phase 3 foundation establishes the canonical observability contract. Journey-by-journey instrumentation and product/HQ consumption may continue in dependent Task 12 work, but must not weaken the authoritative/client separation established here.
