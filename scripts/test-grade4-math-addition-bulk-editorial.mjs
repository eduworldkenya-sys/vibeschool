import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const file = 'content/curriculum/production/grade4-mathematics-addition-1.2-b-to-e.v1.editorial.json'
const batch = JSON.parse(readFileSync(file, 'utf8'))
assert.equal(batch.status, 'EDITORIAL_DRAFT_NOT_IMPORTED_NOT_CERTIFIED_NOT_PUBLISHED')
assert.deepEqual(batch.packets.map(p => p.outcomeCode), ['1.2(b)', '1.2(c)', '1.2(d)', '1.2(e)'])
const countCarries = (a, b) => {
  let carry = 0, total = 0
  for (let place = 0; place < 4; place++) {
    const d = Math.floor(a / (10 ** place)) % 10 + Math.floor(b / (10 ** place)) % 10 + carry
    carry = d >= 10 ? 1 : 0
    total += carry
  }
  return total
}
const allIds = new Set()
for (const p of batch.packets) {
  assert.equal(p.grade, 'Grade 4')
  assert.equal(p.subject, 'Mathematics')
  assert.equal(p.officialOutcomeId, null)
  assert.equal(p.contentStatus, 'EDITORIAL_DRAFT_NOT_PUBLISHED')
  assert.equal(p.formative.length, 5)
  assert.equal(p.independent.length, 3)
  assert.ok(p.worked.steps.length >= 4)
  assert.ok(p.revision && p.teacher && p.visual && p.activity)
  for (const q of [...p.guided, ...p.independent, ...p.formative]) {
    assert.ok(!allIds.has(q.id), 'Duplicate question ID ' + q.id)
    allIds.add(q.id)
    assert.ok(q.explanation && q.incorrectFeedback)
  }
  for (const item of [p.worked, ...p.guided, ...p.independent, ...p.formative]) {
    if (Number.isInteger(item.a) && Number.isInteger(item.b)) {
      assert.equal(item.a + item.b, item.answer, 'Arithmetic mismatch ' + (item.id || p.id))
      if (p.outcomeCode === '1.2(b)') {
        assert.equal(countCarries(item.a, item.b), 2, 'Wrong number of regroupings')
        assert.ok(item.answer <= 10000)
      }
    }
  }
}
const patterns = batch.packets.find(p => p.outcomeCode === '1.2(d)')
for (const [i, val] of patterns.worked.answer.entries()) assert.equal(val, patterns.worked.start + i * patterns.worked.step)
const round10 = n => Math.round(n / 10) * 10
const estimated = batch.packets.find(p => p.outcomeCode === '1.2(c)').worked
assert.equal(round10(estimated.a) + round10(estimated.b), estimated.estimate)
assert.equal(estimated.a + estimated.b, estimated.answer)
console.log('G4 Addition editorial batch structure and arithmetic checks passed: 4 outcomes, 20 formative questions, 12 independent exercises.')
