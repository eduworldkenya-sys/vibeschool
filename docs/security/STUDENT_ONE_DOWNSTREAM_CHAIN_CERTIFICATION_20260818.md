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

The principal remaining hardening gap is policy-role hygiene. Several legacy policies are still declared to `{public}` instead of `authenticated`, including policies on CBC assessments, homework submissions, lesson evidence/interventions and some project/exercise parent/teacher paths. Their predicates commonly call `auth.uid()` and therefore do not automatically grant useful anonymous access, but `PUBLIC` is the wrong durable authorization contract and increases audit ambiguity. These policies must be narrowed deliberately rather than relying on a null `auth.uid()` side effect.

A second gap is certification coverage: some empty downstream tables have no production evidence proving attempted writes cannot reintroduce a profile/account UUID. CI must therefore enforce FK targets, canonical write predicates/resolvers and forbidden direct `auth.uid()`-as-`student_id` patterns.

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

Current decision: **NOT YET PILOT-CERTIFIED** for the full Student = 1 product journey. Existing rows are canonical, but downstream policy-role hygiene and regression certification still need closure before the chain can be declared safe for new real-user activity.
