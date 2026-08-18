# Student = 1 Downstream Product-Journey Certification — 2026-08-18

## Mission

Prove that canonical learner identity survives the complete academic product journey after the Student Identity foundation was repaired.

Canonical rule: durable learner academic state uses `public.students.id`. `auth.uid()` / `profiles.id` is account identity only and must resolve through the canonical learner boundary.

## Scope and sequence

1. Classroom activity: attendance, lesson evidence/interventions, homework, exercises, tasks, timetable/Teach Now.
2. Submission → marking → results: homework/project/exercise submissions, assessment attempts, gradebook, CBC assessment and exam results.
3. Teacher + parent access: adults resolve and authorize the canonical learner without writing account/profile UUIDs into learner columns.
4. Twin/VibeLearn/adaptive learning: memory, practice, KCSE, revision and recommendations accumulate on the same learner.
5. End-to-end authorization: Auth → Student → Classroom → Submission → Result → Parent/Teacher visibility.
6. Instrumentation + pilot readiness: detect identity mismatch, orphan academic rows, resolver failure and unauthorized access.

## Baseline production investigation

Production was inspected before any mutation.

### Existing data

The inspected downstream tables currently contain canonical rows only where data exists:

- attendance: 39 rows, 0 orphan learner IDs, 0 profile-domain learner IDs
- exam_results: 7 rows, 0 orphan learner IDs, 0 profile-domain learner IDs
- homework_submissions: 3 rows, 0 orphan learner IDs, 0 profile-domain learner IDs
- lesson_evidence: 1 row, 0 orphan learner IDs, 0 profile-domain learner IDs
- student_task_execution_receipts: 2 rows, 0 orphan learner IDs, 0 profile-domain learner IDs
- assessment_attempts, assessment_gradebook_entries, cbc_assessments, exercise_submissions, lesson_interventions and project_submissions currently have no rows

This means production data is not presently fragmented at these inspected boundaries, but empty tables cannot prove future writes are safe.

### Structural state

The inspected `student_id` columns are structurally attached to `public.students(id)` for attendance, assessment attempts/gradebook/interventions, CBC assessments, exam results, exercise/homework/project submissions, lesson evidence/interventions and task execution receipts.

RLS is enabled on all inspected downstream tables.

### Authorization findings

Strong boundaries already exist in several places: attendance inserts verify teacher assignment, current class membership and a live canonical `students.id`; exercise submission student writes resolve account identity through `students.profile_id` while storing canonical `students.id`; exam result teacher writes verify class, subject, student-class and exam authority.

Five defects were confirmed during adversarial review:

1. Several downstream policies targeted Postgres `PUBLIC` rather than the intended `authenticated` role.
2. `cbc_assessments` insert authorization only checked `teacher_id = auth.uid()` and did not prove teacher assignment, school/class/subject authority or current canonical learner membership.
3. `cbc_assessments` update authorization did not re-prove the target learner/class/subject boundary, leaving an identity-retargeting path after insert.
4. `project_submissions` student insert proved the caller owned the supplied canonical learner ID, but did not prove the selected project belonged to that learner's current class and school.
5. `parent_student_links` update allowed a parent-owned link to satisfy a new-row check against another current student in the same school, creating a potential learner-link retargeting boundary.

These are authorization defects rather than evidence of current production corruption: the inspected existing rows remain canonical. They matter because a canonical foreign key alone cannot prove that the caller is authorized to create or retarget state for that canonical learner.

## Implemented repository hardening

### Migration 1 — authorization role and write-boundary hardening

`20260818141500_student_one_downstream_authorization_hardening.sql`

This migration:

- replaces the identified legacy `PUBLIC` policies with explicit `TO authenticated` policies;
- hardens CBC assessment inserts with teacher-class-subject-school authority plus current `student_classes` membership and a live `students.id`;
- keeps student homework writes account-scoped through `students.profile_id` while storing canonical `students.id`;
- adds school-aware class membership to homework self-service validation;
- makes lesson evidence/intervention teacher policies explicitly authenticated and school-aware;
- hardens project teacher management with `teacher_classes` and current `student_classes` joins;
- respects parent `access_level <> none` on downstream parent reads;
- narrows legacy parent-link policies to authenticated callers;
- contains fail-closed postconditions preventing a hardened boundary from remaining `PUBLIC` and verifying the CBC insert authority predicate.

### Migration 2 — identity retargeting closure

`20260818141600_student_one_downstream_retargeting_closure.sql`

This migration:

- replaces CBC update authorization so every resulting row must still resolve to a live canonical learner in the current school/class and, for teachers, a matching teacher-class-subject assignment;
- binds student project submission to the caller's canonical learner plus that learner's current class/school and the selected project's class/school;
- makes `parent_student_links` identity-bearing updates school-owner/admin operations only and validates that the target learner is a live current member of the same school;
- contains fail-closed postconditions for all three retargeting boundaries.

### Regression certification

Regression contract: `scripts/test-student-one-downstream-contract.mjs`

CI workflow: `.github/workflows/student-one-downstream-contract.yml`

The CI contract rejects:

- a downstream migration that recreates `TO public` policies;
- direct durable learner `student_id = auth.uid()` semantics;
- loss of canonical `students.profile_id -> students.id` self-service resolution;
- loss of teacher/student class authority from CBC insert/update;
- project submission that is no longer class/school-bound;
- parent-link retargeting without school authority;
- removal of parent-link access-level checks.

## Required certification gates

- Every durable downstream `student_id` FK targets `public.students(id)`.
- No production orphan or profile-domain learner rows.
- Student self-service writes resolve account → canonical learner and cannot choose another learner.
- Teacher writes require current teaching/class authority and canonical class membership.
- Parent reads require canonical `parent_student_links.student_id` linkage.
- Identity-bearing parent-link mutation requires school authority.
- No downstream policy or RPC equates a learner `student_id` directly with `auth.uid()`.
- Legacy `{public}` policies in this boundary are replaced with explicit intended roles.
- CI fails on regression.
- Production postflight repeats structural, data, policy and resolver checks.

## Deployment rule

This work remains isolated from Vercel. No Vercel action is required for database/authorization certification. Production mutation is allowed only after the exact repository migrations are reviewed and certified; postflight must verify the live Supabase state.

## Handover status

Branch: `cert/student-one-downstream-chain-20260818`
Draft PR: `#251`

Baseline production investigation: complete.
Repository authorization hardening: implemented.
Identity-retargeting closure: implemented.
Regression CI coverage: extended to both migrations.
Production application/postflight: pending exact-head certification.

Current decision: **NOT YET PILOT-CERTIFIED** for the full Student = 1 product journey. Existing rows are canonical and the first two downstream repairs are implemented, but the exact PR head must be certified and the canonical migrations must then be applied and postflight-certified in production before this boundary is closed.
