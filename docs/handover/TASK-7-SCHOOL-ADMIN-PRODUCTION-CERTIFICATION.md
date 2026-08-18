# Task 7 — School Admin Core Journey Production Certification

## Status

IN PROGRESS. Do not merge or deploy until the complete Task 7 definition of done is green against exact-current-main and production E2E is certified.

## Starting state

- Starting main head: `77051a4011d7712a275f76af41efed382f017398`
- Task branch: `task7/school-admin-production-certification-20260819`
- Production Supabase project: `yauqsxggtuxuykcbrtzf` (`ACTIVE_HEALTHY`, PostgreSQL 17)
- Production Admin memberships observed at start: 3 canonical `school_members` rows with role `admin`, across Ashley's group of schools, Demo School, and Subukia primary.
- Concurrent work requiring final reconciliation: Task 1 auth/onboarding PR #281, Task 2 migration integrity PR #282, Task 3 canonical student identity PR #283, Task 4 teacher journey PR #286.
- No Task 7 Vercel deployment initiated.

## Mission boundary

Certify one coherent School Operating System:

Admin Login → Identity Resolution → School Resolution → Admin Home → School Setup → Academic Structure → Teachers → Students → Classes/Streams → Subjects → Timetable → Attendance Oversight → Learning/Teaching Oversight → Assessments/Results → Parent Relationships → Communications → Reports → Settings → Logout → Re-login → Correct School State.

Hard release gates include cross-school isolation, backend-derived authority, canonical student identity, safe role boundaries, mobile usability, exact-current-main certification, production E2E, zero unresolved P0 and zero unresolved P1 Admin pilot defects.

## Findings

### T7-001 — Admin student page derives operating school from `profiles.school_id`

- Severity: P0 — identity/authorization journey integrity.
- Surface: `app/admin/students/page.tsx`.
- Reproduction: authenticated bootstrap reads `profiles.school_id`, stores it in browser state, uses it to load classes/enrollments and sends it as `p_school_id` to `admin_add_student`.
- Root cause: legacy profile-scoped school identity remained in a child Admin page after the Admin layout moved to membership-derived role authority.
- Risk: stale or conflicting profile school state can disagree with the canonical `school_members` relationship; the page and shell can therefore resolve different schools. Backend RLS/RPC checks reduce direct privilege abuse but do not make the operational journey coherent.
- Required repair: all scoped Admin pages must resolve one authoritative backend membership-bound Admin context, with backend policies/RPCs remaining the final authorization gate.

### T7-002 — Production notification insert policy is not school-bound

- Severity: P0 — cross-school communication isolation.
- Surface: production `notifications` RLS.
- Reproduction: `notifications_admin_insert` checks only that the caller has an `admin` membership somewhere; it does not require `notifications.school_id` to equal an administered school and does not constrain the target `user_id` to the same school community.
- Root cause: role-only authorization was used where school-object authorization is required.
- Risk: an Admin from School A can attempt to create notification rows targeting School B/community users if Data API grants permit the insert. This violates Task 7's hard cross-school gate.
- Required repair: bind inserts to `is_school_admin(school_id)` and a server-authoritative recipient-in-school predicate; verify direct REST/RPC-style attacks fail closed.

### T7-003 — Student school identity is enrollment-derived, not `students.school_id`

- Severity: architecture fact / integrity constraint.
- Production schema: `students` has no `school_id`; current school/class authority is expressed through `student_classes(school_id, student_id, class_id, is_current, ...)`.
- Consequence: Admin reports, parent links, attendance, results, and student management must consistently derive current school context from canonical enrollment and must not invent a parallel `students.school_id` concept.

### T7-004 — Current production student Admin RLS depends on a single current enrollment

- Severity: P1 until exact identity invariant is reconciled.
- Production policy `students.admin_all` resolves an Admin school from the current `student_classes` row using `LIMIT 1`.
- Concurrent dependency: Task 3 PR #283 introduces a platform-wide one-current-enrollment uniqueness invariant and retry-safe `admin_add_student`; Task 7 must reconcile that exact contract before merge rather than duplicating or weakening it.

## Production authorization evidence captured

- `is_school_admin(p_school_id)` checks `school_members.profile_id = auth.uid()`, role `admin`, and an active/non-deleted canonical school.
- `classes`, `student_classes`, `teacher_classes`, attendance Admin read, and `exam_results` have school-bound policies using membership/admin predicates.
- Parent relationship Admin writes are school-bound and validate school/current-enrollment relationships on update.
- `notifications_admin_insert` is the confirmed exception requiring repair.

## Changes

### Frontend

Pending.

### Backend / database / RPC / migrations

Pending. Production remains unchanged during discovery.

### Tests

Pending.

## Security evidence

Cross-school attack matrix is being built for school profile, students, teachers, classes, attendance, lessons, assessments, results, parents, communications, reports, RPC arguments, guessed UUIDs, and stale state.

## Certification gates

- [ ] Admin identity and canonical school context
- [ ] School setup and academic structure
- [ ] Teacher management
- [ ] Student management and canonical enrollment
- [ ] Classes/streams and subjects
- [ ] Timetable oversight
- [ ] Attendance oversight
- [ ] Teaching/learning oversight
- [ ] Assessments/results
- [ ] Parent relationships
- [ ] Communications and notifications
- [ ] Reports
- [ ] Settings boundaries
- [ ] Empty-school guidance
- [ ] Mobile Admin journey
- [ ] Cross-school isolation
- [ ] Privilege escalation fail-closed
- [ ] RLS/RPC security
- [ ] Regression suite
- [ ] TypeScript
- [ ] Production build
- [ ] Exact-current-main
- [ ] Intended final deployment only
- [ ] Production E2E
- [ ] Zero unresolved P0
- [ ] Zero unresolved P1

## Merge state

WITHHELD while Task 7 gates are red.
