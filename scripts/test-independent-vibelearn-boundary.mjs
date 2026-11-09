import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync('app/student/vibelearn/page.tsx', 'utf8')
const middleware = readFileSync('middleware.ts', 'utf8')
const gradeLayout = readFileSync('app/student/vibelearn/layout.tsx', 'utf8')
const reading = readFileSync('app/student/vibelearn/reading/page.tsx', 'utf8')

assert.match(page, /if \(identity\.independent\) return <IndependentLearnHome \/>/,
  'independent learner must use separate Learn component')
assert.match(page, /return <SchoolVibeLearnWorkstation \/>/,
  'school learner must retain original workstation')
const schoolStart = page.indexOf('function SchoolVibeLearnWorkstation()')
const schoolRpc = page.indexOf('getVibeLearnWorkstation()', schoolStart)
assert.ok(schoolStart > 0 && schoolRpc > schoolStart,
  'school-only workstation calls must live in school component')
const independentReturn = page.indexOf('if (identity.independent) return <IndependentLearnHome />')
assert.ok(independentReturn < schoolStart, 'independent identity must be routed before school workstation mounts')
assert.match(gradeLayout, /identity\.independent \|\| pathname !== "\/student\/vibelearn"/, 'grade-specific layout must never mount school workstation for independent learners')
assert.match(middleware, /pathname === '\/student\/vibelearn\/reading'/,
  'published reader must be reachable for independent learners')
assert.match(reading, /\.eq\("status", "published"\)/,
  'reader must filter unpublished materials')
console.log('PASS independent learner bypasses school-only VibeLearn profile RPC')
console.log('PASS school learner retains original workstation')
console.log('PASS independent reading is publication-gated')
