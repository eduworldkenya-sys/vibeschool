const assert = require('node:assert/strict')
const path = process.argv[2]
if (!path) throw new Error('compiled lessonTiming module path required')
const { allocateLessonTiming, lessonTimingRanges, timeOriginalLessonSections, scheduledLessonMinutes, verifyScheduledLessonMinutes } = require(path)

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

const manuscript = {
  objectives: 'Explain the concept.',
  resources: 'Counters',
  introduction: 'Ask what learners know.',
  development: 'Demonstrate the method.\nTiming: Allow extra time when needed.',
  consolidation: 'Check understanding.',
  assessmentHook: 'Ask a question.',
  homework: 'Practise at home.',
  differentiation: 'Offer support.',
}
const initial = timeOriginalLessonSections(manuscript, 60)
const shortened = timeOriginalLessonSections(initial, 30)
assert.deepEqual(shortened, timeOriginalLessonSections(manuscript, 30))
assert.deepEqual(timeOriginalLessonSections(shortened, 30), shortened)
assert.deepEqual(timeOriginalLessonSections(shortened, 9), timeOriginalLessonSections(manuscript, 9))
const duplicate = {
  ...initial,
  introduction: 'Timing: 0–5 min (5 min).\n' + initial.introduction,
  assessmentHook: 'Timing: 52–60 min (8 min). Total lesson time: 60/60 min.\r\n' + initial.assessmentHook,
}
assert.deepEqual(timeOriginalLessonSections(duplicate, 35), timeOriginalLessonSections(manuscript, 35))
for (const key of ['objectives', 'resources', 'homework', 'differentiation']) {
  assert.equal(shortened[key], manuscript[key])
}
assert.ok(shortened.development.endsWith(manuscript.development))
assert.throws(() => timeOriginalLessonSections(manuscript, 0), /positive/)
assert.throws(() => timeOriginalLessonSections(manuscript, NaN), /positive/)
assert.deepEqual(manuscript.introduction, 'Ask what learners know.')
assert.equal(scheduledLessonMinutes('08:00', '08:35'), 35)
assert.equal(scheduledLessonMinutes('10:10:00', '10:19:00'), 9)
assert.equal(scheduledLessonMinutes('08:00:00.000', '08:30:00.000'), 30)
assert.equal(scheduledLessonMinutes('08:00:00', '08:30:29'), 30)
for (const [start, end] of [[null,'08:30'],['08:00',null],['25:00','26:00'],['08:61','09:00'],['08:00','08:00'],['09:00','08:00'],['08:00:00','08:00:30'],['bad','08:30']]) {
  assert.throws(() => scheduledLessonMinutes(start, end), /invalid duration/)
}
assert.equal(verifyScheduledLessonMinutes(35,35),35)
assert.throws(() => verifyScheduledLessonMinutes(60,35), /changed during preparation/)
assert.throws(() => verifyScheduledLessonMinutes(null,35), /changed during preparation/)
console.log('lesson timing contract: PASS')
