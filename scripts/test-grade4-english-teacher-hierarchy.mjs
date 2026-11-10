import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component = readFileSync(new URL('../components/teacher/curriculum/Grade4EnglishMap.tsx', import.meta.url),'utf8')
const page = readFileSync(new URL('../app/teacher/scheme/AuthoritySchemePage.jsx', import.meta.url),'utf8')
const slots = readFileSync(new URL('../components/teacher/scheme/WeeklyLessonSlots.tsx', import.meta.url),'utf8')
const launcher = readFileSync(new URL('../app/teacher/scheme/generate/page.tsx', import.meta.url),'utf8')
const reference = readFileSync(new URL('../lib/curriculum/grade4EnglishReference.ts', import.meta.url),'utf8')

for(const token of [
  "useState<number>(1)",
  "useState(false)",
  "Read the curriculum",
  "Choose another theme",
  "aria-label=\"Grade 4 English native curriculum reader\"",
  "const matches = useMemo",
  "aria-label=\"Grade 4 English theme list\"",
  "sections.map((heading,index)",
  "GRADE4_ENGLISH_SUBSTRANDS[theme.number]",
  "Original KICD document",
  "outcomes and learning experiences: awaiting source verification",
  "Full in-app republication needs appropriate permission",
  "Open Scheme of Work",
  "View stored weekly plan",
  "onToggleExisting",
  "onOpenScheme",
]) assert.ok(component.includes(token), 'Missing native curriculum reader requirement: '+token)
assert.ok(!component.includes('suggestedTermForTheme'), 'KICD annual curriculum must not be limited to school terms')
assert.ok(!component.includes('setSelectedTheme(null)'), 'Theme 1 must open by default')

assert.ok(page.includes('verifiedOutcomeCount={Object.values(curriculumOutcomes)'), 'Verified outcomes must be counted from loaded curriculum')
assert.ok(page.includes('curriculumTopics={curriculumView ? allCurriculumRows : []}'), 'Use stored weekly curriculum topics in the single overview')
assert.ok(page.includes('<WeeklyLessonSlots'), 'All subjects must see their distinct weekly lesson slots')
assert.ok(page.includes('lessons={selectedWeekItems}'), 'Use only saved lessons for the selected week')
assert.ok(page.includes('allocation={weeklyTarget}'), 'Resolve weekly lesson target through the canonical allocation RPC')
assert.ok(page.includes('schemeCount={schemeItems.length}'), 'Scheme count must reflect the teacher records')
assert.ok(page.includes('<Grade4EnglishMap'), 'Teacher page must mount the new browser')
assert.ok(page.includes('showEnglishLegacy'), 'Existing records must remain accessible')
assert.ok(page.includes("display:isGrade4English&&!showEnglishLegacy?'none':undefined"), 'Legacy grid must hide by default')
assert.ok(page.includes('commit_curriculum_scheme'), 'Existing Scheme flow must be preserved')
assert.ok(reference.includes('GRADE4_ENGLISH_THEMES'), 'Source theme index must remain available')
assert.equal((reference.match(/"number": \d+/g)||[]).length,13, 'Expected 13 English themes')
assert.ok(reference.includes('https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.ENGLISH.LANGUAGE.pdf'), 'Must use first-party KICD 2024 source')
assert.deepEqual([...reference.matchAll(/"sourcePage": (\d+)/g)].map(match=>Number(match[1])),[1,8,15,22,30,37,44,50,56,62,69,75,81], 'Theme locators must match KICD 2024 contents')
assert.ok(!component.includes('Week {selectedWeek} · Curriculum reference'), 'No duplicate Week reference panel')
assert.ok(page.includes('compact={!curriculumView}'), 'Scheme should use compact weekly summary rather than duplicate detailed scheme cards')
assert.ok(slots.includes('const topics=curriculumTopics.filter(row=>row.week===week)'), 'Selected week must scope curriculum topics')
assert.ok(slots.includes('Not planned yet'), 'Unplanned slots must remain visibly empty')
assert.ok(slots.includes('lessons.length>target'), 'Weekly over-allocation must be flagged')
for (const token of [
  "'id, teacher_id, school_id, class_id, subject_id, academic_term_id, week'",
  ".eq('term_id', scheme.academic_term_id)",
  ".eq('week_number', scheme.week)",
  "const rangeStart = matchingWeek.start_date",
  "const rangeEnd = matchingWeek.end_date",
  "existing?.scheme_id === schemeId",
  "const numberedLesson = scheme.lesson_number ?? scheme.period",
  "setChoices(available)",
  "Choose this lesson’s timetable period",
]) assert.ok(launcher.includes(token), 'Scheme launcher lost exact week / identity requirement: '+token)
assert.ok(!launcher.includes('nairobiDateAdd(\n          rangeStart,\n          55'), 'Never find a lesson plan in a different instructional week')
console.log('Grade 4 English native reader, teacher hierarchy and Scheme week identity checks passed')
