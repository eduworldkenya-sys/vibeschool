import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8')

test('submitted-practice marking cannot reveal formal exam answers', () => {
  const sql=read('supabase/migrations/20261115062000_exq_practice_immediate_guided_review.sql')
  assert.match(sql,/v_attempt\.status='teacher_review'/)
  assert.match(sql,/v_attempt\.result_status='partially_marked'/)
  assert.match(sql,/v_attempt\.submitted_at is not null/)
  assert.match(sql,/d\.assessment_type='practice'/)
  assert.match(sql,/v_assignment\.show_score_policy='immediate'/)
  assert.match(sql,/answer_review_policy='after_close'/)
  assert.match(sql,/answer_review_policy='after_release'/)
  assert.match(sql,/s\.profile_id=auth\.uid\(\)/)
  assert.match(sql,/revoke all on function public\.exq_get_my_practice_self_review/)
  assert.doesNotMatch(sql,/update public\.assessment_attempts|update public\.assessment_gradebook_entries/i)
})

test('practice-only route enables learner control and keeps official grades separate', () => {
  const page=read('app/student/assessment/review/[attemptId]/page.tsx')
  const player=read('app/student/assessment/[assignmentId]/page.tsx')
  const exams=read('app/student/vibelearn/exams/page.tsx')
  const client=read('lib/assessment/self-review.ts')
  assert.match(client,/exq_get_my_practice_self_review/)
  assert.match(page,/getMyPracticeReview\(attemptId\)/)
  assert.match(page,/SelfReviewPanel/)
  assert.match(page,/Automatically verified/)
  assert.match(page,/Self-awarded · unverified/)
  assert.match(page,/allReviewed/)
  assert.match(player,/workspace\.assessmentType === 'practice' && workspace\.showScorePolicy === 'immediate'/)
  assert.match(exams,/item\.resultStatus === 'partially_marked'/)
  assert.match(exams,/Review written answers/)
  assert.match(page,/not an independently verified score/i)
})

test('original brands require owner-certified question quality, not titles', () => {
  const sql=read('supabase/migrations/20261115063000_exam_originals_catalogue_identity.sql')
  const discovery=read('lib/assessment/discovery.ts')
  assert.match(sql,/create table if not exists public\.exam_original_assignment_series/)
  assert.match(sql,/public\.is_platform_owner\(\)/)
  assert.match(sql,/revoke all on table public\.exam_original_assignment_series from public, anon, authenticated/)
  assert.match(sql,/assessment_item_outcomes/)
  assert.match(sql,/cannot_rebrand_attempted_exam/)
  assert.match(sql,/'original_product_series',eos\.series_key/)
  assert.match(discovery,/parseExamOriginalKey\(item\.original_product_series\)/)
  assert.match(sql,/paper_item_count_mismatch/)
  assert.doesNotMatch(sql,/update public\.assessment_attempts|update public\.assessment_gradebook_entries/i)
})
