import fs from 'node:fs'
import assert from 'node:assert/strict'

const home = fs.readFileSync('app/student/page.tsx', 'utf8')
const twin = fs.readFileSync('components/student/VibeTwin/TwinWorkspaceProvider.tsx', 'utf8')
const taskMigration = fs.readFileSync('supabase/migrations/20260805130000_student_task_001_unified_learner_task_feed.sql', 'utf8')

assert.match(taskMigration, /h\.title/)
assert.match(taskMigration, /h\.subject/)
assert.match(home, /Assigned subject:/)
assert.match(home, /task\.title/)
assert.match(home, /nextQueue\.length === 0/)
assert.match(home, /task\.taskId !== nextTask\?\.taskId/)
assert.match(home, /See all tasks/)
assert.doesNotMatch(home, /<TwinStateCard/)
assert.doesNotMatch(home, /Start this session/)
assert.doesNotMatch(home, /SectionHeader title="Recovery plan"/)
assert.match(home, /Daily goal reached/)
assert.match(home, /activities completed/)
assert.match(home, /attempt:\$\{change\.sourceId\}/)
assert.match(home, /Review result/)
for (const destination of ['Learn', 'Exams', 'Results', 'VibeTwin']) {
  assert.ok(home.includes(`title="${destination}"`), `Missing ${destination} shortcut`)
}
assert.match(twin, /pathname !== "\/student"/)
console.log('Student Home action-first contract PASSED')
