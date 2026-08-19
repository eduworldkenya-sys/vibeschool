# VibeSchool HQ Geographic Intelligence — Isolated Build Record

## Isolation

- Branch: `hq/geographic-intelligence-20260819`
- Exact branch base: `8fff836a89cc3ebb9499cde77d654667be553e8a`
- Production Supabase: READ-ONLY during isolated development.
- No production migrations, RLS/grant changes, school/profile mutations, Edge Function deploys, runtime/autonomy changes, feature activation, or consequential external actions.

## Architectural boundary

This module organizes canonical truth; it does not redefine it. Canonical school identity remains `public.schools` plus the existing School Identity source/reconciliation/review system. User authority remains the existing profile, membership, enrollment, assignment, and parent relationship contracts. HQ authorization remains the existing owner mechanism. Telemetry remains the existing platform/measurement infrastructure.

## Active PR collision classification

- HQ navigation / `components/hq/HQShell.tsx`: RECONCILE REQUIRED (Founder OS #298, Unified HQ #292).
- HQ operational read models: COORDINATE (Founder OS #298, Autopilot #305).
- Canonical telemetry contract: RECONCILE REQUIRED (Task 12 #289).
- Authorization/privacy boundary: RECONCILE REQUIRED (Task 8 #288).
- School Admin / school authority: COORDINATE (Task 7 #287).
- Workforce Control Room: SAFE unless shared HQ shell/navigation is touched (#290).

No unfinished active PR work will be cherry-picked or overwritten.

## Read-only production readiness — 2026-08-19

Current `public.schools`:

- canonical schools: 36
- county populated: 3
- sub-county populated: 1
- ward populated: 0
- coordinates populated: 0
- KNEC code populated: 1
- NEMIS code populated: 0
- verification timestamp populated: 1

Consequences:

- National geographic coverage is currently incomplete.
- No production UX may imply that a Kenya heat map or school locator represents national coverage.
- Unknown, unresolved, unverified, conflicting, and insufficient-evidence states must remain explicit.
- Map point totals must use only schools with eligible coordinates, never total canonical schools.

## Target architecture

Additive, bounded layers only:

1. Canonical administrative geography dimension: country → county → sub-county → ward, with stable IDs, parent hierarchy, provenance, verification state, and source version.
2. Governed school-geography mapping keyed by canonical `schools.id` with provenance and verification state.
3. Owner-only bounded HQ aggregate/read surfaces for region summary, school breakdown, user role breakdown, data quality, school intelligence, and map points.
4. `/hq/geography` integration seam that does not independently restructure the global HQ navigation while active HQ PRs remain open.
5. Aggregate-first UX with explicit evidence-state semantics and accessible non-map alternatives.

## Metric semantics

Definitions must be deterministic before display. Missing evidence must be `unknown`/`insufficient_evidence`, not numeric zero. Institutional geography is derived through canonical school relationships; it is not residential location.

## Promotion gate

Remain draft until exact-current-main reconciliation, migration/security validation, aggregate reconciliation, owner authorization attacks, mobile/accessibility, visualization consistency, read-only production drift check, and exact-head CI all pass on the exact candidate SHA.
