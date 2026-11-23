import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const page = read('app/student/study/page.tsx')
const css = read('app/student/study/study.module.css')
const visible = page.slice(page.indexOf('return <main className={styles.page}>'),page.indexOf('<details className={styles.more}'))

test('Learn starts with one meaningful reading action and exactly four primary destinations', () => {
  assert.match(visible, /<h1>Learn<\/h1>/)
  assert.match(visible, /!loading && savedReading\.length > 0/)
  assert.match(visible, /href=\{safeInternalRoute\(item\.actionUrl\)\}/)
  assert.match(visible, /<span>Continue<\/span>/)
  assert.match(visible, /Start learning/)
  assert.match(visible, /Browse lessons/)
  assert.match(visible, /className=\{styles\.progressTrack\} role="progressbar"/)
  assert.equal((visible.match(/className=\{styles\.learningTile\}/g)||[]).length,4)
  for(const destination of ['/student/vibelearn/topic-practice','/learn/stories','/student/explore'])
    assert.ok(visible.includes(destination),'Missing essential destination: '+destination)
  assert.match(visible,/href=\{browseHref\} className=\{styles\.learningTile\}/)
  assert.doesNotMatch(visible,/href="\/student\/vibelearn\/exams"|href="\/student\/marks"/)
})

test('grade-aware browsing and no empty teacher assignment cards', () => {
  assert.match(page,/recogniseLearnerGrade\(identity\.className\)/)
  assert.match(page,/encodeURIComponent\(grade\)/)
  assert.match(visible,/!loading && assigned\.length > 0/)
  assert.match(visible,/href=\{safeInternalRoute\(assigned\[0\]\.actionUrl\)\}/)
  assert.match(page,/function safeInternalRoute/)
})

test('advanced insight calls do not delay the reader or add an alternate source of learning records', () => {
  const core = page.slice(page.indexOf('  useEffect(()=>{'),page.indexOf('  // Defer optional evidence'))
  assert.match(core,/getVibeLearnWorkstation\(\)\.then/)
  assert.match(core,/getAssignedReading\(\)\.then/)
  assert.doesNotMatch(core,/Promise\.all/)
  assert.doesNotMatch(core,/getAdaptiveLearningPath|getAdaptiveResourceRecommendations|getExamReadinessBrief/)
  assert.match(page,/if\(!moreOpen\|\|loading\|\|!workspace\|\|moreLoaded\)return/)
  assert.match(page,/getLiveClassResources\(workspace\)\.catch/)
  assert.match(page,/onToggle=\{event=>setMoreOpen\(event\.currentTarget\.open\)\}/)
  assert.match(page,/!loading && !workspace \? <p/)
  assert.doesNotMatch(page,/workspace\?\.twin\.now/)
})

test('existing destinations stay accessible without crowding the first screen', () => {
  assert.match(page,/<summary>More learning/)
  for(const destination of ['/student/vibelearn/exams','/student/vibelearn/revision','/student/tasks','/student/marks','/student/funhub','/student/create'])
    assert.ok(page.includes(destination),'Lost destination: '+destination)
  assert.match(page,/<StudentLearningFeatureLinks mode="learn"/)
  assert.match(page,/getAssignedReading/)
  assert.match(page,/Your learning path/)
  assert.match(page,/Recommended support/)
  assert.match(page,/getExamReadinessBrief/)
})

test('compact responsive styling preserves theme and accessibility', () => {
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/)
  assert.match(css,/@media\(max-width:680px\)/)
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(css,/focus-visible/)
  assert.match(css,/prefers-reduced-motion:reduce/)
  assert.match(css,/var\(--vs-card\)/)
  assert.match(css,/var\(--vs-accent\)/)
  assert.doesNotMatch(css,/#(?:4f46e5|5145e8|6366f1)\b/i)
})
