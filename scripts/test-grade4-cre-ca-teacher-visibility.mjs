import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const map = readFileSync('components/teacher/curriculum/Grade4CreCaMap.jsx', 'utf8')
const scheme = readFileSync('app/teacher/scheme/AuthoritySchemePage.jsx', 'utf8')
const hub = readFileSync('app/teacher/subjecthub/page.tsx', 'utf8')

test('Grade 4 CRE and Creative Arts use the existing canonical subject identities', () => {
  assert.match(map, /8165d513-035b-4019-9fdb-5b86a27335a1/)
  assert.match(map, /6d68b57c-565d-4a04-879d-c77f588d6404/)
  assert.match(map, /resolveGlobalSubjectId\(subjectId\)/)
  assert.match(map, /\.eq\('grade', 'Grade 4'\)/)
  assert.match(map, /belongsToSource\(row, source\.source, kind\)/)
})

test('teacher views use active source-linked outcomes rather than draft material', () => {
  assert.match(map, /\.eq\('status', 'active'\)/)
  assert.match(map, /\.eq\('source_type', source\.outcomeSource\)/)
  assert.match(map, /owner-approved:grade4-cre:2026-11-22/)
  assert.match(map, /owner-paraphrase-2026-11-22/)
  assert.match(map, /are alternatives, not two compulsory units/)
})

test('Curriculum Map and Scheme display the same canonical reference without creating a scheme', () => {
  assert.match(scheme, /isGrade4CRE/)
  assert.match(scheme, /isGrade4CreativeArts/)
  assert.match(scheme, /<Grade4CreCaMap/)
  assert.match(scheme, /mode=\{curriculumView \? 'curriculum' : 'scheme'\}/)
  assert.match(scheme, /isGrade9English\|\|isGrade4CRE\|\|isGrade4CreativeArts/)
  assert.doesNotMatch(map, /\.from\('scheme_of_work'\)|\.insert\(|\.update\(|SERVICE_ROLE_KEY/)
  assert.match(map, /does not create or schedule a lesson/)
})

test('teacher subject hub links Grade 4 CRE and Creative Arts to the existing map', () => {
  assert.match(hub, /const grade4CreCaClass/)
  assert.match(hub, /creative arts and sports/)
  assert.match(hub, /christian religious education/)
  assert.match(hub, /\/teacher\/curriculum\?classId=/)
})
