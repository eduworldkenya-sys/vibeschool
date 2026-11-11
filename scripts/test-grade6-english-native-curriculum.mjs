import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  GRADE6_ENGLISH_PREFIX, GRADE6_ENGLISH_SOURCE_URL, GRADE6_ENGLISH_THEMES,
  GRADE6_ENGLISH_UNITS,
} from '../lib/teaching/grade6EnglishCatalog.mjs'
import { buildGrade1AnnualSchemeDraft } from '../lib/teaching/creativeSchemeDraft.mjs'

const page = readFileSync(new URL('../app/teacher/scheme/AuthoritySchemePage.jsx', import.meta.url), 'utf8')
const subject = readFileSync(new URL('../app/teacher/subjecthub/page.tsx', import.meta.url), 'utf8')
const reader = readFileSync(new URL('../components/teacher/curriculum/Grade6EnglishMap.tsx', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20261111104500_grade6_english_kicd_reference_scheme.sql', import.meta.url), 'utf8')

assert.equal(GRADE6_ENGLISH_PREFIX, 'VS-CUR-G06-EN-2026')
assert.equal(GRADE6_ENGLISH_SOURCE_URL, 'https://kicd.ac.ke/wp-content/uploads/2024/10/ENGLISH-GRADE-6-UPDATED-Revised-Sept.pdf')
assert.equal(GRADE6_ENGLISH_THEMES.length, 13)
assert.deepEqual(GRADE6_ENGLISH_THEMES.map(t => t.id), Array.from({ length: 13 }, (_, i) => i + 1))
assert.equal(GRADE6_ENGLISH_UNITS.length, 10)
assert.equal(new Set(GRADE6_ENGLISH_UNITS.map(u => u.id)).size, 10)
assert.deepEqual(GRADE6_ENGLISH_UNITS.map(u => u.id), ['1.1','2.1','2.2','2.3','3.1','3.2','4.1','4.2','4.3','4.4'])
assert.deepEqual(GRADE6_ENGLISH_UNITS.map(u => u.lessons), [39,11,22,3,33,6,14,6,13,3])
assert.equal(GRADE6_ENGLISH_UNITS.reduce((n,u) => n + u.lessons,0), 150)
assert.deepEqual([...new Set(GRADE6_ENGLISH_UNITS.map(u=>u.strand))], ['Listening and Speaking','Reading','Language Use','Writing'])
const outcomes = GRADE6_ENGLISH_UNITS.reduce((n,u)=>n+u.outcomes.length,0)
assert.equal(outcomes,42)
for (const u of GRADE6_ENGLISH_UNITS) {
  assert.ok(u.outcomes.length >= 3 && u.outcomes.every(o=>o.length>32))
  assert.ok(u.experiences.length >= 2 && u.inquiry.length >= 1)
  assert.ok(u.resources && u.assessment && u.competencies)
}
assert.ok(GRADE6_ENGLISH_THEMES.every(t=>t.title && t.context))

for(const token of [
 'GRADE6_ENGLISH_UNITS','GRADE6_ENGLISH_THEMES','View original KICD source',
 'Official outcome-by-outcome reconciliation remains pending',
 'Plan this skill in Scheme of Work','mappedUnits[current.id]',
]) assert.ok(reader.includes(token), 'Missing reader element: '+token)

for(const token of [
 "isGrade6English", "isAutoScheme = isGrade1AutoScheme || isGrade8Mathematics || isGrade8English || isGrade6Mathematics || isGrade6English",
 "from('grade6_english_reader_bindings')", "eq('grade','Grade 6')",
 "GRADE6_ENGLISH_PREFIX", "mappedUnits={grade6EnglishCatalog}",
 "isGrade6English?grade6EnglishCatalog:isGrade6Mathematics?grade6Catalog:", "commit_mapped_scheme_lesson",
]) assert.ok(page.includes(token),'Grade 6 Scheme binding missing: '+token)
assert.ok(subject.includes('grade6EnglishClass') && subject.includes('<Grade6EnglishMap compact'))
for(const token of [
 'create table if not exists public.grade6_english_reader_bindings',
 'alter table public.grade6_english_reader_bindings enable row level security',
 'VS-CUR-G06-EN-2026#','GRADE6_ENGLISH_PERSISTENCE_INCOMPLETE',
 'grade8_mathematics_reader_bindings','grade8_english_reader_bindings',
 'grade1_curriculum_reader_bindings','scheme_lesson_outcomes',
]) assert.ok(migration.includes(token),'Migration gate missing: '+token)
const terms=[1,2,3].map(term=>({id:'term-'+term,term,academic_year:2026}))
const termWeeks=terms.flatMap(t=>Array.from({length:10},(_,i)=>({term_id:t.id,week_number:i+1,week_type:'normal'})))
const preview=buildGrade1AnnualSchemeDraft({units:GRADE6_ENGLISH_UNITS,terms,termWeeks,weeklyAllocation:5,expectedUnitCount:10,gradeLabel:'Grade 6'})
assert.equal(preview.error,null)
assert.equal(preview.items.length,150)
assert.equal(new Set(preview.items.map(i=>i.key)).size,150)
assert.ok(preview.items.every(i=>i.outcomes?.length && i.termId && i.week>0))
console.log('Grade 6 English source facts, canonical Scheme bindings, safety, and 150-lesson preview: PASS')
