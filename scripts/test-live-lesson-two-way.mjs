import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { lessonToLiveHref, liveToLessonHref, validLessonId } from '../lib/teaching/liveLessonLinks.ts'

const read = path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const migration=read('supabase/migrations/20261124143449_live_plan_history_read.sql')
const classroom=read('components/live-classroom/LiveClassroom.tsx')
const review=read('components/live-classroom/LiveLessonReview.tsx')
const history=read('components/teacher/LiveLessonHistory.tsx')
const notes=read('app/teacher/lesson-notes/page.tsx')
const modal=read('components/teacher/LessonPlanModal.tsx')

const a='11111111-1111-4111-8111-111111111111'
const b='22222222-2222-4222-8222-222222222222'
const c='33333333-3333-4333-8333-333333333333'
const d='44444444-4444-4444-8444-444444444444'

test('validated bidirectional navigation preserves exact plan and occurrence',()=>{
  const href=lessonToLiveHref({lessonPlanId:a,classId:b,subjectId:c,occurrenceId:d,occurrenceDate:'2026-11-24'})
  assert.ok(href)
  assert.equal(href?.startsWith('/teacher/classhub/'+b+'/live?'),true)
  const url=new URL(href,'https://vibeschool.co.ke')
  assert.equal(url.searchParams.get('lessonPlanId'),a)
  assert.equal(url.searchParams.get('occurrenceId'),d)
  assert.equal(url.searchParams.get('date'),'2026-11-24')
  const back=liveToLessonHref({lessonPlanId:a,classId:b,occurrenceId:d})
  assert.ok(back)
  const returnUrl=new URL(back,'https://vibeschool.co.ke')
  assert.equal(returnUrl.pathname,'/teacher/lesson-notes')
  assert.equal(returnUrl.searchParams.get('lessonPlanId'),a)
  assert.equal(returnUrl.searchParams.get('classId'),b)
  assert.equal(returnUrl.searchParams.get('occurrenceId'),d)
  assert.equal(returnUrl.searchParams.get('teach'),'1')
  assert.equal(validLessonId('not-an-id'),false)
  assert.equal(lessonToLiveHref({lessonPlanId:'bad',classId:b}),null)
  assert.equal(liveToLessonHref({lessonPlanId:a,classId:'bad'}),null)
  assert.equal(new URL(lessonToLiveHref({lessonPlanId:a,classId:b,occurrenceDate:'2026-02-30'}),'https://vibeschool.co.ke').searchParams.get('date'),null)
})

test('history is private to currently authorized teacher, class and school',()=>{
  assert.match(migration,/auth\.uid\(\)/)
  assert.match(migration,/teacher_id=v_caller/)
  assert.match(migration,/public\.teacher_can_access_class\(v_plan\.class_id,null,false\)/)
  assert.match(migration,/teacher_get_operating_context\(null\)/)
  assert.match(migration,/and class_id=v_plan\.class_id and school_id=v_school and mode='school'/)
  assert.match(migration,/revoke all on function public\.vibe_live_plan_history\(uuid\)/)
  assert.match(migration,/grant execute on function public\.vibe_live_plan_history\(uuid\) to authenticated/)
  assert.doesNotMatch(migration, /grant select on vibe_live\.sessions|grant execute .* to anon/i)
  assert.doesNotMatch(migration, /\b(update|delete|insert)\s+(into|from)?\s*(public\.attendance|public\.teaching_occurrences|public\.lesson_evidence)/i)
})

test('school Live offers a selected owned plan, never shares its private body',()=>{
  assert.match(classroom,/teacher&&classId&&<section aria-label="Prepare Live Lesson"/)
  assert.match(classroom,/\.eq\('teacher_id',auth\.data\.user\.id\)\.eq\('class_id',classId\)/)
  assert.match(classroom,/\.eq\('id',planId\)\.eq\('teacher_id',user\.id\)\.eq\('class_id',classId\)/)
  assert.match(classroom,/selectedPlanId/)
  assert.match(classroom,/action==='start'&&next\.mode==='school'/)
  assert.match(classroom,/p_action:'bind'/)
  assert.match(classroom,/if\(startLinkFailure\)setLinkedPlanError/)
  assert.match(classroom,/setLinkedPlan\(null\)/)
  assert.match(classroom,/linkedPlan\?\.id!==selectedPlanId/)
  assert.match(classroom,/teacherLivePlan\(/)
  assert.match(classroom,/Nothing on this panel is shared with learners/)
})

test('post-class panel is rendered after End, allows explicit link and evidence save',()=>{
  assert.match(classroom,/teacher&&room\?\.status==='ended'&&room\.mode==='school'/)
  assert.match(classroom,/<LiveLessonReview roomId=\{room\.id\} roomStatus=\{room\.status\}/)
  assert.match(review,/Link saved plan/)
  assert.match(review,/request\('capture'\)/)
  assert.match(review,/review\.captureAllowed/)
  assert.match(review,/liveToLessonHref\(/)
  assert.match(review,/onSelectPlan\(result\.lessonPlanId\)/)
  assert.match(classroom,/selectedPlanId=\{selectedPlanId\}/)
  assert.match(review,/roomStatus !== 'ended'/)
  assert.doesNotMatch(review,/public\.attendance|mark.*mastery/i)
})

test('normal saved plan displays linked session history but not private learner responses',()=>{
  assert.match(notes,/<LiveLessonHistory planId=\{plan\.id\} classId=\{plan\.class_id\}\/>/)
  assert.match(history,/supabase\.rpc\('vibe_live_plan_history'/)
  assert.match(history,/session\.status==='ended'\?'Review Live':'Resume Live'/)
  assert.match(history,/Joining a Live Lesson does not automatically mark school attendance/)
  assert.doesNotMatch(migration,/student_id|a\.body|answer_key/)
  assert.match(modal,/lessonToLiveHref\(/)
})
