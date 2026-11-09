import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const twin = readFileSync('app/student/twin/page.tsx','utf8')
const learn = readFileSync('components/student/LearnActivityHub.tsx','utf8')
const core = readFileSync('components/student/VibeTwin/index.tsx','utf8')

assert.doesNotMatch(learn,/title: "AI Tutor"/,'Do not advertise a duplicate AI Tutor')
assert.match(learn,/href: "\/student\/tutoring"/,'Keep human tuition separate')
assert.match(twin, /Ask Twin a question/,'Visible conversational action')
assert.match(twin, /MODES\.map\(item => <button/,'Preserve canonical instructional actions')
assert.match(twin, /selectMode\(item.id\)/,'Teaching actions are interactive')
for (const dest of ['/student/tasks','/student/vibelearn/revision','/student/vibelearn/exams']) {
  assert.ok(twin.includes(dest),'Keep existing learning route: '+dest)
}
assert.match(twin, /<AdaptiveSessionCard \/>/,'Preserve existing session engine')
assert.match(twin, /<VibeTwin isOpen=/,'Preserve existing Twin assistant')
assert.match(twin, /hasEvidence && now\?\.actionUrl/,'Show recommendation only when supported by evidence')
assert.match(twin, /'My progress'/,'Keep progress and evidence details available')
assert.match(core, /routeTwinCore\(q\)/,'Retain deterministic assistant fallback')
console.log('PASS Twin action-first UI reuses existing instructional engines; duplicate AI Tutor removed')
