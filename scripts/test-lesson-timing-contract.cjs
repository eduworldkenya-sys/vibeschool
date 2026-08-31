const assert = require('node:assert/strict')
const path = process.argv[2]
if (!path) throw new Error('compiled lessonTiming module path required')
const { allocateLessonTiming, lessonTimingRanges } = require(path)

for (const total of [1,2,3,4,5,10,15,20,30,35,40,45,60,80,120]) {
  const timing = allocateLessonTiming(total)
  assert.equal(timing.total, total, `total preserved for ${total}`)
  assert.equal(
    timing.introduction + timing.development + timing.consolidation + timing.assessment,
    total,
    `phases sum exactly for ${total}`,
  )
  for (const [name, value] of Object.entries(timing)) {
    if (name === 'total') continue
    assert.ok(value >= 0, `${name} nonnegative for ${total}`)
  }
  if (total > 4) {
    assert.ok(timing.introduction >= 1)
    assert.ok(timing.development >= 1)
    assert.ok(timing.consolidation >= 1)
    assert.ok(timing.assessment >= 1)
  }

  const ranges = lessonTimingRanges(timing)
  assert.equal(ranges.introduction, `0–${timing.introduction} min`)
  assert.ok(ranges.assessment.endsWith(`–${total} min`), `final range ends at exact total ${total}`)
}

console.log('lesson timing contract: PASS')
