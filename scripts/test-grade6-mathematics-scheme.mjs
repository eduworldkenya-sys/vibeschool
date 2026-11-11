import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GRADE6_MATHEMATICS_UNITS, GRADE6_MATHEMATICS_LESSONS, GRADE6_MATHEMATICS_PREFIX, GRADE6_MATHEMATICS_SOURCE_URL } from '../lib/teaching/grade6MathematicsCatalog.mjs'
import { buildGrade1AnnualSchemeDraft } from '../lib/teaching/creativeSchemeDraft.mjs'

const read = file => readFileSync(new URL(file,import.meta.url),'utf8')
const json = JSON.parse(read('../lib/curriculum/grade6Mathematics2024.json'))
const page = read('../app/teacher/scheme/AuthoritySchemePage.jsx')
const subject = read('../app/teacher/subjecthub/page.tsx')
const reader = read('../components/teacher/curriculum/Grade6MathematicsMap.jsx')
const sql = read('../supabase/migrations/20261111131700_grade6_mathematics_kicd_reference_scheme.sql')
const u = GRADE6_MATHEMATICS_UNITS
assert.equal(u.length,16)
assert.equal(new Set(u.map(x=>x.id)).size,16)
assert.deepEqual(u.map(x=>x.id),['1.1','1.2','1.3','1.4','1.5','1.6','2.1','2.2','2.3','2.4','2.5','2.6','3.1','3.2','3.3','4.1'])
assert.deepEqual(u.map(x=>x.lessons),[20,6,6,12,12,8,14,6,6,14,10,8,6,6,6,10])
assert.equal(u.reduce((n,x)=>n+x.lessons,0),GRADE6_MATHEMATICS_LESSONS)
assert.equal(GRADE6_MATHEMATICS_LESSONS,150)
assert.equal(new Set(u.map(x=>x.strand)).size,4)
assert.equal(u.reduce((n,x)=>n+x.outcomes.length,0),97)
assert.equal(GRADE6_MATHEMATICS_PREFIX,'VS-CUR-G06-MA-2026')
assert.ok(GRADE6_MATHEMATICS_SOURCE_URL.startsWith('https://kicd.ac.ke/'))
assert.ok(u.every(x=>x.outcomes.length>=3&&x.experiences.length>=2&&x.inquiry.length>=1&&x.resources&&x.assessment))
for(const x of u){
  const ref=json.units.find(z=>z.id===x.id)
  assert.ok(ref)
  assert.deepEqual(ref.outcomes,x.outcomes)
  assert.equal(json.strands[ref.strand-1],x.strand)
}
const snap=sql.match(/from jsonb_array_elements\('([\s\S]*?)'::jsonb\) unit;/)
assert.ok(snap,'Migration must contain the same immutable reader snapshot')
const db=JSON.parse(snap[1].replaceAll("''","'"))
assert.equal(db.length,16)
assert.deepEqual(db,u)
const terms=[1,2,3].map(n=>({id:'t'+n,term:n}))
const weeks=terms.flatMap(t=>Array.from({length:10},(_,i)=>({term_id:t.id,week_number:i+1,week_type:'normal',school_id:null})))
const options={units:u,terms,termWeeks:weeks,weeklyAllocation:5,expectedUnitCount:16,gradeLabel:'Grade 6'}
const draft=buildGrade1AnnualSchemeDraft(options)
assert.equal(draft.error,null)
assert.equal(draft.items.length,150)
assert.equal(new Set(draft.items.map(x=>x.key)).size,150)
assert.ok(draft.weeks.every(w=>draft.items.filter(item=>item.termId===w.termId&&item.week===w.week).length===5))
assert.deepEqual(buildGrade1AnnualSchemeDraft(options),draft)
assert.ok(buildGrade1AnnualSchemeDraft({...options,weeklyAllocation:4}).error,'School underallocation must fail closed')
assert.ok(buildGrade1AnnualSchemeDraft({...options,terms:terms.slice(0,2)}).error)
for(const value of ['isGrade6Mathematics','grade6_mathematics_reader_bindings','<Grade6MathematicsMap',
  "p_outcome_ids:item.outcomeIds",'grade6CatalogError','GRADE6_MATHEMATICS_UNITS'])
  assert.ok(page.includes(value),'Scheme missing '+value)
assert.ok(subject.includes('grade6MathematicsClass')&&subject.includes('<Grade6MathematicsMap compact'))
assert.ok(reader.includes('GRADE6_MATHEMATICS_SOURCE_URL')&&reader.includes('All 16 topics'))
for(const guard of ['security invoker',"s.grade='Grade 6'","s.grade='Grade 8'",
  'grade6_mathematics_reader_bindings','grade8_mathematics_reader_bindings',
  'grade1_curriculum_reader_bindings','SCHEME_CURRICULUM_IDENTITY_MISMATCH',
  'GRADE6_MATH_PERSISTENCE_INCOMPLETE','on conflict(subject_id,grade,name,sub_strand) do nothing'])
  assert.ok(sql.includes(guard),'SQL missing '+guard)
assert.ok(!/delete from public\.cbc_strands|truncate public\.cbc_strands|insert into public\.scheme_of_work/i.test(sql))
console.log('Grade 6 Mathematics · 16 sub-strands · 97 outcomes · 150 lessons · mapping and teaching gates PASS')
