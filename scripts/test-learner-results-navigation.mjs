import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const results = read('app/student/results/[attemptId]/page.tsx')
const revision = read('app/student/vibelearn/revision/page.tsx')
const exams = read('app/student/vibelearn/exams/page.tsx')
const practice = read('app/student/vibelearn/practice/page.tsx')
const mistakes = read('app/student/vibelearn/mistakes/page.tsx')

assert.match(results, /result\.canRetry\s*&&/, 'Retake action must follow server canRetry flag')
assert.match(results, /encodeURIComponent\(result\.assignmentId\)/, 'Retake must target the same assessment assignment')
assert.match(results, /Try this exam again/, 'Retake button must communicate intended action')
assert.doesNotMatch(results, /Open My Assessments/, 'No generic assessment hub redirect from retake card')
assert.match(results, /\/student\/vibelearn\/exams/, 'Results must offer a canonical back-to-exams route')
assert.match(exams, /listMyAssessmentAssignments/, 'Exam discovery must use canonical assignments')
assert.match(practice, /recordGroundedPracticeAnswer/, 'Practice scoring remains canonical')
assert.match(mistakes, /verifyMistakeMastery/, 'Only evidence-based mastery verification is presented')
assert.doesNotMatch(revision, /Mark understood/, 'Revision must not provide competing mistake resolution')
assert.doesNotMatch(revision, /resolveMistake/, 'Revision must not invoke the old resolution shortcut')
assert.match(revision, /daysRemaining > 0/, 'Expired or unset exam date should not show a misleading countdown')
console.log('Learner retake, revision and mastery navigation: PASS')
