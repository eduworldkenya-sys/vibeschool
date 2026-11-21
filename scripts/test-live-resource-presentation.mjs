import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  LIVE_LEARNER_ASSET_KINDS, LIVE_SCHOOL_GRADE_LABELS, liveResourcePages, readableLiveResourceText,
} from '../lib/live/resourcePresentation.ts'

assert.equal(readableLiveResourceText({content_text:' Learner chapter ', body:'stale'}),'Learner chapter')
assert.equal(readableLiveResourceText({body:' Worked example '}),'Worked example')
for(const invalid of [null,undefined,[],{body:{secret:true}},{notes:'teacher only'}]) {
  assert.equal(readableLiveResourceText(invalid),'')
}
for(const secret of ['teacher_notes','lesson_plan','marking_scheme','rubric','assessment','quiz']) {
  assert.equal(LIVE_LEARNER_ASSET_KINDS.includes(secret),false,secret+' must not be discoverable')
}
assert.ok(LIVE_SCHOOL_GRADE_LABELS.includes('Grade 4'))
assert.ok(LIVE_SCHOOL_GRADE_LABELS.includes('Form 4'))
for(const blocked of ['CPA','Professional Studies','Grade 13','University']) assert.equal(LIVE_SCHOOL_GRADE_LABELS.includes(blocked),false)
assert.deepEqual(liveResourcePages('x',''),[])
assert.deepEqual(liveResourcePages('','hello'),[])
const content=('Kenya Grade 4 learning text.\n').repeat(260)
const pages=liveResourcePages('Fractions',content)
assert.ok(pages.length>1&&pages.length<=30)
assert.ok(pages.every(p=>p.length<=4000))
const joined=pages.map(page=>page.replace(/^Fractions · Page \d+ \/ \d+\n\n/,'')).join('')
assert.equal(joined,content.trim())
assert.deepEqual(liveResourcePages('Too long','x'.repeat(108001)),[],'must not silently truncate')
const code=readFileSync(new URL('../components/live-classroom/LiveResourcePicker.tsx',import.meta.url),'utf8')
const room=readFileSync(new URL('../components/live-classroom/LiveClassroom.tsx',import.meta.url),'utf8')
for(const required of [
  ".eq('status', 'active').eq('visibility', 'public')",
  ".in('asset_kind', [...LIVE_LEARNER_ASSET_KINDS])",
  ".in('grade', LIVE_SCHOOL_GRADE_LABELS)",
  ".eq('lifecycle_status', 'certified')",
  ".in('rights_status', ['cleared', 'not_applicable'])",
  ".not('certified_at', 'is', null)",
  ".eq('publication_status', 'shared')",
  ".eq('class_id', classId)",
  "if (!classId) throw new Error('School material requires its original class.')",
  ".from('scheme_of_work')",
  ".from('teaching_resource_links')",
  ".eq('target_type', 'scheme_lesson')",
  ".eq('teacher_id', auth.data.user.id)",
  ".eq('class_id', classId)",
  "if (!scheme.data) throw new Error('The Scheme lesson no longer belongs to this class.')",
  "if (!link.data) throw new Error('This Scheme resource link is no longer available.')",
  "if (item.pinnedVersionId) versionQuery = versionQuery.eq('id', item.pinnedVersionId)",
  'onPresent(selected.pages[page])',
]) assert.ok(code.includes(required),'resource contract missing '+required)
for(const required of [
  "panel==='resources'",
  "canPresent={!busy&&online&&room.status==='active'}",
  "onPresent={body=>void act('publish',null,{kind:'teach',body,answerKey:null})}",
  "panel!=='resources'",
  '<span>Resources</span>',
]) assert.ok(room.includes(required),'Live integration missing '+required)
assert.ok(!code.includes(".eq('publication_status', 'draft')"),'draft resource leak')
console.log('PASS: resource pagination, public certified gates, shared class isolation and Live presentation contract')
