import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const identitySource = fs.readFileSync('lib/teacher/teachingIdentity.ts','utf8')
const viewSource = fs.readFileSync('lib/timetable/teacherScheduleView.ts','utf8')
const importTs = async src => {
  const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText
  return import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))
}
const { resolveTeacherTeachingIdentity: resolve } = await importTs(identitySource)
const {
  defaultTeacherScheduleView: defaultView,
  canUseTeacherScheduleView: canView,
  mayEditSchoolTimetable: mayEdit,
  projectTeacherDaySchedule: project,
} = await importTs(viewSource)

const unlinked=resolve('teacher-a',{state:'needs_school',active_school_id:null,schools:[]})
const linked=resolve('teacher-a',{state:'ready',active_school_id:'school-a',
  schools:[{id:'school-a',name:'A'},{id:'school-b',name:'B'}]})

assert.equal(defaultView(unlinked),'independent','no school is a valid teacher context')
assert.equal(defaultView(linked),'school','linked teacher defaults to school')
assert.equal(canView(unlinked,'school'),false,'no-school teacher cannot claim school mode')
assert.equal(canView(unlinked,'all'),false,'no-school teacher cannot claim combined school mode')
assert.equal(canView(unlinked,'independent'),true)
assert.equal(canView(linked,'school'),true)
assert.equal(canView(linked,'all'),true)
assert.equal(canView(linked,'independent'),true)

const school=[{kind:'school',start:'08:20',slot:{id:'sch',schoolId:'school-a'}}]
const privateSlots=[{kind:'tuition',start:'08:10',lesson:{id:'private'}}]
assert.deepEqual(project('school',school,privateSlots).map(e=>e.kind),['school'])
assert.deepEqual(project('independent',school,privateSlots).map(e=>e.kind),['tuition'])
assert.deepEqual(project('all',school,privateSlots).map(e=>e.kind),['tuition','school'])
assert.equal(project('independent',school,[]).length,0,'no invented personal slots')
assert.equal(project('school',[],privateSlots).length,0,'no tuition leak into school')
assert.equal(project('all',school,privateSlots)[0].lesson.id,'private')
assert.equal(mayEdit('school','school-a','school-a'),true)
assert.equal(mayEdit('school','school-a','school-b'),false)
assert.equal(mayEdit('school',null,'school-a'),false)
assert.equal(mayEdit('independent','school-a','school-a'),false)
assert.equal(mayEdit('all','school-a','school-a'),false)

const page=fs.readFileSync('app/teacher/timetable/page.tsx','utf8')
const tuition=fs.readFileSync('components/timetable/TuitionTimetable.tsx','utf8')
const lower=page.indexOf('if (!schoolId) {')
const schoolFetch=page.indexOf("supabase.rpc('get_my_school_day_blocks')")
assert.ok(lower>0 && schoolFetch>lower,'unlinked teacher must bypass school-owned reads')
assert.match(page,/profileResponse\.data\?\.role !== 'teacher'/)
assert.match(page,/setVerifiedTeacher\(true\)/)
assert.match(page,/if \(!loading && !verifiedTeacher\) return/)
assert.match(page,/resolveTeacherTeachingIdentity\(user\.id, schoolResponse\.data\)/)
assert.match(page,/defaultTeacherScheduleView\(identity\)/)
assert.match(page,/setSchoolFilter\('all'\); setScheduleContext\('all'\)/,'All must include all verified schools')
assert.match(page,/setSchoolFilter\(activeSchoolId\); setScheduleContext\('school'\)/,'School returns to active school')
assert.match(page,/projectTeacherDaySchedule\(/)
assert.match(page,/mayEditSchoolTimetable\(scheduleContext, activeSchoolId, schoolFilter\)/)
assert.match(page,/canEdit=\{Boolean\(scheduleContext === 'school'/)
assert.match(page,/canCopy=\{Boolean\(scheduleContext === 'school'/)
assert.match(page,/scheduleContext === 'independent' && <p/)
assert.match(page,/No private tuition lessons scheduled/)
assert.match(page,/tuitionError && scheduleContext !== 'school'/)
assert.match(page,/scheduleContext === 'school' && \(showAddSlot/)
assert.match(page,/scheduleContext !== 'independent' && activeSchoolId && <SlotDrawer/,'independent mode cannot generate school occurrences through the slot drawer')
assert.match(page,/setSelected\(null\)/)
assert.match(page,/setAllSlots\(\[\]\)/,'school rows must be cleared during identity transitions')
assert.match(page,/event !== 'SIGNED_OUT'/,'school data must clear on sign-out')
assert.match(tuition,/onAuthStateChange/,'private tuition data must clear on account changes')
assert.match(tuition,/setLessons\(\[\]\)/,'old tuition data must not survive read failure')
assert.doesNotMatch(page,/scheduleContext === 'tuition'/,'old tuition mode removed')
assert.doesNotMatch(page,/Connect or select your active school before opening the timetable/)
assert.doesNotMatch(page,/from\(['"]vibetutor_lessons['"]\)/,'school timetable must not directly read private table')
assert.match(tuition,/rpc\("vibetutor_my_lessons"\)/,'existing invitation RPC remains authority')
assert.match(tuition,/setLoading\(false\)/)
assert.doesNotMatch(tuition,/School timetable is still available/)
console.log('PASS: Stage 2 school/independent/all scope routing and negative controls')
