# VibeSchool Task 24 — School Admin UX Final Pilot Certification

Date: 2026-08-19
Branch: `task24/admin-ux-final-pilot-certification-20260819`
Starting main: `77051a4011d7712a275f76af41efed382f017398`
Status: **SHARED-FOUNDATION HOLD — branch-safe work only**

## Mission

Certify the School Admin product as one coherent school operating system for a low-cost Android device:

`Login → School Resolution → Home → Setup → People → Academics → Operations → Communication → Reports → Settings → Logout → Re-login`

The operating model is **Briefing → Decide → Act → Verify**. Database objects are implementation details, not the information architecture.

## Hold-gate constraints

Until required shared foundations ahead of Task 24 merge:

- no merge
- no production Supabase mutation
- no production migration/RLS/grant changes
- no production data repair
- no intentional Vercel deployment

Allowed work: audit, implementation on this isolated branch, static/regression contracts, local/disposable testing, read-only production inspection where authorized, mobile/usability scenarios and handover evidence.

## Starting-state evidence

### Existing strengths

- Admin shell resolves school scope from the authoritative Twin role binding.
- School identity is visible in the shell/header and side navigation.
- Mobile has persistent bottom navigation plus a secondary navigation drawer.
- Admin Home already uses an operational briefing model with actionable attendance/staff/meeting/fee signals.
- Admin loading and failure states use shared portal recovery primitives.
- Existing Teacher/Admin remediation work established visible focus, reduced-motion support and route-level failure recovery.

### Task 24 gaps observed from current main

#### P1 — information architecture remains ERP-shaped
Current primary/secondary navigation exposes top-level `Finance`, `Meetings`, `Visitors`, `Projects` and `Resources` alongside core school-operating work. This increases decision burden and competes with pilot-critical flows such as people, academic structure, timetable, results and parent relationships.

Target principle: preserve existing routes where functional, but progressively organize them under school-operation language rather than database/product-module taxonomy.

#### P1 — people management is split conceptually
Students and Staff are separate top-level destinations, while teacher identity, membership, class/subject assignment and learner enrollment are relationship workflows. Task 24 must ensure their page language and next actions make those relationships obvious without exposing internal identity complexity.

#### P1 — dashboard evidence is incomplete for setup/readiness
Admin Home surfaces useful daily operational signals but does not yet prove the complete readiness chain requested by Task 24: school setup, class/stream structure, teacher assignment, timetable readiness, assessment/result completion and parent-link exceptions.

#### P1 — current dashboard uses many parallel client queries
The School Hub issues multiple school-scoped requests in parallel. This is acceptable for initial pilot scale but must be measured/reconciled against Task 44 performance requirements. Do not solve performance by weakening school scoping or loading an entire school dataset client-side.

#### P1 — mobile navigation parity needs formal regression protection
The bottom bar intentionally exposes only a small subset and relies on `More` for the rest. This is a good mobile pattern only if every pilot-critical destination remains reachable and understandable. Task 24 now adds a dedicated regression contract for this boundary.

## Target information architecture

This is a **progressive organization target**, not permission to delete working routes before workflow migration is proven.

### Home
- School Hub
- Attention Required / Today
- Setup readiness

### People
- Teachers / Staff
- Students
- Parent / Guardian relationships

### Academics
- Academic year / term
- Classes / streams
- Subjects / teacher assignments
- Timetable
- Assessments / results
- Teaching / learning / homework oversight

### Operations
- Attendance oversight
- Meetings / visitors where pilot-relevant
- Other routine school operations

### Communication
- Notices / VibeConnect
- Notifications

### Reports
- Enrollment
- Attendance
- Teaching activity
- Assessment completion / results
- Engagement

### Settings
- School details
- Account / profile
- Support / Report a Problem

Finance, projects and resources remain available where already functional, but they must not displace pilot-critical school-operation tasks in the Admin mental model.

## Implemented in this branch

### Dedicated Task 24 Admin UX regression contract

Added `scripts/test-admin-ux-contract.mjs` to assert:

- authoritative admin school-scope resolution
- persistent school identity in the shell
- explicit sign-out path
- mobile bottom navigation and `More` access
- school-scoped dashboard queries
- authorized-school dashboard boot
- attention/briefing model
- actionable attendance routing
- shared loading state
- shared recoverable error state
- existence of core admin routes
- no raw UUID terminology in the shell

### CI integration

Updated `.github/workflows/portal-ux-contract.yml` so Task 24 branches and PRs execute both the shared portal contract and the dedicated School Admin contract.

## Certification scenarios

The following scenarios are mandatory before final Task 24 certification. They are not marked complete merely because the pages exist.

1. **New School** — resolve school → setup details → term → class/stream → subject → teacher/student assignment → timetable readiness.
2. **Morning Operations** — open Home → identify attention required → inspect missing attendance/operational exception → verify resolution path.
3. **Enrollment** — search learner → avoid duplicate identity → enroll → assign class/stream → verify visible status.
4. **Staffing** — invite/add teacher → membership/status → assign class/subject → verify authorization-aware UI.
5. **Academics** — inspect class hub → subjects → timetable → teaching activity.
6. **Attendance Oversight** — school → class → day/session → missing attendance exception.
7. **Assessment** — configured assessment → completion → result-entry state → release/publish state.
8. **Parent Relationship** — pending request → verify/reject/revoke without unsafe arbitrary linking.
9. **Communication** — select audience → preview exact scope/count → confirm consequential broadcast → result/failure evidence.
10. **Return** — logout → login → school scope restored correctly with no stale cross-school state.

## Security and privacy invariants

- UI school context must come from verified authorization context, never query-string trust.
- All data queries remain school-scoped; frontend hiding is never the authorization boundary.
- Manipulated route IDs must fail closed for students, teachers, classes, parents, results, communications and reports.
- Role/membership, parent-link, result publication and destructive learner/staff actions require consequential UX and backend authorization.
- No raw Supabase/Postgres errors should be presented to school administrators.

## Mobile contract

Primary target: low-cost Android portrait viewport.

- no mandatory horizontal scrolling for routine list actions
- minimum practical touch targets for primary actions
- critical destination reachable with one bottom-nav action or `More`
- school identity visible without hunting
- filters usable without desktop-width toolbars
- dialogs preserve focus and do not overflow viewport
- long lists use search/filter/pagination rather than uncontrolled payloads

## Remaining hold-gated work

- reconcile Task 7 exact Admin journey evidence against current routes/contracts
- inspect/adjust Teacher/Student/Class/Academic/Parent/Communication page UX in detail
- add setup-readiness and operational-attention coverage to Admin Home where supported by canonical data
- normalize consistent filters/status/empty/error/save feedback across high-volume modules
- add mobile/browser scenario coverage for the ten mandatory scenarios
- rerun auth, school identity, RLS/cross-school and student-identity contracts on exact candidate
- fetch latest `main` after upstream foundations merge and reconcile all Admin/auth/school/security/navigation changes
- run TypeScript + production build + exact-head CI
- only after hold release: intended deployment and real `vibeschool.co.ke` mobile production smoke

## Certification status

Task 24 is **not final-certified yet**. The branch establishes the exact-current-main baseline and regression boundary while the shared-foundation hold remains active. No production mutations, deployments or merge were performed.
