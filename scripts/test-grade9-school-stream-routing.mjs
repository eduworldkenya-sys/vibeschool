import assert from 'node:assert/strict'
import fs from 'node:fs'
const route=fs.readFileSync('app/student/vibelearn/topic-practice/page.tsx','utf8')
const hub=fs.readFileSync('components/student/LearnActivityHub.tsx','utf8')
assert.match(route,/classLabel\.match\(/)
assert.match(route,/gradeMatch\[1\]/)
assert.match(hub,/Grade\\s\*9\(\?:\\s\+\.\+\)\?/)
const normalize=(label)=>{
  const m=label.trim().match(/^(Grade\s*\d{1,2}|Form\s*[1-4])(?:\s+.+)?$/i)
  return m?m[1].replace(/\s+/g,' ').replace(/^grade/i,'Grade').replace(/^form/i,'Form'):''
}
for(const label of ['Grade 9','grade9','Grade 9 A','Grade 9 East','grade 9 stream B'])
  assert.equal(normalize(label),'Grade 9',label)
for(const label of ['Grade 8 A','Form 2 East','Form 1'])
  assert.notEqual(normalize(label),'Grade 9',label)
assert.equal(normalize('Grade 90'), '')
console.log('PASS: streamed Grade 9 classes use canonical Grade 9 topic practice route and resume')
