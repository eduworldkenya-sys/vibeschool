import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql=fs.readFileSync('supabase/migrations/20261110143000_grade9_indices_topic_practice_01.sql','utf8')
const expectedQuestions=[
  'Simplify 2³ × 2⁴.',
  'Evaluate 5⁰ + 2³.',
  'Evaluate 3² × 3³.',
  'Simplify 5⁴ ÷ 5².',
  'Evaluate (2³)².',
]
assert.match(sql,/topic_practice',true/)
assert.match(sql,/'public_practice','Grade 9'/)
assert.match(sql,/'open',null,3,false,false/)
assert.match(sql,/source_item_id/)
assert.match(sql,/source_block_id/)
assert.match(sql,/source_reuse_integrity_failed/)
assert.match(sql,/five_question_integrity_failed/)
assert.match(sql,/assessment_item_requires_source_block_before_release|v_block3/)
assert.match(sql,/curriculum_verification','provisional'/)
for (const question of expectedQuestions.slice(2)) {
  assert.ok(sql.includes(question), `Missing original question ${question}`)
}
// The two original pilot questions are copied from stored items, never reauthored.
// Independent arithmetic checks for the new questions.
assert.equal(3**2 * 3**3,243)
assert.equal(5**4 / 5**2,25)
assert.equal((2**3)**2,64)
assert.equal((2**3)*(2**4),128)
assert.equal(5**0+2**3,9)
console.log('Grade 9 Indices original topic practice contract PASSED')
