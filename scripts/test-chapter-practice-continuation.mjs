import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const reader = read('app/read/textbook/[publicationId]/ReaderClient.tsx')
const launcher = read('components/read/ReaderAssessmentLauncher.tsx')
const practice = read('app/student/vibelearn/practice/page.tsx')
const server = read('lib/student/vibelearn.ts')

// Click-time provenance: the displayed chapter is the sole practice source.
assert.match(reader, /new CustomEvent\("vibe:reader-open-practice"/)
assert.match(reader, /publicationId,chapterId:active\.id,nextChapterId/)
assert.match(reader, /chapter\.can_read&&chapter\.status==="published"/)
assert.match(launcher, /validSource\(\(event as CustomEvent<Detail>\)\.detail\) \?\? activeSource\.current/)
assert.match(launcher, /await sb\.auth\.getUser\(\)/)
assert.match(launcher, /query\.set\("next", source\.nextChapterId\)/)
assert.match(launcher, /\/student\/vibelearn\/practice\?/)

// Exact chapter questions still use published source and server-owned scoring.
assert.match(practice, /getGroundedChapterPractice\(requestedPublicationId, requestedChapterId, 10\)/)
assert.match(practice, /recordGroundedPracticeAnswer\(\{ contentBlockId: question\.contentBlockId/)
assert.match(server, /student_get_grounded_chapter_practice/)
assert.match(server, /student_record_grounded_practice_answer/)

// Learner controls: feedback, re-read, retry, progress without a false mastery claim.
assert.match(practice, /const needsReview = correct < questions\.length/)
assert.match(practice, /Review this unit/)
assert.match(practice, /Try again/)
assert.match(practice, /Continue learning/)
assert.match(practice, /not certified mastery/)
assert.match(practice, /const validNextChapterId = \/\^\[0-9a-f\]/)
console.log('PASS: chapter-scoped practice continuation retains server scoring and honest next actions')
