const assert = require('node:assert/strict')
const path = require('node:path')

const compiledPath = process.argv[2]
if (!compiledPath) throw new Error('compiled lessonTiming module path is required')

const {
  allocateLessonPhaseTiming,
  durationMinutesFromClock,
} = require(path.resolve(compiledPath))

for (const total of [1, 2, 3, 4, 5, 10, 20, 35, 40, 60, 80, 120]) {
  const result = allocateLessonPhaseTiming(total)
  const sum = result.introduction + result.development + result.assessment + result.consolidation
  assert.equal(sum, total, `phase sum for ${total}`)
  assert.equal(result.totalMinutes, total)
  assert.ok(result.introduction >= 0)
  assert.ok(result.development >= 0)
  assert.ok(result.assessment >= 0)
  assert.ok(result.consolidation >= 0)
}

assert.deepEqual(allocateLessonPhaseTiming(40), {
  totalMinutes: 40,
  introduction: 4,
  development: 24,
  assessment: 6,
  consolidation: 6,
})
assert.deepEqual(allocateLessonPhaseTiming(60), {
  totalMinutes: 60,
  introduction: 6,
  development: 36,
  assessment: 9,
  consolidation: 9,
})
assert.deepEqual(allocateLessonPhaseTiming(80), {
  totalMinutes: 80,
  introduction: 8,
  development: 48,
  assessment: 12,
  consolidation: 12,
})

assert.equal(durationMinutesFromClock('08:00', '08:40'), 40)
assert.equal(durationMinutesFromClock('08:00', '09:00'), 60)
assert.equal(durationMinutesFromClock('08:00', '09:20'), 80)
assert.equal(durationMinutesFromClock('08:00', '08:05'), 5)

console.log('lesson timing contract: PASS')
