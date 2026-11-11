import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {buildCreativeAnnualSchemeDraft,buildGrade1AnnualSchemeDraft,termCreativeSchemeRows} from '../lib/teaching/creativeSchemeDraft.mjs'

const mathSource=readFileSync(new URL('../components/teacher/curriculum/Grade1MathematicsMap.tsx',import.meta.url),'utf8')
const englishSource=readFileSync(new URL('../components/teacher/curriculum/Grade1EnglishMap.tsx',import.meta.url),'utf8')
const map=readFileSync(new URL('../app/teacher/scheme/AuthoritySchemePage.jsx',import.meta.url),'utf8')
const preview=readFileSync(new URL('../components/teacher/scheme/AutoCreativeScheme.jsx',import.meta.url),'utf8')
const weekly=readFileSync(new URL('../components/teacher/scheme/WeeklyLessonSlots.tsx',import.meta.url),'utf8')
const sql=readFileSync(new URL('../supabase/migrations/20261111101000_grade1_math_english_scheme_weekly_pacing_guard.sql',import.meta.url),'utf8')
const thematicSql=readFileSync(new URL('../supabase/migrations/20261111102000_grade1_english_thematic_scheme_context.sql',import.meta.url),'utf8')
const parseUnits=(s,prefix)=>JSON.parse(s.split('export const '+prefix+'_UNITS: readonly CurriculumUnit[] = ')[1].split('\n\nconst card: CSSProperties')[0])
const math=parseUnits(mathSource,'GRADE1_MATHEMATICS')
const english=parseUnits(englishSource,'GRADE1_ENGLISH')
const themes=JSON.parse(englishSource.split('export const GRADE1_ENGLISH_THEMES = ')[1].split(' as const')[0])
const terms=[{id:'term-1',term:1},{id:'term-2',term:2},{id:'term-3',term:3}]
const calendar=(counts)=>terms.flatMap((term,i)=>Array.from({length:counts[i]},(_,n)=>({term_id:term.id,week_number:n+1,week_type:'normal',school_id:null})))
const thirty=calendar([10,10,10])
const forty=calendar([13,14,13])
const mk=(units,opts={})=>buildGrade1AnnualSchemeDraft({units,terms,termWeeks:thirty,weeklyAllocation:5,requireWeeklyAllocation:true,expectedUnitCount:units.length,...opts})

assert.equal(math.length,11)
assert.equal(english.length,13)
assert.equal(themes.length,15)
assert.equal(math.reduce((n,u)=>n+u.lessons,0),150)
assert.equal(english.reduce((n,u)=>n+u.lessons,0),150)
const math30=mk(math)
assert.equal(math30.error,null)
assert.equal(math30.items.length,150)
assert.equal(math30.weeks.length,30)
assert.equal(math30.weeklyAllocation,5)
assert.equal(math30.annualCapacity,150)
assert.equal(math30.pacingSource,'calendar-and-weekly-allocation')
assert.ok(math30.weeks.every(w=>math30.items.filter(item=>item.termId===w.termId&&item.week===w.week).length===5))
assert.deepEqual(new Set(math30.items.map(item=>item.unitId)),new Set(math.map(item=>item.id)))
assert.deepEqual(math30.items.filter(x=>x.unitId==='1.1').map(x=>x.suggestedLesson),
  Array.from({length:math[0].lessons},(_,i)=>i+1),'Mathematics keeps prerequisite-first progression')
assert.deepEqual(mk(math),math30,'Identical input must produce deterministic annual pacing')

const math40=mk(math,{termWeeks:forty})
assert.equal(math40.error,null)
assert.equal(math40.items.length,150)
assert.equal(math40.weeks.length,40)
assert.equal(math40.annualCapacity,200)
assert.ok(math40.weeks.every(w=>{
  const n=math40.items.filter(item=>item.termId===w.termId&&item.week===w.week).length
  return n>=3&&n<=5
}),'Forty weeks must spread 150 source suggestions without inventing 50 more')
assert.equal(math40.annualCapacity-math40.totalLessons,50)

const english30=mk(english,{themes})
assert.equal(english30.error,null)
assert.equal(english30.items.length,150)
assert.equal(english30.annualCapacity,150)
assert.deepEqual(english30.items.slice(0,10).map(x=>x.strand),[1,2,3,4,1,2,3,4,1,1],
  'English needs interleaved listening, reading, language use and writing in each theme')
for(const theme of themes){
  const items=english30.items.filter(x=>x.themeId===theme.id)
  assert.equal(items.length,10,'Each of 15 contexts has 10 suggested lessons')
  assert.ok(items.every(x=>x.themeTitle===theme.title))
  assert.deepEqual([1,2,3,4].map(strand=>items.filter(x=>x.strand===strand).length),[4,2,2,2])
}
for(const unit of english){
  const items=english30.items.filter(x=>x.unitId===unit.id)
  assert.equal(items.length,unit.lessons,'Every original English sub-strand keeps its lesson count')
  assert.deepEqual(items.map(x=>x.suggestedLesson),Array.from({length:unit.lessons},(_,i)=>i+1))
}
assert.equal(mk(english,{themes,termWeeks:forty}).items.length,150)
assert.deepEqual(mk(english,{themes}),english30)

assert.equal(mk(math,{termWeeks:calendar([8,8,8])}).items.length,0,'Cannot fit 150 lessons into 24x5 periods')
assert.match(mk(math,{termWeeks:calendar([8,8,8])}).error,/allocation fits only 120/)
assert.equal(mk(math,{termWeeks:calendar([10,10,9])}).items.length,0,'29x5 is 145, too few periods')
assert.equal(mk(math,{weeklyAllocation:4}).items.length,0,'Do not overbook 30 weeks with four slots')
assert.equal(mk(math,{weeklyAllocation:null}).items.length,0,'Maths must fail closed on missing allocation')
assert.match(mk(english,{weeklyAllocation:null,themes}).error,/confirmed weekly lesson allocation/)
assert.equal(mk(english,{weeklyAllocation:5.5,themes}).items.length,0,'Fractional allocation is invalid')
assert.equal(mk(english,{themes:themes.slice(0,14)}).items.length,0,'Incomplete thematic coverage must fail closed')
assert.equal(mk(english,{themes:themes.slice(0,14)}).error?.includes('reconciled.'),true)

const holidayOverride=[...forty,{term_id:'term-1',week_number:2,week_type:'holiday',school_id:'real-school'}]
const withoutHoliday=mk(math,{termWeeks:holidayOverride})
assert.equal(withoutHoliday.weeks.length,39,'School holidays override generic calendar teaching weeks')
assert.ok(withoutHoliday.items.every(item=>!(item.termId==='term-1'&&item.week===2)))
assert.equal(withoutHoliday.items.length,150)
assert.equal(buildCreativeAnnualSchemeDraft({units:[],terms,termWeeks:thirty}).items.length,0)
const creative=buildCreativeAnnualSchemeDraft({units:Array.from({length:16},(_,i)=>({id:String(i),title:'Creative',strand:1,lessons:i<2?14:13,outcomes:['Learning objective']})),terms,termWeeks:forty,weeklyAllocation:7})
assert.equal(creative.error,null)
assert.equal(creative.items.length,210,'Creative Activities keeps original engine and 210 lesson capacity')
assert.equal(termCreativeSchemeRows(creative,'term-1').every(row=>row.termId==='term-1'),true)

for(const expected of [
  "buildCreativeAnnualSchemeDraft({...options,units:GRADE1_CREATIVE_UNITS})",
  "buildGrade1AnnualSchemeDraft({...options,units:readerUnits",
  "requireWeeklyAllocation:true,themes:isGrade1English?GRADE1_ENGLISH_THEMES:null",
  "previewCount={!curriculumView&&isGrade1Paced?autoWeekSuggestions.length:0}",
  "{!curriculumView && isGrade1Paced && <AutoCreativeScheme",
  "catalog={isGrade1Creative?creativeCatalog:grade1ReaderCatalog}",
  "supabase.rpc(isGrade1English?'commit_mapped_thematic_scheme_lesson':'commit_mapped_scheme_lesson'",
  "p_sub_strand_id:item.subStrandId,p_outcome_ids:[item.outcomeId]",
  "allocatedWeekCapacity===null",
  "weekAllocationFull",
  "prepareSchemeLesson(saved)"
]) assert.ok(map.includes(expected),'Missing canonical UI-to-Scheme connection: '+expected)
assert.ok(preview.includes('capacityFull'),'Preview must block adding mapped lessons when week is full')
assert.ok(preview.includes('activeThisWeek'),'Preview must count the same active lessons as the database')
assert.ok(preview.includes('subjectName'),'Reuse Creative Activities UI rather than duplicate a new Scheme engine')
assert.ok(preview.includes('Theme {item.themeId}: {item.themeTitle}'),'English theme shown in draft')
assert.ok(preview.includes('onViewUnit(item.unitId,item.themeId)'),'Theme survives navigation back to Curriculum Map')
assert.ok(weekly.includes("item.status!=='cancelled'"),'Cancelled lessons free active periods')
assert.ok(weekly.includes('cancelledLessons.map'),'Cancelled lessons remain visible as history')

for(const token of [
  "public.resolve_subject_weekly_allocation(p_class_id,p_subject_id)",
  "pg_advisory_xact_lock(hashtextextended",
  "status is distinct from 'cancelled'",
  "SCHEME_WEEK_ALLOCATION_FULL",
  "SCHEME_WEEKLY_ALLOCATION_REQUIRED",
  "v_reader_ref like 'VS-CUR-G01-MA-2026#%'",
  "v_reader_ref like 'VS-CUR-G01-EN-2026#%'",
  "s.source_ref like 'VS-CUR-G01-CA-2026#%'",
  "security invoker",
  "public.commit_custom_scheme_item(",
]) assert.ok(sql.includes(token),'Missing server capacity or Creative Activities guard: '+token)
assert.ok(!sql.includes('security definer'),'Mapped Scheme must remain invoker-authorized')
for(const token of [
  'public.commit_mapped_thematic_scheme_lesson',
  'security invoker',
  'public.commit_mapped_scheme_lesson(',
  'SCHEME_ENGLISH_THEME_REQUIRED',
  'SCHEME_ENGLISH_THEME_SUBJECT_MISMATCH',
  "topic=v_themes[p_theme_id]||' · '||v_saved.topic",
  'where sw.id=v_saved.id and sw.teacher_id=auth.uid()',
]) assert.ok(thematicSql.includes(token),'Missing English thematic Scheme contract '+token)
assert.equal(themes.filter(theme=>thematicSql.includes("'"+theme.title.replaceAll("'","''")+"'")).length,15,
  'SQL and English curriculum themes must match exactly')
assert.ok(!sql.includes('insert into public.term_weeks'),'Never fabricate school weeks')
assert.ok(!sql.includes('insert into public.subject_weekly_allocations'),'Never invent subject allocations')
console.log('PASS: Grade 1 Maths and English thematic/weekly pacing, capacity guard, Creative preservation and Scheme handoff')
