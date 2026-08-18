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

Strong boundaries already exist in several places: attendance inserts verify teacher assignment, current class membership and a live canonical `students.id`; exercise/project submission student writes resolve account identity through `students.profile_id` while storing canonical `students.id`; exam result teacher writes verify class, subject, student-class and exam authority.

Two defects were confirmed:

1. Several downstream policies still targeted Postgres `PUBLIC` rather than the intended `authenticated` role.
2. `cbc_assessments` insert authorization only checked `teacher_id = auth.uid()`. It did not prove teacher assignment, school/class/subject authority, or current canonical learner membership.

The CBC defect is consequential: the FK prevents a nonexistent learner ID, but without teacher/class authorization a signed-in teacher could attempt to write assessment state for a canonical learner outside the teacher's actual classroom authority.

## Implemented repository hardening

Migration: `20260818141500_student_one_downstream_authorization_hardening.sql`

The migration:

- replaces the identified legacy `PUBLIC` policies with explicit `TO authenticated` policies;
- hardens CBC assessment inserts with teacher-class-subject-school authority plus current `student_classes` membership and a live `students.id`;
- keeps student homework writes account-scoped through `students.profile_id` while storing canonical `students.id`;
- adds school-aware class membership to homework self-service validation;
- makes lesson evidence/intervention teacher policies explicitly authenticated and school-aware;
- hardens project marking/submission teacher authority with `teacher_classes` and current `student_classes` joins;
- respects parent `access_level <> none` on downstream parent reads;
- narrows legacy parent-link policies to authenticated callers;
- contains fail-closed migration postconditions preventing a hardened boundary from remaining `PUBLIC` and verifying the CBC authority predicate.

Regression contract: `scripts/test-student-one-downstream-contract.mjs`

CI workflow: `.github/workflows/student-one-downstream-contract.yml`

The CI contract rejects:

- a downstream migration that recreates `TO public` policies;
- direct durable learner `student_id = auth.uid()` semantics;
- loss of canonical `students.profile_id -> students.id` self-service resolution;
- loss of teacher/student class authority from the CBC write boundary;
- removal of parent-link access-level checks.

## Required certification gates

- Every durable downstream `student_id` FK targets `public.students(id)`.
- No production orphan or profile-domain learner rows.
- Student self-service writes resolve account → canonical learner and cannot choose another learner.
- Teacher writes require current teaching/class authority and canonical class membership.
- Parent reads require canonical `parent_student_links.student_id` linkage.
- No downstream policy or RPC equates a learner `student_id` directly with `auth.uid()`.
- Legacy `{public}` policies in this boundary are replaced with explicit intended roles.
- CI fails on regression.
- Production postflight repeats structural, data, policy and resolver checks.

## Deployment rule

This work remains isolated from Vercel. No Vercel action is required for database/authorization certification. Production mutation is allowed only after the exact repository migration is reviewed and certified; postflight must verify the live Supabase state.

## Handover status

Branch: `cert/student-one-downstream-chain-20260818`

Baseline: complete.
Repository hardening: implemented.
Regression CI: implemented.
Production application/postflight: pending exact-head certification.

Current decision: **NOT YET PILOT-CERTIFIED** for the full Student = 1 product journey. Existing rows are canonical and the first downstream authorization repair is implemented, but the exact branch must pass CI and the canonical migration must then be applied and postflight-certified in production before this boundary is closed.
