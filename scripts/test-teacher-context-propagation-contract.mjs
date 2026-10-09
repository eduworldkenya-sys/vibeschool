import assert from 'node:assert/strict'
import fs from 'node:fs'

const classHub = fs.readFileSync('app/teacher/classhub/page.tsx', 'utf8')
const subjectHub = fs.readFileSync('app/teacher/subjecthub/page.tsx', 'utf8')
const lessonContext = fs.readFileSync('lib/teaching/lessonContext.ts', 'utf8')
const learnerWorkspace = fs.readFileSync('app/teacher/classhub/[id]/student/[studentId]/page.tsx', 'utf8')
const pulse = fs.readFileSync('lib/pulse/fetcher.ts', 'utf8')
const academicTerm = fs.readFileSync('lib/academicTerm.ts', 'utf8')
const scheme = fs.readFileSync('app/teacher/scheme/AuthoritySchemePage.jsx', 'utf8')
const assessment = fs.readFileSync('app/teacher/assessment/page.tsx', 'utf8')
const tpad = fs.readFileSync('app/teacher/tpad/page.tsx', 'utf8')
const attendanceRanges = fs.readFileSync('lib/attendance/ranges.ts', 'utf8')
const termProvisioningMigration = fs.readFileSync('supabase/migrations/20261001193000_canonical_school_term_provisioning.sql', 'utf8')

assert.match(classHub, /teacher_get_operating_context/)
assert.match(classHub, /from\('student_classes'\)/)
assert.match(classHub, /eq\('school_id', activeSchoolId\)/)
assert.doesNotMatch(classHub, /get_my_teacher_school_context/)

assert.match(subjectHub, /teacher_get_operating_context/)
assert.match(subjectHub, /get_allowed_teaching_subjects/)
assert.match(subjectHub, /create_teacher_class_assignment/)
assert.match(subjectHub, /from\('student_classes'\)/)
assert.doesNotMatch(subjectHub, /resolveSchoolId/)
assert.doesNotMatch(subjectHub, /CBC_SUBJECTS/)
assert.doesNotMatch(subjectHub, /from\('students'\)\.select\('class_id'\)/)

assert.match(lessonContext, /from\('student_classes'\)[\s\S]*?select\('student_id'\)/)
assert.match(lessonContext, /from\('students'\)[\s\S]*?\.in\('id', studentIds\)/)
assert.doesNotMatch(lessonContext, /student_id,students\(/)

assert.match(learnerWorkspace, /from\("student_classes"\)\.select\("student_id"\)/)
assert.match(learnerWorkspace, /from\("students"\)\.select\("id,name,admission_number,profile_id,deleted_at"\)/)
assert.doesNotMatch(learnerWorkspace, /student_id,students\(/)

assert.match(pulse, /from\("student_classes"\)/)
assert.doesNotMatch(pulse, /from\("students"\)[\s\S]{0,160}class_id/)

// Term-dependent Teacher OS surfaces must self-heal through one server-authoritative
// active-school RPC rather than instructing teachers to ask an admin to create terms.
assert.match(academicTerm, /ensure_my_active_school_term/)
assert.match(academicTerm, /await ensureMyActiveSchoolTerm\(occurrenceDate\)/)
assert.match(pulse, /getActiveTerm\(schoolId\)/)
assert.match(scheme, /ensureMyActiveSchoolTerm\(todayIso\(\)\)/)
assert.match(assessment, /ensureMyActiveSchoolTerm\(\)/)
assert.match(tpad, /ensureMyActiveSchoolTerm\(\)/)
assert.match(attendanceRanges, /ensureMyActiveSchoolTerm\(today\)/)

for (const token of [
  'private.generate_term_weeks_internal',
  'public.ensure_my_active_school_term',
  'private.ensure_school_term_internal',
  'term_weeks_term_week_unique',
  'trg_provision_school_term',
  'vibeschool-school-term-reconcile',
  'private.school_term_health',
]) {
  assert.ok(termProvisioningMigration.includes(token), `Missing canonical term authority: ${token}`)
}
assert.match(termProvisioningMigration, /revoke all on function private\.generate_term_weeks_internal\(uuid\) from public,anon,authenticated,service_role/)
assert.match(termProvisioningMigration, /on conflict\(term_id,week_number\) do nothing/)
assert.doesNotMatch(scheme, /Ask your admin to set up the current term/i)

console.log('Teacher context propagation uses canonical school, assignment, subject, enrollment and self-healing term authorities')
