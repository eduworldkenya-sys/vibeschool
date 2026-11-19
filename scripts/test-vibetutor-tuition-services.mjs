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
  assert.match(page, /redirect\('\/vibetutor\/browse'\)/)
  assert.match(browse, /href="\/vibetutor\/post-request"/)
  assert.doesNotMatch(page, /wa\.me|tel:|WhatsApp|Book now|Pay now/)
  assert.doesNotMatch(browse, /href="\/vibetutor\/tuition"/)
  assert.match(browse, /\[\.\.\.live\.tutors, \.\.\.KENYA_DEMO_TUTORS\]/)
  assert.match(request, /findTuitionService\(new URLSearchParams/)
  assert.match(request, /setMode\('online'\)/)
  assert.match(request, /REQUEST_AREAS\.map/)
})

import { KENYA_DEMO_TUTORS, KENYA_DEMO_COVERAGE } from '../components/vibetutor/kenya-demo-tutors.ts'

test('150 named fictional examples, exact geography, no real contact or booking', () => {
  assert.equal(KENYA_DEMO_TUTORS.length, 150)
  assert.equal(new Set(KENYA_DEMO_TUTORS.map(t => t.id)).size, 150)
  assert.equal(new Set(KENYA_DEMO_TUTORS.map(t => t.name)).size, 150)
  const femaleNames = new Set(['Amina','Faith','Grace','Mary','Lucy','Mercy','Esther','Jane','Wanjiku','Ann'])
  assert.equal(KENYA_DEMO_TUTORS.filter(t => femaleNames.has(t.name.split(' ')[0])).length, 75)
  for (const [area, count] of KENYA_DEMO_COVERAGE) {
    assert.equal(KENYA_DEMO_TUTORS.filter(t => t.area === area).length, count)
  }
  for (const t of KENYA_DEMO_TUTORS) {
    assert.equal(t.real, false)
    assert.equal(t.mode, 'online')
    assert.deepEqual(t.days, [])
    assert.equal('phone' in t, false)
    assert.equal('whatsapp' in t, false)
    assert.match(t.bio, /Fictional example/)
    assert.ok(t.levels.every(level => t.subjects.every(subject => SUBJECTS_BY_LEVEL[level]?.includes(subject))))
  }
  const cards = readFileSync('components/vibetutor/Cards.tsx', 'utf8')
  const browse = readFileSync('app/vibetutor/browse/BrowseClient.tsx', 'utf8')
  assert.ok(cards.includes("{t.real && <Link href=\"/login\" className={styles.modalSignIn}>Sign in to contact</Link>}"))
  assert.ok(cards.includes('not bookable'))
  assert.ok(browse.includes('registered tutor listings'))
  assert.ok(browse.includes('fictional examples'))
  assert.ok(browse.includes('Fictional profiles and sample prices'))
})
