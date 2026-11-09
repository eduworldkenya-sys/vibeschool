import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const subjects = ['mathematics', 'english', 'kiswahili']
const questions = []
const bankKeys = new Set()
const titles = new Set()

for (const slug of subjects) {
  const path = `content/exams/grade4/2026/${slug}-exam-01.json`
  test(`Grade 4 ${slug}: original content publication contract`, () => {
    const paper = JSON.parse(readFileSync(path, 'utf8'))
    assert.equal(paper.grade, 'Grade 4')
    assert.equal(paper.assessment_type, 'practice', 'Existing canonical public assessment path')
    assert.equal(paper.visibility, 'public_practice')
    assert.equal(paper.status, 'original_content_editorial_review')
    assert.equal(paper.items.length, 12)
    assert.equal(paper.total_marks, 12)
    assert.ok(!/pilot/i.test(paper.title), 'Public VibeSchool exam titles may not be named pilot')
    assert.ok(!titles.has(paper.title.toLowerCase()))
    titles.add(paper.title.toLowerCase())
    assert.equal(new Set(paper.items.map(x => x.number)).size, 12)
    assert.equal(new Set(paper.items.map(x => x.prompt.trim().toLowerCase())).size, 12)
    assert.equal(paper.items.reduce((n, x) => n + x.marks, 0), paper.total_marks)
    for (const [index, question] of paper.items.entries()) {
      assert.equal(question.number, index + 1)
      assert.ok(question.prompt.length >= 8)
      assert.ok(question.explanation.length >= 12)
      assert.ok(question.topic.length >= 2)
      assert.ok(!bankKeys.has(question.bank_key), 'Bank key must be globally unique')
      bankKeys.add(question.bank_key)
      assert.equal(question.options.length, 4)
      assert.deepEqual(question.options.map(x => x.value), ['A','B','C','D'])
      assert.equal(new Set(question.options.map(x => x.label.trim().toLowerCase())).size, 4)
      assert.ok(question.options.some(x => x.value === question.correctAnswer))
      assert.equal(question.verified_kicd_outcome_id, null, 'Never claim unverified KICD outcome')
      assert.equal(question.review_status, 'editorial_review_required')
      questions.push(question.prompt.trim().toLowerCase())
    }
  })
}
test('Grade 4 first three original exams have no repeated question prompts', () => {
  assert.equal(new Set(questions).size, 36)
})
