import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const pack = JSON.parse(read('../content/curriculum/grade4/mathematics/time.v1.json'))
const reader = read('../components/learn/Grade4TimeContentReader.tsx')
const route = read('../app/learn/grade-4/mathematics/time/page.tsx')
const rpc = read('../supabase/migrations/20261111200000_grade4_math_time_certified_reader.sql')
const unitFix = read('../supabase/migrations/20261111211000_grade4_math_time_reader_binding_unit_fix.sql')

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
assert.ok(unitFix.includes("split_part(b.source_ref, '#', 2)::text,"), 'Reader unit ID must be supplied by active canonical binding')
assert.ok(!unitFix.includes("split_part(s.source_ref, '#', 2)::text,"), 'Do not read nullable cbc_strands.source_ref')
assert.ok(unitFix.includes("v.lifecycle_status = 'certified'"), 'Release-only policy must survive RPC repair')
assert.ok(reader.includes("clean.length !== data.length"), 'Client must reject malformed RPC rows as an error')
assert.ok(!reader.includes("Lesson manuscripts are being prepared for release."), 'Do not report published lessons as drafts')
assert.ok(!rpc.includes("v.lifecycle_status = 'candidate'"))
assert.ok(reader.includes("background: '#f5f9f6'"), 'Reader must have readable light page canvas on dark global theme')
assert.ok(reader.includes("color: INK"), 'Reader must provide appropriate text contrast')
assert.ok(!reader.includes('service_role'))
assert.ok(!reader.includes('supabase.auth.getUser()'))
assert.ok(reader.includes("supabase.rpc('vs_public_grade4_math_time_learner_lessons')"))
assert.ok(route.includes('<Grade4TimeContentReader />'))
console.log('PASS: ten complete Grade 4 Time lessons, seven mapped outcomes, 72 stable questions, certified-only shared reader')

// The owner's November 13 expanded edition is a reviewable source candidate,
// not a secret live override of immutable certified versions.
const expanded = JSON.parse(read('../content/curriculum/grade4/mathematics/time.v2.editorial.json'))
assert.equal(expanded.grade, 'Grade 4')
assert.equal(expanded.subject, 'Mathematics')
assert.equal(expanded.sub_strand, '2.6 Time')
assert.equal(expanded.version, 2)
assert.equal(expanded.status, 'editorial_candidate_owner_approved_not_certified_or_published')
assert.equal(expanded.editorial_lineage.release_status, 'NOT_PUBLISHED')
assert.equal(expanded.editorial_lineage.production_v1_immutable, true)
assert.equal(expanded.outcomes.length, 7)
assert.deepEqual(expanded.outcomes, pack.outcomes, 'Keep the original 7 outcome identities')
assert.deepEqual(expanded.lessons.map(l => l.id), pack.lessons.map(l => l.id), 'No new lesson authorities')
assert.deepEqual(expanded.lessons.map(l => l.canonical_outcome_ids), pack.lessons.map(l => l.canonical_outcome_ids))
assert.ok(expanded.lessons.every(l => l.expanded_teaching_v2?.learner_explanation && l.expanded_teaching_v2?.teacher_notes && l.expanded_teaching_v2?.worked_model))
const extras = expanded.supplementary_v2.items
assert.equal(extras.length, 63, 'Seven sets of nine new supplementary items')
assert.equal(new Set(extras.map(q=>q.editorial_id)).size, 63, 'Candidate item keys unique')
assert.equal(new Set(extras.map(q=>q.prompt)).size, 63, 'No exact repeated new question prompt')
assert.ok(extras.every(q => q.prompt && q.answer && q.feedback && q.section && q.exam_eligibility==='not_approved' && q.independent_review==='NOT_CHECKED'))
assert.equal(new Set(extras.map(q=>q.section)).size, 7)
assert.equal(expanded.teaching_models_v2.length, 6)
assert.equal(expanded.quality_and_release_v2.public_reader_v2, 'NOT_PUBLISHED')
assert.equal(expanded.quality_and_release_v2.protected_exam_bank, 'NOT_CONNECTED')
console.log('PASS: v2 editorial candidate retains all canonical lesson identities, adds 63 checked-form practice prompts; no fake publication')
