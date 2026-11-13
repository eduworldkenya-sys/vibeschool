import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const manuscript = JSON.parse(read('../content/curriculum/grade4/mathematics/time.v1.json'))
const migration = read('../supabase/migrations/20261112114500_p1_published_outcome_delivery.sql')
const reader = read('../components/learn/Grade4TimeContentReader.tsx')
const shared = read('../components/learn/Grade4TimeOutcomePackage.tsx')
const map = read('../components/teacher/curriculum/Grade4MathematicsMap.jsx')
const scheme = read('../app/teacher/scheme/AuthoritySchemePage.jsx')
const notes = read('../app/teacher/lesson-notes/page.tsx')
const guide = read('../app/teacher/teacher-guide/page.tsx')
const teacher = read('../app/teacher/outcome-package/page.tsx')
const learner = read('../app/learn/grade-4/mathematics/time/outcome/[outcomeId]/page.tsx')

assert.equal(manuscript.package_id, 'VS-G04-MA-2.6-TIME-20261111')
assert.equal(manuscript.canonical.sub_strand_id, 'e975dcc6-32a9-4274-a2a3-3d19e409cf5c')
assert.equal(manuscript.lessons.length, 10)
assert.equal(manuscript.outcomes.length, 7)
const ids = new Set(manuscript.outcomes.flatMap(o => o.stable_outcome_ids))
assert.equal(ids.size, 9, 'Stable IDs include the two split curriculum concepts')
for (const lesson of manuscript.lessons) {
  assert.ok(lesson.canonical_outcome_ids.every(id => ids.has(id)))
  const questions = [...lesson.guided, ...lesson.independent, ...lesson.check]
  assert.ok(questions.length > 0)
  for (const question of questions) {
    assert.match(question.id, /^VS-G04-MA-TIME-L(0[1-9]|10)-(G|E|Q)[0-9]+$/)
    assert.ok(['guided', 'exercise', 'formative_check'].includes(question.kind))
    assert.ok(question.prompt && question.answer && question.explanation)
  }
}
for (const guarded of [
  'vs_public_grade4_math_time_learner_lessons()', 'vs_curriculum_alias_outcomes',
  'vs_curriculum_resource_aliases', 'vs_curriculum_package_gate',
  "v.lifecycle_status = 'certified'", "v.certified_at is not null",
  "v.rights_status in ('cleared', 'not_applicable')",
  "v.payload->>'source_edition' = 'learner'",
  "q.item->>'kind' in ('guided', 'exercise', 'formative_check')",
  "'formative_only'", "coalesce(q.item->>'visibility', 'learner_revealed') <> 'protected'",
  'revoke all on function public.vs_published_grade4_time_outcome(uuid)',
  'revoke all on function public.vs_published_grade4_time_practice(uuid)',
  'to anon, authenticated',
]) assert.ok(migration.includes(guarded), 'Missing P1 delivery boundary: ' + guarded)
assert.ok(!migration.includes('service_role;'), 'Never grant service_role to browsers')
assert.ok(!migration.includes('insert into public.assessment'), 'No assessment-bank clone')
assert.ok(!migration.includes('insert into public.student_outcome_mastery'), 'No fabricated mastery')
for (const line of ['class_id', 'timetable_slot_id', 'student_id', 'school_id']) {
  const rpcSection = migration.split('create or replace function public.vs_published_grade4_time_outcome')[1]
    .split('-- These questions were deliberately')[0]
  assert.ok(!rpcSection.includes(line), 'Public outcome reader cannot require ' + line)
}
assert.ok(reader.includes("supabase.rpc('vs_published_grade4_time_outcomes')"))
assert.ok(reader.includes('/learn/grade-4/mathematics/time/outcome/'))
assert.ok(shared.includes("supabase.rpc('vs_published_grade4_time_outcome'"))
assert.ok(shared.includes("supabase.rpc('vs_published_grade4_time_practice'"))
assert.ok(shared.includes('Revealing an answer does not record completion, marks or mastery.'))
assert.ok(shared.includes("audience === 'teacher'"))
assert.match(shared, /if \(audience === 'learner'\) return <main className=\{readerStyles\.page\}/,
  'Learner outcome routes must use the modern Grade 4 Time shell')
assert.match(shared, /<UniversalLearnReader[\s\S]*?<Grade4TimePracticeCards/,
  'Learner lessons must retain the universal sections and interactive published practice')
assert.match(shared, /aria-label="Choose another learning goal"/,
  'All learning goal links should stay inside the same reader experience')
assert.match(shared, /aria-label="Move between outcome lessons"/,
  'Previous and next lesson navigation must remain within the outcome')
assert.match(shared, /resource_version_id === row\.resource_version_id/,
  'A lesson chooser must use certified resource-version identity')
assert.match(shared, /audience === 'teacher'[\s\S]*?Certified teacher guidance/,
  'Do not remove the teacher preparation view')
assert.ok(learner.includes('audience="learner"'))
assert.ok(teacher.includes('audience="teacher"'))
assert.ok(map.includes('/teacher/outcome-package?outcomeId='))
assert.ok(scheme.includes("grade4Catalog['2.6']?.outcomes?.some"))
assert.ok(notes.includes('Open linked Time outcome package'))
assert.ok(guide.includes('Choose an exact Time outcome'))
console.log('PASS: P1 outcome delivery static contracts, stable identities, read-only formative eligibility, classless learner, timetable-free teacher access')
