import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const areas = ['science-technology','agriculture','social-studies']
const seenKeys = new Set()
const seenPrompts = new Set()

for (const area of areas) {
  test(`Grade 4 ${area} original exam structurally valid`, () => {
    const paper = JSON.parse(readFileSync(`content/exams/grade4/2026/${area}-exam-01.json`, 'utf8'))
    assert.equal(paper.grade, 'Grade 4')
    assert.equal(paper.assessment_type, 'practice')
    assert.equal(paper.visibility, 'public_practice')
    assert.equal(paper.status, 'original_content_editorial_review')
    assert.doesNotMatch(paper.title, /pilot/i)
    assert.equal(paper.items.length, 12)
    assert.equal(paper.total_marks, 12)
    assert.equal(paper.items.reduce((sum,q)=>sum+q.marks,0),paper.total_marks)
    for (const [i,q] of paper.items.entries()) {
      assert.equal(q.number,i+1)
      assert.ok(q.prompt.length>8 && q.explanation.length>=12)
      assert.ok(!seenKeys.has(q.bank_key))
      assert.ok(!seenPrompts.has(q.prompt.toLowerCase()))
      seenKeys.add(q.bank_key)
      seenPrompts.add(q.prompt.toLowerCase())
      assert.equal(q.options.length,4)
      assert.deepEqual(q.options.map(o=>o.value),['A','B','C','D'])
      assert.equal(new Set(q.options.map(o=>o.label.trim().toLowerCase())).size,4)
      assert.ok(q.options.some(o=>o.value===q.correctAnswer))
      assert.equal(q.review_status,'editorial_review_required')
      assert.equal(q.verified_kicd_outcome_id,null)
    }
  })
}
test('Second wave contains 36 independently identified items',()=>assert.equal(seenKeys.size,36))
