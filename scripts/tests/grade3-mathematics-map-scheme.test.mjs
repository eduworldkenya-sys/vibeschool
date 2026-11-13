import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {GRADE3_MATHEMATICS_UNITS as units,GRADE3_MATHEMATICS_LESSONS as total,
 GRADE3_MATHEMATICS_WEEKLY_ALLOCATION as weekly,GRADE3_MATHEMATICS_PREFIX as prefix} from '../../lib/teaching/grade3MathematicsCatalog.mjs'
import {buildGrade1AnnualSchemeDraft,termCreativeSchemeRows} from '../../lib/teaching/creativeSchemeDraft.mjs'
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8')
test('Grade 3 KICD Mathematics: 14 exact headings, three strands, 150 suggested lessons',()=>{
 assert.equal(units.length,14)
 assert.equal(total,150)
 assert.equal(weekly,5)
 assert.equal(new Set(units.map(u=>u.id)).size,14)
 assert.deepEqual(units.map(u=>u.id),['1.1','1.2','1.3','1.4','1.5','1.6','1.7','2.1','2.2','2.3','2.4','2.5','3.1','3.2'])
 assert.deepEqual([...new Set(units.map(u=>u.strand))],['Numbers','Measurement','Geometry'])
 assert.deepEqual(['Numbers','Measurement','Geometry'].map(s=>units.filter(u=>u.strand===s).reduce((a,u)=>a+u.lessons,0)),[101,40,9])
 assert.equal(units.reduce((a,u)=>a+u.lessons,0),150)
 assert.equal(units.reduce((a,u)=>a+u.outcomes.length,0),42)
 assert.ok(units.every(u=>u.inquiry.length&&u.experiences.length&&u.resources&&u.assessment))
 assert.equal(prefix,'VS-CUR-G03-MA-2026')
})
test('Grade 3 Mathematics source-linked catalog is identical to migration contents',()=>{
 const sql=read('supabase/migrations/20261113180500_grade3_mathematics_kicd_map_scheme.sql')
 const m=sql.match(/from jsonb_array_elements\(\$catalog\$([\s\S]*?)\$catalog\$::jsonb\) unit;/)
 assert.ok(m)
 assert.deepEqual(JSON.parse(m[1]),units)
 for(const guard of ['GRADE3_MATH_SOURCE_IDENTITY_CONFLICT','GRADE3_MATH_OUTCOMES_MISMATCH','SCHEME_GRADE3_MATH_CANONICAL_BINDING','grade3_mathematics_reader_bindings','source_type','creator_claimed','on conflict(subject_id,grade,name,sub_strand) do nothing'])assert.ok(sql.includes(guard),guard)
 assert.ok(!/delete from public\.cbc_strands|truncate public\.cbc_strands|insert into public\.scheme_of_work/i.test(sql),'Historical rows and teacher Scheme must remain untouched')
})
test('Teacher curriculum map and Scheme share official unit selectors and canonical RPC',()=>{
 const page=read('app/teacher/scheme/AuthoritySchemePage.jsx')
 const hub=read('app/teacher/subjecthub/page.tsx')
 const map=read('components/teacher/curriculum/Grade3MathematicsMap.jsx')
 assert.ok(page.includes("isGrade3Mathematics"))
 assert.ok(page.includes("grade3_mathematics_reader_bindings"))
 assert.ok(page.includes('<Grade3MathematicsMap'))
 assert.ok(page.includes('grade3DraftRecord'))
 assert.ok(page.includes("supabase.rpc('commit_mapped_scheme_lesson'"))
 assert.ok(page.includes("isGrade3Mathematics?grade3Catalog"))
 assert.ok(hub.includes('grade3MathematicsClass')&&hub.includes('<Grade3MathematicsMap'))
 assert.ok(map.includes('Teaching guides and outcomes here are VibeSchool-original'))
})
test('Annual Scheme planning never invents term/week and totals 150 with 30 eligible school weeks',()=>{
 const terms=[1,2,3].map(n=>({id:'term'+n,term:n}))
 const termWeeks=terms.flatMap(t=>Array.from({length:10},(_,i)=>({term_id:t.id,week_number:i+1,week_type:'normal',school_id:null})))
 const opts={units,terms,termWeeks,weeklyAllocation:5,expectedUnitCount:14,gradeLabel:'Grade 3'}
 const draft=buildGrade1AnnualSchemeDraft(opts)
 assert.equal(draft.error,null)
 assert.equal(draft.items.length,150)
 assert.equal(draft.unitCount,14)
 assert.equal(new Set(draft.items.map(u=>u.key)).size,150)
 assert.equal(terms.reduce((n,t)=>n+termCreativeSchemeRows(draft,t.id).length,0),150)
 assert.ok(buildGrade1AnnualSchemeDraft({...opts,terms:terms.slice(0,2)}).error)
 assert.ok(buildGrade1AnnualSchemeDraft({...opts,weeklyAllocation:4}).error)
})
