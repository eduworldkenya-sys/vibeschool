import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const path='content/curriculum/production/grade4-mathematics-addition-1.2a.v1.editorial.json'
const doc=JSON.parse(readFileSync(path,'utf8'))
assert.equal(doc.status,'editorial_candidate_not_certified_not_published')
assert.equal(doc.curriculum.curriculumOutcomeId,null)
const known=new Set()
function pair(item){
 if(!Number.isInteger(item.operandA)||!Number.isInteger(item.operandB))return null
 return item.operandA+':'+item.operandB
}
for(const item of [...doc.learner.worked,...doc.learner.guided,...doc.learner.independent]){
 const p=pair(item)
 if(p)known.add(p)
}
function carries(a,b){
 let carried=0,count=0
 for(let i=0;i<4;i++){
  const value=Math.floor(a/10**i)%10+Math.floor(b/10**i)%10+carried
  carried=value>=10?1:0
  count+=carried
 }
 return count
}
const questions=doc.learner.formative
assert.equal(questions.length,5)
const seen=new Set()
for(const q of questions){
 const p=pair(q)
 assert.ok(p&&!known.has(p),'Formative question repeats already exposed material: '+q.id)
 assert.ok(!seen.has(p),'Duplicate formative question: '+q.id)
 seen.add(p)
 assert.equal(q.answer,q.operandA+q.operandB,'Wrong answer '+q.id)
 assert.equal(carries(q.operandA,q.operandB),1,'Not exactly one regrouping '+q.id)
 assert.ok(q.explanation.length>60 && q.mistakeFeedback.length>60,'Requires explanatory feedback')
 assert.ok(q.answer<=10000,'Outside sub-strand bound')
}
assert.match(doc.revision.recall.prompt,/without opening the worked example/)
const revision=doc.revision.recall.prompt.match(/([0-9,]+)\s*\+\s*([0-9,]+)/)
assert.ok(revision,'Revision prompt must contain an arithmetic task')
const a=Number(revision[1].replaceAll(',','')),b=Number(revision[2].replaceAll(',',''))
assert.ok(!known.has(a+':'+b) && !seen.has(a+':'+b),'Revision problem must be new')
assert.equal(carries(a,b),1)
assert.ok(doc.revision.recall.answer.includes((a+b).toLocaleString('en-US')))
console.log('PASS: 5 unseen formative sums + new revision recall, correct answers and exactly one regrouping, draft-only')
