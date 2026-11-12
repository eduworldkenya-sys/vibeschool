import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../lib/learn/schoolCatalog.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { SCHOOL_LEVELS, fallbackSubjectGroups, groupsForAvailableSubjects,
  levelForGrade, readersForSubject, recogniseLearnerGrade, subjectKey } =
  await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const ui = read('components/learn/SchoolLearnLibrary.tsx')
const css = read('components/learn/SchoolLearnLibrary.module.css')
const publicPage = read('app/learn/page.tsx')
const studentPage = read('app/student/vibelearn/reading/page.tsx')
const courses = read('app/learn/courses/page.tsx')
const catalog = read('lib/learn/schoolCatalog.ts')

assert.equal(SCHOOL_LEVELS.length, 5, 'Early Years, Primary, Junior, Senior, legacy must be separate')
assert.equal(new Set(SCHOOL_LEVELS.flatMap(group => group.grades)).size, 19, 'All levels need unique grade identities')
for (const grade of ['PP1','PP2']) assert.equal(fallbackSubjectGroups(grade)[0].subjects.length, 4)
for (let n = 1; n <= 9; n++) {
  const groups = fallbackSubjectGroups('Grade ' + n)
  const core = groups[0].subjects
  assert.equal(core.length, n <= 3 ? 7 : n <= 6 ? 8 : 9, 'Exact national main learning areas per grade band')
  assert.ok(core.includes('Mathematics') && core.includes('English') && core.includes('Kiswahili'))
}
assert.equal(fallbackSubjectGroups('Grade 10').length, 4, 'Senior School needs pathway grouping')
assert.equal(fallbackSubjectGroups('Playgroup').length, 0, 'Playgroup has no invented KICD subject list')
assert.equal(fallbackSubjectGroups('Form 4').length, 0, 'Legacy Forms cannot receive invented full subject lists')
assert.equal(levelForGrade('Grade 9'), 'junior')
assert.equal(levelForGrade('Grade 10'), 'senior')
assert.equal(recogniseLearnerGrade('Grade 4 Kilimanjaro'), 'Grade 4')
assert.equal(recogniseLearnerGrade('Form 4'), 'Form 4')
assert.equal(subjectKey('Science and Technology'), subjectKey('Science & Technology'))
assert.equal(subjectKey('Creative Arts and Sports'), subjectKey('Creative Arts'))
assert.equal(subjectKey('Agriculture and Nutrition'), subjectKey('Agriculture'))
assert.deepEqual(groupsForAvailableSubjects('Grade 4', ['Mathematics', 'Extra Subject']).flatMap(group => group.subjects), ['Mathematics', 'Extra Subject'],
  'Canonical registered subjects must not be silently dropped')
assert.equal(readersForSubject('Grade 4','Mathematics')[0]?.href, '/learn/grade-4/mathematics/time')
assert.equal(readersForSubject('Grade 1','Creative Activities')[0]?.href, '/learn/grade-1/creative-activities')
assert.equal(readersForSubject('Grade 8','Mathematics').length, 0, 'No fictitious certified reader')
assert.match(ui, /\.eq\('status', 'published'\)/, 'Only published books')
assert.match(ui, /\.eq\('format', 'vibetextbook'\)/, 'Use canonical publication type')
assert.match(ui, /\.range\(/, 'Paginate rather than truncate the first 150 books')
assert.match(ui, /if \(!active\) return/, 'Cancel stale publication requests')
assert.match(ui, /setRegisteredSubjects\(null\)/, 'Reset stale grade registry on grade changes')
assert.match(ui, /\.eq\('grade', grade\)/, 'Use the canonical subject authority')
assert.match(ui, /role="tablist"/, 'Subject tabs must remain accessible')
assert.match(ui, /aria-label="Choose grade"/, 'Grade selector must have an accessible name')
assert.match(ui, /href=\{reader\.href\}/, 'Do not rebuild protected lesson routes')
assert.match(ui, /encodeURIComponent\(book\.id\)/, 'Canonical textbook identity must be safely encoded')
assert.doesNotMatch(ui, /service_role|certified_at\s*=/, 'Browser library must not bypass release controls')
assert.match(css, /@media\(max-width:620px\)/, 'Mobile layout must be present')
assert.match(publicPage, /SchoolLearnLibrary mode="public"/)
assert.match(studentPage, /SchoolLearnLibrary mode="student"/)
assert.match(studentPage, /identity\?\.className/, 'Remember grade from learner identity')
assert.match(courses, /export default function LearnPage/, 'Preserve existing vocational course catalogue')
assert.match(catalog, /No invented Playgroup or legacy Form national subject lists/)
console.log('PASS: school Learn frontend, all grade bands, subject authority, publication gating, existing readers and responsive shared discovery')
