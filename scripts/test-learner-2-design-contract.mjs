import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(path,'utf8')

test('learner 2.0 keeps five primary tabs and visible secondary destinations',()=>{
 const nav=read('components/student/BottomNav.tsx')
 const css=read('components/student/BottomNav.module.css')
 assert.equal((nav.match(/label: "(?:Home|Learn|Practice|Tasks|Progress)", href:/g)||[]).length,5)
 for(const route of ['/student/vibelearn/exams','/student/workspace','/learn/stories','/student/timetable','/student/settings']){
  assert.ok(nav.includes(route),'navigation shortcut '+route)
 }
 assert.match(css,/@media\(min-width:1024px\)/)
 assert.match(css,/\.tabbar|\.nav/)
 assert.match(read('app/student/layout.tsx'),/width:calc\(100% - 220px\)/)
})

test('Home shows action first while Workspace and stories stay discoverable',()=>{
 const home=read('app/student/page.tsx')
 assert.match(home,/nextTask\?\.title/)
 assert.match(home,/className="student-home-secondary-grid"/)
 assert.match(home,/title="Workspace"/)
 assert.match(home,/title="Stories"/)
 assert.match(home,/title="My Day"/)
 assert.match(home,/router\.push\('\/student\/vibelearn\/exams'\)/)
})

test('personalisation is account scoped and cannot touch grading authority',()=>{
 const appearance=read('lib/student-appearance.ts')
 const settings=read('app/student/settings/page.tsx')
 const workspace=read('app/student/workspace/page.tsx')
 assert.match(appearance,/appearanceKey\(studentId\)/)
 assert.match(appearance,/imageKey\(studentId\)/)
 assert.match(appearance,/saveLearnerAppearance/)
 assert.match(appearance,/LEARNER_APPEARANCE_EVENT/)
 for(const control of ['italicHeadings','largeText','compact','reduceMotion','wallpaper','palette','font']){
  assert.ok(settings.includes(control),'missing appearance control '+control)
 }
 assert.match(settings,/Notification\.requestPermission\(\)/)
 assert.match(settings,/compressWallpaper\(file\)/)
 assert.match(settings,/not uploaded to VibeSchool/i)
 assert.match(workspace,/readLearnerWallpaperPhoto/)
 assert.match(workspace,/gridTemplateColumns: "repeat\(auto-fit,minmax\(135px,1fr\)\)"/)
 assert.doesNotMatch(appearance,/submitAttempt|saveResponse|marks|exam_question_bank/)
})

test('certified Topic Practice is not a second timed exam shelf',()=>{
 const topic=read('components/student/CanonicalTopicPractice.tsx')
 assert.match(topic,/attempt\.items\.length!==5 \|\| attempt\.timeLimitMinutes!==null/)
 assert.match(topic,/Browse Exams/)
 assert.doesNotMatch(topic,/otherPractice|listMyAssessmentAssignments/)
 assert.match(topic,/startOrResumeAttempt\(/)
 assert.match(topic,/saveResponse\(/)
 assert.match(topic,/submitAttempt\(/)
})
