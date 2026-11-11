import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const pack = JSON.parse(read('../content/curriculum/grade4/mathematics/time.v1.json'))
const reader = read('../components/learn/Grade4TimeContentReader.tsx')
const route = read('../app/learn/grade-4/mathematics/time/page.tsx')
const rpc = read('../supabase/migrations/20261111200000_grade4_math_time_certified_reader.sql')

assert.equal(pack.grade, 'Grade 4')
assert.equal(pack.subject, 'Mathematics')
assert.equal(pack.sub_strand, '2.6 Time')
assert.equal(pack.canonical.curriculum_source_ref, 'VS-CUR-G04-MA-2026#2.6')
assert.equal(pack.source.lesson_allocation, 10)
assert.equal(pack.lessons.length, 10)
assert.equal(pack.outcomes.length, 7)
assert.equal(pack.canonical.sub_strand_id, 'e975dcc6-32a9-4274-a2a3-3d19e409cf5c')
assert.ok(pack.source.url.startsWith('https://kicd.ac.ke/'))

const outcomeIds = new Set(pack.outcomes.map(x => x.id))
const itemIds = new Set()
let items = 0
for (const [index, lesson] of pack.lessons.entries()) {
  assert.equal(lesson.order, index + 1)
  assert.ok(lesson.title && lesson.goal && lesson.explanation && lesson.teacher)
  assert.ok(lesson.vocabulary.length >= 2)
  assert.ok(lesson.worked.prompt && lesson.worked.steps.length >= 3)
  assert.ok(lesson.activity.steps.length >= 3 && lesson.activity.evidence)
  assert.ok(lesson.misconception && lesson.remedial && lesson.enrichment)
  assert.ok(lesson.outcomes.length > 0)
  for (const outcome of lesson.outcomes) assert.ok(outcomeIds.has(outcome), 'Unknown outcome: ' + outcome)
  for (const kind of ['guided', 'independent', 'check']) {
    const questions = lesson[kind]
    assert.ok(questions.length >= 2)
    for (const q of questions) {
      assert.ok(q.id && q.prompt && q.answer && q.explanation)
      assert.ok(!itemIds.has(q.id), 'Repeated question ID: ' + q.id)
      itemIds.add(q.id)
      items++
    }
  }
}
assert.equal(items, 72)
for (const id of outcomeIds) {
  const coverage = pack.lessons.filter(l => l.outcomes.includes(id))
  assert.ok(coverage.length >= 2, 'Outcome needs direct lesson + revision coverage: ' + id)
}
assert.ok(pack.lessons.some(l => l.title.includes('analogue')))
assert.ok(pack.lessons.some(l => l.title.includes('Subtracting')))
assert.ok(pack.lessons.some(l => l.title.includes('weeks')))
for (const phrase of ["v.lifecycle_status = 'certified'",'v.certified_at is not null',
  "r.owner_type = 'platform'","r.source_type = 'platform_authored'",
  "s.sub_strand = 'Time'","b.source_ref = 'VS-CUR-G04-MA-2026#2.6'",
  "v.payload->>'source_edition' = 'learner'",
  'public.fn_learning_resource_visible(r.id)',
  'to anon, authenticated']) {
  assert.ok(rpc.includes(phrase), 'Missing release-only guard: ' + phrase)
}
assert.ok(!rpc.includes("v.lifecycle_status = 'candidate'"))
assert.ok(!reader.includes('service_role'))
assert.ok(!reader.includes('supabase.auth.getUser()'))
assert.ok(reader.includes("supabase.rpc('vs_public_grade4_math_time_learner_lessons')"))
assert.ok(route.includes('<Grade4TimeContentReader />'))
console.log('PASS: ten complete Grade 4 Time lessons, seven mapped outcomes, 72 stable questions, certified-only shared reader')
