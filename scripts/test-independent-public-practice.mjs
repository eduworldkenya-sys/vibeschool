import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync('supabase/migrations/20261109180000_exq_independent_public_practice.sql', 'utf8')
const page = readFileSync('app/student/vibelearn/exams/grade-9/mathematics/page.tsx', 'utf8')

test('public practice is explicitly grade-scoped and limited to published practice', () => {
  assert.match(migration, /audience='public_practice'/)
  assert.match(migration, /exq_public_practice_eligible\(aa\.audience_grade\)/)
  assert.match(migration, /ad\.assessment_type='practice'/)
  assert.match(migration, /ad\.published_at is not null/)
})
test('school assessment assignment remains enrolment-scoped', () => {
  assert.match(migration, /aa\.audience='class' and sc\.student_id is not null/)
  assert.match(migration, /sc\.student_id=student_row\.id and sc\.is_current=true/)
})
test('attempts and gradebook support absent school identity without fake enrolments', () => {
  for (const table of ['assessment_assignments','assessment_attempts','assessment_attempt_audit_events','assessment_gradebook_entries']) {
    assert.match(migration, new RegExp('alter table public\\.' + table + ' alter column school_id drop not null'))
    assert.match(migration, new RegExp('alter table public\\.' + table + ' alter column class_id drop not null'))
  }
})
test('publishing requires HQ owner, verified grade-subject authority and approved items', () => {
  assert.match(migration, /perform public\.hq_assert_owner\(\)/)
  assert.match(migration, /grade_subject_authority/)
  assert.match(migration, /public_practice_requires_approved_items/)
  assert.match(migration, /revoke all on function public\.exq_publish_public_practice/)
})
test('Grade 9 client no longer uses school class name as its access gate', () => {
  assert.doesNotMatch(page, /const allowed = !identityLoading && isGradeNine/)
  assert.match(page, /const allowed = !identityLoading && Boolean\(identity\)/)
})
