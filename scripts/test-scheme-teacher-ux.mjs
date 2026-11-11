import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const s=readFileSync(new URL('../app/teacher/scheme/AuthoritySchemePage.jsx',import.meta.url),'utf8')
for(const token of ['Teaching notes and observations','Change status','pendingStatusChange','Confirm','Cancel','Curriculum outcome and sub-strand linked','prepareSchemeLesson(item)','openLinkedCurriculum(item)','Teaching reflection','Add teacher-created lesson'])assert.ok(s.includes(token),token)
assert.ok(!s.includes("{['planned','teaching','done','cancelled'].map(s=><button"),'Do not expose direct one-tap status mutation')
assert.ok(s.includes("supabase.rpc('commit_curriculum_scheme'"),'Preserve canonical scheme commit')
assert.ok(s.includes("supabase.from('scheme_of_work').update({status})"),'Preserve teacher status persistence')
console.log('Scheme UX contract passed')
