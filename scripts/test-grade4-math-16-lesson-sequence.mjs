import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source='content/curriculum/production/grade4-mathematics-addition-subtraction-16-lesson-sequence.v1.editorial.json'
const doc=JSON.parse(readFileSync(source,'utf8'))
assert.equal(doc.status,'EDITORIAL_ONLY_NOT_CERTIFIED_NOT_PUBLISHED')
assert.equal(doc.lessons.length,16)
assert.equal(new Set(doc.lessons.map(l=>l.id)).size,16)
assert.deepEqual(doc.reusedCandidatePRs.map(r=>r.pr),[1698,1693,1694])
const nRound=x=>Math.round(x/10)*10
function calculate(item){
 switch(item.operator){
 case '+': return item.a+item.b
 case '-': return item.a-item.b
 case 'estimated_sum_nearest_ten': return nRound(item.a)+nRound(item.b)
 case 'estimated_difference_nearest_ten': return nRound(item.a)-nRound(item.b)
 case 'increasing_pattern': return Array.from({length:item.count},(_,i)=>item.start+i*item.step)
 case 'decreasing_pattern': return Array.from({length:item.count},(_,i)=>item.start-i*item.step)
 default: throw Error('Unsupported math kind '+item.operator)
 }
}
for (const [unit,expected] of [['1.2',8],['1.3',8]]){
 const filtered=doc.lessons.filter(l=>l.subStrand===(unit==='1.2'?'Addition':'Subtraction'))
 assert.equal(filtered.length,expected)
 assert.deepEqual(filtered.map(l=>l.sequence),[1,2,3,4,5,6,7,8])
 assert.deepEqual(new Set(filtered.map(l=>l.sourceOutcome)).size,5)
}
let checked=0
for(const lesson of doc.lessons){
 assert.equal(lesson.canonicalOutcomeId,null,'Never invent authority identifiers')
 assert.equal(lesson.releaseState,'editorial_candidate_not_certified_or_published')
 assert.ok(lesson.model.why.length>40&&lesson.goal.length>20)
 assert.ok(lesson.guidedActivity.length===2&&lesson.exitCheck.reason.length>20)
 assert.ok(lesson.teacherPrompt.length>20&&lesson.misconceptionRepair.length>20)
 assert.ok(lesson.delivery.accessibility.length>20)
 for(const item of [lesson.model,lesson.exitCheck]){
  assert.deepEqual(item.answer,calculate(item),lesson.id+' calculation')
  if(Number.isInteger(item.exact)){
   assert.equal(item.exact,item.operator==='estimated_sum_nearest_ten'?item.a+item.b:item.a-item.b)
  }
  checked++
 }
}
assert.equal(checked,32)
console.log('PASS: 16 distinct Grade 4 Mathematics lesson sequences; 32 numerical/sequence assertions; editorial-only authority enforced')
