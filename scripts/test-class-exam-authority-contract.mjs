// Structural safety contract. DB and real-role tests remain mandatory before merge.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = readFileSync(
  new URL('../supabase/migrations/20261011093500_class_exam_review_authority.sql', import.meta.url),
  'utf8'
);
const checks = [
  [/teacher_can_view_class_exam\(/, 'class view predicate'],
  [/teacher_is_current_class_teacher\(/, 'class teacher predicate'],
  [/tc\.is_class_teacher\s*=\s*true/, 'class teacher appointed in class'],
  [/sm\.role\s*=\s*'teacher'/, 'active school teacher membership'],
  [/p\.account_status::text\s*=\s*'active'/, 'active teacher account'],
  [/for select to authenticated/, 'class-wide read is SELECT-only'],
  [/teacher_correct_class_exam_result\(/, 'separate class correction API'],
  [/class_teacher_not_authorized/, 'class edit permission checked server-side'],
  [/result_not_entered_by_subject_teacher/, 'only the subject teacher enters new marks'],
  [/active_school_changed/, 'active school context enforced'],
  [/student_not_in_current_class/, 'canonical active learner enrollment'],
  [/class_subject_not_assigned/, 'class learning area scoped'],
  [/exam_locked/, 'exam locked on correction'],
  [/for share/, 'concurrent exam lock safety'],
  [/result_changed_review_again/, 'optimistic concurrency'],
  [/p_expected_updated_at is null/, 'no blind overwrite'],
  [/non_scored_result_cannot_have_marks/, 'non-score is not zero'],
  [/v_score > v_max/, 'maximum marks validation'],
  [/correction_reason_required/, 'reason compulsory'],
  [/insert into public\.platform_events\(/, 'audited correction reason'],
  [/grant execute on function public\.teacher_correct_class_exam_result/, 'explicit RPC grant'],
  [/revoke all on function public\.teacher_correct_class_exam_result/, 'no anonymous RPC access'],
];
assert.equal(
  sql.includes('insert into public.exam_results('),
  false,
  'class-teacher corrections must never create a mark in another subject'
);
for (const [pattern,label] of checks) {
  assert.match(sql,pattern, label);
  console.log('PASS:',label);
}
console.log('Static contract passed. NOT database or authenticated-role certification.');
