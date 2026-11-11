import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {buildJumpingDraftSections} from '../lib/teaching/jumpingDraftSections.ts'

const read = path => readFileSync(path,'utf8')
const scheme = read('app/teacher/scheme/AuthoritySchemePage.jsx')
const modal = read('components/teacher/LessonPlanModal.tsx')
const guide = read('app/teacher/teacher-guide/page.tsx')
const picker = read('components/teacher/JumpingSchemeContent.jsx')
const migration = read('supabase/migrations/20261111122000_grade1_jumping_scheme_content_draft_integration.sql')

assert.ok(scheme.includes('<JumpingSchemeContent schemeId={item.id}/>'),'Scheme must show exact linked content.')
assert.ok(modal.includes('buildJumpingDraftSections(jumpingDraft, suggestion)'),'Plan must use original content, not regenerate it.')
assert.ok(modal.includes("'vs_pin_jumping_draft_to_plan'"),'A saved draft must pin exact source versions.')
assert.ok(guide.includes('<JumpingSchemeContent schemeId={source.schemeId} />'),'Teacher guide must reuse Scheme content.')
assert.ok(picker.includes("'vs_read_linked_jumping_scheme_content'"),'Picker uses the guarded RPC.')
assert.ok(!picker.includes('.pdf'),'Content browser must not depend on PDFs.')
assert.ok(migration.includes("s.teacher_id=(select auth.uid())"),'Scheme read requires exact teacher ownership.')
assert.ok(migration.includes("tc.teacher_id=(select auth.uid())"),'Scheme read requires active class/subject assignment.')
assert.ok(migration.includes("p_lesson_number not between 1 and 14"),'Pin rejects invalid lesson units.')
assert.ok(migration.includes("JUMPING_DRAFT_SOURCE_CANNOT_BE_DELIVERED"),'Non-certified drafts must never be published.')
assert.ok(migration.includes("r.canonical_key in ("),'Read must be anchored to exact manuscript identity.')
assert.ok(!migration.includes('create table'),'No duplicate canonical content table allowed.')
const selection = {
  schemeId:'scheme-1',lessonNumber:7,title:'Across the river',
  content:{
    teacher:{body:'Show a controlled jump across a chalk river.',activities:['Choose a safe landing spot.','Jump and balance.'],questions:['What helps you land safely?'],assessment_guidance:'Look for balanced landing.',differentiation:['Use a shorter distance.'],homeworkTasks:['Name a safe place.']},
    learner:{body:'Choose a safe crossing.',learnerActivities:['Stand behind the line.'],questions:['Which crossing is safer?']},
    assessment:{body:'Check movement safely.'},
    observation:{body:'Record next teaching step.'},
  }
}
const sections=buildJumpingDraftSections(selection,{objectives:'Jump safely.',learningResources:'Chalk',assessmentMethods:'Observe movement.',keyInquiryQuestion:'What is a safe landing?'})
assert.equal(sections.objectives,'Jump safely.')
assert.ok(sections.development.includes('Show a controlled jump across a chalk river.'))
assert.ok(sections.development.includes('Stand behind the line.'))
assert.ok(sections.assessmentHook.includes('balanced landing'))
assert.ok(sections.homework.includes('Name a safe place'))
assert.ok(sections.differentiation.includes('Use a shorter distance.'))
assert.ok(!JSON.stringify(sections).includes('Lesson 08'),'Lesson sources must not cross units.')
assert.throws(()=>buildJumpingDraftSections({...selection,content:{teacher:selection.content.teacher}},{}),/missing its teaching or learner content/)
console.log('Grade 1 Jumping Scheme → content → Lesson Plan and tools: PASS')
