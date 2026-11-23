import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = path => readFileSync(path,'utf8')
const canonical = read('components/student/CanonicalTopicPractice.tsx')
const progress = read('app/student/vibelearn/topic-practice/progress/page.tsx')
const revision = read('app/student/vibelearn/revision/page.tsx')
const result = read('app/student/results/[attemptId]/page.tsx')
const marks = read('app/student/marks/page.tsx')
const practice = read('app/student/vibelearn/practice/page.tsx')
const bottom = read('components/student/BottomNav.tsx')

assert.match(canonical,/router\.push\('\/student\/vibelearn\/topic-practice\/progress'/,'Topic Practice progress button stays inside practice')
assert.doesNotMatch(canonical,/router\.push\('\/student\/marks'\)/,'Topic Practice must not jump to overall report')
assert.match(progress,/student_topic_practice_progress_history/,'Progress uses the canonical learner-owned topic history reader')
assert.match(progress,/completedAttempts/,'Progress uses recorded assessment history')
assert.match(progress,/completed_attempts/,'Progress exposes recorded attempt counts')
assert.match(progress,/resultAvailable/,'Progress respects result release availability')
assert.match(progress,/from=topic-practice/,'Topic Practice result preserves return owner')
assert.match(canonical,/from=topic-practice/,'Canonical completion retains practice return owner')
assert.match(revision,/RevisionTopicStarter/,'Revision uses the authorized topic starter rather than redirecting to unrelated practice')
assert.match(revision,/searchParams\.get\('subject'\)/,'Revision reads subject context')
assert.match(practice,/from=practice/,'Legacy practice result retains its return context')
assert.match(marks,/from=progress-report/,'Overall report result retains return context')
assert.match(result,/from === 'topic-practice'/,'Result returns to Topic Practice')
assert.match(result,/from === 'progress-report'/,'Result returns to overall progress')
assert.match(bottom,/path\.startsWith\("\/student\/assessment\/"\)\) return ""/,'Shared assessment runners do not masquerade as Tasks')
const navCss = read('components/student/BottomNav.module.css')
const learnChrome = read('components/learn/LearnNavigation.tsx')
const primaryDestinations = [...bottom.matchAll(/label: "(?:Home|Learn|Practice|Tasks|Progress)", href:/g)]
assert.equal(primaryDestinations.length,5,'Keep exactly five primary tabs')
const moreDestinations = [...bottom.matchAll(/label: "[^"]+", href: "[^"]+", Icon: [A-Za-z]+, group: "(?:Practice & exams|Reading & study|Planning & tuition|My account)"/g)]
assert.equal(moreDestinations.length,11,'All eleven active secondary destinations including VibeChat must have one canonical group')
assert.ok(bottom.includes('label: "VibeChat", href: "/vibechat"'), 'VibeChat is the learner communication destination')
assert.doesNotMatch(bottom,/label: "Offline Books"|href: "\/offline\/books"/,'Retired offline book access must stay absent')
assert.match(bottom,/MORE\.filter\(item => item\.group ===/,'Groups derive from one source of truth')
assert.match(bottom,/role="dialog" aria-modal="true"/,'More must be an accessible dialog')
assert.match(bottom,/event\.key === "Escape"/,'More closes by Escape')
assert.match(bottom,/event\.key !== "Tab"/,'More traps keyboard focus')
assert.match(bottom,/previousFocus\.focus\(\)/,'Closing More restores the previous focus')
assert.match(bottom,/document\.body\.style\.overflow = "hidden"/,'More locks background scroll')
assert.match(bottom,/matchMedia\("\(min-width:1024px\)"\)/,'Desktop transition closes mobile sheet')
assert.match(navCss,/\.sheetGroupTitle\{/,'More sections remain discoverable on mobile')
assert.match(navCss,/\.sheetActive\{/,'Active destinations remain identifiable')
assert.match(learnChrome,/LearnHeader student=\{student === true\}/,'Learn discovery knows the learner context')
assert.match(learnChrome,/POST_SECONDARY_PUBLIC_ENABLED && !student && <Link href="\/learn\?view=courses"/,'Public course destination is not forced onto signed-in learner header')
assert.match(learnChrome,/student && <Link href="\/student\/study"/,'Signed-in learner can return to their personal Learn')

const home = read('app/student/page.tsx')
const homeDesk = read('components/student/StudentHomeDesk.tsx')
const homeDeskCss = read('components/student/StudentHomeDesk.module.css')
assert.match(home, /<StudentHomeDesk/, 'Home renders the shared learner desk')
assert.match(home, /isNewLearner=\{!hasLearningEvidence && !continueReading\}/, 'First-visit state is derived from recorded learning and saved reading')
assert.match(home, /nextTask=\{nextTask\}/, 'Assigned schoolwork remains connected to the Home action')
assert.match(homeDesk, /fallbackSubjectGroups\(learnerGrade\)/, 'New learner subject choices reuse the canonical catalogue')
assert.match(homeDesk, /gradeHref\(learnerGrade, subject\)/, 'Subject tiles open the canonical grade-scoped catalogue')
assert.match(homeDesk, /safeReadingHref\(reading\.actionUrl\)/, 'Returning learner reading must retain safe internal navigation')
assert.match(homeDesk, /schoolLinked \? '\/student\/projects' : '\/student\/projects\/independent'/, 'Projects support independent and school-linked learners')
assert.match(homeDesk, /NEXT_PUBLIC_VIBE_LIVE_ENABLED === 'true'/, 'Disabled Live does not present a false join action')
assert.match(homeDesk, /unavailable: !liveEnabled/, 'Live tile visibly reflects activation state')
assert.match(homeDesk, /aria-label=\{group\.name\}/, 'Tool groups are named for assistive navigation')
assert.match(homeDeskCss, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/, 'Mobile Home uses a four-column tool grid')
for (const href of [
  '/student/study', '/student/vibelearn/topic-practice', '/student/vibelearn/exams',
  '/student/vibelearn/revision', '/student/vibelearn/mistakes',
  '/student/vibelearn/practice', '/learn/stories', '/student/tasks',
  '/student/homework', '/student/assessment', '/student/exercises',
  '/student/projects/independent', '/student/timetable', '/student/live',
  '/student/tutoring', '/vibechat', '/student/marks', '/student/workspace',
  '/schools/following', '/student/notifications', '/student/profile',
  '/student/settings',
]) {
  assert.ok(homeDesk.includes(href), 'Learner Home must expose existing destination ' + href)
}
assert.doesNotMatch(homeDesk, /href=['"]\/offline\/books/, 'Do not restore retired offline book saving')

console.log('Student navigation ownership and context contracts: PASS')
