import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { buildLearningToolContext, getLearningToolSectionBinding, buildCertifiedTeacherToolContexts } from '../lib/learn/teachingToolContentBridge.mjs'

const A='123e4567-e89b-42d3-a456-426614174000'
const B='123e4567-e89b-42d3-a456-426614174001'
const C='123e4567-e89b-42d3-a456-426614174002'
const read = file => readFileSync(new URL(file,import.meta.url),'utf8')
const sections=[
 {id:'understand',title:'Learn',tone:'learn',body:'One hour is 60 minutes. [visual:'+C+']'},
 {id:'example',title:'Worked example',tone:'example',body:'1. Convert the hours.\n2. Add the minutes.'},
 {id:'feedback',title:'Answers',tone:'feedback',body:'Answer: 123'},
]
const input={sourceKind:'published_outcome',audience:'learner',subject:'Mathematics',grade:'Grade 4',
 resourceId:A,resourceVersionId:B,outcomeId:C,sections}

test('links exact published identities, real text and existing visual placeholders without inventing assets',()=>{
 const context=buildLearningToolContext(input)
 assert.equal(context.bindings.length,2)
 assert.equal(context.bindings[0].body,sections[0].body)
 assert.equal(context.bindings[1].slot,'worked_example')
 assert.deepEqual(context.bindings[0].visualPlaceholders,[C])
 assert.equal(context.bindings[0].resourceVersionId,B)
 assert.equal(context.outcomeId,C)
 assert.equal(context.bindings.some(b=>b.body.includes('Answer: 123')),false)
 assert.ok(Object.isFrozen(context.bindings))
 assert.ok(Object.isFrozen(context.bindings[0]))
 assert.equal(getLearningToolSectionBinding(context,sections[1],1)?.slot,'worked_example')
 assert.equal(getLearningToolSectionBinding(context,{...sections[1],body:'another lesson'},1),null)
})
test('preserves original reader order when empty sections occur',()=>{
 const c=buildLearningToolContext({...input,sections:[{id:'empty',title:'',body:''},...sections]})
 assert.equal(c.bindings[0].sectionIndex,0)
 assert.equal(c.bindings[1].sectionIndex,1)
})
test('fails closed for invalid IDs, unsourced payloads and learner access to scheme-only content',()=>{
 assert.throws(()=>buildLearningToolContext({...input,resourceVersionId:'not-an-id'}),/invalid resource version ID/)
 assert.throws(()=>buildLearningToolContext({...input,sourceKind:'certified_scheme'}),/boundary violated/)
 assert.throws(()=>buildLearningToolContext({...input,sourceKind:'published_outcome',resourceId:null}),/pinned identities/)
 assert.throws(()=>buildLearningToolContext({...input,sections:null}),/sections must come/)
 assert.equal(buildLearningToolContext({...input,sourceKind:'published_lesson',outcomeId:null,resourceId:null,sections:[]}).bindings.length,0)
})
test('does not introduce alternative data authorities or expose feedback to interactive tools',()=>{
 const bridge=read('../lib/learn/teachingToolContentBridge.mjs')
 const reader=read('../components/learn/UniversalLearnReader.tsx')
 const full=read('../components/learn/Grade4TimeContentReader.tsx')
 const outcome=read('../components/learn/Grade4TimeOutcomePackage.tsx')
 for (const forbidden of ['supabase.', 'localStorage', 'fetch(', 'assessment_questions', 'service_role', 'insert(']) {
  assert.ok(!bridge.includes(forbidden),'unexpected side effect '+forbidden)
 }
 assert.match(reader,/getLearningToolSectionBinding/)
 assert.match(full,/buildLearningToolContext/)
 assert.match(outcome,/buildLearningToolContext/)
 assert.match(full,/vs_public_grade4_math_time_learner_lessons/)
 assert.match(outcome,/vs_published_grade4_time_outcome/)
 assert.match(outcome,/audience === 'teacher'/)
})

test('teacher-side Scheme and curriculum sources reuse certified canonical payload versions',()=>{
 const asset={resourceId:A,resourceVersionId:B,assetKind:'learner_notes',
  certifiedAt:'2026-11-13T00:00:00Z',certificationPolicyVersion:'v1',
  contentSha256:'abc',payload:{
   sections:[{id:'example',title:'Observe',body:'Watch the same water in a glass.',tone:'explore'},
    {id:'feedback',title:'Answer key',body:'Teacher-only response',tone:'feedback'}],
   teacher_guidance:{private:'Do not expose this to learners'},
  }}
 const linked=buildCertifiedTeacherToolContexts({subject:'Science',grade:'Grade 8',schemeLessonId:C,curriculumId:'actual-curriculum-id',subStrandId:'actual-substrand-id',assets:[asset]})
 assert.equal(linked.length,1)
 assert.equal(linked[0].sourceKind,'certified_scheme')
 assert.equal(linked[0].schemeLessonId,C)
 assert.equal(linked[0].bindings.length,1)
 assert.equal(linked[0].bindings[0].body,'Watch the same water in a glass.')
 assert.ok(!JSON.stringify(linked).includes('Teacher-only response'))
 assert.ok(!JSON.stringify(linked).includes('Do not expose'))
 const unscheduled=buildCertifiedTeacherToolContexts({subject:'Science',grade:'Grade 8',assets:[asset]})
 assert.equal(unscheduled[0].sourceKind,'certified_curriculum')
 assert.equal(unscheduled[0].schemeLessonId,null)
 assert.throws(()=>buildLearningToolContext({...input,sourceKind:'certified_curriculum'}),/boundary violated/)
 assert.deepEqual(buildCertifiedTeacherToolContexts({subject:'Science',grade:'',assets:[asset]}),[])
 assert.deepEqual(buildCertifiedTeacherToolContexts({subject:'Science',grade:'Grade 8',assets:[{...asset,certifiedAt:null}]}),[])
 assert.deepEqual(buildCertifiedTeacherToolContexts({subject:'Science',grade:'Grade 8',assets:[{...asset,assetKind:'marking_scheme'}]}),[])
})
test('existing canonical teacher bundle exposes only derived tool contexts',()=>{
 const source=read('../lib/teaching/lessonSourceBundle.ts')
 assert.match(source,/loadCertifiedContentForSource/)
 assert.match(source,/buildCertifiedTeacherToolContexts/)
 assert.match(source,/toolContexts:/)
 assert.match(source,/schemeLessonId: source\?\.schemeId/)
})
