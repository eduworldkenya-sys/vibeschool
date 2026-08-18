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

Production was inspected before mutation.

### Existing data

- attendance: 39 rows, 0 orphan learner IDs, 0 profile-domain learner IDs
- exam_results: 7 rows, 0 orphan learner IDs, 0 profile-domain learner IDs
- homework_submissions: 3 rows, 0 orphan learner IDs, 0 profile-domain learner IDs
- lesson_evidence: 1 row, 0 orphan learner IDs, 0 profile-domain learner IDs
- student_task_execution_receipts: 2 rows, 0 orphan learner IDs, 0 profile-domain learner IDs
- assessment_attempts, assessment_gradebook_entries, cbc_assessments, exercise_submissions, lesson_interventions and project_submissions: no rows at baseline

All inspected durable downstream `student_id` foreign keys target `public.students(id)`. RLS is enabled on the inspected academic boundary.

## Defects found and closed

1. Legacy downstream policies targeted Postgres `PUBLIC` instead of explicit `authenticated`.
2. `cbc_assessments` insert did not prove teacher school/class/subject assignment or current learner membership.
3. `cbc_assessments` update could retarget learner/class without re-proving authority.
4. `project_submissions` learner insert did not prove project ↔ current learner class/school membership.
5. `parent_student_links` update could retarget the linked learner without school administrative authority.
6. Duplicate permissive teacher ownership policies existed on `homework_submissions`.

These defects were authorization defects, not observed production learner corruption.

## Production migrations and exact repository lineage

The repository filenames are reconciled to the exact production Supabase migration ledger. Do not recreate these under alternate timestamps.

### 20260818125323 — downstream authorization hardening

`supabase/migrations/20260818125323_student_one_downstream_authorization_hardening.sql`

- explicit authenticated roles on the hardened boundary;
- CBC insert teacher/class/subject/school/current learner authority;
- canonical homework self-service resolution;
- lesson evidence/intervention teacher/current-class authority;
- project teacher/current learner authority;
- parent canonical linkage and access-level enforcement;
- fail-closed policy postconditions.

### 20260818125338 — retargeting closure

`supabase/migrations/20260818125338_student_one_downstream_retargeting_closure.sql`

- CBC update re-proves resulting learner/class/subject authority;
- project learner submission is bound to the learner's current class/school;
- parent-link identity mutation requires school owner/admin authority;
- fail-closed postconditions.

### 20260818130039 — homework policy deduplication

`supabase/migrations/20260818130039_student_one_homework_policy_dedup.sql`

- removes the duplicate legacy teacher `ALL` policy;
- preserves `homework_submissions_teacher` as the canonical teacher ownership policy;
- verifies the duplicate cannot remain after migration.

### 20260818130509 — VibeLearn identity and gamification authority

`supabase/migrations/20260818130509_student_one_vibelearn_identity_authority.sql`

- `vibelearn_saved` and `vibelearn_completed` policies are explicit authenticated canonical learner policies;
- direct client INSERT/UPDATE/DELETE on VibeLearn points and streaks is revoked;
- `student_award_vibelearn_points(...)` derives canonical learner identity server-side and controls point values;
- `student_touch_vibelearn_streak()` derives canonical learner identity server-side and owns streak mutation;
- fail-closed postconditions ensure legacy PUBLIC policy and direct XP mutation authority cannot return.

## Production postflight

After application of the first three downstream migrations:

- all inspected academic `student_id` FKs still target `public.students(id)`;
- attendance 39 / exam results 7 / homework submissions 3 / lesson evidence 1 / task receipts 2 remain 0 orphan and 0 profile-domain learner IDs;
- empty assessment/project/exercise tables remain structurally canonical;
- hardened policies are explicit `authenticated` policies;
- CBC insert/update, project submission and parent-link update contain the expected canonical authority predicates;
- duplicate homework teacher policy was removed;
- Supabase migration ledger contains `20260818125323`, `20260818125338`, `20260818130039` and `20260818130509`.

## Runtime proof

### Homework and unified task execution

`app/student/homework/[id]/page.tsx` reads the learner from Student context and looks up submissions with canonical `identity.studentId`.

`lib/homework/studentSubmission.ts` does not accept caller-supplied `student_id`. It calls `save_student_homework_draft` / `submit_student_homework` with homework + answer material only.

Production `save_student_homework_draft` resolves `auth.uid()` through `students.profile_id`, writes `students.id`, verifies current class/homework membership, and validates question ownership.

Production `student_sync_task_execution_receipt` resolves `auth.uid()` to `students.id` and joins homework/assessment/exercise/project evidence using that same learner ID.

### VibeLearn defect discovered

The active student VibeLearn page imports `components/student/VibeLearnShellWrapper.tsx`.

That shell still has legacy direct queries and mutations such as:

- `vibelearn_saved.student_id = user.id`
- `vibelearn_completed.student_id = user.id`
- save/unsave inserts and deletes using `user.id`
- completion insertion using `user.id`

The live VibeLearn saved/completed tables already FK `student_id` to `students(id)`, so the legacy client cannot create profile-domain rows; instead its reads/writes can fail or appear empty. All four inspected VibeLearn state tables (`saved`, `completed`, `points`, `streaks`) currently have zero rows, so no production data repair is required.

`components/student/VibeProgress.tsx` has been repaired on this branch to resolve `current_student_id()` before querying durable progress.

`lib/vibelearn-points.ts` has been repaired to use the canonical server gamification RPCs instead of direct table mutation.

The large legacy VibeLearn library shell still requires its saved/completed calls to be migrated from auth UUID semantics to canonical learner semantics before Stage 4 can pass.

## Regression certification

Regression contract: `scripts/test-student-one-downstream-contract.mjs`

CI workflow: `.github/workflows/student-one-downstream-contract.yml`

The contract protects the downstream migration shape against PUBLIC policy resurrection, `student_id = auth.uid()` durable semantics, CBC authority loss, project retargeting and parent-link retargeting. It must be extended to cover the newly discovered VibeLearn client shortcuts when that shell repair lands.

## Gate status

- Classroom activity canonical storage: PASS at inspected database boundary.
- Homework submission/runtime canonical resolution: PASS.
- Unified task receipt canonical resolution: PASS.
- Submission/result structural identity: PASS for inspected FK/policy/postflight boundary; empty tables still require runtime exercise during pilot certification.
- Teacher/parent canonical authorization: PASS for the repaired inspected policy boundaries; full product-page journey still to be exercised.
- Twin/adaptive/KCSE: not yet re-certified in this branch.
- VibeLearn: BLOCKED by legacy library-shell auth-ID client shortcuts; points/streak server authority is repaired.
- Instrumentation/pilot certification: pending.

## Deployment rule

This work remains isolated from Vercel. No Vercel action has been intentionally triggered. Do not merge this PR until the full product-journey certification and exact-current-main certification are complete.

## Handover status

Branch: `cert/student-one-downstream-chain-20260818`
Draft PR: `#251`

Production database hardening: applied and postflight-verified.
Repository ↔ production migration lineage: reconciled.
VibeLearn progress/gamification branch repair: implemented.
Known blocking runtime defect: `components/student/VibeLearnShellWrapper.tsx` saved/completed auth-ID shortcuts.
Current main advanced independently to `c88fa34f430c7fffa37429cbf07cdf604ed706db`; branch must be reconciled against latest main before promotion.

Current decision: **NOT YET PILOT-CERTIFIED** for the full Student = 1 product journey. The immediate Classroom Activity → Homework/Task identity boundary is materially hardened and production-postflight clean, but VibeLearn runtime identity, remaining adult/Twin journeys, instrumentation, exact-head CI and current-main reconciliation must be closed before promotion.
