import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Verify the lesson resource studio remains a pure renderer; canonical release
// checks still belong to the already-protected teaching library reader.
const reader = readFileSync('app/teacher/resources/read/[resourceId]/page.tsx', 'utf8')
const studio = readFileSync('components/learn/PlaceValueResourceStudio.tsx', 'utf8')
assert.match(reader, /eq\('status', 'active'\)/)
assert.match(reader, /eq\('visibility', 'public'\)/)
assert.match(reader, /eq\('lifecycle_status', 'certified'\)/)
assert.match(reader, /not\('certified_at', 'is', null\)/)
assert.match(reader, /isPlaceValueStudioPayload\(version.payload\)/)
assert.match(reader, /<PlaceValueResourceStudio payload=\{resource.interactivePayload\}/)

for (const id of [
  'place-value-chart', 'digital-abacus', 'grouping-and-exchange',
  'real-life-numbers', 'practice-game', 'learner-worksheet', 'teacher-presentation',
]) assert.ok(studio.includes(id), `Missing resource module: ${id}`)
assert.ok(studio.includes('aria-label'), 'Interactive controls need labels')
assert.ok(studio.includes('aria-live'), 'Feedback needs accessible announcement')
assert.ok(studio.includes('Math.min(9'), 'An abacus rod must not exceed nine beads')
assert.ok(studio.includes("filter(Boolean)"), 'Expanded form should omit zero-value terms')
assert.ok(studio.includes("Answers are not included"), 'Learner worksheet must not expose answers')
assert.ok(!studio.includes('dangerouslySetInnerHTML'), 'Do not render untrusted HTML')
assert.ok(!studio.includes('service_role'), 'Renderer must not use elevated credentials')

const placeValues = [10000, 1000, 100, 10, 1]
const digits = [3, 6, 4, 8, 2]
assert.equal(digits.reduce((sum, digit, i) => sum + digit * placeValues[i], 0), 36482)
assert.equal(digits[1] * placeValues[1], 6000)
assert.equal([2,4,9,0,7].reduce((sum, digit, i) => sum + digit * placeValues[i], 0), 24907)
assert.deepEqual([4,0,5,0,6].map((digit,i) => digit * placeValues[i]).filter(Boolean), [40000,500,6])
console.log('Grade 4 place-value resource studio contract: PASS')
