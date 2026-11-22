import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const page = read('app/learn/grade-4/mathematics/place-value/page.tsx')
const lesson = read('components/learn/Grade4PlaceValueContentReader.tsx')
const lessonStyles = read('components/learn/Grade4PlaceValueContentReader.module.css')
const time = read('components/learn/Grade4TimeContentReader.tsx')
const timeStyles = read('components/learn/Grade4TimeContentReader.module.css')
const sharedReader = read('components/learn/UniversalLearnReader.tsx')
const chart = read('components/learn/PlaceValuePreviewChart.tsx')
const outline = read('components/learn/SubjectTextbookOutline.tsx')
const schoolCatalog = read('lib/learn/schoolCatalog.ts')
const editorial = read('content/curriculum/production/grade4-mathematics-whole-numbers-objective1.v3.learner.md')

// The existing published textbook RPC remains the release/entitlement authority.
assert.match(page, /loadPublicReader\(PUBLICATION_ID\)/)
assert.match(page, /findChapter\(reader, CHAPTER_ID\)/)
assert.match(page, /chapter\.status !== 'published'/)
assert.match(page, /!chapter\.can_read/)
assert.match(page, /!Array\.isArray\(chapter\.blocks\)/)
assert.match(page, /stop <= 0\) notFound\(\)/)
assert.match(page, /FIRST_LESSON_STOP\.toLowerCase\(\)/)
assert.match(page, /REQUIRED_LESSON_HEADINGS\.every\(hasHeading\)/)
assert.match(page, /blocks=\{publishedLesson\}/)
assert.match(page, /Grade4PlaceValueContentReader/)
assert.match(page, /chapter\.blocks\.slice\(0, stop\)/)
assert.match(page, /Reading and writing numerals/)
assert.match(page, /robots: \{ index: false/)
assert.doesNotMatch(page, /readFileSync|grade4-mathematics-whole-numbers-objective1\.v3\.learner\.md/)

// Production 404 regression: compare normalized released heading on both sides.
const publishedHeading = 'Reading and writing numerals'
const boundary = page.match(/const FIRST_LESSON_STOP = '([^']+)'/)?.[1]
assert.equal(boundary, publishedHeading)
assert.equal(publishedHeading.trim().toLowerCase(), boundary.toLowerCase())
assert.notEqual(publishedHeading.toLowerCase(), boundary)

// Same UI contract as Grade 4 Mathematics Time, but with published Place Value blocks.
assert.match(time, /Grade4TimeContentReader\.module\.css/)
assert.match(time, /<UniversalLearnReader/)
assert.match(lesson, /Grade4TimeContentReader\.module\.css/)
assert.match(lesson, /<UniversalLearnReader/)
assert.match(lesson, /timeStyles\.hero/)
assert.match(lesson, /timeStyles\.breadcrumbs/)
assert.match(lesson, /timeStyles\.lessonChooser/)
assert.match(lesson, /timeStyles\.article/)
assert.match(lesson, /timeStyles\.articleHead/)
assert.match(lesson, /timeStyles\.goal/)
assert.match(lesson, /timeStyles\.textSettings/)
assert.match(lesson, /timeStyles\.lessonPager/)
assert.match(lesson, /LearningNotebookPrompt/)
assert.match(lesson, /<PlaceValuePreviewChart/)
assert.match(lesson, /Practice Place Value/)
assert.match(lesson, /Back to Mathematics/)
assert.match(lesson, /Read the full published topic/)
assert.match(lesson, /chapter-level reading tools and saved progress/)
assert.match(lesson, /showTeachingTools=\{false\}/, 'Do not invent unverified lesson tools')
assert.match(sharedReader, /export default function UniversalLearnReader/)
assert.match(lessonStyles, /\.richText table/)
assert.match(timeStyles, /\.articleHead/)

// All four textbook sections are presented in source order, without creating
// new publication versions, grades, scores or completion claims.
assert.match(lesson, /'Introduction'/)
assert.match(lesson, /'What is Place Value\?'/)
assert.match(lesson, /'Worked Example 1'/)
assert.match(lesson, /'Whole numbers in everyday life'/)
assert.match(lesson, /blocks\.slice\(intro, learn\)/)
assert.match(lesson, /blocks\.slice\(learn, worked\)/)
assert.match(lesson, /blocks\.slice\(worked, everyday\)/)
assert.match(lesson, /blocks\.slice\(everyday\)/)
assert.match(lesson, /numberedList/)
assert.match(lesson, /bulletList/)
assert.match(lesson, /<details className=\{styles\.answerReveal\}/)
assert.match(lesson, /aria-pressed=\{largeText\}/)
assert.doesNotMatch(lesson, /service_role|mark_chapter_complete|upsert\(|update_reading_progress|setCompleted\(/i)

// Existing learner discovery, textbook and accessible chart remain.
assert.match(outline, /Open Lesson 1/)
assert.match(outline, /Published topic reading/)
assert.match(schoolCatalog, /title: 'Place Value and Total Value'/)
assert.match(chart, /aria-pressed=\{selected === i\}/)
assert.match(chart, /aria-live="polite"/)
assert.match(editorial, /### Mastery check: can you explain the mathematics\?/)
for (const [value, digits] of [[24907,[2,4,9,0,7]],[40506,[4,0,5,0,6]],[50505,[5,0,5,0,5]]]) {
  assert.equal(digits.reduce((sum,digit,index)=>sum+digit*[10000,1000,100,10,1][index],0),value)
}
console.log('Grade 4 Place Value: released blocks in Grade 4 Time lesson design, protected progression and practice')
