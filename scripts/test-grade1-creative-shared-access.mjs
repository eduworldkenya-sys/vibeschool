import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const shared = read('../components/learn/Grade1CreativeContentReader.tsx')
const teacherMap = read('../components/teacher/curriculum/Grade1CreativeActivitiesMap.tsx')
const publicRoute = read('../app/learn/grade-1/creative-activities/page.tsx')
const publicLearn = read('../app/learn/page.tsx')
const teacherSubject = read('../app/teacher/subjecthub/page.tsx')
const teacherResources = read('../app/teacher/resources/page.tsx')
const studentResources = read('../app/student/resources/page.tsx')
const accessPath = '/learn/grade-1/creative-activities'

// One source for 16 curriculum sub-strands; no forked, editorial or PDF data store.
assert.ok(shared.includes("from '@/components/teacher/curriculum/Grade1CreativeActivitiesMap'"))
assert.ok(shared.includes('GRADE1_CREATIVE_UNITS'))
assert.ok(shared.includes('GRADE1_CREATIVE_STRANDS'))
assert.ok(teacherMap.includes("VS-CUR-G01-CA-2026"))
assert.ok(publicRoute.includes('alternates: { canonical:'))
assert.ok(publicRoute.includes('<Grade1CreativeContentReader />'))
assert.ok(!shared.includes('service_role'), 'Do not bypass browser RLS to serve editorial content')

// Release safety: only learner-facing assets, active roots and certified immutable versions.
for (const fragment of [
  "supabase.auth.getUser()",
  ".eq('status', 'active')",
  ".eq('lifecycle_status', 'certified')",
  ".not('certified_at', 'is', null)",
  ".filter('asset_kind', 'in', '(learner_notes,worksheet)')",
  "root.asset_kind === 'learner_notes' || root.asset_kind === 'worksheet'",
  ".like('source_ref', 'VS-CUR-G01-CA-2026#%')",
  "root.sub_strand_id",
  "unitByStrand.get(root.sub_strand_id)",
]) assert.ok(shared.includes(fragment), 'Missing canonical safety condition: ' + fragment)

assert.ok(!shared.includes(".eq('lifecycle_status', 'candidate')"))
assert.ok(!shared.includes("'teacher_notes'"), 'Teacher-only manuscripts must never reach the shared learner reader')
assert.ok(shared.includes('editorial') || shared.includes('Draft manuscripts'))
assert.ok(shared.includes("view === 'teach'"))
assert.ok(shared.includes('Try these activities'))

// Discoverable from teacher/student/public user journeys, without a second content copy.
for (const [name, source] of [
  ['public Learn', publicLearn],
  ['teacher Subjects', teacherSubject],
  ['teacher Resources', teacherResources],
  ['student Study Room', studentResources],
]) {
  assert.ok(source.includes(accessPath), name + ' must reach the same shared address')
}
console.log('PASS: one shared Grade 1 Creative Activities reader, guarded canonical versions and four role entry points')
