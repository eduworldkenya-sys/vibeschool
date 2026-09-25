import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

const workspace = read('lib/teacher/workspace.ts')
const academicTerm = read('lib/academicTerm.ts')

const requiredWorkspaceTokens = [
  "resolveSchoolId",
  "loadTeacherTimetableForRange",
  "resolveOccurrence",
  ".eq('teacher_id', input.teacherId)",
  ".eq('school_id', schoolId)",
  "klass.school_id !== schoolId",
  "assignmentByKey",
]

for (const token of requiredWorkspaceTokens) {
  if (!workspace.includes(token)) {
    throw new Error('Teacher workspace authority missing: ' + token)
  }
}

if (academicTerm.includes("new Date().toISOString().slice(0, 10)")) {
  throw new Error('Academic term authority must not derive Kenya dates from UTC ISO.')
}

if (!academicTerm.includes('nairobiDateStr()')) {
  throw new Error('Academic term authority must use Nairobi calendar dates.')
}

console.log('Teacher workspace authority contract: PASS')
