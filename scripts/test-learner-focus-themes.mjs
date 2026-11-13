import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=path=>readFileSync(path,'utf8')

test('theme controls use one account-scoped colour and brightness model',()=>{
  const appearance=source('lib/student-appearance.ts')
  const settings=source('app/student/settings/page.tsx')
  const layout=source('app/student/layout.tsx')
  for(const palette of ['jade','ocean','sunset','midnight'])assert.match(appearance,new RegExp(palette+':\\{'))
  assert.match(appearance,/displayMode:LearnerDisplayMode/)
  assert.match(appearance,/COLORS\[appearance\.palette\]\[resolvedLearnerDisplayMode/)
  assert.match(appearance,/--vs-nav-bg/)
  assert.match(appearance,/--vs-surface/)
  assert.match(settings,/value\.displayMode/)
  assert.doesNotMatch(settings,/setTheme\(/)
  assert.match(layout,/learnerAppearanceStyle\(appearance,systemDark\)/)
  assert.match(layout,/matchMedia\('\(prefers-color-scheme: dark\)'\)/)
})

test('background placement can include Home but not exam answers',()=>{
  const settings=source('app/student/settings/page.tsx')
  const layout=source('app/student/layout.tsx')
  assert.match(settings,/wallpaperPlacement/)
  assert.match(settings,/home-workspace/)
  assert.match(settings,/compressWallpaper\(file\)/)
  assert.match(layout,/pathname==='\/student\/workspace'/)
  assert.match(layout,/appearance\.wallpaperPlacement==='home-workspace'/)
  assert.match(layout,/learnerWallpaperBackground\(/)
  assert.match(layout,/studyMode!=='reading'/)
  assert.match(layout,/\.assessment-focus/)
})

test('Focus and Reading are visible, reversible and quiet',()=>{
  const settings=source('app/student/settings/page.tsx')
  const layout=source('app/student/layout.tsx')
  const reminders=source('components/student/StudentPlannerReminders.tsx')
  assert.match(settings,/\['focus','Do Not Disturb'/)
  assert.match(settings,/\['reading','Reading Mode'/)
  assert.match(settings,/value\.pauseSocialLinks/)
  assert.match(settings,/cannot block social-media apps/)
  assert.match(layout,/data-study-mode=\{studyMode\}/)
  assert.match(layout,/Exit study mode/)
  assert.match(layout,/onClickCapture=\{guardSocialLinks\}/)
  assert.match(layout,/showToast\('Social links are paused/)
  assert.match(layout,/<StudentPlannerReminders quiet=/)
  assert.match(reminders,/if \(!owner \|\| quiet\)/)
  assert.match(reminders,/if \(!owner \|\| quiet \|\| examFocused\) return null/)
})

test('no claims or changes of exam marking, score, or user permissions',()=>{
  const app=source('lib/student-appearance.ts')
  assert.doesNotMatch(app,/submitAttempt|saveResponse|assessment_engine|exam_question_bank/)
  assert.match(app,/studentId/)
  assert.match(app,/endsWith\('\.'\+domain\)/)
})
