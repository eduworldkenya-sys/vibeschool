import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { TUITION_SERVICES, PUBLIC_TUITION_SERVICES, LOWER_PRIMARY_SERVICES, TUITION_AREA_ALLOCATIONS, findTuitionService } from '../components/vibetutor/tuitionServices.ts'
import { SUBJECTS_BY_LEVEL } from '../components/vibetutor/data.ts'

test('150 distinct service categories follow all 19 area quotas and canonical subjects', () => {
  assert.equal(TUITION_SERVICES.length, 150)
  assert.equal(TUITION_AREA_ALLOCATIONS.length, 19)
  assert.equal(new Set(TUITION_SERVICES.map(s => s.id)).size, 150)
  assert.equal(new Set(TUITION_SERVICES.map(s => JSON.stringify([s.area, s.level, s.subjects]))).size, 150)
  for (const [area, count] of TUITION_AREA_ALLOCATIONS) {
    assert.equal(TUITION_SERVICES.filter(s => s.area === area).length, count)
  }
  for (const service of TUITION_SERVICES) {
    assert.ok(service.subjects.every(subject => SUBJECTS_BY_LEVEL[service.level]?.includes(subject)))
    assert.deepEqual(findTuitionService(service.id), service)
    assert.deepEqual(Object.keys(service).sort(), ['area', 'id', 'level', 'subjects'])
  }
  assert.equal(findTuitionService(null), undefined)
  assert.equal(findTuitionService('invalid'), undefined)
})

test('tuition catalogue requests only; existing registered tutor identities remain separate', () => {
  const page = readFileSync('app/vibetutor/tuition/page.tsx', 'utf8')
  const browse = readFileSync('app/vibetutor/browse/BrowseClient.tsx', 'utf8')
  const request = readFileSync('app/vibetutor/post-request/page.tsx', 'utf8')
  assert.match(page, /redirect\('\/vibetutor\/browse'\)/)
  assert.match(browse, /href="\/vibetutor\/post-request"/)
  assert.doesNotMatch(page, /wa\.me|tel:|WhatsApp|Book now|Pay now/)
  assert.doesNotMatch(browse, /href="\/vibetutor\/tuition"/)
  assert.doesNotMatch(browse, /KENYA_DEMO_TUTORS/)
  assert.match(browse, /live\?\.tutors \?\? \[\]/)
  // Service categories remain selectable when posting a request, not as tutor identities.
  assert.doesNotMatch(browse, /post-request\\?service=|PUBLIC_TUITION_SERVICES|services\\.slice|Tuition requests by subject/)
  assert.match(browse, /tutors\\.map\\(tutor => <TutorCard/)
  assert.match(request, /findTuitionService\(query.get\('service'\)\)/)
  assert.match(request, /setMode\('online'\)/)
  assert.match(request, /REQUEST_AREAS\.map/)
})

test('fictional tutor sources and prefill are absent', () => {
  const post = readFileSync('app/vibetutor/post-request/page.tsx', 'utf8')
  const data = readFileSync('components/vibetutor/data.ts', 'utf8')
  const cards = readFileSync('components/vibetutor/Cards.tsx', 'utf8')
  assert.doesNotMatch(post, /findExampleTuitionNeeds|kenya-demo-tutors/)
  assert.doesNotMatch(data, /export const DEMO_TUTORS/)
  assert.doesNotMatch(cards, /post-request\?example=/)
})

test('lower primary is available as request categories, not tutor identities', () => {
  assert.equal(LOWER_PRIMARY_SERVICES.length, TUITION_AREA_ALLOCATIONS.length * SUBJECTS_BY_LEVEL['Grade 1–3'].length)
  assert.equal(new Set(PUBLIC_TUITION_SERVICES.map(s => s.id)).size, PUBLIC_TUITION_SERVICES.length)
  for (const s of LOWER_PRIMARY_SERVICES) {
    assert.equal(s.level, 'Grade 1–3')
    assert.ok(s.subjects.every(subject => SUBJECTS_BY_LEVEL[s.level].includes(subject)))
    assert.deepEqual(findTuitionService(s.id), s)
    assert.deepEqual(Object.keys(s).sort(), ['area', 'id', 'level', 'subjects'])
  }
})
