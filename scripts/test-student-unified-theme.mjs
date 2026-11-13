import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(path, 'utf8')
const files = [
  'app/student/layout.tsx',
  'app/student/page.tsx',
  'app/student/student-home.css',
  'app/student/study/study.module.css',
  'app/student/tasks/page.tsx',
  'app/student/profile/page.tsx',
  'app/student/vibelearn/exams/exams.css',
  'app/student/vibelearn/revision/page.tsx',
  'app/student/vibelearn/topic-practice/page.tsx',
  'app/student/vibelearn/mistakes/page.tsx',
  'app/student/vibelearn/practice/page.tsx',
]

test('one learner-wide Student Learn green theme for school and independent learners', () => {
  const layout = read('app/student/layout.tsx')
  const palette = read('lib/student-theme.ts')
  assert.match(layout,/--vs-bg:[^\n]*#f5f8f6/)
  assert.match(layout,/--vs-accent:[^\n]*#166d49/)
  assert.match(layout,/--vs-soft:/)
  assert.match(layout,/--vs-on-accent:/)
  assert.doesNotMatch(layout,/style=\{identity\?\.independent \?/, 'school-link status must not choose a different theme')
  assert.match(palette,/light: \{/)
  assert.match(palette,/dark: \{/)
  assert.match(palette,/return "light"/, 'default should match Student Learn')
  assert.match(read('components/student/BottomNav.tsx'),/href: "\/student\/study"/, 'personal Learn tab remains intact')
})

test('home retains action-first data and shows responsive green dashboard',()=>{
  const home=read('app/student/page.tsx')
  const css=read('app/student/student-home.css')
  assert.match(home,/className="student-home-feature-grid"/)
  assert.match(home,/className="student-home-quick-grid"/)
  assert.match(home,/className="student-home-pulse"/)
  assert.match(home,/nextTask\?\.title/)
  assert.match(home,/resolveTaskLaunch\(task\.taskId\)/)
  assert.match(home,/router\.push\('\/student\/study'\)/)
  assert.match(home,/router\.push\('\/student\/vibelearn\/exams'\)/)
  assert.match(home,/See all tasks/)
  assert.match(home,/Mark seen/)
  assert.match(home,/Save my goals/)
  assert.match(css,/@media\(max-width:820px\)/)
  assert.match(css,/\.student-home-quick-icon/)
  assert.doesNotMatch(home,/#(?:312e81|4f46e5|5145e8)/i)
})

test('shared study, tasks, exams, revision surfaces consume tokens without malformed colors',()=>{
  for(const file of files){
    assert.ok(existsSync(file),file+' must exist')
    const source=read(file)
    assert.doesNotMatch(source,/var\(--[a-z0-9-]+\)[0-9a-f]{2,}/i,file+' has a corrupted hex color')
    assert.doesNotMatch(source,/#(?:4f46e5|5145e8|6366f1)\b/i,file+' still contains old primary purple')
  }
  const desk=read('app/student/study/study.module.css')
  const exams=read('app/student/vibelearn/exams/exams.css')
  assert.match(desk,/background:var\(--vs-bg\)/)
  assert.match(desk,/border:1px solid var\(--vs-border\)/)
  assert.match(exams,/\.vs-exams\{[^\n]*background:var\(--vs-bg\)/)
  assert.match(exams,/\.vs-exam-button\{[^\n]*background:var\(--vs-accent\)/)
  assert.match(exams,/\.vs-exam-status--in-progress\{background:#fff2d9/)
})
