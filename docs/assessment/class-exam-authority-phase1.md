# Class-wide CBC Exam Authority — Phase 1

Status: **backend + Class Exam Register implemented on feature branch; not merged or deployed; pilot NOT certified**.

## Why this exists
A class teacher must review all learning-area results for an assigned class, while a
subject teacher may review the same class but edit only their own subject. Existing
`exam_results` RLS restricts teacher SELECT to their assigned learning area; the
existing `teacher_save_exam_result_state` refuses cross-subject corrections and
refuses a different `teacher_id` owner on existing records.

This is an **additive backend and read-only/class-correction UI foundation**, not a new mark store. It preserves the
`exams`, `exam_results`, `student_classes`, `teacher_classes`, and
`exam_subject_config` authorities. It neither changes UI nor redefines formal KNEC
reporting. `assessment_gradebook_entries` remains the distinct released assessment
projection; do not duplicate those results.

## Scope
- `teacher_can_view_class_exam(school,class)`: checks authenticated caller,
  **active** teacher profile, school teacher membership, real class-school join,
  and a teacher-class appointment.
- Adds SELECT-only RLS access for assigned class teachers **and subject teachers**
  to all subjects' exam results within that class. Cross-subject UPDATE remains
  denied by existing policies.
- `teacher_is_current_class_teacher(school,class)`: requires actual
  `is_class_teacher` appointment, not merely `teacher` role.
- `teacher_correct_class_exam_result`: explicit and audited class-teacher
  correction with a mandatory reason for existing entries only; validates active operating school,
  class-subject assignments, active learner enrolment, the subject's maximum,
  explicit result state, lock, and expected revision. Original `teacher_id`
  remains unchanged on corrections.
- Records a reason-bearing `platform_events` event in the same transaction;
  existing examination change triggers continue operating.

## Important boundaries
1. Do **not** call correction RPC from subject-teacher marks entry. Subject teachers
   continue using `teacher_save_exam_result_state` for their own entries.
2. **Initial entry belongs to the assigned subject teacher.** The class-teacher
   correction RPC explicitly rejects a missing subject result with
   `result_not_entered_by_subject_teacher`. This avoids taking ownership of
   a score before the subject teacher enters it. The class teacher sees missing
   cells but cannot fill them on another subject's behalf in phase 1.
   Reassigned-subject-teacher editing of historical records remains a separate
   authority/ownership issue to resolve before pilot.
3. A consolidated Class Results tab is now implemented at `/teacher/results`, alongside the existing fast subject markbook. It displays the canonical enrolled roster, all assigned learning areas, saved numeric scores and non-score statuses. A subject teacher edits their assigned learning area; a class teacher may correct existing cross-subject entries with a reason. Submitted/approved/published per-subject lifecycle is not yet implemented.
   The existing `is_locked` is the only verified lock boundary; do not claim
   that it represents moderation or publication.
4. Existing parent/learner exam-read policies do not yet enforce new publication
   states. Address separately, before promising release workflows.
5. PR #739 contains unmerged exam-state / denominator UI and migration work, with
   its schema already present in production. Reconcile that PR before deploying
   or changing score semantics again.
6. Verify this migration against production migration history and run role-specific
   database tests in an isolated database; **do not run on production to test**.

## Required integration tests before merge/deploy
- Teacher A: Grade 8 East Maths, not class teacher: can SELECT whole-class
  English marks; cannot INSERT/UPDATE English through direct table or correction RPC.
- Teacher B: Grade 8 East class teacher: can read all subjects in East; can
  correct English mark with reason and expected timestamp; original teacher_id
  and previous value remain recorded in audit.
- Teacher B cannot view/correct West, another school, or a former student's mark.
- Teacher B must not correct an unassigned learning area, a locked exam, or a
  result changed concurrently. Missing/absent/exempt/zero remain distinct.
- Student/parent/anonymous users cannot execute the correction RPC.
- Remove teacher appointment / school membership / active account and immediately
  lose scope. A teacher of two subjects receives only those write permissions.
- Verify that correction events and the original audit trigger are written once
  per actual change and that errors roll back the whole transaction.
- Run exact-head TypeScript, existing exam contract tests, RLS integration tests,
  and Android/browser teacher journeys **before** marking pilot-ready.

## Rollout
1. Verify applied production migrations and reconcile PR #739.
2. Apply this migration to isolated integration database, test all users and RLS.
3. Fix any test failures; obtain reviewed merge with passing CI.
4. Apply production migration through controlled deployment, verify grants and
   negative permission tests. Only then enable class-wide UI and corrections.


## Additional work carried by this branch
- Reconciles the four October 4 canonical exam-result migrations already applied in production but missing from main. Fixed invalid dollar quoting in the repository's migration so blank-database replay can parse it.
- Includes the class-exam read projection RPC with explicit school/teacher verification and the existing canonical student/subject/result identities; no parallel result table.
- Adds mobile-adaptive, horizontally scrollable class-wide results and source-authoritative correction readback.
- The subject markbook uses the existing scoring-policy RPC for authentic /20, /50, /80 and /100 ranges. An internal threshold is **not** a CBC EE/ME/AE/BE conversion.
- Removes automatic CBC grades from the legacy markbook and CSV; CSV includes raw maximum, percentage and original result state.
- Uses admission/learner IDs for paste matching; positional matching is prohibited.
- Uses existing atomic batch RPC for "Save all" and restores ABS to pending rather than manufacturing a zero.
- Extends the exam type check to allow end-term entries already presented in UI.

## Remaining release blockers
1. Reconcile PR #739's **remaining application consumers and tests**, not just its production-applied migrations. They contain valuable score-state/report work but are still open and unmergeable.
2. School examination subject submission, teacher correction request/reopen, admin approval, publication/privacy rules for learner/parent screens.
3. Hosted nonproduction Supabase testing with real authenticated subject/class/admin/parent/learner actors and two distinct schools, and production parity.
4. Full Android/mobile, offline/slow-network, report card and new-teacher workflows.
5. Exact-head governance, typecheck, lint, full migrations replay and CI must all pass before merge. Migration deployment and Vercel release must be verified separately.
