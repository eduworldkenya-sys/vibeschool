# Task 3 — Canonical Student Identity & Data Integrity Handover

Date: 2026-08-19
Branch: `agent/task3-student-identity-integrity`
PR: #283
Starting main: `77051a4011d7712a275f76af41efed382f017398`

## Mission contract

- `auth.users.id` = authentication account identity.
- `profiles.id` = VibeSchool account/profile identity and is expected to match the authenticated account UUID.
- `students.id` = durable canonical learner-domain identity.
- Any application/database field named `student_id` means `public.students.id`.
- `students.profile_id` is the explicit account → canonical learner mapping; account UUIDs and learner UUIDs are never interchangeable merely because both are UUIDs.
- `student_classes.id` is an enrollment-record identity. `student_classes.student_id` is canonical learner identity.
- `school_members.id`/membership rows establish adult school authority; they are not learner identities.
- `parent_student_links.id` identifies a relationship row. `parent_student_links.student_id` is canonical learner identity and `parent_id` is profile/account identity.
- Admission numbers are school-scoped external identifiers and must not be used to merge historical learner rows when evidence conflicts.
- Notification `user_id` is account-recipient identity; learner-domain targeting remains `student_id` on learner records.

## Starting production state

Production project: `yauqsxggtuxuykcbrtzf` (PostgreSQL 17, active/healthy).

Identity baseline:

- Auth users: 101.
- Active canonical learners: 116.
- Active student-role profiles: 10.
- Canonical learners mapped to profiles: 1.
- Roster/unclaimed learners: 115.
- Student-role profiles without canonical learner: 9.
- Open identity recovery cases: 9.
- Missing student profiles not represented by recovery quarantine: 0.
- Duplicate active profile → learner mappings: 0.
- Claimed learners with wrong profile role: 0.
- Claimed learner profiles missing Auth user: 0.

Structural learner references:

- Public base-table `student_id` columns: 106.
- Validated FKs from those columns to `public.students(id)`: 106/106.
- Missing `student_id` FKs: 0.
- Wrong-domain `student_id` FKs: 0.
- Unvalidated learner FKs: 0.

Enrollment baseline:

- Current `student_classes` enrollments: 70.
- Learners with multiple current enrollments: 0.
- Current enrollment missing class: 0.
- Class/school mismatch: 0.
- Legacy `students.class_id` drift against current enrollment: 0.
- Active learners without current enrollment: 46.

Parent baseline:

- Parent → learner links: 2.
- Missing parent profiles: 0.
- Wrong parent roles: 0.
- Missing students: 0.
- Duplicate parent/student pairs: 0.
- Parent-link/current-enrollment school mismatch: 0.

## Existing foundation retained

The repository already contained Student=1 semantic closure, runtime identity guards, full-journey certification, legacy identity recovery, Pathways canonical learner authority, and content-learning identity closure. The Task 3 work extends rather than replaces those controls.

The existing 9 legacy student-role profiles without learners have no school ID, no school membership, and no deterministic learner target. They remain safely quarantined as `legacy_missing_canonical_learner`; no name-based or guessed reconciliation is permitted.

## Findings and classification

### P1 — Retry/concurrency-unsafe learner provisioning

Affected RPCs:

- `teacher_add_student`
- `admin_add_student`
- `create_child_for_parent`

Root cause: each invocation inserted a new `students` row. Network/RPC retry could manufacture duplicate canonical learner records.

Repair:

- `student_provisioning_receipts` service-only ledger.
- Transaction advisory locks.
- Replay returns the original canonical `students.id`.
- Teacher/admin roster provisioning requires a school admission identifier and fails closed on conflict.
- Parent creation is request-payload retry safe.

### P1 — Parent class selection prematurely created official current enrollment

Root cause: `create_child_for_parent` inserted `student_classes` before the frontend created a pending `class_join_requests` row and before teacher approval.

Repair: parent creation now creates the canonical learner + parent relationship only. Current enrollment is reserved for the legitimate school/class approval transition.

### P1 — Missing global one-current-enrollment invariant

Production happened to have zero duplicate-current learners but constraints permitted a learner to be current in different classes/schools simultaneously.

Repair: partial unique index on `student_classes(student_id) WHERE is_current=true`.

### P1 — Duplicate pending parent join requests were structurally possible

Repair: partial unique index on `(student_id,class_id,parent_id) WHERE status='pending'`.

### P0/P1 boundary risk — Teacher access trusted historical `teacher_classes` without live school membership

Production had 28 teacher-class rows and all 28 currently matched live teacher school membership, so no present stale-assignment exposure was found. However, multiple learner-data policies trusted `teacher_classes` directly and could retain access after membership removal.

Repair:

- `is_teacher_of_student()` now requires current student enrollment + teacher assignment + live `school_members.role='teacher'` membership.
- Added `is_live_teacher_class()` and `is_live_teacher_subject()`.
- Rebound student, attendance, CBC assessment, exam result, assessment-attempt, homework-submission, lesson-evidence/intervention, exercise/project-submission, parent relationship/message/profile, claim-code, mastery and learner-outcome teacher policies to current canonical learner + live teacher authority.

### P0 semantic defect — `student_profiles` policies mixed profile identity with learner identity

Production `student_profiles.profile_id` is account/profile identity. Legacy policies compared it directly with `student_classes.student_id` and `parent_student_links.student_id`.

Production data showed 1 `student_profiles` row, correctly mapped through `students.profile_id`; there was no accidental `student_profiles.profile_id = students.id` equality.

Repair:

- Removed confused parent/teacher policies.
- New policy first resolves `student_profiles.profile_id -> students.profile_id -> students.id`, then evaluates parent/teacher authorization against the canonical learner ID.
- Permanent regression rejects direct `student_id = student_profiles.profile_id` semantics.

### P1 — Legacy self resolver used arbitrary `LIMIT 1`

`funhub_get_student_id()` selected a learner by account with `LIMIT 1`. Production already has a unique partial index preventing multiple active learners per profile, but the resolver did not itself fail closed.

Repair: delegates to `current_student_id()`, which returns zero/one mapping and raises on ambiguity.

### P1 historical — Parent-created learners lost parent relationship

Of 46 active learners without current enrollment:

- 0 are claimed by a profile.
- 0 have attendance.
- 0 have homework submissions.
- 0 have exam results.
- 0 have learning-event history.
- 0 have claim codes.
- 24 were created by authenticated parent profiles but had no parent relationship.
- 21 have no creator provenance.
- 1 was created by admin/owner provenance.

Repair:

- Exact `students.created_by` parent provenance restores only that parent/student relationship.
- School is taken from the parent profile when known, otherwise remains NULL; no school/class is invented.
- Parent-created learners remain pre-enrollment until a legitimate enrollment workflow supplies class/school authority.
- Remaining inert/unprovable unenrolled learners are represented in service-only `student_enrollment_recovery_cases` and preserved for explicit recovery.

### Ambiguous external identifiers — not learner duplicates

Production contains 4 same-school reused normalized admission-number groups affecting 9 canonical learners. Evidence shows different learner names/fingerprints and, in several groups, different classes. Admission-number reuse is therefore not sufficient proof of duplicate identity.

Repair:

- No learner rows merged or deleted.
- Conflicts are recorded in service-only `student_external_identifier_conflicts`.
- Future teacher/admin provisioning fails closed when a school admission identifier already exists without a matching provisioning receipt.

## Downstream identity proof

- Attendance `student_id` → canonical learner FK.
- Homework submissions `student_id` → canonical learner FK.
- Assessment attempts `student_id` → canonical learner FK.
- Exam results `student_id` → canonical learner FK.
- Student learning events `student_id` → canonical learner FK.
- Student Twin state/adaptation/memory/exposure tables use canonical learner FK.
- Student Pathways decisions/passports use canonical learner FK.
- Live profile-keyed Pathways legacy tables contain zero production records; current Pathways state is in canonical `student_pathway_*` tables.
- `student_adaptive_learning_sessions`: 31 production rows, 0 null learner IDs, 0 missing learners, 0 profile/learner mapping mismatches.
- `learning_product_entitlements`: 0 production rows; its distinct profile/account and student/beneficiary fields remain semantically separate.
- `notifications.user_id` FK → `profiles.id`; notification recipient identity is deliberately account-scoped.
- Service-only mixed-profile Student Twin/adaptive tables have RLS enabled and no anon/authenticated table grants.

## Code/database changes

Migrations:

1. `20260819010000_task3_student_identity_provisioning_integrity.sql`
2. `20260819011000_task3_student_teacher_boundary_semantic_closure.sql`
3. `20260819012000_task3_student_self_resolver_unification.sql`
4. `20260819013000_task3_historical_unenrolled_student_reconciliation.sql`

Application:

- `app/teacher/onboarding/students/page.tsx` now makes the authoritative roster admission identifier explicit, surfaces conflicts, and does not silently navigate after provisioning failure.

Regression/CI:

- `scripts/test-task3-student-identity-integrity.mjs`
- `.github/workflows/task3-student-identity-integrity.yml`

## Safety decisions

- No historical learner row is deleted.
- No academic history is reassigned from ambiguous evidence.
- No learners are merged by name/DOB similarity.
- Reused admission identifiers are quarantined, not treated as automatic merge evidence.
- Browser roles have no direct access to service-only provisioning/recovery/conflict ledgers.
- Production has not been modified by this PR during discovery/repair.
- No Vercel deployment has been intentionally triggered during repair work.

## Final certification gate

Before merge, the exact final head must pass:

- Task 3 Student Identity Integrity.
- Student Provisioning Contract.
- Student One Full Journey.
- Student One Legacy Identity Recovery.
- Supabase Migration Security Contract.
- TBL-011 isolated clean rebuild.
- TBL-012 repository extractor.
- Auth & Onboarding Hardening.
- TypeScript and Production Build Gate.
- CI Production Build Contract.
- any additional path-triggered portal/UX gates.

Then:

1. fetch current main and reconcile if it moved;
2. rerun exact-head certification;
3. merge only if all gates are green;
4. apply the intended migrations to production;
5. verify production counts/constraints/RLS/functions;
6. run negative auth boundary probes and representative Student/Teacher/Parent/Admin production journeys;
7. verify zero unresolved P0/P1 identity defects;
8. record final merge/deployment/production evidence.
