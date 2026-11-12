# Teacher timetable Stage 3 — official school publication

**Branch:** `feat/school-timetable-publication-stage3-20261112`
**Merge target:** `integration/intelligent-timetable`, never directly to `main`.
**Status:** code review / CI in progress; **not** live migration or production school certification.

## One official school timetable

Stage 3 reuses the canonical `timetable_releases`, `timetable_slots`,
`school_periods`, `class_subject_allocations`, `school_members` and
`teacher_classes` tables, existing admin-only release state-machine RPC,
and the existing Teacher OS timetable engine. It creates no second
schedule table, teacher profile or separate school calendar.

School operators configure **actual** bell times and breaks, place
lessons into confirmed periods, check KICD-aligned class allocations,
then deliberately move a release through:
`draft → review → approved → published → retired`.

The existing `/admin/timetable` page now displays review releases, their
readiness figures and explicit **Approve** / **Publish** actions. Every
approval/publish invokes the existing server transition RPC.
School administrators get a human confirmation before transitioning.
An additional versioned migration makes server readiness authoritative
even for direct RPC calls, so a manipulated client cannot skip checks.

### Server preflight
`school_timetable_release_preflight` is school-admin-only and checks:

- At least one real confirmed teaching period and at least one active
  slot in the release
- Every released slot matches a real, unprotected school teaching period
  on the correct day, time and school
- Valid school teacher/class/subject membership and assignment
- No active school lessons outside the candidate release
- An effective non-null allocation for every released class/subject
- Actual weekly recurring allocation units equal effective school targets
  for all subjects in released classes, with no ambiguous duplicate
  effective targets
- The existing resource-requirement validation also remains mandatory

The server refuses publication if checks fail, if the school is not
authorised, or if the effective date is in the past. It serialises
publication per school to prevent simultaneous conflicting releases.

This checks the effective allocation records; it **does not
independently certify the original KICD national source**. Grades 1–9
KICD verification and actual Gilgil period confirmation remain separate
gates.

### Teacher OS default
School-linked teachers inherit only their school’s published release.
The active linked school remains their default, with separate
Independent/All modes preserved from Stage 2. School subscriptions are
membership-scoped. The timetable range loader filters by the exact
published release ID at the database query.

If the school has not published, the teacher sees **School timetable not
yet published**. Historical/test/draft slots are **not silently
presented as official**. Curriculum, Scheme, unscheduled Lesson Plan
preparation and unscheduled Teach remain available.

Published slot identities are protected against deletion or
reassignment; only a school administrator may narrow a *future*
effective date range without rewriting the slot identity. Changes
require an explicitly new release, not an invisible overwrite.

### History and scope
Existing historical lesson IDs, attendance, schemes, tuition and
teaching occurrences are **not deleted or rewritten**. The published
Teacher OS list is not a historical archive: older retired releases
remain in the database; historically dated recovery/access replay and
future-effective revision acceptance are still Stage 7–10 work.

Existing private tuition uses the accepted-invitation RPC and cannot
publish or affect the school release. Stage 4 introduces arbitrary
independent teacher-owned schedules; Stage 5 covers teacher change
requests and school approvals beyond the publication flow.

### Migration / rollout gate
`supabase/migrations/20261112210000_school_timetable_publication_authority.sql`
is a **new** migration. The migration is required for safe publication
and must not be applied before the older timetable TBL-012/013
migrations are reconciled, especially
`20261112101500`–`20261112101800` and the existing cross-context
`20261112150000` migration. Never rename/auto-version original
migration files or fabricate migration-ledger evidence.

Run `node scripts/test-school-timetable-publication-stage3.mjs`,
`npm run test:timetable`, typecheck/build, authorization contracts,
clean database rebuild and TBL-012 parity preflight. Obtain signed-in
administrator approval→publication and linked teacher acceptance,
plus positive and negative slot/period/allocation tests, before
authorising promotion. **Do not publish Gilgil without locally
confirmed school times.**
