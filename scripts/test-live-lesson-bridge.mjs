import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isLessonUuid, lessonToLiveHref, liveToLessonHref } from '../lib/teaching/liveLessonLinks.ts'

const plan='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const classId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const subject='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const slot='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const occurrence='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const context={lessonPlanId:plan,classId,subjectId:subject,timetableSlotId:slot,occurrenceId:occurrence,occurrenceDate:'2026-11-23'}
assert.equal(isLessonUuid(plan),true)
assert.equal(isLessonUuid('not-a-uuid'),false)
const live=lessonToLiveHref(context)
assert.ok(live)
assert.equal(live?.startsWith('/teacher/classhub/'+classId+'/live?'),true)
const liveParams=new URL(live!,'https://example.test').searchParams
assert.equal(liveParams.get('lessonPlanId'),plan)
assert.equal(liveParams.get('subjectId'),subject)
assert.equal(liveParams.get('timetableSlotId'),slot)
assert.equal(liveParams.get('occurrenceId'),occurrence)
assert.equal(liveParams.get('date'),'2026-11-23')
const back=liveToLessonHref(context)
assert.ok(back)
const backParams=new URL(back!,'https://example.test').searchParams
assert.equal(backParams.get('lessonPlanId'),plan)
assert.equal(backParams.get('classId'),classId)
assert.equal(backParams.get('occurrenceId'),occurrence)
assert.equal(backParams.get('teach'),'1')
assert.equal(lessonToLiveHref({...context,lessonPlanId:'javascript:alert(1)'}),null)
assert.equal(liveToLessonHref({...context,classId:'../../student'}),null)
const invalid=lessonToLiveHref({...context,occurrenceId:'not-an-occurrence',occurrenceDate:'2026-02-30',subjectId:'invalid'})
assert.ok(invalid)
const invalidParams=new URL(invalid!,'https://example.test').searchParams
assert.equal(invalidParams.has('occurrenceId'),false)
assert.equal(invalidParams.has('date'),false)
assert.equal(invalidParams.has('subjectId'),false)

const source=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const liveUi=source('components/live-classroom/LiveClassroom.tsx')
const notes=source('app/teacher/lesson-notes/page.tsx')
const modal=source('components/teacher/LessonPlanModal.tsx')
assert.match(modal,/lessonToLiveHref\(\{[\s\S]*occurrenceId: teachingOccurrence\?\.occurrenceId/)
assert.match(notes,/lessonToLiveHref\(\{[\s\S]*occurrenceId: occurrence\?\.id/)
assert.ok(liveUi.includes('Choose saved Lesson Plan'))
assert.ok(liveUi.includes('Previous</button>'))
assert.ok(liveUi.includes('Next</button>'))
assert.ok(liveUi.includes('Return to lesson · reflection and completion'))
assert.ok(liveUi.includes('liveToLessonHref({'))
assert.ok(liveUi.includes("eq('id',selectedPlanId).eq('teacher_id',user.id).eq('class_id',classId)"))
assert.ok(liveUi.includes('samePlan&&matchingSlot?route.get(\'occurrenceId\'):null'))
assert.ok(liveUi.includes('teacherLivePlan(String(result.data.body'))
assert.ok(liveUi.includes('Present approved Resources'))
assert.ok(!liveUi.includes("act('publish',null,{kind:'teach',body:linkedPlan"),'Private plan body must never be published to Live')
console.log('PASS: Lesson Plan <-> Live validated links, exact occurrence context, private phases and no implicit sharing')
