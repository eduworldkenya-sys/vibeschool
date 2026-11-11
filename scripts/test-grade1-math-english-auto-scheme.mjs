import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildGrade1AnnualSchemeDraft, buildCreativeAnnualSchemeDraft, termCreativeSchemeRows } from '../lib/teaching/creativeSchemeDraft.mjs'

const read = path => readFileSync(new URL(path, import.meta.url),'utf8')
const page = read('../app/teacher/scheme/AuthoritySchemePage.jsx')
const panel = read('../components/teacher/scheme/AutoCreativeScheme.jsx')
const helper = read('../lib/teaching/creativeSchemeDraft.mjs')
const math = read('../components/teacher/curriculum/Grade1MathematicsMap.tsx')
const english = read('../components/teacher/curriculum/Grade1EnglishMap.tsx')
function units(source, name) {
  const begin = 'export const ' + name + '_UNITS: readonly CurriculumUnit[] = '
  const data = source.split(begin)[1]?.split('\n\nconst card: CSSProperties')[0]
  assert.ok(data, 'Grade 1 reader missing: '+name)
  return JSON.parse(data)
}
const terms = [1,2,3].map(n=>({id:'term-'+n,term:n}))
const weeks = terms.flatMap((term,i)=>Array.from({length:[13,14,13][i]},(_,j)=>({
  school_id:null,term_id:term.id,week_number:j+1,week_type:'normal'
})))
const cases = [
  {subject:'Mathematics',units:units(math,'GRADE1_MATHEMATICS'),count:11,outcomes:54},
  {subject:'English',units:units(english,'GRADE1_ENGLISH'),count:13,outcomes:58},
]
for(const item of cases){
  const {subject,units:catalog,count,outcomes}=item
  assert.equal(catalog.length,count,subject+' complete sub-strands')
  assert.equal(catalog.reduce((n,u)=>n+u.outcomes.length,0),outcomes,subject+' outcomes')
  assert.equal(catalog.reduce((n,u)=>n+u.lessons,0),150,subject+' full annual scope')
  const draft=buildGrade1AnnualSchemeDraft({
    units:catalog,expectedUnitCount:count,terms,termWeeks:weeks,weeklyAllocation:5
  })
  assert.equal(draft.error,null,subject+' should build a draft')
  assert.equal(draft.items.length,150,subject+' annual suggested lessons')
  assert.equal(draft.unitCount,count)
  assert.equal(draft.weeks.length,40)
  assert.equal(draft.pacingSource,'calendar-and-weekly-allocation')
  assert.equal(new Set(draft.items.map(row=>row.key)).size,150,subject+' unique lesson identities')
  assert.deepEqual(new Set(draft.items.map(row=>row.unitId)),new Set(catalog.map(unit=>unit.id)))
  for(const term of terms){
    const rows=termCreativeSchemeRows(draft,term.id)
    assert.ok(rows.length>0,subject+' needs every term')
    assert.ok(rows.every(row=>row.termId===term.id&&row.week>=1))
  }
  for(const week of draft.weeks){
    const found=draft.items.filter(row=>row.termId===week.termId&&row.week===week.week)
    assert.ok(found.length===3||found.length===4,subject+' school weekly allocation')
  }
  for(const unit of catalog){
    const rows=draft.items.filter(row=>row.unitId===unit.id)
    assert.equal(rows.length,unit.lessons,subject+' prescribed unit lesson count')
    assert.equal(new Set(rows.flatMap(row=>row.outcomeIndexes)).size,unit.outcomes.length,subject+' outcome coverage')
    assert.ok(rows.every(row=>row.outcomes.length===row.outcomeIndexes.length),'Every draft outcome carries a full explanation')
  }
  assert.deepEqual(buildGrade1AnnualSchemeDraft({units:catalog,expectedUnitCount:count,terms,termWeeks:weeks,weeklyAllocation:5}),draft,
    subject+' deterministic reload')
  assert.ok(buildGrade1AnnualSchemeDraft({units:catalog,expectedUnitCount:count,terms:terms.slice(0,2),termWeeks:weeks}).error,
    subject+' cannot invent a missing school term')
  assert.ok(buildGrade1AnnualSchemeDraft({units:catalog,expectedUnitCount:count,terms,termWeeks:weeks,weeklyAllocation:3}).error,
    subject+' cannot exceed declared teaching allocation')
}
assert.ok(page.includes('isGrade1AutoScheme = isGrade1Creative || isGrade1Reader'),
  'All three subjects must use the same automatic scheme entry')
assert.ok(page.includes('!curriculumView && isAutoScheme && <AutoCreativeScheme'),
  'Open Scheme must automatically display the linked curriculum drafts')
assert.ok(page.includes('buildGrade1AnnualSchemeDraft({...shared,units:autoUnits,expectedUnitCount:autoUnits.length,gradeLabel:')&&page.includes("(isGrade4English||isGrade4Mathematics)?'Grade 4':")&&page.includes("(isGrade6Mathematics||isGrade6English)?'Grade 6':"),
  'Mathematics and English must use canonical shared pacing')
assert.ok(page.includes('catalog={isGrade4English?grade4EnglishCatalog:isGrade4Mathematics?grade4Catalog:isGrade6English?grade6EnglishCatalog:')&&page.includes('isGrade1Creative?creativeCatalog:grade1ReaderCatalog}'),
  'Draft suggestions must reference the saved IDs and authenticated mapped outcomes')
assert.ok(page.includes('loading={annualCalendarLoading||mappedCatalogLoading}'))
assert.ok(page.includes('error={annualCalendarError||mappedCatalogError}'))
assert.ok(page.includes("rpc('commit_mapped_scheme_lesson'"),
  'Save and prepare must use the existing authorized scheme function')
assert.ok(page.includes('p_outcome_ids:item.outcomeIds'),'Persist all selected outcomes in one scheme record')
assert.ok(panel.includes('item.outcomeIds?.length'),'Never save partially mapped outcomes')
assert.ok(page.includes('learningArea={autoLearningArea}'),
  'Display the teacher selected subject, not Creative Activities for every subject')
assert.ok(panel.includes('learningArea=\'Creative Activities\''),
  'Preserve Creative Activities default')
assert.ok(panel.includes('Draft suggestions are visible without creating teaching records.'),
  'Opening a scheme never invents saved lessons')
assert.ok(helper.includes('export function buildCreativeAnnualSchemeDraft(options)'),
  'Preserve existing Creative Activities planner contract')
assert.ok(page.includes("grade1_curriculum_reader_bindings"),
  'Preserve exact Mathematics/English identity mapping')
console.log('Grade 1 Mathematics and English automatic curriculum-linked Scheme of Work: PASS')
