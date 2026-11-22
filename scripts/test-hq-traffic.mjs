import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  normalizeTrafficPagePath, parseTrafficPeriod, parseTrafficCursor,
  parseTrafficSearch, kenyaDateKey, csvTrafficCell,
} from '../lib/hq/traffic-policy.ts'

const src = path => readFileSync(path, 'utf8')

test('records public, teacher, learner and HQ pages without recording APIs or sensitive URLs', () => {
  for (const pathname of ['/', '/learn', '/teacher', '/student/vibelearn/exams', '/hq', '/hq/traffic', '/parent']) {
    assert.equal(normalizeTrafficPagePath(pathname), pathname)
  }
  for (const invalid of ['/api', '/api/hq/visitors', '/_next/data', '//evil', '/learn?token=secret',
    '/reset#token', '/school/%40secret', '/school/user@domain.com', 'https://evil.example/']) {
    assert.equal(normalizeTrafficPagePath(invalid), null)
  }
  assert.equal(
    normalizeTrafficPagePath('/student/assignment/123e4567-e89b-12d3-a456-426614174000'),
    '/student/assignment/_id',
  )
  assert.equal(normalizeTrafficPagePath('/schools/1234567'), '/schools/_id')
  assert.equal(normalizeTrafficPagePath('/learn/ab1234567890abcdef12345678'), '/learn/_id')
  assert.equal(normalizeTrafficPagePath('/' + 'a'.repeat(1100)), null)
})

test('filter grammar rejects malformed traffic cursor and path', () => {
  assert.equal(parseTrafficPeriod(null), 7)
  assert.equal(parseTrafficPeriod('30'), 30)
  assert.equal(parseTrafficPeriod('90'), 90)
  assert.equal(parseTrafficPeriod('all'), 'all')
  assert.equal(parseTrafficPeriod('bad'), 7)
  for (const invalid of ['0', '-1', '1 or 1=1', '1234567890123456789']) {
    assert.equal(parseTrafficCursor(invalid), null)
  }
  assert.equal(parseTrafficCursor('6128'), '6128')
  assert.equal(parseTrafficSearch('/learn/grade-4'), '/learn/grade-4')
  for (const invalid of ['learn', '/learn?x=token', '/foo%bar', '123 OR 1=1']) {
    assert.equal(parseTrafficSearch(invalid), null)
  }
})

test('reports Kenyan calendar day, not UTC day', () => {
  assert.equal(kenyaDateKey('2026-11-21T22:30:00Z'), '2026-11-22')
  assert.equal(kenyaDateKey('2026-11-22T20:59:59Z'), '2026-11-22')
})

test('CSV escapes double quotes and rejects spreadsheet formula injection', () => {
  assert.equal(csvTrafficCell('normal/path'), '"normal/path"')
  assert.equal(csvTrafficCell('a"b'), '"a""b"')
  assert.equal(csvTrafficCell('=HYPERLINK("evil")'), '"\'=HYPERLINK(""evil"")"')
  assert.equal(csvTrafficCell(' -SUM(A1:A2)'), '"\' -SUM(A1:A2)"')
})

test('every ledger read and CSV is guarded by verified founder authority', () => {
  const api = src('app/api/hq/visitors/route.ts')
  const guard = api.indexOf('const access = await authorizedOwner(req)')
  const mode = api.indexOf("if (mode === 'visits' || mode === 'export')")
  assert.ok(guard > 0 && mode > guard, 'authorization precedes all read modes')
  assert.match(api, /auth\.getUser\(token\)/)
  assert.match(api, /rpc\('is_platform_owner'\)/)
  assert.match(api, /visitor_hash\.slice\(0, 12\)/)
  assert.match(api, /cache: 'no-store'|noStore/)
  assert.match(api, /query\.lt\('id', cursor\)/)
  assert.match(api, /X-Content-Type-Options.*nosniff/)
  assert.match(api, /CSV_LIMIT/)
  assert.match(api, /for \(let fetched = 0; fetched < SUMMARY_LIMIT; fetched \+= ROW_BATCH\)/)
  assert.match(api, /if \(beforeId\) query = query.lt\('id', beforeId\)/)
  assert.match(api, /allPages/)
  assert.match(api, /mode !== 'summary'/)
})

test('root tracking, HQ navigation and responsive visit ledger are wired without new public data grants', () => {
  const tracker = src('components/hq/VisitorTracker.tsx')
  const root = src('app/layout.tsx')
  const nav = src('components/hq/HQShell.tsx')
  const screen = src('app/hq/traffic/page.tsx')
  assert.match(root, /<VisitorTracker\s*\/>/)
  assert.match(tracker, /normalizeTrafficPagePath\(pathname\)/)
  assert.doesNotMatch(tracker, /pathname\.startsWith\('\/hq'\)/)
  assert.match(tracker, /previousPath\.current/)
  assert.match(nav, /\["Traffic","\/hq\/traffic"/)
  assert.match(screen, /'All visits'/)
  assert.match(screen, /summary\?\.allPages/)
  assert.match(screen, /nextCursor/)
  assert.match(screen, /Download CSV/)
  assert.match(screen, /repeatVisitors/)
  const paths = ['app/api/hq/visitors/route.ts', 'lib/hq/traffic-policy.ts', 'app/hq/traffic/page.tsx']
  for (const p of paths) {
    assert.doesNotMatch(src(p), /service_role.+grant|grant.+service_role/i)
  }
})
