import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { eligibleRoom } from '../components/live-classroom/LiveNoticePolicy.ts'

const room = {
  id: 'c4b09c16-e9bd-4aa4-8b48-29ad4bbd4e93',
  title: 'Grade 4 Mathematics',
  mode: 'school',
  status: 'active',
  own: false,
  canJoin: true,
}
assert.equal(eligibleRoom(room), true, 'The authorized active lesson should be shown')

const rejected = [
  null, undefined, '', [], {},
  { ...room, canJoin: false }, // discovery is not admission
  { ...room, own: true }, // cannot show own teacher sessions as learner invites
  { ...room, status: 'paused' },
  { ...room, status: 'ended' },
  { ...room, id: 'other-learner' },
  { ...room, id: 'https://example.com' },
  { ...room, mode: 'private-unknown' },
  { ...room, title: '' },
  { ...room, title: 'a'.repeat(121) },
]
for (const invalid of rejected) assert.equal(eligibleRoom(invalid), false, 'Fail-closed display policy: ' + JSON.stringify(invalid))

const home = readFileSync(new URL('../app/student/page.tsx', import.meta.url), 'utf8')
const notice = readFileSync(new URL('../components/live-classroom/LiveLearnerNotice.tsx', import.meta.url), 'utf8')
assert.match(home, /<LiveLearnerNotice studentId=\{identity.studentId\}/, 'The signed-in learner Home must render the alert')
assert.match(notice, /p_action: 'list'/, 'Only the existing scoped Live discovery command is allowed')
assert.match(notice, /p_payload: \{ host: false \}/, 'Learner discovery must not claim teacher authority')
assert.match(notice, /document.visibilityState === 'hidden'/, 'Do not poll a backgrounded mobile tab')
assert.match(notice, /navigator.onLine/, 'Do not query while offline')
assert.match(notice, /if \(cancelled\) return/, 'Late responses must not update another learner view')
console.log('PASS: in-app Live notice admission filtering and home wiring')
