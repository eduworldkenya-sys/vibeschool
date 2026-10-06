import assert from 'node:assert/strict'
import fs from 'node:fs'

const onboarding=fs.readFileSync('app/teacher/onboarding/students/page.tsx','utf8')
const workspace=fs.readFileSync('app/teacher/classhub/[id]/student/[studentId]/page.tsx','utf8')

assert.match(onboarding,/teacher_add_student_v2/,'onboarding must use the idempotent canonical learner creator')
assert.doesNotMatch(onboarding,/rpc\('teacher_add_student'/,'legacy non-request-scoped creator must not remain')
assert.match(onboarding,/p_request_id:\s*s\.request_id/,'each learner create must retain a stable request id across retries')
assert.match(onboarding,/p_admission_number:\s*s\.admission_number\.trim\(\)\s*\|\|\s*null/,'admission number must remain optional')
assert.doesNotMatch(onboarding,/Admission number is required/,'optional admission numbers must not be blocked in the UI')
assert.match(onboarding,/student\/\$\{addedStudentIds\[0\]\}\?tab=about&setup=1/,'successful creation must hand off to progressive learner information')

assert.match(workspace,/type LearnerContextKey/,'learner context must use an explicit typed contract')
assert.match(workspace,/teacher_learner_events/,'learner context must extend the canonical event authority')
assert.match(workspace,/event_kind:\s*"management"/,'context changes must be durable management events')
assert.match(workspace,/visibility:\s*"class_teacher"/,'stable learner context must remain class-teacher scoped')
assert.match(workspace,/provenance:\s*"teacher-entered"/,'teacher-entered facts must expose provenance')
assert.match(workspace,/supersedes_event_id/,'updates must preserve append-only history')
assert.match(workspace,/request_id:\s*requestId/,'context writes must retain a retry identity')
assert.match(workspace,/insertError\.code === "23505"/,'committed retry duplicates must be reconciled instead of creating a second version')
assert.doesNotMatch(workspace,/from\(["']student_profiles["']\).*\.(insert|update|upsert)/s,'teacher learner context must not mutate the legacy account projection')
assert.match(workspace,/Attendance, marks, homework and progress stay in their existing VibeSchool records/,'UI must explain that operational modules remain authoritative')
assert.match(workspace,/only to the class teacher/,'UI must explain the learner-context visibility boundary')
assert.match(workspace,/requestedSubjectId \? tabs\.filter\(\(item\) => item !== "about"\)/,'subject-scoped teachers must not receive the class-teacher learner context editor')
assert.match(workspace,/aria-pressed=\{tab === item\}/,'learner workspace tabs must expose selected state accessibly')

console.log('canonical learner record contract: PASS')
