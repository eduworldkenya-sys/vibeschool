import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { teacherTabs, teacherTools, teacherTabForPath } from '../components/teacher/navigation.ts'

assert.deepEqual(teacherTabs.map(tab=>tab.id), ['today','teach','classes','assess','me'])
const destinations = Object.values(teacherTools).flat().map(tool=>tool.href)
assert.equal(new Set(destinations).size, destinations.length, 'Navigation destinations must be unique')
for (const href of destinations) {
  assert.ok(fs.existsSync(`app${href}/page.tsx`) || fs.existsSync(`app${href}/page.jsx`), `Missing navigation route: ${href}`)
}
for (const [path,expected] of [
  ['/teacher/classhub/class-id/student/learner-id/progress','classes'],
  ['/teacher/assessment/gradebook','assess'],
  ['/teacher/assessment/builder/assessment-id/preview','assess'],
  ['/teacher/lessonplan/prepare','teach'],
  ['/teacher/teacher-guide','teach'],
  ['/teacher/results/report-card/learner-id','assess'],
  ['/teacher/content-assessments/assessment-id','assess'],
  ['/teacher/notifications','today'],
  ['/teacher/profile/teaching-scope','me'],
  ['/teacher/assessment-not-a-route','today'],
  ['/teacher','today'],
]) assert.equal(teacherTabForPath(path),expected, `Wrong tab for ${path}`)
// Verify that the shared metadata is wired into both navigation surfaces and tools.
const navigation = fs.readFileSync('components/teacher/TeacherNavigation.tsx','utf8')
const tools = fs.readFileSync('app/teacher/more/page.tsx','utf8')
assert.match(navigation,/teacherTabs\.map/)
assert.match(navigation,/teacherTools\[active\]/)
assert.match(navigation,/teacherTools\[open\]/)
assert.match(tools,/teacherTools\[tab\.id\]/)
// Nested landmarks confuse screen-reader navigation across route changes.
// The authenticated shell owns the only main; public acquisition pages are
// rewritten outside that shell and retain their own landmark.
let inspected = 0
for (const file of fs.readdirSync('app/teacher', { recursive: true })) {
  if (!/page\.(tsx|jsx)$/.test(file) || ['page.tsx','creators/page.tsx'].includes(file)) continue
  const source = ts.createSourceFile(file, fs.readFileSync(`app/teacher/${file}`, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const inspect = node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) assert.notEqual(node.tagName.getText(source), 'main', `Nested main landmark in ${file}`)
    ts.forEachChild(node, inspect)
  }
  inspect(source)
  inspected++
}
assert.match(fs.readFileSync('app/teacher/layout.tsx','utf8'), /<main id="teacher-main"/)
for (const file of fs.readdirSync('components/teacher', { recursive: true })) {
  if (!/\.(tsx|jsx)$/.test(file)) continue
  const source = ts.createSourceFile(file, fs.readFileSync(`components/teacher/${file}`, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const inspect = node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) assert.notEqual(node.tagName.getText(source), 'main', `Nested main landmark in Teacher component ${file}`)
    ts.forEachChild(node, inspect)
  }
  inspect(source)
}
console.log(`Teacher landmark regression: PASS (${inspected} authenticated route files)`)
console.log(`Teacher navigation regression: PASS (${destinations.length} real destinations; deep links and route-prefix negative case)`)

// Attendance is not evidence that a lesson has been taught. Exercise actual
// rendered components with every lesson's attendance marked, without a
// canonical teaching completion record.
const { createElement } = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const { default: TodayHero } = await import('../components/teacher/TodayHero.tsx')
const { default: TodayGlance } = await import('../components/teacher/TodayGlance.tsx')
const snapshot = { todaySlots: [{ id:'slot', class_id:'class', class_name:'Grade 4', subject:'Maths', attendance_status:'completed' }], totalStudentsToday:2, attPending:[], homeworkUngraded:[] }
for (const html of [
  renderToStaticMarkup(createElement(TodayHero, {snap:snapshot})),
  renderToStaticMarkup(createElement(TodayHero, {snap:snapshot, focusSlot:snapshot.todaySlots[0]})),
  renderToStaticMarkup(createElement(TodayGlance, {snap:snapshot, onNavigate:()=>{}})),
]) {
  assert.doesNotMatch(html, /Lesson taught|All lessons taught|Day complete|>Completed</)
  assert.match(html, /Attendance marked/)
}
const pulse = fs.readFileSync('app/teacher/pulse/page.tsx','utf8')
assert.match(pulse, /const dayResult = runRules\(snap\)/, 'Urgent tasks must use all classes, not the selected class')
assert.match(pulse, /tasks=\{dayResult.tasks\}/)
assert.match(pulse, /slots=\{snap.todaySlots\}/)
const roster = fs.readFileSync('app/teacher/classhub/[id]/page.tsx','utf8')
assert.match(roster, /revealedCodes.has\(student.id\) && <div id=/, 'Claim code must not render until explicitly revealed')
assert.match(roster, /aria-expanded=\{revealedCodes.has\(student.id\)\}/)
console.log('Issue 753 regression: PASS (attendance semantics, all-class day, intentional code reveal)')

const grading = fs.readFileSync('app/teacher/classhub/[id]/homework/[hwId]/page.tsx','utf8')
assert.match(grading, /teacher_get_operating_context/)
assert.match(grading, /from\("student_classes"\).*eq\("is_current", true\)/)
assert.match(grading, /from\("students"\).*in\("id", learnerIds\)/)
assert.doesNotMatch(grading, /from\("students"\).*eq\("class_id"/)
assert.match(grading, /eq\("class_id", classId\).eq\("teacher_id", user.id\)/)
console.log('Homework marking authority: PASS (canonical enrollment and assigned school/class scope)')
