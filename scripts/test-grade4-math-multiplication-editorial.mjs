import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const d=JSON.parse(readFileSync('content/curriculum/production/grade4-math-multiplication-1.4-eight-lessons.v1.editorial.json','utf8'))
assert.equal(d.status,'DRAFT_NOT_IMPORTED_NOT_CERTIFIED_NOT_PUBLISHED')
assert.equal(d.source.approved,false)
assert.equal(d.source.sourceSha256,null)
assert.equal(d.lessons.length,8)
const ids=new Set()
const calc=(mode,a)=>mode==='product'?a[0]*a[1]:mode==='estimate'?Math.round(a[0]/10)*10*Math.round(a[1]/10)*10:a[1].map(k=>k*a[0])
const eq=(a,b)=>assert.deepEqual(a,b)
const codes={a:0,b:0,c:0,d:0,e:0}
for(let i=0;i<d.lessons.length;i++){
 const l=d.lessons[i]
 assert.equal(l.id,'VS-G04-MA-1.4-S'+String(i+1).padStart(2,'0'))
 assert.ok(!ids.has(l.id));ids.add(l.id)
 assert.equal(l.officialOutcomeId,null)
 assert.equal(l.publicationStatus,'EDITORIAL_CANDIDATE_ONLY')
 const letter=l.sourceOutcome.match(/^1\.4\(([a-e])\)$/)?.[1]
 assert.ok(letter);codes[letter]++
 assert.ok(l.goal.length>35&&l.explanation.length>50)
 assert.equal(l.worked.steps.length,3)
 assert.ok(l.guidedActivity.steps.length>=3)
 eq(l.worked.answer,calc(l.worked.mode,l.worked.operands))
 eq(l.independent.answer,calc(l.independent.mode,l.independent.operands))
 if(letter==='c'){assert.ok(l.worked.answer<=1000&&l.independent.answer<=1000)}
 if(letter==='d'){assert.ok(l.worked.answer.every(x=>x<=100)&&l.independent.answer.every(x=>x<=100))}
 assert.ok(l.remedial.length>30&&l.teacher.length>30&&l.visual.brief.length>20)
}
eq(codes,{a:2,b:2,c:1,d:2,e:1})
console.log('PASS: 8 original multiplication lesson drafts, 16 calculated examples/checks, source caps and no fake publishing')
