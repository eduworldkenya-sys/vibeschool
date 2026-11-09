import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = JSON.parse(readFileSync(new URL('../content/drafts/grade9-mathematics-100-candidates.json', import.meta.url), 'utf8'))
const questions = source.questions
assert.equal(questions.length, 100)
assert.equal(source.metadata.count, questions.length)
const seen = new Set()
const gcd = (a, b) => b ? gcd(b, a % b) : a
const fraction = (a, b) => { const d = gcd(a, b); return `${a / d}/${b / d}` }

for (const [index, q] of questions.entries()) {
  assert.equal(q.id, `G9M-${String(index + 1).padStart(3, '0')}`)
  assert.equal(q.grade, 'Grade 9')
  assert.equal(q.subject, 'Mathematics')
  assert.equal(q.curriculum_authority_status, 'unmapped_draft')
  assert.equal(q.curriculum_outcome_id, null)
  assert.equal(q.publication_status, 'draft')
  assert.equal(q.review_status, 'needs_subject_expert_review')
  assert.equal(q.options.length, 4)
  assert.equal(new Set(q.options).size, 4)
  assert.ok(q.correct_index >= 0 && q.correct_index <= 3)
  assert.equal(q.options[q.correct_index], q.correct_answer)
  assert.ok(q.explanation.trim().length > 8)
  assert.ok(!seen.has(q.prompt), `Duplicate prompt: ${q.id}`)
  seen.add(q.prompt)

  let expected
  let match
  switch (q.candidate_sub_strand) {
    case 'Integers':
      match = q.prompt.match(/records (-?\d+)°C.* rises by (\d+)°C, then falls by (\d+)°C/)
      assert.ok(match)
      expected = `${Number(match[1]) + Number(match[2]) - Number(match[3])}°C`
      break
    case 'Cubes and Cube Roots':
      match = q.prompt.match(/cube root of (\d+)/)
      assert.ok(match)
      expected = String(Math.round(Math.cbrt(Number(match[1]))))
      assert.equal(Number(expected) ** 3, Number(match[1]))
      break
    case 'Compound Proportions and Rates of Work':
      match = q.prompt.match(/(\d+) workers take (\d+) days.*would (\d+) workers need/)
      assert.ok(match)
      expected = `${Number(match[1]) * Number(match[2]) / Number(match[3])} days`
      break
    case 'Equation of a Straight Line':
      match = q.prompt.match(/through \((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)/)
      assert.ok(match)
      expected = String((Number(match[4]) - Number(match[2])) / (Number(match[3]) - Number(match[1])))
      break
    case 'Probability':
      match = q.prompt.match(/has (\d+) red beads and (\d+) blue beads/)
      assert.ok(match)
      expected = fraction(Number(match[1]), Number(match[1]) + Number(match[2]))
      break
    default:
      assert.fail(`Unknown topic: ${q.candidate_sub_strand}`)
  }
  assert.equal(q.correct_answer, expected, `Incorrect mathematical answer in ${q.id}`)
}
console.log('Validated 100 ORIGINAL DRAFT Grade 9 Mathematics candidates: unique prompts, four distinct options, correct answer keys, five deterministic answer families, all unpublished/unapproved.')
