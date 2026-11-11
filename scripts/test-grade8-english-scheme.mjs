import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
 GRADE8_ENGLISH_UNITS, GRADE8_ENGLISH_THEMES, GRADE8_ENGLISH_LESSONS,
 GRADE8_ENGLISH_PREFIX, GRADE8_ENGLISH_SOURCE_URL
} from '../lib/teaching/grade8EnglishCatalog.mjs'
import { buildGrade1AnnualSchemeDraft, termCreativeSchemeRows } from '../lib/teaching/creativeSchemeDraft.mjs'

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
const page=read('../app/teacher/scheme/AuthoritySchemePage.jsx')
const hub=read('../app/teacher/subjecthub/page.tsx')
const map=read('../components/teacher/curriculum/Grade8EnglishMap.jsx')
const sql=read('../supabase/migrations/20261111101000_grade8_english_kicd_reference_scheme.sql')
const units=GRADE8_ENGLISH_UNITS
assert.equal(GRADE8_ENGLISH_THEMES.length,15)
assert.equal(units.length,75)
assert.equal(new Set(units.map(u=>u.id)).size,75)
assert.equal(new Set(units.map(u=>u.theme)).size,15)
assert.deepEqual(new Set(units.map(u=>u.strand)),new Set(['Listening and Speaking','Reading','Grammar in Use','Writing']))
assert.equal(GRADE8_ENGLISH_LESSONS,150)
assert.equal(units.reduce((n,u)=>n+u.lessons,0),150)
assert.equal(units.reduce((n,u)=>n+u.outcomes.length,0),150)
assert.ok(units.every(u=>u.lessons===2&&u.outcomes.length===2&&u.outcomes.every(x=>x.length>40)&&u.experiences.length&&u.inquiry.length))
assert.ok(units.every(u=>u.title.startsWith(GRADE8_ENGLISH_THEMES[u.theme-1].title+': ')))
assert.equal(GRADE8_ENGLISH_PREFIX,'VS-CUR-G08-EN-2026')
assert.match(GRADE8_ENGLISH_SOURCE_URL,/^https:\/\/kicd\.ac\.ke\//)
assert.ok(units.find(u=>u.id==='01-GR')?.title.includes('Compound Nouns'), 'KICD theme-one grammar')
assert.ok(units.find(u=>u.id==='01-WR')?.title.includes('Legibility'), 'KICD theme-one writing')
assert.ok(units.find(u=>u.id==='02-GR')?.title.includes('Collective Nouns'), 'KICD theme-two grammar')
assert.ok(units.find(u=>u.id==='15-WR')?.title.includes('Notices and Posters'), 'KICD theme-fifteen writing')

const terms=[1,2,3].map(n=>({id:'t'+n,term:n}))
const termWeeks=terms.flatMap(t=>Array.from({length:10},(_,i)=>({term_id:t.id,week_number:i+1,week_type:'normal',school_id:null})))
const opts={terms,termWeeks,units,expectedUnitCount:75,weeklyAllocation:5}
const draft=buildGrade1AnnualSchemeDraft(opts)
assert.equal(draft.error,null)
assert.equal(draft.items.length,150)
assert.equal(draft.weeks.length,30)
assert.equal(new Set(draft.items.map(x=>x.key)).size,150)
assert.ok(draft.weeks.every(w=>draft.items.filter(item=>item.termId===w.termId&&item.week===w.week).length===5))
assert.equal(terms.reduce((sum,t)=>sum+termCreativeSchemeRows(draft,t.id).length,0),150)
assert.deepEqual(buildGrade1AnnualSchemeDraft(opts),draft)
assert.ok(buildGrade1AnnualSchemeDraft({...opts,terms:terms.slice(1)}).error,'all school terms required')
assert.ok(buildGrade1AnnualSchemeDraft({...opts,weeklyAllocation:4}).error,'over-allocation fails closed')

assert.ok(page.includes('isGrade8English && <Grade8EnglishMap'), 'Grade8 English map rendered')
assert.ok(page.includes('isAutoScheme = isGrade1AutoScheme || isGrade8Mathematics || isGrade8English'), 'Grade8 uses existing teacher-safe auto scheme')
assert.ok(page.includes("from('grade8_english_reader_bindings')"), 'read persisted binding')
assert.ok(page.includes("p_sub_strand_id:item.subStrandId,p_outcome_ids:item.outcomeIds"))
assert.ok(page.includes('isGrade1Mathematics && <Grade1MathematicsMap'))
assert.ok(page.includes('isGrade1English && <Grade1EnglishMap'))
assert.ok(page.includes('isGrade1Creative && <Grade1CreativeActivitiesMap'))
assert.ok(hub.includes('grade8EnglishClass'))
assert.ok(map.includes('Plan this in Scheme of Work'))
assert.ok(map.includes('GRADE8_ENGLISH_SOURCE_URL'))
assert.ok(sql.includes('security invoker'))
assert.ok(sql.includes("public.grade8_english_reader_bindings"))
assert.ok(sql.includes("status='active' and source_type='creator_claimed'"))
assert.ok(sql.includes("s.grade='Grade 8'"))
assert.ok(sql.includes('GRADE8_ENGLISH_PERSISTENCE_INCOMPLETE'))
assert.ok(sql.includes("'junior_school','Grade 8','English',5"))
assert.ok(!sql.includes('insert into public.scheme_of_work'),'never create teacher scheme records on catalog import')
assert.ok(!sql.includes('delete from public.cbc_strands'),'preserve legacy KICD candidates')
console.log('Grade 8 English curriculum/Scheme source, security and pacing checks: PASS')
