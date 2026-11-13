import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {GRADE3_MATHEMATICS_UNITS,GRADE3_MATHEMATICS_PREFIX} from '../../lib/teaching/grade3MathematicsCatalog.mjs'
import {buildGrade1AnnualSchemeDraft} from '../../lib/teaching/creativeSchemeDraft.mjs'
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8')
const sql=read('../../supabase/migrations/20261113200100_grade3_mathematics_original_scheme_connection.sql')
const canonical=read('../../supabase/migrations/20261111131700_grade6_mathematics_kicd_reference_scheme.sql')
const page=read('../../app/teacher/scheme/AuthoritySchemePage.jsx')
const map=read('../../components/teacher/curriculum/Grade3MathematicsMap.jsx')
const match=sql.match(/from jsonb_array_elements\('([\s\S]*?)'::jsonb\) unit;/)
test('Grade 3 original source-indexed catalog is exactly identical to migration snapshot',()=>{
  assert.ok(match,'expected immutable migration fixture')
  const snapshot=JSON.parse(match[1].replaceAll("''","'"))
  assert.deepEqual(snapshot,GRADE3_MATHEMATICS_UNITS)
  assert.equal(snapshot.length,14)
  assert.equal(snapshot.reduce((sum,u)=>sum+u.lessons,0),150)
  assert.equal(snapshot.reduce((sum,u)=>sum+u.outcomes.length,0),28)
  assert.ok(snapshot.every(u=>u.outcomes.length>0&&u.experiences.length>0&&u.inquiry.length>0&&u.resources&&u.assessment))
  assert.equal(GRADE3_MATHEMATICS_PREFIX,'VS-CUR-G03-MA-2026')
})
test('Existing Scheme infrastructure remains the only saving authority and requires real IDs',()=>{
  for(const x of ['grade3_mathematics_reader_bindings','commit_mapped_scheme_lesson','SCHEME_GRADE3_MATH_READER_ACTIVE','completeness_new','GRADE3_MATH_PERSISTENCE_INCOMPLETE','GRADE3_MATH_SCHEME_RPC_AUTHORITY_DRIFT','security definer'])
    assert.ok(sql.includes(x),'Missing Scheme security or link: '+x)
  assert.ok(canonical.includes('auth.uid()')&&canonical.includes('insert into public.scheme_lesson_outcomes'),
    'Grade 3 must reuse the existing authenticated outcome-junction saving contract')
  for(const x of ['grade3_mathematics_reader_bindings','setGrade3MathCatalog','saveAndPrepareAutoDraft','GRADE3_MATHEMATICS_UNITS','isGrade3Mathematics','<Grade3MathematicsMap','onPlanUnit='])
    assert.ok(page.includes(x),'Missing teacher integration: '+x)
  assert.ok(map.includes('record.outcomes.map'))
  assert.ok(!/insert into public\.scheme_of_work|delete from public\.scheme_of_work|truncate table|disable row level security/i.test(sql))
  assert.ok(!map.includes('.insert('))
  assert.ok(sql.includes('on conflict(subject_id,grade,name,sub_strand) do nothing'))
  assert.ok(sql.includes('from public,anon'))
})
test('150 suggested lessons use selected actual school calendar; insufficient allocation fails closed',()=>{
  const terms=[1,2,3].map(term=>({term,id:'t'+term}))
  const termWeeks=terms.flatMap(term=>Array.from({length:10},(_,index)=>({term_id:term.id,week_number:index+1,week_type:'normal',school_id:null})))
  const common={units:GRADE3_MATHEMATICS_UNITS,terms,termWeeks,weeklyAllocation:5,expectedUnitCount:14,gradeLabel:'Grade 3'}
  const annual=buildGrade1AnnualSchemeDraft(common)
  assert.equal(annual.error,null)
  assert.equal(annual.items.length,150)
  assert.equal(new Set(annual.items.map(x=>x.key)).size,150)
  assert.ok(annual.weeks.every(w=>annual.items.filter(x=>x.week===w.week&&x.termId===w.termId).length===5))
  assert.ok(buildGrade1AnnualSchemeDraft({...common,weeklyAllocation:4}).error)
  assert.ok(buildGrade1AnnualSchemeDraft({...common,termWeeks:termWeeks.filter(x=>x.term_id!=='t3')}).error)
})
