import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(file, 'utf8')
const page = read('app/learn/grade-4/mathematics/place-value/page.tsx')
const reader = read('app/read/textbook/[publicationId]/ReaderClient.tsx')
const loop = read('components/read/LearningLoopArticle.tsx')
const chart = read('components/learn/PlaceValuePreviewChart.tsx')
const outline = read('components/learn/SubjectTextbookOutline.tsx')
const editorial = read('content/curriculum/production/grade4-mathematics-whole-numbers-objective1.v3.learner.md')

// The published textbook RPC is the only canonical content / entitlement source.
assert.match(page,/loadPublicReader\(PUBLICATION_ID\)/)
assert.match(page,/findChapter\(reader, CHAPTER_ID\)/)
assert.match(page,/chapter\.status !== 'published'/)
assert.match(page,/!chapter\.can_read/)
assert.match(page,/!Array\.isArray\(chapter\.blocks\)/)
assert.match(page,/stop <= 0\) notFound\(\)/)
assert.match(page,/ReaderClient/)
assert.match(page,/lessonFocus=/)
assert.match(page,/stopBeforeHeading: FIRST_LESSON_STOP/)
assert.match(page,/Whole numbers in everyday life/)
assert.match(page,/robots: \{ index: false/)
assert.doesNotMatch(page,/readFileSync|grade4-mathematics-whole-numbers-objective1\.v3\.learner\.md/)

// Preserve canonical reading tools but do not credit partial reading to full-chapter progress.
assert.match(reader,/const lessonActive=Boolean/)
assert.match(reader,/return stop>0\?available\.slice\(0,stop\):\[\]/)
assert.match(reader,/if\(!active\?\.can_read\|\|lessonActive\)return;/)
assert.match(reader,/progressScope=\{lessonActive\?/)
assert.match(loop,/vibe\.learning-loop\.lesson\./)
assert.match(reader,/Practice Place Value/)
assert.match(reader,/router\.push\("\/student\/vibelearn\/topic-practice/)
assert.match(reader,/Read the full topic/)
assert.match(reader,/PlaceValuePreviewChart/)
assert.match(reader,/ReaderNarrationMiniPlayer/)
assert.match(reader,/OfflineBookSaveButton/)
assert.match(reader,/if\(!active\?\.can_read\)return;/)

// The lesson remains the first accessible user journey, with the existing book intact.
assert.match(outline,/const open = resumed \?\? pilotLesson \?\? first/)
assert.match(outline,/Open Lesson 1/)
assert.match(outline,/Published topic reading/)
assert.match(outline,/topic\.entries\.map\(/)
assert.match(outline,/isGrade4Maths && topic\.id === '0f130af0-8f3c-433a-a0df-453927dece7f'/)
assert.doesNotMatch(outline,/Open preview|Preview answers are not saved|Official chapter review continues/)

// Keep the original mathematics checks and accessible interactive exploration.
assert.match(editorial,/### Mastery check: can you explain the mathematics\?/)
assert.match(chart,/aria-pressed=\{selected === i\}/)
assert.match(chart,/aria-live="polite"/)
for (const [number,digits] of [[24907,[2,4,9,0,7]],[40506,[4,0,5,0,6]],[50505,[5,0,5,0,5]]])
  assert.equal(digits.reduce((sum,digit,index)=>sum+digit*[10000,1000,100,10,1][index],0),number)

for (const forbidden of [/service_role/i,/publish_publication\s*\(/i,/certify_/i,/answer\s*key/i,/marking_scheme/i]) {
  assert.ok(!forbidden.test(page), 'Lesson route must never self-publish or expose answers')
}
console.log('Grade 4 lesson page: canonical published reader, scoped lesson progression and protected practice')
