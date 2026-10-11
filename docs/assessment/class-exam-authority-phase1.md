# Class-wide CBC Exam Authority — Phase 1

Status: **proposed migration, NOT applied and NOT certified**.

## Why this exists
A class teacher must review all learning-area results for an assigned class, while a
subject teacher may review the same class but edit only their own subject. Existing
`exam_results` RLS restricts teacher SELECT to their assigned learning area; the
existing `teacher_save_exam_result_state` refuses cross-subject corrections and
refuses a different `teacher_id` owner on existing records.

This is an **additive backend foundation**, not a new markbook. It preserves the
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
  correction with a mandatory reason; validates active operating school,
  class-subject assignments, active learner enrolment, the subject's maximum,
  explicit result state, lock, and expected revision. Original `teacher_id`
  remains unchanged on corrections.
- Records a reason-bearing `platform_events` event in the same transaction;
  existing examination change triggers continue operating.

## Important boundaries
1. Do **not** call correction RPC from subject-teacher marks entry. Subject teachers
   continue using `teacher_save_exam_result_state` for their own entries.
2. If a class teacher **first** enters an unrecorded subject mark, `teacher_id`
   initially denotes that class teacher. Current subject-RPC ownership checks
   prevent a different teacher from editing it later. This is a known pending
   *subject-owner handoff* and must be closed before activating cross-subject entry
   in the UI. Until then, the UI should enable class-teacher corrections of existing
   marks only, and keep empty cells read-only.
3. Submitted/approved/published per-subject lifecycle is not yet implemented.
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
