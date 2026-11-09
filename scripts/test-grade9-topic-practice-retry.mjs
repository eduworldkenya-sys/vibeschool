import assert from 'node:assert/strict'
import fs from 'node:fs'
const ui=fs.readFileSync('components/student/CanonicalTopicPractice.tsx','utf8')
assert.match(ui,/Retry missed or skipped questions for learning/)
assert.match(ui,/retryChoices/)
assert.match(ui,/Correct on retry/)
assert.match(ui,/Try this question again/)
assert.match(ui,/These retries do not change your recorded score/)
assert.match(ui,/startOrResumeAttempt/)
assert.match(ui,/saveResponse/)
assert.match(ui,/submitAttempt/)
assert.match(ui,/student_get_canonical_topic_practice_feedback/)
assert.doesNotMatch(ui,/student_record_vibelearn_practice_answer/)
console.log('Grade 9 Topic Practice retry contract passed')
