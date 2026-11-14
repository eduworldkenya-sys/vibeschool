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
// Independent formative questions must test transfer, not reproduce revealed model/exercise answers.
for (const p of batch.packets) {
 const known = new Set([p.worked, ...p.guided, ...p.independent].map(x => x.prompt))
 const formativePrompts = new Set()
 for (const q of p.formative) {
  assert.ok(!known.has(q.prompt), 'Formative repeats revealed question: ' + q.id)
  assert.ok(!formativePrompts.has(q.prompt), 'Duplicate formative question: ' + q.id)
  formativePrompts.add(q.prompt)
  assert.ok(q.incorrectFeedback.length >= 55, 'Insufficient corrective guidance: ' + q.id)
 }
 if (p.outcomeCode === '1.2(b)') {
  const exposed = new Set([p.worked, ...p.guided, ...p.independent]
   .filter(x => Number.isInteger(x.a) && Number.isInteger(x.b))
   .map(x => x.a + ':' + x.b))
  for (const q of p.formative) assert.ok(!exposed.has(q.a + ':' + q.b), 'Reused arithmetic pair: ' + q.id)
 }
 if (p.outcomeCode === '1.2(c)') {
  const exposed = new Set([p.worked, ...p.guided, ...p.independent].map(x => x.answer).filter(Number.isInteger))
  for (const q of p.formative) {
   assert.ok(!exposed.has(q.answer), 'Reused answer from demonstration: ' + q.id)
   const numbers = [...q.prompt.matchAll(/\\d[\\d,]*/g)].map(m => Number(m[0].replaceAll(',', '')))
   assert.equal(numbers.length, 2, 'Expected two addends: ' + q.id)
   const [a,b] = numbers
   const expected = q.prompt.startsWith('Estimate') ? Math.round(a/10)*10 + Math.round(b/10)*10 : a+b
   assert.equal(q.answer, expected, 'Wrong estimate or exact sum: ' + q.id)
  }
 }
 if (p.outcomeCode === '1.2(d)') {
  for (const q of p.formative) {
   const nums = [...q.prompt.matchAll(/\\d[\\d,]*/g)].map(m => Number(m[0].replaceAll(',', '')))
   assert.equal(nums.length, 3)
   const step = nums[1]-nums[0]
   assert.equal(nums[2]-nums[1],step)
   assert.deepEqual(q.answer, q.prompt.startsWith('Find the common') ? step : [nums[2]+step,nums[2]+2*step])
  }
 }
 if (p.outcomeCode === '1.2(e)') {
  const exposed = new Set([p.worked, ...p.guided, ...p.independent].map(x => x.answer).filter(Number.isInteger))
  for (const q of p.formative) {
   assert.ok(!exposed.has(q.answer), 'Reused model/exercise answer: ' + q.id)
   const nums = [...q.prompt.matchAll(/\\d[\\d,]*/g)].map(m => Number(m[0].replaceAll(',', '')))
   assert.equal(nums.length,2)
   assert.equal(q.answer,nums[0]+nums[1])
  }
 }
}
const patterns = batch.packets.find(p => p.outcomeCode === '1.2(d)')
for (const [i, val] of patterns.worked.answer.entries()) assert.equal(val, patterns.worked.start + i * patterns.worked.step)
const round10 = n => Math.round(n / 10) * 10
const estimated = batch.packets.find(p => p.outcomeCode === '1.2(c)').worked
assert.equal(round10(estimated.a) + round10(estimated.b), estimated.estimate)
assert.equal(estimated.a + estimated.b, estimated.answer)

const diagrams = [
  ['1.2(b)', 'grade4-addition-1.2b-double-exchange.svg', '3,825'],
  ['1.2(c)', 'grade4-addition-1.2c-round-nearest-ten.svg', '3,790'],
  ['1.2(d)', 'grade4-addition-1.2d-pattern.svg', '1,650'],
  ['1.2(e)', 'grade4-addition-1.2e-combined-quantities.svg', '3,775'],
]
for (const [outcome, filename, answer] of diagrams) {
  assert.ok(batch.packets.some(p => p.outcomeCode === outcome), 'Missing ' + outcome)
  const svg = readFileSync('content/curriculum/production/visuals/' + filename, 'utf8')
  assert.match(svg, /<svg[^>]*role="img"[^>]*aria-labelledby="title desc"/)
  assert.match(svg, /<title[^>]*>.+<\/title>/)
  assert.match(svg, /<desc[^>]*>.+<\/desc>/)
  assert.ok(svg.includes(answer), filename + ' must show the correct result')
}
assert.ok(batch.packets.every(p => p.source.url === 'https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf'))
assert.ok(batch.packets.every(p => p.canonicalStatus === 'SOURCE_OBSERVED_NOT_PROMOTED'))
assert.ok(batch.packets.every(p => p.assessmentStatus === 'PRIVATE_EDITORIAL_ITEMS_NOT_IN_CANONICAL_BANK'))
console.log('G4 Addition editorial batch structure and arithmetic checks passed: 4 outcomes, 20 formative questions, 12 independent exercises.')
