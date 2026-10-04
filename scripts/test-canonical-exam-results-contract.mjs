import fs from 'node:fs'

function read(path) { return fs.readFileSync(path, 'utf8') }
function check(condition, message) {
  if (!condition) { console.error(`FAIL: ${message}`); process.exitCode = 1 }
  else console.log(`PASS: ${message}`)
}
function lacks(source, pattern, message) { check(!pattern.test(source), message) }

const semantics = read('supabase/migrations/20261004151143_canonical_exam_result_semantics_v2.sql')
const intelligence = read('supabase/migrations/20261004151511_canonical_exam_intelligence_semantics.sql')
const policy = read('supabase/migrations/20261004151652_teacher_exam_subject_policy_authority.sql')
const authority = read('lib/teacher/examResultAuthority.ts')
const model = read('lib/assessment/exam-results.ts')
const resultsPage = read('app/teacher/results/page.tsx')
const markbook = read('components/teacher/ProfessionalMarkbook.tsx')
const consolePage = read('components/teacher/AssessmentIntelligenceConsole.tsx')
const admin = read('app/admin/academics/gradebook/page.tsx')
const reportPicker = read('app/teacher/results/report-card/page.tsx')
const reportCard = read('app/teacher/results/report-card/[studentId]/page.tsx')
const student = read('app/student/marks/page.tsx')
const twin = read('lib/twin/service.ts')

for (const state of ['entered','absent','not_assessed','exempt','pending','incomplete','late','transferred','awaiting_marking']) {
  check(semantics.includes(`'${state}'`) && model.includes(`'${state}'`), `canonical result state ${state} is shared by DB and app`)
}
check(semantics.includes('alter column marks drop not null'), 'non-score states do not require fake zero marks')
check(semantics.includes('max_marks') && semantics.includes('generated always as') && semantics.includes('marks / max_marks'), 'percentage is derived from raw score and recorded denominator')
check(semantics.includes("is_absent = (result_state='absent')"), 'legacy absence flag cannot contradict canonical result state')
check(semantics.includes('pg_advisory_xact_lock') && semantics.includes('p_expected_updated_at'), 'result mutations retain race and stale-tab protection')
check(semantics.includes('teacher_subject_not_authorized') && semantics.includes('student_not_in_current_class') && semantics.includes('active_school_changed'), 'result authority enforces live teaching, roster and active-school scope')
check(semantics.includes('revoke all on function public.teacher_save_exam_result_state') && semantics.includes('to authenticated'), 'canonical result mutation is not public/anonymous')
check(policy.includes('exam_subject_policy_has_results'), 'score denominator cannot be silently rewritten after results exist')
check(policy.includes('p_pass_mark>p_max_marks') && policy.includes('p_max_marks<=0'), 'subject scoring policy validates maximum and pass marks')

check(intelligence.includes('er.percentage') && intelligence.includes("er.result_state='entered'"), 'exam intelligence uses normalized scored evidence')
check(intelligence.includes("'result_states'") && intelligence.includes("'not_entered'"), 'intelligence reports evidence completeness instead of fake zeroes')
lacks(intelligence, /'EE'|'ME'|'AE'|'BE'|marks\s*>?=\s*80/, 'exam intelligence does not invent fixed grade bands')

check(authority.includes('teacher_get_exam_subject_policy') && authority.includes('teacher_save_exam_result_state'), 'frontend mutations use canonical policy/result authority')
check(authority.includes('teacher_clear_exam_result') && authority.includes('expectedUpdatedAt'), 'clear/update operations remain optimistic-concurrency aware')
check(resultsPage.includes('Maximum marks') && resultsPage.includes('Pass mark'), 'teacher can configure real raw-score denominator and pass mark')
check(resultsPage.includes('result_state') && resultsPage.includes('max_marks') && resultsPage.includes('percentage'), 'Exam Centre reads canonical result semantics')
lacks(resultsPage, /getGrade\(|\/100\b|marks\s*>?=\s*80/, 'Exam Centre has no fixed /100 or grade-band assumptions')

for (const label of ['Absent','Not assessed','Exempt','Pending','Incomplete','Late','Transferred','Awaiting marking']) {
  check(markbook.includes(label), `markbook exposes natural state: ${label}`)
}
check(markbook.includes('maxMarks') && markbook.includes('examResultPercentage'), 'markbook validates and displays the actual denominator')
lacks(markbook, /getGrade\(|\/100\b|marks\s*>?=\s*80/, 'markbook does not manufacture grades from raw marks')

check(consolePage.includes('at_or_above_target') && consolePage.includes('not_scored'), 'intelligence UI renders neutral target/evidence buckets')
lacks(consolePage, /Record<"EE"|marks\s*>?=\s*80/, 'intelligence UI has no hard-coded grade distribution')

check(admin.includes('const relevantExams = examRows'), 'admin does not hide teacher exams merely because subject config is absent')
check(admin.includes('result_state') && admin.includes('max_marks') && admin.includes('percentage'), 'admin oversight consumes canonical result state and denominator')
check(reportPicker.includes('percentage') && reportPicker.includes('normalizeExamResultState'), 'compiled learner report summaries use normalized percentages')
lacks(reportPicker, /getGrade\(|meanGrade|gradeColor|totalMarks/, 'compiled report summary does not add incomparable raw marks or invent grades')
check(reportCard.includes('max_marks') && reportCard.includes('percentage') && reportCard.includes('result_state'), 'learner report card preserves raw denominator, percentage and state')
lacks(reportCard, /getGrade\(|meanGradeFromArr|gradeColor|\/100\b|r\.marks\s*>?=\s*80/, 'learner report card does not invent exam grade bands or assume /100')
check(student.includes('max_marks, percentage, result_state') && student.includes('examResultStateLabel'), 'Student OS shows canonical exam scores and non-score states')
check(twin.includes('getCanonicalExamSubjectPolicy') && twin.includes('proposal.maxMarks'), 'Twin reads authoritative exam scoring before proposing a mark')
lacks(twin, /score\/100|marks\/100|proposal\.score}\/100/, 'Twin has no fixed /100 mark mutation language')

if (process.exitCode) {
  console.error('\nCanonical exam/results contract FAILED')
  process.exit(process.exitCode)
}
console.log('\nCanonical exam/results contract PASSED')
