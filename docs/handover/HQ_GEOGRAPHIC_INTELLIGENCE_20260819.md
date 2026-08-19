# VibeSchool HQ National Intelligence — Isolated Build Record

## Mission

Build the canonical VibeSchool HQ National Geographic, School, User, Growth and Founder Intelligence layer without creating competing identity, telemetry, Founder OS, Worker Engine, Autopilot, support, payment, curriculum, or school-operating truth.

## Isolation

- Branch: `hq/geographic-intelligence-20260819`
- Draft PR: `#306`
- Exact branch base: `8fff836a89cc3ebb9499cde77d654667be553e8a`
- Production Supabase: READ-ONLY during isolated development.
- No production migrations, RLS/grant changes, school/profile mutations, Edge Function deploys, runtime/autonomy changes, feature activation, payment action, publication, or consequential external operation.

## Architectural boundary

Canonical operational systems remain authoritative. This branch only adds governed dimensions, mappings and bounded owner-authorized analytical read models.

- Canonical school identity: `public.schools` and existing School Identity discovery/evidence/review machinery.
- Canonical school level: `public.school_levels`. `schools.school_type` is not treated as level.
- Canonical user/institution relationships: memberships, current enrollment, parent/student relationships and existing profile identities.
- Canonical product measurement: Measurement Kernel (`product_measurement_state`, `product_account_sessions`, `product_acquisition_attribution`).
- Canonical activity evidence: current platform event contract pending Task 12 reconciliation.
- Canonical HQ authority: existing platform-owner assertion.
- Founder OS, findings, decisions, support, incidents, Worker Engine and Autopilot remain separate owning systems.

## Active PR overlap matrix

| Surface / contract | Active owner | Classification | Branch rule |
|---|---|---|---|
| `components/hq/HQShell.tsx`, shared HQ navigation | #298 / #292 | RECONCILE REQUIRED | Do not edit from #306 while active |
| `/hq` Today / users / shared HQ composition | #292 | RECONCILE REQUIRED | Keep #306 on dedicated route |
| Founder OS operational read models | #298 | COORDINATE | Consume after merge; do not duplicate |
| Autopilot governance / organization | #305 | COORDINATE | Evidence-only integration later |
| Task 12 telemetry contract | #289 | RECONCILE REQUIRED | Current event use is provisional evidence consumer |
| Task 8 authorization/privacy | #288 | RECONCILE REQUIRED | Exact-main auth recertification required |
| Task 7 School Admin + `lib/database.types.ts` | #287 | BLOCKED BY UPSTREAM OWNERSHIP for generated types | Do not edit generated types here |
| Task 15 Workforce Control Room | #290 | SAFE unless shared shell touched | No Worker authority changes |
| Measurement Kernel / Founder Command | #275 | COORDINATE | Consume existing measurement state; no duplicate retention engine |
| School identity discovery/review | existing canonical system | COORDINATE | Read evidence only; never auto-merge identity |

No unfinished active PR work will be cherry-picked, overwritten, or copied into a competing subsystem.

## Read-only production readiness — 2026-08-19

Current evidence:

- canonical schools: 36
- canonical profiles: 101
- school county text populated: 3
- school sub-county text populated: 1
- school ward text populated: 0
- school coordinates populated: 0
- KNEC code populated: 1
- NEMIS code populated: 0
- verification timestamp populated: 1
- platform events: 258 total / 118 in last 30 days / 18 school-scoped in last 30 days
- Measurement Kernel certified from `2026-08-18T21:38:41.787139+00:00`
- Measurement Kernel account-session rows: 0
- open school-identity review rows: 0
- canonical `school_levels`: 35 schools currently `PRIMARY`; one school has no level row

Consequences:

- National geographic coverage is incomplete.
- Production currently cannot support a truthful school locator map because eligible coordinates are zero.
- Heat-map/map UX must expose coverage state and accessible list/table alternatives.
- Retention is unavailable until certified measurement evidence exists; it must not be reconstructed from pre-certification history.
- Institutional geography must never be described as home/residential geography.
- School level filtering must consume `school_levels`, not `schools.school_type`.

## Implemented on the isolated branch

### Geographic foundation

- `geo_countries`
- `geo_counties`
- `geo_subcounties`
- `geo_wards`
- `school_geography` keyed by canonical `schools.id`
- provenance, source version/checksum, verification state and bounded coordinate precision
- RLS enabled with direct public/anon/authenticated table access revoked

### Owner-authorized read models

- `hq_geography_hierarchy()`
- `hq_geography_summary(...)`
- `hq_geography_region_breakdown(...)`
- `hq_geographic_data_quality()`
- `hq_map_school_points(...)`
- `hq_school_360(...)`
- `hq_growth_intelligence(...)`
- `hq_geographic_opportunities(...)`
- `hq_school_explorer_list(...)`

All browser-callable HQ RPCs are authenticated transport only plus server-side owner assertion. No national raw analytical table is broadly exposed.

### Correctness repairs

A regional aggregation defect was found before promotion: joining school geography directly to platform events could multiply school totals by event fan-out. The replacement read model separates school rollup from event rollup and uses distinct active schools. A permanent static regression check now rejects the original fan-out pattern.

A second semantic defect was found from production evidence: `schools.school_type` contains institution/ownership-like values such as `private`, not school level. School-level filtering was moved to canonical `school_levels` with Unknown preserved when no level evidence exists.

### Founder UX

`/hq/geography` has been expanded into a National Intelligence surface with:

- one canonical geographic scope filter;
- NOW / WHERE / TREND information hierarchy;
- geographic coverage and data-quality truth;
- regional ranking/intensity view with accessible numeric evidence;
- deterministic opportunity signals;
- canonical school explorer/search using aliases and official codes;
- aggregate-first School 360;
- Measurement-Kernel-aware growth evidence;
- explicit retention-unavailable state;
- map hold/partial-coverage semantics rather than fake points or counties;
- Android-first responsive layout.

The route deliberately does not modify global HQ shell/navigation while #298/#292 own that surface.

## Deterministic opportunity rules currently implemented

1. `teacher_activation`: school has current learners and zero recently active teacher actors in the selected event window.
2. `geography_gap`: governed mapping is missing/unresolved/conflicting.

Each signal returns school scope, evidence and a recommended investigation only. No signal authorizes messaging, repair, onboarding, Worker Engine action or Autopilot execution.

## Security / privacy contract

- owner assertion on every HQ intelligence RPC;
- PUBLIC/anon execution revoked;
- authenticated execution is transport only, not authorization;
- no student/parent names, emails, phones, health data, Twin memory, residential location, or unrestricted educational records returned by map/explorer read models;
- School 360 defaults to counts and institutional evidence;
- no residential geography inference;
- no direct canonical school mutation.

## CI contract

Dedicated workflow: `.github/workflows/hq-geographic-intelligence.yml`.

Permanent static checks cover:

- canonical geography hierarchy and school FK;
- no competing `hq_schools` / `hq_users` truth;
- table lockdown and owner authorization;
- pinned SECURITY DEFINER search path;
- event-fanout aggregate protection;
- canonical `school_levels` usage;
- bounded school explorer payload;
- alias consumption without identity collapse;
- no user PII in school explorer payload;
- no fake fallback geography;
- route isolation from global HQ navigation ownership.

The workflow now watches all isolated `*hq_*.sql` migrations so migration-only changes cannot escape the dedicated contract.

## Remaining master-mission work

Still required before promotion:

- exact-head CI green, including migration security, clean reconstruction, TypeScript and production build;
- reconcile Task 8 authorization and Task 12 telemetry after their merges;
- reconcile HQ shell/Founder OS after #298/#292 merge without overwriting their information architecture;
- correct generated DB types through the owning post-merge reconciliation path rather than editing Task 7-owned generated types here;
- add certified school-level distribution/read model and unique-vs-membership denominator tests;
- add certified cohort/retention views only from Measurement Kernel evidence;
- add curriculum/content geography after canonical measurement linkage is proven;
- add support/platform-health geography after Task 12 evidence dimensions are final;
- add deterministic comparison/time-machine contracts;
- add real Kenya county map only from governed boundary data and truthful coverage metadata;
- add school locator rendering only when eligible coordinates exist;
- clean DB reconstruction and SQL execution tests;
- owner/anon/student/teacher/parent/admin adversarial authorization tests;
- aggregate reconciliation fixtures and opportunity fixtures;
- Android/tablet/desktop visual certification;
- accessibility and performance certification;
- read-only production drift check at exact candidate;
- exact-current-main reconciliation immediately before promotion.

## Current verdict

`CONTINUE THE AUTONOMOUS LOOP`

PR #306 remains draft and production-disconnected. It is not merge-authorized yet.
