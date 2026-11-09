import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const code=readFileSync('app/student/vibelearn/practice/page.tsx','utf8')
assert.match(code,/listMyAssessmentAssignments/)
assert.match(code,/Grade 4 English/)
assert.match(code,/\/student\/assessment\/\$\{item\.assignmentId\}/)
assert.match(code,/\/student\/results\/\$\{encodeURIComponent\(item\.attemptId as string\)\}/)
assert.match(code,/item\.canStart/)
assert.match(code,/item\.resultStatus === 'released'/)
assert.match(code,/recordGroundedPracticeAnswer/)
assert.match(code,/recordVibeLearnPracticeAnswer/)
assert.doesNotMatch(code,/\.from\('exam_question_bank'\)/)
assert.doesNotMatch(code,/correct_index/)
console.log('PASS: Grade 4 English practice reuses secure assessment assignment, result and marking routes')
