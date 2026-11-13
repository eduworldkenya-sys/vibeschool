import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const shared = read('../components/learn/Grade1CreativeContentReader.tsx')
const teacherMap = read('../components/teacher/curriculum/Grade1CreativeActivitiesMap.tsx')
const publicRoute = read('../app/learn/grade-1/creative-activities/page.tsx')
const publicLearn = read('../app/learn/page.tsx')
const publicCatalogue = read('../lib/learn/schoolCatalog.ts')
const unifiedLearn = read('../components/learn/SchoolLearnLibrary.tsx')
const teacherSubject = read('../app/teacher/subjecthub/page.tsx')
const teacherResources = read('../app/teacher/resources/page.tsx')
const studentResources = read('../app/student/resources/page.tsx')
const studentVibeLearn = read('../app/student/vibelearn/layout.tsx')
const studentVibeLearnReader = read('../app/student/vibelearn/grade-1/creative-activities/page.tsx')
const accessPath = '/learn/grade-1/creative-activities'
const readerRpc = read('../supabase/migrations/20261111151000_grade1_ca_public_certified_reader.sql')
const middleware = read('../middleware.ts')
const teacherVibeLearn = read('../app/teacher/vibelearn/page.tsx')

// One source for 16 curriculum sub-strands; no forked, editorial or PDF data store.
assert.ok(shared.includes("from '@/components/teacher/curriculum/Grade1CreativeActivitiesMap'"))
assert.ok(shared.includes('GRADE1_CREATIVE_UNITS'))
assert.ok(shared.includes('GRADE1_CREATIVE_STRANDS'))
assert.ok(teacherMap.includes("VS-CUR-G01-CA-2026"))
assert.ok(publicRoute.includes('alternates: { canonical:'))
assert.ok(publicRoute.includes('<Grade1CreativeContentReader />'))
assert.ok(!shared.includes('service_role'), 'Do not bypass browser RLS to serve editorial content')
assert.ok(studentVibeLearn.includes('return <>{children}</>'), 'VibeLearn compatibility layout must preserve the guarded Grade 1 reader route')
assert.ok(publicCatalogue.includes(accessPath), 'Grade 1 reader must remain discoverable through unified Learn')
assert.ok(studentVibeLearnReader.includes('<Grade1CreativeContentReader />'), 'Student VibeLearn must reuse the shared read-only reader, not duplicate lessons')
assert.ok(!studentVibeLearnReader.includes('service_role') && !studentVibeLearnReader.includes('candidate'), 'Student route must not bypass resource certification')

// Public Originals reader never needs auth or service-role secrets.
assert.ok(shared.includes("supabase.rpc('vs_public_grade1_creative_learner_lessons')"))
assert.ok(!shared.includes('supabase.auth.getUser()'))
assert.ok(shared.includes('READY TO READ'))
// Teacher Find Learning must discover the *same* certified learner RPC and link
// to the same canonical reader, not create a vibelearn_content publication copy.
assert.ok(teacherVibeLearn.includes('supabase.rpc("vs_public_grade1_creative_learner_lessons")'))
assert.ok(teacherVibeLearn.includes('GRADE1_CREATIVE_UNITS'))
assert.ok(teacherVibeLearn.includes('VIBESCHOOL ORIGINALS · PUBLISHED LESSONS'))
assert.ok(teacherVibeLearn.includes('originalMatches.map'))
assert.ok(teacherVibeLearn.includes('/learn/grade-1/creative-activities?unit='))
assert.ok(shared.includes('new URLSearchParams(window.location.search).get("unit")'))
assert.ok(!teacherVibeLearn.includes('insert({ source_type: "platform_authored"'))

// Both the certified lesson body and the existing curriculum activities now
// use the same subject-aware frontend, without inventing certified tool payloads.
assert.ok(shared.includes("import UniversalLearnReader from '@/components/learn/UniversalLearnReader'"))
assert.equal((shared.match(/<UniversalLearnReader/g) ?? []).length, 2)
assert.ok(shared.includes("showTeachingTools={false}"))
assert.ok(shared.includes("title={activeLesson.title}"))
assert.ok(shared.includes("body: activeLesson.body"))
assert.ok(shared.includes("body: unit.experiences.map"))
assert.ok(!shared.includes('<VisualRichText'), 'Do not retain the legacy Grade 1 lesson renderer')
assert.ok(shared.includes('Next lesson'))
for (const fragment of [
  "security definer", "set search_path = ''",
  "r.owner_type = 'platform'", "r.source_type = 'platform_authored'",
  "r.grade = 'Grade 1'", "r.subject = 'Creative Activities'",
  "r.status = 'active'", "r.visibility = 'public'",
  "r.asset_kind in ('learner_notes','worksheet')",
  "r.canonical_key like 'vs:g1:%:learner:%'",
  "s.source_ref like 'VS-CUR-G01-CA-2026#%'",
  "v.lifecycle_status = 'certified'", "v.certified_at is not null",
  "v.payload->>'source_edition' = 'learner'",
  "public.fn_learning_resource_visible(r.id)",
  "to anon, authenticated",
]) assert.ok(readerRpc.includes(fragment), 'Missing strict public reader condition: ' + fragment)
assert.ok(!readerRpc.includes('service_role'))
assert.ok(middleware.includes("pathname === '/student/vibelearn/grade-1/creative-activities'"))
assert.ok(middleware.includes("reader.pathname = '/learn/grade-1/creative-activities'"))
assert.ok(middleware.includes("return NextResponse.redirect(reader, 307)"))
assert.ok(shared.includes("view === 'teach'"))
assert.ok(shared.includes('Try these activities'))

// Discoverable from teacher/student/public user journeys, without a second content copy.
assert.ok(publicLearn.includes('SchoolLearnLibrary'), 'Public Learn must mount the common grade-aware school library')
assert.ok(unifiedLearn.includes('readersForSubject'), 'Subject cards must resolve canonical shared readers')
for (const [name, source] of [
  ['public Learn catalogue', publicCatalogue],
  ['teacher Subjects', teacherSubject],
  ['teacher Resources', teacherResources],
  ['student Study Room', studentResources],
]) {
  assert.ok(source.includes(accessPath), name + ' must reach the same shared address')
}
console.log('PASS: one shared Grade 1 Creative Activities reader, guarded canonical versions and four role entry points')
