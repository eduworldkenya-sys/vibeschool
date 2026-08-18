# Task 7 — School Admin Core Journey Production Certification

## Status

IN PROGRESS / FOUNDATION HOLD.

Do not merge Task 7, mutate production Supabase, apply production migrations, modify production RLS/grants, deploy Edge Functions, repair production data, or intentionally trigger Vercel until the shared foundation ahead of Task 7 has merged.

After the shared foundation merges: synchronize with exact-current-main, inspect production again, reconcile every overlapping auth/database/student/teacher contract, then rerun every affected Task 7 gate before any final certification or release action.

## Starting state

- Starting main head: `77051a4011d7712a275f76af41efed382f017398`
- Task branch: `task7/school-admin-production-certification-20260819`
- PR: #287 (draft, unmerged)
- Production Supabase project inspected read-only: `yauqsxggtuxuykcbrtzf`
- Concurrent foundation dependencies: Task 1 #281, Task 2 #282, Task 3 #283, Task 4 #286.
- At the latest hold check all four dependency PRs remained draft and unmerged.
- No Task 7 production migration has been applied.
- No Task 7 Edge Function deployment has been performed.
- No Task 7 intentional Vercel deployment has been performed.

## Mission boundary

Admin Login → Identity Resolution → School Resolution → Admin Home → School Setup → Academic Structure → Teachers → Students → Classes/Streams → Subjects → Timetable → Attendance Oversight → Learning/Teaching Oversight → Assessments/Results → Parent Relationships → Communications → Notifications → Reports → Settings → Logout → Re-login → Correct School State.

Hard release gates: canonical backend-derived authority, canonical learner identity, cross-school isolation, privilege-escalation resistance, privacy minimization, mobile usability, exact-current-main certification, production E2E, zero unresolved P0 and zero unresolved P1 School Admin pilot defects.

## Confirmed findings and repairs on Task 7 branch

### T7-001 — Legacy profile school pointer used as Admin operating authority

Severity: P0 journey/authority integrity.

Affected Admin child pages derived school from `profiles.school_id`, allowing shell and page scope to disagree when profile state was stale or ambiguous.

Repair: added `lib/admin/authority.ts`, which resolves Admin school scope from the shared relationship-derived Twin authority graph and fails closed without one explicit school scope. Core Admin surfaces now use this resolver; database RLS/RPC authority remains final.

### T7-002 — Cross-school notification recipient injection

Severity: P0 cross-school isolation.

Production read-only inspection and earlier rollback-only reproduction established that the legacy notification insert policy was role-bound rather than school/object-bound.

Repair in repository migration: bind notification inserts and VibeConnect circular/thread recipients to the administered school and a server-authoritative school-community predicate. No production policy/grant has been changed under the foundation hold.

### T7-003 — Canonical learner school/class identity is enrollment-derived

`students` does not own operational school authority. Current school/class identity is represented by `student_classes(school_id, student_id, class_id, is_current, ...)`.

Repair: Admin learner roster, learner detail, attendance oversight and assessment/result oversight use canonical current enrollment rather than legacy `students.class_id` assumptions.

Task 3 #283 remains the shared dependency for retry-safe learner provisioning, one-current-enrollment uniqueness and canonical student provisioning invariants; Task 7 will consume that contract after merge rather than duplicate it.

### T7-004 — Admin Home contained invalid/legacy operational queries

Repair: dashboard evidence now comes from canonical current enrollments, school teacher memberships, classes, attendance, teaching occurrences, assessments, guardian links, academic term and school notices. Empty-school state routes into setup instead of presenting unexplained zeroes.

### T7-005 — Admin Attendance duplicated the teacher classroom write workflow

Repair: School Admin Attendance is oversight-only. It compares canonical expected enrollment against teacher-recorded attendance and highlights missing capture without creating a second attendance-authoring authority.

### T7-006 — Academic oversight used parallel legacy grade stores

Repair: Admin Academics/Gradebook now follow canonical term, class, subject, exam configuration and `exam_results` identity rather than split `traditional_grades` / `cbc_assessments` reporting logic.

### T7-007 — Repeated class/subject setup could create identity duplicates

Production read-only integrity checks found no current duplicate class groups, subject groups or current-enrollment school mismatches, but required uniqueness protections were incomplete.

Repository migrations now add normalized duplicate prevention and safe school-scoped identity rules for classes and subjects. Used objects are not hard-deleted from the Admin UI when historical teaching/timetable/result dependencies exist. No production migration has been applied.

### T7-008 — Academic-term setup used an invalid lifecycle value

Legacy Admin setup attempted to create/deactivate terms with `inactive`, while production term status permits `active`, `upcoming` and `completed`.

Repository repair: idempotent term creation uses valid `upcoming`; activation is intended to be transactional and completes the prior active term. Used/active terms are protected from unsafe deletion. No production RPC/migration has been applied.

### T7-009 — School Profile direct update path could not satisfy production authority contract

Legacy School Profile derived scope from `profiles.school_id` and attempted direct school updates despite production client grants not providing the necessary write authority.

Repository repair: operational school-profile changes go through a school-bound Admin RPC; authoritative identity/provenance fields such as KNEC/NEMIS/MoE/TSC identifiers remain protected/read-only from ordinary Admin editing. No production RPC/migration has been applied.

### T7-010 — Teacher management mixed HR records with canonical teaching authority

Repository repair: canonical teacher management uses school membership plus `teacher_classes` assignments, prevents duplicate assignments and preserves historical teaching evidence when current assignments/membership are removed. The existing Staff navigation is reconciled toward this canonical teacher management surface rather than introducing another teacher identity.

### T7-011 — Parent relationship administration required a safe verification primitive

Repository repair: Admin can issue a bounded learner guardian claim only for a learner currently enrolled in the administered school. The guardian must authenticate and redeem the claim. Revocation removes active access while preserving relationship history. No arbitrary learner-name/UUID linking is introduced.

### T7-012 — Communications recipient discovery relied on frontend profile school hints

Repository repair: guarded RPCs search the administered school community and perform school circular recipient fanout from canonical teacher/student/guardian relationships. The frontend no longer needs to trust `profiles.school_id` to decide who belongs to the school.

### T7-013 — Reports were shallow/static rather than operationally reconciled

Repository repair: pilot reporting uses canonical enrollment, attendance, teaching activity and exam results from the same operational identities used by Admin workflows.

### T7-014 — Admin notifications were not a coherent operational attention system

Repository repair: actionable Admin notifications now cover incomplete term/class/subject/teacher/timetable setup, missing attendance and unresolved guardian relationships, each with a corrective destination.

### T7-015 — Settings boundary was unclear

Repository repair: settings explicitly distinguish personal account identity, school operating settings and HQ/platform controls. School Admin is not presented with service-role or HQ-owner controls.

### T7-016 — Authenticated TRUNCATE grant bypasses RLS

Severity: systemic P0-class database authority defect.

Read-only production grant inventory showed `authenticated` currently holds TRUNCATE on many public tables, including pilot-critical school/learner tables. PostgreSQL RLS does not protect TRUNCATE.

Repository repair: Task 7 candidate migration revokes TRUNCATE from `anon`/`authenticated` on the public schema and future default table privileges. Earlier rollback-only simulation showed the intended result, but under the current foundation hold no additional production simulation or production grant mutation will be performed. Final ownership of this systemic grant correction must be reconciled with Task 2/Task 8 before release to avoid duplicate or conflicting security migrations.

## Read-only production integrity evidence captured

At the observed production snapshot:

- normalized duplicate class groups: 0
- normalized duplicate subject groups: 0
- learners with multiple current enrollments: 0
- enrollment/class school mismatches: 0
- teacher/class school mismatches: 0
- teacher/subject school mismatches: 0
- attendance/current-enrollment school mismatches: 0
- duplicate academic-term groups: 0
- schools with multiple active terms: 0
- academic terms without a school: 0

These counts are snapshot evidence only and must be re-inspected after the shared foundation merges and before final certification.

## Regression protection added

### School Admin Task 7 contract

Permanent branch CI checks now cover:

- centralized Admin school authority
- no regression to `profiles.school_id` as Admin authority
- canonical `student_classes` learner roster
- oversight-only Admin attendance
- canonical academic/result sources
- class history preservation
- communication school-community validation
- class/subject duplicate protections
- term authority contract
- parent claim/revocation contract
- school profile authority contract
- client TRUNCATE revocation migration

### Dead-route contract

`scripts/test-school-admin-route-contract.mjs` scans literal internal Admin navigation targets and verifies they resolve to actual Next.js Admin page routes, including dynamic route matching. It also enforces the critical Task 7 journey route set.

### Deterministic Twin contract reconciliation

Task 7 centralizes Admin authority in `lib/admin/authority.ts`. The deterministic Twin contract was updated to validate that boundary directly rather than requiring duplicated calls to `getTwinAuthorityContext`/`selectTwinRoleBinding` in `app/admin/page.tsx`.

## CI evidence

Candidate `8b7bc6fa9c113757e027bdba091fafb6646237a8`:

Passed:
- School Admin Pilot Task 7
- Supabase Migration Security Contract
- Student One Full Journey
- Student One Legacy Identity Recovery
- Portal UX Contract
- Auth Gateway Contract
- CI Production Build Contract
- TBL-012 repository extractor
- School discovery contract

Failed:
- Deterministic Twin Contract — branch-caused static contract mismatch after Admin authority centralization; repaired in later Task 7 commit.
- TypeScript and Production Build Gate — still under diagnosis; must be green before Task 7 can certify.

In progress at that snapshot:
- TBL-011 Isolated Clean Rebuild
- Auth & Onboarding Hardening

Later Task 7 commits trigger the same affected gate set; results must be evaluated only against the latest exact branch head.

## Production safety / hold discipline

From the foundation-hold instruction onward:

- production Supabase inspection is SELECT/read-only only;
- no production transactions that mutate even temporarily;
- no RLS/grant policy changes;
- no production migrations;
- no Edge Function deploys;
- no production data repair;
- no intentional Vercel deployment;
- no Task 7 merge.

## Foundation reconciliation required before final certification

When Tasks 1–4/shared foundation have merged:

1. Fetch exact current `main`.
2. Inspect all merged auth, migration, canonical learner identity and teacher operating-context changes.
3. Rebase/reconcile Task 7 without retaining duplicated shared migrations or stale assumptions.
4. Re-inspect production schema, grants, RLS, RPCs and representative pilot school state read-only.
5. Re-run Task 7 contracts and every affected shared contract.
6. Re-run TypeScript, lint and production build.
7. Re-run isolated clean rebuild and migration security.
8. Re-run canonical student identity and auth/onboarding gates.
9. Re-run School A → School B authorization attack matrix.
10. Re-run privilege-escalation, malformed-ID, stale-membership and failure-injection gates.
11. Perform realistic mobile/browser Admin journey certification.
12. Only after exact-candidate repository certification is green may production migration/deployment decisions resume under the release plan.
13. After intended final deployment, run production Admin E2E and verify persisted state against authoritative backend data.

## Certification gates

- [ ] Admin authentication / identity resolution
- [ ] Canonical school resolution
- [x] Admin Home repository repair
- [x] School setup repository repair
- [x] Academic structure repository repair
- [x] Teacher management repository repair
- [x] Student management repository repair (final provisioning reconciliation pending Task 3)
- [x] Canonical enrollment reads
- [x] Classes/streams repository repair
- [x] Subjects repository repair
- [x] Timetable oversight repository repair
- [x] Attendance oversight repository repair
- [x] Teaching/learning oversight repository repair
- [x] Assessments/results repository repair
- [x] Parent relationship repository repair
- [x] Communications repository repair
- [x] Operational notifications repository repair
- [x] Pilot reports repository repair
- [x] Settings boundary repository repair
- [x] Empty-school guided setup repository repair
- [ ] Dead-control exact-head contract
- [ ] Mobile Admin browser certification
- [ ] School A Admin → School B complete attack matrix after foundation merge
- [ ] Privilege-escalation complete negative matrix after foundation merge
- [ ] Final RLS/RPC security after foundation merge
- [ ] Canonical student identity shared contract reconciliation
- [ ] Latest regression suite
- [ ] Latest TypeScript
- [ ] Latest lint
- [ ] Latest production build
- [ ] Latest isolated clean rebuild
- [ ] Exact-current-main certification
- [ ] Intended final deployment only
- [ ] Production E2E
- [ ] Zero unresolved P0
- [ ] Zero unresolved P1

## Merge state

WITHHELD by explicit foundation dependency rule and remaining certification gates.
