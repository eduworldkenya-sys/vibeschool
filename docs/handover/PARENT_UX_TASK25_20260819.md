# VibeSchool Task 25 — Parent UX Final Pilot Certification Handover

Date: 2026-08-19
Branch: `cert/parent-ux-task25-20260819`
Stacked foundation: Task 6 PR #285 head `23c515e1bc922c25558c59c60d956a40c27d3432`
Shared-foundation state: HOLD — do not merge or mutate production.

## Mission

Certify the Parent/Guardian product as one understandable, privacy-safe family-school experience on low-cost Android devices.

Canonical journey:

`Login -> Parent authority -> verified child relationship -> child/family context -> Home -> Attendance -> Schoolwork -> Progress -> Messages -> Profile -> Logout -> Re-login`

## Starting state

Task 6 already closes the critical Parent authorization/revocation/publication defects and adds permanent Parent core-journey regression coverage. Task 25 therefore treats Task 6 as the security/functionality floor and focuses on coherent family UX without weakening backend authority.

Existing Parent Command Center R1 already provides a useful Home/inbox foundation, but the shell and account/children surfaces retained product-fragmentation and trust defects.

## Confirmed findings

### P1 — Parent primary navigation exposed implementation/product modules

The bottom navigation was `Home / Inbox / VibeLearn / Learn / Children`, with VibeLearn treated as a raised central action. This reflects internal product modules rather than common parent questions and creates two overlapping learning destinations.

Impact: low-digital-literacy parents must understand VibeSchool product architecture before they can find child schoolwork or progress.

Repair: canonical family navigation is now `Home / Children / Schoolwork / Progress / Messages`. Existing routes remain; this is an information-architecture repair, not a backend rewrite.

### P1 — duplicate communication destination

The shell's top message control used `/parent/messages` while the canonical Parent event/inbox surface is `/parent/inbox`.

Impact: fragmented communication mental model and inconsistent deep-link behavior.

Repair: top-level communication now converges on `/parent/inbox`.

### P1 — attendance empty-data semantics were wrong

The old Children screen derived `attendance_pct = 0` when no attendance records existed and then treated `attendance_pct > 0` as the condition for rendering attendance. A legitimate recorded 0% and zero recorded attendance were therefore indistinguishable.

Impact: violates Task 25 trust requirement; missing data could not be explained correctly.

Repair: Children now retains `attendanceRecords` and nullable percentage. Zero records render: `No attendance has been recorded yet. This does not mean the learner was absent.` A real 0% remains a displayed recorded value.

### P1 — child linking language conflicted with verified authority

The old Children/Profile flows contained `Add Child to Class` / `+ Add Child` affordances even though Task 6 closes arbitrary Parent learner creation and routes Parents through verified linking.

Impact: misleading trust boundary and expectation that a Parent can self-create or self-claim canonical school learners.

Repair: all repaired entry points say `Link or request access`, route to `/parent/link-child`, and explain that knowing a learner name is not sufficient.

### P1 — Profile exposed non-persistent notification controls

The Profile page rendered interactive notification toggles while labelling the feature `Coming soon`; state changed only in React and was not authoritative.

Impact: false confirmation — a Parent could believe important attendance/homework/fee alerts were configured when nothing was saved or enforced.

Repair: fake controls removed. Profile exposes current relationship-level alert status only and explicitly withholds preference controls until backend persistence/enforcement exists.

### P1 — dead Settings route

The Children screen linked to `/parent/settings`, but no Parent settings route existed.

Repair: account/settings affordance now resolves to `/parent/profile`.

### P1 — Report Problem path absent

Task 25 requires a low-friction diagnostic route without asking Parents to send screenshots of internal errors.

Repair: `/parent/support` now produces privacy-minimized safe context: Parent role, current support screen, timestamp, network status and an ephemeral correlation reference. It deliberately excludes child/student identifiers and warns against sharing passwords, PINs and learner screenshots.

## Changes in this branch

- `app/parent/layout.tsx`
  - family-centered primary navigation;
  - canonical Inbox message route;
  - accessible button semantics and active-page state;
  - >=44px header tap targets and mobile safe-area bottom navigation;
  - removes Parent-shell VibeLearn modal as a competing primary action.
- `app/parent/students/page.tsx`
  - trust-first child list;
  - explicit missing-attendance semantics;
  - verified-linking-only empty state;
  - real account/settings destination;
  - recoverable load error and retry state;
  - touch-friendly child cards.
- `app/parent/profile/page.tsx`
  - account identity and linked-child authority made explicit;
  - removes fake notification toggles;
  - removes generic editable `relationship` field from account profile UX;
  - routes all new child access through verified linking;
  - adds Report Problem entry;
  - keeps logout explicit.
- `app/parent/support/page.tsx`
  - privacy-safe support context and copy action.
- `scripts/validate-parent-ux-task25.py`
  - permanent repository-level Task 25 contract.
- `.github/workflows/parent-ux-task25-contract.yml`
  - CI gate for Parent UX contract changes.

## Privacy invariants preserved

- Task 25 does not introduce any new Parent authority source.
- Frontend child selection does not grant access.
- `parent_student_links -> students.id` remains the family authorization boundary inherited from Task 6.
- No production Supabase mutation, migration, grant/RLS change or relationship repair has been performed by Task 25.
- Support diagnostics contain no child/student ID.
- Parent notification UX no longer claims settings were saved when they were not.

## Validation matrix

Current branch validation to run on the exact branch candidate:

1. `Parent UX Task 25 Contract`.
2. `Parent Core Journey Contract` inherited from Task 6.
3. TypeScript and production build.
4. Auth/onboarding contract.
5. canonical Student identity/full journey contracts.
6. migration-security / RLS contracts because Task 25 is stacked on Task 6 security changes.
7. mobile/browser Parent journeys when an authenticated disposable family fixture is available.

## Realistic Parent scenarios — current branch status

- New Parent / no verified child: UX repaired; backend authority inherited from Task 6; browser E2E pending shared-foundation reconciliation.
- Morning attendance: missing-vs-recorded semantics repaired; authenticated browser E2E pending.
- Homework / schoolwork: primary navigation now has one parent-facing `Schoolwork` destination; Task 6 child-scoped homework authority remains underlying gate.
- Academic update: primary navigation now exposes `Progress`; publication safety inherited from Task 6.
- Multiple children: Task 6 stale sibling-state closure remains required; Task 25 final repeated-switch browser certification pending.
- Communication: canonical shell destination is Inbox; child-scoped authorization inherited from Task 6.
- Return/logout/re-login: Profile logout preserved; final authenticated production proof remains pending deployment.

## Shared-foundation dependencies

Do not merge Task 25 while the foundation hold is active. At minimum reconcile after:

- Task 1 Auth/Onboarding PR #281;
- Task 3 canonical Student identity PR #283;
- Task 6 Parent Core Journey PR #285;
- Task 8 authorization/privacy PR #288 where it changes Parent/global authorization surfaces;
- Task 12 telemetry PR #289 and Task 21 measurement work where Parent event naming/analytics contracts become authoritative.

Before final certification:

`fetch current main -> reconcile Task 25 -> rerun Parent Core + privacy + multi-child + revoked-link + mobile + TypeScript/build -> certify exact candidate`

## Production safety log

- Production Supabase mutation: NONE.
- Production migrations/RLS/grants: NONE.
- Production relationship repair: NONE.
- Edge Function deployment: NONE.
- Intentional Vercel deployment: NONE.
- Merge: FORBIDDEN while shared-foundation hold remains.

## Certification state

**NOT FINAL / HOLD.**

The branch closes confirmed Parent UX P1 defects and adds permanent regression protection, but Task 25 cannot be declared complete until exact-current-main reconciliation, all relevant CI/build/privacy gates, authenticated repeated-child switching, Android/mobile E2E and intended production smoke are green with zero unresolved P0/P1 Parent UX/privacy defects.
