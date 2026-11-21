import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseLiveReadingPage, liveReadingBlockType } from '../lib/live/readingPresentation.ts'
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
  'onPresent(raw)',
  'const shared = encodeSlide(',
  'lessonPlanId: string | null',
  ".eq('target_type', 'lesson_plan')",
  "if (link.error || !link.data) throw new Error('Lesson Plan resource link was removed.')",
  'if (schemeLessonId && planResult.data.scheme_id !== schemeLessonId)',
]) assert.ok(code.includes(required),'resource contract missing '+required)
for(const required of [
  "panel==='resources'",
  "canPresent={!busy&&online&&room.status==='active'}",
  "onPresent={body=>void act('publish',null,{kind:'teach',body,answerKey:null})}",
  "panel!=='resources'",
  '<span>Resources</span>',
]) assert.ok(room.includes(required),'Live integration missing '+required)
assert.ok(code.includes("const preparedIds = new Set([...planPrepared,...prepared].map(item => item.id))"),'prepared items must be deduplicated against generic resources')
assert.ok(code.includes("const key = link.scheme_lesson_id + ':' + link.resource_id"),'prepared identity must use the persisted Scheme and resource identifiers')
assert.ok(code.includes("if (!link.data) throw new Error('This Scheme resource link is no longer available.')"),'stale Scheme links must fail closed')
assert.ok(!code.includes(".eq('publication_status', 'draft')"),'draft resource leak')
console.log('PASS: resource pagination, public certified gates, shared class isolation and Live presentation contract')

const filesUi=readFileSync(new URL('../components/live-classroom/LiveClassFiles.tsx',import.meta.url),'utf8')
const lessonNotes=readFileSync(new URL('../app/teacher/lesson-notes/page.tsx',import.meta.url),'utf8')
for(const token of ['Upload classroom PDF or photo','createSignedUrl(file.object_path,60)',".from('live_classroom_assets')",'allowedSignature(file)',"teacher&&status!=='ended'",'Share with class']) assert.ok(filesUi.includes(token),'Private files UI missing '+token)
for(const token of ['Saved teaching materials','<LiveClassFiles roomId={room.id} teacher={teacher} status="ended"/>',"setLinkedPlan({id:result.data.id",'lessonPlanId={room.mode',"learnerTool==='files'"]) assert.ok(room.includes(token),'Live integration missing '+token)
assert.ok(lessonNotes.includes('Teach this Lesson Plan in Live'))
console.log('PASS: exact Lesson Plan linkage, teacher-diagram preview and retained private file access surfaces')


// Learner-facing reader: structural rendering must not change the room's
// authorization or silently discard content. Keep narrative and outcome text.
const longParagraph = ('The pupils read the analogue clock and explain the minutes. ').repeat(260)
const narrativePages = liveResourcePages('Reading Time',longParagraph)
assert.ok(narrativePages.length>1)
const bodyOf = page => page.replace(/^Reading Time · Page \d+ \/ \d+\n\n/,'')
assert.equal(narrativePages.map(bodyOf).join(''),longParagraph.trim())
assert.ok(narrativePages.slice(0,-1).every(page=>/[\s.!?]$/.test(bodyOf(page))),'reading pages should not break an ordinary word')
const parsed = parseLiveReadingPage("Reading Time · Page 2 / 5\n\nI CAN: Read the clock.\n\nLET'S LEARN\n\nThe short hand gives the hour.\n\nThe long hand gives the minutes.")
assert.equal(parsed.title,'Reading Time')
assert.equal(parseLiveReadingPage('Reading Time · Page 1 / 3\nOne line follows.').title,'Reading Time')
assert.equal(parsed.number,2)
assert.equal(parsed.total,5)
assert.deepEqual(parsed.paragraphs,["I CAN: Read the clock.","LET'S LEARN","The short hand gives the hour.","The long hand gives the minutes."])
assert.equal(liveReadingBlockType(parsed.paragraphs[0]),'outcome')
assert.equal(liveReadingBlockType(parsed.paragraphs[1]),'section')
assert.equal(liveReadingBlockType('THE CLOCK'),'heading')
assert.equal(liveReadingBlockType(parsed.paragraphs[2]),'prose')
assert.deepEqual(parseLiveReadingPage('A plain teacher paragraph.'),{title:null,number:null,total:null,paragraphs:['A plain teacher paragraph.']})
const readerUI=readFileSync(new URL('../components/live-classroom/LiveReadingSurface.tsx',import.meta.url),'utf8')
const readerCSS=readFileSync(new URL('../components/live-classroom/LiveReadingSurface.module.css',import.meta.url),'utf8')
for(const token of ['LiveReadingSurface','onQuote','aria-label="Reading preferences"','liveReadingBlockType','article.current?.contains','onClick={saveQuote}','setZoom']) assert.ok(readerUI.includes(token),'Reader missing '+token)
assert.ok(!readerUI.includes('dangerouslySetInnerHTML'),'Untrusted lesson text must never be injected as HTML')
assert.ok(!readerUI.includes('supabase'),'Reader cannot invent a second resource authority')
assert.ok(readerCSS.includes('min(100%,840px)')&&readerCSS.includes('overflow-wrap:anywhere'),'Reader must reflow on mobile')
for(const token of ['<ClockExplorer value={prompt.body}/>','learnerMenu&&','More learner tools','onQuote={!teacher','noteDirty.current=true']) assert.ok(room.includes(token),'Live learner integration missing '+token)
console.log('PASS: interactive learner reading, structure, no silent content loss, scoped notes and mobile reader contract')

/* Real classroom answers still use the authorized existing RPC.
   Test explicit options, malformed input, private working bounds and UI wiring. */
const {liveAnswerChoices,addWorkToPrivateNotes}=await import('../lib/live/learnerActivity.ts')
assert.deepEqual(liveAnswerChoices('What is the value?\nA. 40\nB) 400\nC: 4000').map(c=>c.value),['A. 40','B. 400','C. 4000'])
assert.deepEqual(liveAnswerChoices('Explain 3 steps.\n1. First\n2. Second'),[])
assert.deepEqual(liveAnswerChoices('A. One'),[])
assert.deepEqual(liveAnswerChoices('A. One\nC. Three'),[])
assert.deepEqual(liveAnswerChoices('A. One\nA. Other'),[])
assert.deepEqual(liveAnswerChoices('A. One\nB. Two\nC. Three\nD. Four\nE. Five\nF. Six\nG. Seven'),[])
assert.equal(addWorkToPrivateNotes('Existing notes',' 2 + 2 = 4 '),'Existing notes\n\nWorking:\n2 + 2 = 4')
assert.equal(addWorkToPrivateNotes('',''),null)
assert.equal(addWorkToPrivateNotes('x'.repeat(7990),'working'),null)
assert.equal(addWorkToPrivateNotes('','x'.repeat(2001)),null)
for(const expected of ["learnerTool==='work'","liveAnswerChoices(prompt.body)","addWorkToPrivateNotes(noteDraft,workDraft)","setAnswerFor(prompt.id)","Choose your answer","Use as answer","Add to private notes"])assert.ok(room.includes(expected),'Learner activity integration missing '+expected)
const learnerCss=readFileSync(new URL('../components/live-classroom/LiveClassroom.module.css',import.meta.url),'utf8')
assert.ok(learnerCss.includes('.answerChoices')&&learnerCss.includes('.workpadActions'))
console.log('PASS: explicit choice handling and scoped learner working remain private until authorized submission')
