import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')

const layout = read('components/teacher/navigation.ts')
const more = read('app/teacher/more/page.tsx')
const twin = read('lib/teacher/twin.ts')
const subject = read('components/teacher/SubjectCompanion.tsx')
const results = read('app/teacher/results/page.tsx')
const alias = read('app/teacher/exams/page.tsx')
const workbook = read('components/teacher/workbook/ClassWorkbook.tsx')
const workspace = read('components/teacher/classroom/ClassWorkspace.tsx')

const checks = {
  'Teacher Assess tray exposes Exams': layout.includes("label: 'Exams'") && layout.includes("href: '/teacher/results'"),
  'Assess tray language is reconciled': layout.includes("assess: [") && layout.includes("label: 'Assessments'") && layout.includes("label: 'Exams'"),
  'All tools exposes Exams': more.includes("teacherTools[tab.id]") && layout.includes("href: '/teacher/results'"),
  'Twin resolves Exam Centre to canonical route': twin.includes("label: 'Exam Centre', url: '/teacher/results'"),
  'Twin no longer emits dead /teacher/exams action': !twin.includes("label: 'Exam Centre', url: '/teacher/exams'"),
  'Compatibility route redirects safely': alias.includes("redirect('/teacher/results')"),
  'Subject companion exposes Exams': subject.includes('id: "exams"') && subject.includes('label: "Exams"'),
  'Subject companion carries class and subject': subject.includes('/teacher/results?classId=') && subject.includes('&subjectId='),
  'Class workspace links to exams': workspace.includes('/teacher/results?classId=${classId}'),
  'Workbook hands off to Exam Centre': workbook.includes('Open Exam Centre / full analysis'),
  'Exam Centre identity remains canonical': results.includes('>Exam Centre</div>'),
  'Exam context exposes completion': results.includes('marks entered') && results.includes('% complete'),
  'Locked exam remains read-only': results.includes('activeExam.is_locked') && results.includes('This exam is locked; marks are read-only.'),
  'Canonical result authority preserved': results.includes('saveCanonicalExamResult'),
  'No duplicate results write introduced': !results.includes(".from('exam_results').upsert") && !results.includes('.from("exam_results").upsert'),
}

let failed = 0
for (const [name, ok] of Object.entries(checks)) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed += 1
}
if (failed) {
  console.error(`\n${failed} Exam OS contract check(s) failed.`)
  process.exit(1)
}
console.log(`\nPASS  Exam OS canonical closure contract (${Object.keys(checks).length} checks)`)
