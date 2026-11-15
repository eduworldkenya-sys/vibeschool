import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const path='content/curriculum/production/grade4-mathematics-subtraction-1.3a-e.v1.editorial.json'
const doc=JSON.parse(readFileSync(path,'utf8'))
assert.equal(doc.status,'EDITORIAL_CANDIDATE_ONLY_NOT_IN_CONTENT_ENGINE')
assert.equal(doc.packets.length,5)
assert.deepEqual(doc.packets.map(p=>p.outcome),['1.3(a)','1.3(b)','1.3(c)','1.3(d)','1.3(e)'])
const allIds=new Set()
const subtract=(a,b)=>a-b
const estimate=(a,b)=>Math.round(a/10)*10-Math.round(b/10)*10
let checked=0
for(const p of doc.packets){
 assert.equal(p.canonicalOutcomeId,null,'Never invent a promoted outcome ID')
 assert.equal(p.status,'EDITORIAL_DRAFT_NOT_CERTIFIED_NOT_PUBLISHED')
 assert.equal(p.source.url,'https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf')
 assert.equal(p.checks.length,5)
 assert.equal(p.independent.length,3)
 assert.ok(p.worked.steps.length>=4)
 assert.ok(p.activity.steps.length>=3&&p.revision&&p.teacher&&p.visual)
 for(const q of [...p.guided,...p.independent,...p.checks]){
  assert.ok(!allIds.has(q.id),'Duplicate question ID '+q.id)
  allIds.add(q.id)
  assert.ok(q.explanation&&q.correctFeedback&&q.incorrectFeedback)
  if(q.operands){
   const {minuend,subtrahend,kind}=q.operands
   assert.ok(Number.isInteger(minuend)&&Number.isInteger(subtrahend)&&minuend>=subtrahend)
   const calc=kind==='rounded_estimate'?estimate(minuend,subtrahend):subtract(minuend,subtrahend)
   assert.equal(q.answer,calc,'Wrong answer for '+q.id)
   checked++
  }else assert.equal(p.outcome,'1.3(d)','Numeric question lacks operand metadata')
 }
 const first=p.checks[0]
 assert.notEqual(first.prompt,p.worked.prompt,'Independent check cannot reuse the worked wording')
 assert.notEqual(JSON.stringify(first.answer),JSON.stringify(p.worked.answer),'First check should not reuse worked answer')
 if(first.operands && Number.isInteger(p.worked.minuend)){
  assert.ok(first.operands.minuend!==p.worked.minuend || first.operands.subtrahend!==p.worked.subtrahend,
    'First check must not repeat model operands')
 }
 const feedback=first.incorrectFeedback.toLowerCase()
 if(p.outcome==='1.3(c)')assert.match(feedback,/round/)
 if(p.outcome==='1.3(d)')assert.match(feedback,/pattern|step|term/)
 if(p.outcome==='1.3(e)')assert.match(feedback,/remainder/)
 if(Number.isInteger(p.worked.minuend)){
  assert.equal(subtract(p.worked.minuend,p.worked.subtrahend),p.worked.answer)
  if(p.worked.estimate!==undefined) assert.equal(estimate(p.worked.minuend,p.worked.subtrahend),p.worked.estimate)
  checked++
 }
}
const pattern=doc.packets[3]
for(const [i,value] of pattern.worked.answer.entries())assert.equal(value,pattern.worked.start-i*pattern.worked.step)
assert.deepEqual(pattern.independent.map(x=>x.answer),[[8250,8000,7750],[4550,4450],[4500,4000,3500]])
assert.deepEqual(pattern.checks.map(x=>x.answer),[[6850,6600],[5800,5600],250,[4550,4450],3000])
console.log('PASS: Grade 4 Subtraction: five separate draft outcomes, 25 checks, 15 independent tasks; '+checked+' arithmetic validations; draft authority preserved.')
