import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = p => fs.readFileSync(p, 'utf8')
const layout = read('app/teacher/layout.tsx')
const marking = read('app/teacher/assessment/marking/page.tsx')
const results = read('app/teacher/results/page.tsx')
const marks = read('components/teacher/ProfessionalMarkbook.tsx')
const classResults = read('app/teacher/assessment/gradebook/page.tsx')
const analytics = read('app/teacher/assessment/analytics/page.tsx')
const pulse = read('components/teacher/AssessmentPulseCard.tsx')

assert.match(layout, /Mark Submitted Work/)
assert.match(layout, /Class Results/)
assert.match(layout, /Results Analysis/)
assert.doesNotMatch(layout, /label: "Gradebook"/)
assert.doesNotMatch(layout, /label: "Marking"/)

assert.match(marking, />Mark Submitted Work</)
assert.match(marking, /Work waiting to be marked/)
assert.match(marking, /Finish marking/)
assert.match(marking, /Finish & share result/)
assert.match(marking, /Ask for mark review/)
assert.doesNotMatch(marking, />Marking Centre</)

assert.match(classResults, />Class Results</)
assert.doesNotMatch(classResults, />Unified Gradebook</)
assert.match(analytics, />Results Analysis</)
assert.doesNotMatch(analytics, />Teacher Analytics</)

assert.match(results, /Change exam \/ class \/ subject/)
assert.match(results, /Change exam details/)
assert.match(results, /Use this mark sheet/)
assert.match(results, /marks entered/)
assert.doesNotMatch(results, /classes\.map\(\(c,i\)=>.*style=\{pill/s)

assert.match(marks, /Enter marks/)
assert.match(marks, /mobile-list/)
assert.match(marks, /@media \(max-width: 720px\)/)
assert.match(marks, /Mark absent/)
assert.match(marks, /Clear absence/)
assert.match(marks, /View learner report/)
assert.match(marks, />⋯</)
assert.doesNotMatch(marks, />ABS<\/button>/)
assert.match(pulse, /Mark submitted work/)
assert.match(pulse, /Class Results/)

console.log('teacher exam language + mobile UX contract: PASS')
