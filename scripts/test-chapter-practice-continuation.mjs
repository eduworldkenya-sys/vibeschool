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


const continuity = read('components/read/ReaderContinuityCoordinator.tsx')
const study = read('components/read/ReaderStudyInteractions.tsx')
const annotations = read('components/read/ReaderAnnotationManager.tsx')
const editorial = read('components/learn/PublishedTextbookEditorial.module.css')

// Exactly one authoritative reader progress writer.
assert.doesNotMatch(reader, /record_reading_progress/, 'ReaderClient must not duplicate progress writes')
assert.match(continuity, /record_reading_progress/, 'Canonical progress and saved position remain')
assert.match(reader, /canRead:active\.can_read&&active\.status==="published"&&!lessonActive/)
assert.match(continuity, /detail\.canRead !== true/, 'Locked and preview content must not write progress')
assert.match(continuity, /generation !== chapterGeneration/, 'Stale chapter restoration must be dropped')
assert.match(continuity, /activeRef\.current\?\.chapterId !== snapshot\.chapterId/)

// The bottom controls invoke the reader API, not brittle text-matched DOM buttons.
assert.match(reader, /vibe:reader-open-contents/)
assert.match(continuity, /new Event\("vibe:reader-open-contents"\)/)
assert.match(reader, /vibe:reader-navigate/)
assert.match(continuity, /new CustomEvent\("vibe:reader-navigate"/)
assert.doesNotMatch(continuity, /text\.startsWith\(label\)/)
assert.match(reader, /disabled=\{!readableChapter\(chapter\)\}/)
assert.match(reader, /disabled=\{previousIndex<0\}/)
assert.match(reader, /disabled=\{nextIndex<0\}/)

// Only the annotation manager renders saved highlights and note markers.
assert.doesNotMatch(study, /cssApi\.highlights\.set|get_my_study_workspace_items/)
assert.match(study, /vibe:reader-annotation-changed/, 'Saving notifies the annotation owner')
assert.match(annotations, /vibe:reader-annotation-changed/)
assert.match(annotations, /cssApi\.highlights\.set\("vibe-reader-highlights"/)
assert.match(annotations, /chapterIdRef\.current !== chapterId/, 'Ignore stale annotation results')

// Text sizing applies to the actual published book, not just controls.
assert.match(reader, /"--reader-book-font-size":font\+"px"/)
assert.match(editorial, /var\(--reader-book-font-size, 1\.04rem\)/)
assert.match(launcher, /\/login\?redirect=/, 'Chapter practice survives sign-in')
console.log('PASS: single-owner reader continuity, annotations, accessible navigation and font scaling')
