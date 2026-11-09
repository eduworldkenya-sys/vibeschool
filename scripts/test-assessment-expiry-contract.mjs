import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const runner = readFileSync('app/student/assessment/[assignmentId]/page.tsx', 'utf8')
assert.match(runner, /const existing = inFlightSaves\.current\[item\.id\][\s\S]*?if \(existing\) return existing[\s\S]*?secondsLeft === 0/, 'Await existing saves before blocking post-deadline writes')
assert.match(runner, /if \(expired\) \{[\s\S]*?Promise\.allSettled\(Object\.values\(inFlightSaves\.current\)\)/, 'Wait for pre-expiry writes before finalising')
assert.match(runner, /submissionInFlightRef\.current = true/, 'Prevent concurrent submits')
assert.match(runner, /automaticExpiryAttemptedRef\.current = true/, 'Prevent repeated automatic expiry submit')
assert.match(runner, /Retry finalising attempt/, 'Expose manual retry after expiry error')
assert.match(runner, /const skipped = !deadlineReached/, 'Do not claim local-only answers were scored')
assert.match(runner, /const deadlineReached = expired \|\|/, 'A manual submission must respect expired server deadlines')
console.log('Assessment expiry and in-flight save contracts: PASS')
