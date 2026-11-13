import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8')
const migration=read('supabase/migrations/20261113115000_grade9_english_outcome_scheme_activation.sql')
const map=read('components/teacher/curriculum/Grade9EnglishMap.tsx')
const scheme=read('app/teacher/scheme/AuthoritySchemePage.jsx')
const index=JSON.parse(read('content/curriculum/grade9-english-2024-index.json'))
const crosswalk=JSON.parse(read('content/curriculum/grade9-english-scheme-crosswalk-20261113.json'))

test('Grade 9 English uses all 75 EXISTING sub-strand identities, never a new Scheme engine',()=>{
 assert.equal(index.themes.length,15)
 assert.equal(crosswalk.rows.length,75)
 assert.equal(new Set(crosswalk.rows.map(x=>x.canonical_sub_strand_id)).size,75)
 assert.ok(map.includes('canonicalSubStrandId: crosswalk.rows.find('))
 assert.ok(scheme.includes('.eq(\'id\',unit.canonicalSubStrandId)'))
 assert.ok(scheme.includes("supabase.rpc('commit_mapped_scheme_lesson'"))
 assert.ok(!scheme.includes('commit_grade9_english_scheme'))
 assert.ok(migration.includes("pg_get_functiondef('public.commit_mapped_scheme_lesson"))
 assert.ok(!/create table|insert into public\.(?:scheme_of_work|cbc_strands|curriculum_learning_outcomes)|update public\.scheme_of_work/i.test(migration))
})

test('Grade 9 English grade and source ref must be exact and original content must be active',()=>{
 assert.match(migration, /SCHEME_GRADE9_ENGLISH_READER_ACTIVE/)
 assert.match(migration, /source_ref ~ '\^VS-REF-G09-EN-2024#/)
 assert.match(migration, /global_subject\.school_id is null/)
 assert.match(migration, /global_subject\.name='English'/)
 assert.match(migration, /GRADE9_ENGLISH_EXACT_INDEX_REQUIRED/)
 assert.match(migration, /SCHEME_CANONICAL_CONTENT_INCOMPLETE/)
 assert.ok(scheme.includes(".eq('source_type','creator_claimed')"))
 assert.ok(scheme.includes(".eq('status','active')"))
 assert.ok(scheme.includes(".like('source_ref',reference+'/%')"))
 assert.ok(scheme.includes("row.source_ref!==reference"))
 assert.ok(scheme.includes("row.sub_strand!==unit.code+' · '+unit.title"))
 assert.ok(scheme.includes('hasText(row.key_inquiry_questions)&&hasText(row.suggested_experiences)'))
 assert.ok(scheme.includes("guidance.data?.learning_resources?.trim()"))
 assert.ok(scheme.includes("guidance.data?.assessment_methods?.trim()"))
})

test('Grade 9 English requires teacher-authorized RPC with RLS and nonempty calendar week',()=>{
 assert.match(migration, /SCHEME_INVOKER_AUTHORITY_REQUIRED/)
 assert.match(migration, /from public,anon;/)
 assert.match(migration, /to authenticated;/)
 assert.match(migration, /GRADE9_ENGLISH_SCHEME_RPC_PRIVILEGE_DRIFT/)
 assert.ok(scheme.includes('!weeks.some(w=>w.week_number===selectedWeek)'))
 assert.ok(scheme.includes("supabase.rpc('commit_mapped_scheme_lesson'"))
 assert.ok(scheme.includes('grade9EnglishCatalogError'))
 assert.ok(scheme.includes('grade9EnglishCatalogLoading'))
 assert.ok(scheme.includes('grade9EnglishDraftRecord ? grade9EnglishDraftUnit'))
 assert.ok(scheme.includes('grade9EnglishDraftUnit && !grade9EnglishDraftRecord'))
 assert.ok(scheme.includes('Select the outcomes for one lesson'))
})
