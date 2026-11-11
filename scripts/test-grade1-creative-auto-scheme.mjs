import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {buildCreativeAnnualSchemeDraft,termCreativeSchemeRows} from '../lib/teaching/creativeSchemeDraft.mjs'

const reader=readFileSync(new URL('../components/teacher/curriculum/Grade1CreativeActivitiesMap.tsx',import.meta.url),'utf8')
const page=readFileSync(new URL('../app/teacher/scheme/AuthoritySchemePage.jsx',import.meta.url),'utf8')
const component=readFileSync(new URL('../components/teacher/scheme/AutoCreativeScheme.jsx',import.meta.url),'utf8')
const weeksComponent=readFileSync(new URL('../components/teacher/scheme/WeeklyLessonSlots.tsx',import.meta.url),'utf8')
const definitions=[...reader.matchAll(/id: '(\d\.\d)', title: '([^']+)', strand: ([123]), lessons: (\d+),\s*outcomes: \[([^\]]+)\]/g)]
const units=definitions.map(match=>({
  id:match[1],title:match[2],strand:Number(match[3]),lessons:Number(match[4]),
  outcomes:[...match[5].matchAll(/'([^']*)'/g)].map(x=>x[1]),
}))
assert.equal(units.length,16,'Must plan all 16 curriculum sub-strands')
assert.equal(units.reduce((n,u)=>n+u.lessons,0),210,'Do not change annual curriculum scope')
assert.equal(units.reduce((n,u)=>n+u.outcomes.length,0),68,'Learning outcomes retained')

const terms=[{id:'term-1',term:1},{id:'term-2',term:2},{id:'term-3',term:3}]
const weeks=terms.flatMap((term,index)=>Array.from({length:[13,14,13][index]},(_,i)=>({term_id:term.id,week_number:i+1,week_type:'normal',school_id:null})))
const draft=buildCreativeAnnualSchemeDraft({units,terms,termWeeks:weeks})
assert.equal(draft.error,null)
assert.equal(draft.weeks.length,40)
assert.equal(draft.items.length,210)
assert.equal(draft.unitCount,16)
assert.equal(draft.pacingSource,'provisional-calendar-only')
assert.deepEqual(new Set(draft.items.map(item=>item.unitId)),new Set(units.map(x=>x.id)))
for(const term of terms){
  const subset=termCreativeSchemeRows(draft,term.id)
  assert.ok(subset.length>0,'Each term must have suggested content')
  assert.ok(subset.every(row=>row.termId===term.id),'No cross-term contamination')
}
for(const week of draft.weeks){
  const count=draft.items.filter(item=>item.termId===week.termId&&item.week===week.week).length
  assert.ok(count>=5&&count<=6,'Annual pacing should distribute 210 suggestions evenly over 40 weeks')
}
for(const unit of units){
  const unitRows=draft.items.filter(item=>item.unitId===unit.id)
  assert.equal(unitRows.length,unit.lessons,'Keep suggested lessons per sub-strand')
  assert.equal(new Set(unitRows.map(item=>item.outcomeIndex)).size,unit.outcomes.length,'Each learning outcome must be covered')
}
assert.deepEqual(buildCreativeAnnualSchemeDraft({units,terms,termWeeks:weeks}),draft,'Draft generation must be deterministic')
assert.equal(buildCreativeAnnualSchemeDraft({units,terms:terms.slice(0,2),termWeeks:weeks}).items.length,0,'Missing term cannot silently redistribute all content')
assert.equal(buildCreativeAnnualSchemeDraft({units,terms,termWeeks:weeks,weeklyAllocation:4}).items.length,0,'Do not over-allocate the school timetable')
assert.equal(buildCreativeAnnualSchemeDraft({units,terms,termWeeks:weeks,weeklyAllocation:7}).items.length,210)
const withOverride=[...weeks,{term_id:'term-1',week_number:1,week_type:'normal',school_id:'school'}]
assert.equal(buildCreativeAnnualSchemeDraft({units,terms,termWeeks:withOverride}).weeks.length,40,'Do not duplicate school-specific and global week')
assert.ok(page.includes('<AutoCreativeScheme'),'Teacher opens Scheme and sees curriculum-linked draft automatically')
assert.ok(page.includes("supabase.from('term_weeks')"),"Read the school's real instructional calendar")
assert.ok(page.includes("saveAndPrepareAutoDraft(item)"),'Prepare action must save a real canonical teacher scheme lesson')
assert.ok(page.includes("rpc('commit_mapped_scheme_lesson'"),'Reuse atomic secured database linkage')
assert.ok(component.includes('Draft suggestions are visible without creating teaching records'),'Do not misrepresent unsaved drafts as committed')
assert.ok(weeksComponent.includes('previewCount'),'Saved weekly slots must distinguish suggestions')
assert.ok(page.includes('isGrade1Mathematics && <Grade1MathematicsMap'),'Keep Grade 1 Mathematics intact')
assert.ok(page.includes('isGrade1English && <Grade1EnglishMap'),'Keep Grade 1 English intact')
console.log('Grade 1 Creative Activities automatic curriculum-linked scheme preview: PASS')
