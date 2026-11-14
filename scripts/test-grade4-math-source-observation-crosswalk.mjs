import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const data=JSON.parse(readFileSync('content/curriculum/production/grade4-math-numbers-source-crosswalk.v1.observed.json','utf8'))
assert.equal(data.status,'SOURCE_TEXT_OBSERVED_NOT_REGISTERED_NOT_PROMOTED')
assert.equal(data.source.url,'https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf')
for(const key of ['contentSha256','privateArtifactStorageLocator','approvedSourceId','approvedSnapshotId'])assert.equal(data.source[key],null)
assert.equal(data.outcomes.length,10)
const all=new Set()
for(const unit of ['1.2','1.3']){
 const outcomes=data.outcomes.filter(x=>x.unit===unit)
 assert.deepEqual(outcomes.map(x=>x.sourceOutcomeOrdinal),['a','b','c','d','e'])
 assert.equal(data.scope.subStrands.find(x=>x.unit===unit).suggestedLessons,8)
 const numbers=[]
 for(const o of outcomes){
  assert.equal(o.canonicalOutcomeId,null)
  assert.equal(o.sourcePromotion,'NOT_VERIFIED_OR_PROMOTED')
  assert.ok(o.outcomeIntentOriginalParaphrase.length>40)
  assert.match(o.sourceLocator,/printed pp\./)
  for(const lessonId of o.editorialLessonIds){
   assert.ok(!all.has(lessonId),'duplicate lesson: '+lessonId)
   all.add(lessonId)
   const m=lessonId.match(/-S(\d\d)$/)
   assert.ok(m)
   numbers.push(Number(m[1]))
  }
 }
 assert.deepEqual(numbers.slice().sort((a,b)=>a-b),[1,2,3,4,5,6,7,8])
}
assert.equal(all.size,16)
console.log('PASS: ten source-scoped outcomes covering 16 distinct lesson editorial candidates; no fabricated authority or publication claims')
