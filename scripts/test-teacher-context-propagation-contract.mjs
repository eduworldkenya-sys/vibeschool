import assert from 'node:assert/strict'
import fs from 'node:fs'

const classHub = fs.readFileSync('app/teacher/classhub/page.tsx', 'utf8')
const subjectHub = fs.readFileSync('app/teacher/subjecthub/page.tsx', 'utf8')
const lessonContext = fs.readFileSync('lib/teaching/lessonContext.ts', 'utf8')
const learnerWorkspace = fs.readFileSync('app/teacher/classhub/[id]/student/[studentId]/page.tsx', 'utf8')
const pulse = fs.readFileSync('lib/pulse/fetcher.ts', 'utf8')

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

console.log('Teacher context propagation uses canonical school, assignment, subject and enrollment authorities')
