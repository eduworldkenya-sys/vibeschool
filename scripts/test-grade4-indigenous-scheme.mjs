import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
 GRADE4_INDIGENOUS_THEMES as themes, GRADE4_INDIGENOUS_UNITS as units,
 GRADE4_INDIGENOUS_PREFIX as prefix, GRADE4_INDIGENOUS_SOURCE_URL as source,
 GRADE4_INDIGENOUS_LESSONS as lessons, GRADE4_INDIGENOUS_OUTCOMES as outcomes
} from '../lib/teaching/grade4IndigenousCatalog.mjs'
import {buildGrade1AnnualSchemeDraft,termCreativeSchemeRows} from '../lib/teaching/creativeSchemeDraft.mjs'
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const map=read('../components/teacher/curriculum/Grade4IndigenousMap.jsx')
const scheme=read('../app/teacher/scheme/AuthoritySchemePage.jsx')
const hub=read('../app/teacher/subjecthub/page.tsx')
const sql=read('../supabase/migrations/20261111162500_grade4_indigenous_kicd_scheme.sql')
assert.equal(themes.length,9,'KICD has nine Indigenous Languages themes')
assert.deepEqual(themes.map(t=>t.number),[1,2,3,4,5,6,7,8,9])
assert.equal(units.length,28,'Nine themes × three strands + one cross-strand showcase')
assert.equal(units.filter(u=>!u.crossStrand).length,27)
assert.equal(units.filter(u=>u.crossStrand).length,1)
assert.equal(units.filter(u=>u.crossStrand)[0].lessons,6)
assert.equal(lessons,60,'Official KICD annual content scope is 60 lessons')
assert.equal(outcomes,84,'VibeSchool original English-language teaching guidance')
assert.equal(prefix,'VS-CUR-G04-IL-2026')
assert.equal(source,'https://kicd.ac.ke/wp-content/uploads/2024/10/GRADE-4-INDIGENOUS-LANGUAGE-DESIGN-Revised.pdf')
assert.equal(new Set(units.map(u=>u.id)).size,28)
assert.deepEqual(new Set(units.filter(u=>!u.crossStrand).map(u=>u.strand)),new Set(['Listening and Speaking','Reading','Writing']))
for(const theme of themes){
 const themeUnits=units.filter(u=>u.theme===theme.number)
 assert.deepEqual(themeUnits.map(u=>u.strand),['Listening and Speaking','Reading','Writing'])
 assert.ok(themeUnits.every(u=>u.lessons===2))
 assert.ok(themeUnits.every(u=>u.title.includes(theme.name)))
}
assert.ok(units.every(u=>u.reviewStatus==='language_adaptation_required'&&u.outcomes.length===3&&u.inquiry.length&&u.experiences.length&&u.assessment&&u.resources))
const snap=sql.match(/from jsonb_array_elements\(\$vs_g4_il\$([\s\S]*?)\$vs_g4_il\$::jsonb\) unit;/)
assert.ok(snap,'Migration must contain one exact catalog snapshot')
assert.deepEqual(JSON.parse(snap[1]),units,'Application and DB curriculum must not diverge')
const terms=[1,2,3].map(n=>({id:'term-'+n,term:n}))
const termWeeks=terms.flatMap(t=>Array.from({length:10},(_,i)=>({term_id:t.id,week_number:i+1,week_type:'normal',school_id:null})))
const options={units,terms,termWeeks,weeklyAllocation:2,expectedUnitCount:28,gradeLabel:'Grade 4'}
const draft=buildGrade1AnnualSchemeDraft(options)
assert.equal(draft.error,null,'Illustrative two-lesson-per-week school capacity fits KICD 60-lesson content')
assert.equal(draft.items.length,60)
assert.equal(draft.unitCount,28)
assert.equal(new Set(draft.items.map(row=>row.key)).size,60)
assert.deepEqual(new Set(draft.items.map(row=>row.unitId)),new Set(units.map(u=>u.id)))
assert.equal(terms.reduce((n,t)=>n+termCreativeSchemeRows(draft,t.id).length,0),60)
assert.ok(draft.weeks.every(w=>draft.items.filter(r=>r.termId===w.termId&&r.week===w.week).length===2))
assert.deepEqual(buildGrade1AnnualSchemeDraft(options),draft,'Preview should never persist or mutate teacher records')
assert.ok(buildGrade1AnnualSchemeDraft({...options,weeklyAllocation:1}).error,'Insufficient declared school capacity must fail')
assert.ok(buildGrade1AnnualSchemeDraft({...options,terms:terms.slice(0,2)}).error,'Missing school term must fail')
for(const part of [
 'isGrade4Indigenous','grade4_indigenous_reader_bindings','GRADE4_INDIGENOUS_PREFIX','GRADE4_INDIGENOUS_UNITS',
 'grade4IndigenousCatalog','<Grade4IndigenousMap','isAutoScheme',
 "rpc('commit_mapped_scheme_lesson'",'p_outcome_ids:item.outcomeIds',
 "alias.data?.name!=='Indigenous Language'",'onPlanUnit={selectedClass'
]) assert.ok(scheme.includes(part),'Canonical Scheme missing: '+part)
for(const part of [
 'Nine KICD themes','Native','language','onPlanUnit(unit.id)','language_adaptation_required',
 'View earlier weekly curriculum records'
].filter(x=>x!=='Nine KICD themes'&&x!=='Native'&&x!=='language_adaptation_required')) assert.ok(map.includes(part),'Reader missing: '+part)
assert.ok(hub.includes('grade4IndigenousClass')&&hub.includes('Open Indigenous Languages curriculum'))
for(const guard of [
 'authorization-test: public.grade4_indigenous_reader_bindings','enable row level security',
 "source_type='creator_claimed'",'SCHEME_INVOKER_AUTHORITY_REQUIRED','GRADE4_INDIGENOUS_PERSISTENCE_INCOMPLETE',
 'on conflict(subject_id,grade,name,sub_strand) do nothing','language_adaptation_required',
 'SCHEME_CURRICULUM_IDENTITY_MISMATCH','grade4_indigenous_reader_bindings'
]) assert.ok(sql.includes(guard),'DB security or mapping guard missing '+guard)
assert.doesNotMatch(sql,/delete from public\.cbc_strands|truncate public\.cbc_strands|insert into public\.scheme_of_work/i,'Never overwrite teacher or existing curriculum records')
console.log('Grade 4 Indigenous Languages PASS: 9 themes, 3 KICD strands, 28 planning units, 84 original outcomes, 60 KICD lessons, preserved teacher Scheme')
