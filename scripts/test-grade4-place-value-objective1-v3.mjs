import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Editorial candidate regression: never treat this file as a released chapter.
// Separate private teacher notes/marking must not enter public learner markdown.
const text=readFileSync('content/curriculum/production/grade4-mathematics-whole-numbers-objective1.v3.learner.md','utf8')
const canonical=JSON.parse(readFileSync('content/curriculum/production/grade4-mathematics-whole-numbers-1.1.v2.editorial.json','utf8'))
assert.equal(canonical.status,'EDITORIAL_CANDIDATE_ONLY_NOT_IMPORTED_NOT_PUBLISHED')
assert.equal(canonical.reader.find(r=>r.id==='WN-01').sourceOutcomeCodes[0],'G4-MATH-1.1-a')
assert.match(text,/Our learning goal:\*\* Explain the place value and total value of digits through ten-thousands/)
for(const part of ['Discover:','groups of ten','place-value chart','Worked example 1','Worked example 2','Worked example 3','Worked example 4','Try it together','Build confidence','Apply the idea','Think more deeply','common mistakes','Mastery check','At home or with a friend'])
  assert.ok(text.includes(part),'Missing pedagogy element: '+part)
for(let n=1;n<=15;n++)assert.ok(text.includes('\n'+n+'. '),'Missing differentiated practice item '+n)
for(let n=1;n<=6;n++)assert.ok(text.includes('**M'+n+' ('),'Missing mastery check '+n)
assert.ok(!/\bKICD\b|sourceOutcomeCodes|\bUUID\b|answer key|editorial separation|vibeschool\.originals\.editorial/i.test(text),
  'No authority/backend status or protected marking keys in learner-facing copy')
for(const entry of [
  [24907,[2,4,9,0,7]], [36482,[3,6,4,8,2]], [40506,[4,0,5,0,6]],
  [50505,[5,0,5,0,5]], [30742,[3,0,7,4,2]], [12504,[1,2,5,0,4]]
]){
  const [number,digits]=entry
  assert.equal(digits.reduce((sum,digit,index)=>sum+digit*[10000,1000,100,10,1][index],0),number)
}
assert.equal(24987-24907,80)
assert.equal(15204-12504,2700)
console.log('Grade 4 objective-one upgraded manuscript: editorial and arithmetic checks passed (not certification)')
