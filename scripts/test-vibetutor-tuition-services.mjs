import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { TUITION_SERVICES, TUITION_AREA_ALLOCATIONS, findTuitionService } from '../components/vibetutor/tuitionServices.ts'
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
  assert.match(page, /Tutor to be confirmed/)
  assert.match(page, /post-request\?service=/)
  assert.doesNotMatch(page, /wa\.me|tel:|WhatsApp|Book now|Pay now/)
  assert.match(browse, /href="\/vibetutor\/tuition"/)
  assert.match(browse, /const tutorSource: DemoTutor\[\] = live\?\.tutors \?\? \[\]/)
  assert.match(request, /findTuitionService\(new URLSearchParams/)
  assert.match(request, /setMode\('online'\)/)
  assert.match(request, /REQUEST_AREAS\.map/)
})
