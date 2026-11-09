import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const code = readFileSync('app/student/vibelearn/practice/page.tsx', 'utf8')

// Grade 4 uses the same approved assessment pathway as other grades.
assert.match(code, /listMyAssessmentAssignments\(\)/)
assert.match(code, /item\.assessmentType === 'practice'/)
assert.doesNotMatch(code, /isGrade4 && !hasReaderSource/, 'Do not reintroduce a Grade 4-only experience')
assert.match(code, /\/student\/assessment\/\$\{encodeURIComponent\(item\.assignmentId\)\}/)
assert.match(code, /\/student\/results\/\$\{encodeURIComponent\(item\.attemptId as string\)\}/)
assert.match(code, /item\.canStart \|\| active/)
assert.match(code, /item\.resultStatus === 'released'/)
assert.match(code, /recordGroundedPracticeAnswer/)
assert.match(code, /recordVibeLearnPracticeAnswer/)
assert.doesNotMatch(code, /\.from\('exam_question_bank'\)/)
assert.doesNotMatch(code, /correct_index/)
console.log('PASS Grade 4 English retains authorised practice, results and server marking in shared learner interface')
