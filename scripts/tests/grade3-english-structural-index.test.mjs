import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import { GRADE3_ENGLISH_UNITS, GRADE3_ENGLISH_STRANDS, GRADE3_ENGLISH_SUGGESTED_LESSONS, GRADE3_ENGLISH_LESSONS_PER_WEEK } from '../../lib/teaching/grade3EnglishCatalog.mjs'
const read=(path)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8')

test('Grade 3 English 2024 structural source summary reconciles 10 units and 150 lessons',()=>{
  assert.equal(GRADE3_ENGLISH_UNITS.length,10)
  assert.equal(GRADE3_ENGLISH_STRANDS.length,4)
  assert.equal(GRADE3_ENGLISH_LESSONS_PER_WEEK,5)
  assert.equal(GRADE3_ENGLISH_SUGGESTED_LESSONS,150)
  assert.equal(GRADE3_ENGLISH_UNITS.reduce((sum,u)=>sum+u.lessons,0),150)
  for(const strand of GRADE3_ENGLISH_STRANDS){
    assert.equal(GRADE3_ENGLISH_UNITS.filter(u=>u.strand===strand.title).reduce((sum,u)=>sum+u.lessons,0),strand.lessons)
  }
  assert.equal(new Set(GRADE3_ENGLISH_UNITS.map(u=>u.id)).size,10)
})
test('Grade 3 English map hands off to existing Scheme without fabricating published outcomes',()=>{
  const map=read('components/teacher/curriculum/Grade3EnglishMap.tsx')
  const subjecthub=read('app/teacher/subjecthub/page.tsx')
  const scheme=read('app/teacher/scheme/AuthoritySchemePage.jsx')
  assert.match(map,/not the full KICD transcription or verified outcomes/i)
  assert.match(subjecthub,/<Grade3EnglishMap /)
  assert.match(scheme,/curriculumView && isGrade3English && <Grade3EnglishMap/)
  assert.match(scheme,/grade3EnglishDraftUnit &&/)
  assert.match(scheme,/No verified curriculum outcome is linked/)
  assert.ok(scheme.includes("supabase.rpc('commit_mapped_scheme_lesson'"))
  assert.ok(!read('lib/teaching/grade3EnglishCatalog.mjs').includes('outcome_text'))
})
