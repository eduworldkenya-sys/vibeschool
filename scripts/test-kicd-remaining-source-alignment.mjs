import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GRADE4_MATHEMATICS_UNITS } from '../lib/teaching/grade4MathematicsCatalog.mjs'
import { GRADE4_ENGLISH_UNITS } from '../lib/teaching/grade4EnglishCatalog.mjs'
import { GRADE4_INDIGENOUS_UNITS } from '../lib/teaching/grade4IndigenousCatalog.mjs'
import { GRADE6_MATHEMATICS_UNITS } from '../lib/teaching/grade6MathematicsCatalog.mjs'
import { GRADE6_ENGLISH_UNITS } from '../lib/teaching/grade6EnglishCatalog.mjs'
import {
  GRADE6_KISWAHILI_UNITS,
  GRADE6_KISWAHILI_SOURCE_ROW_TOTAL,
  GRADE6_KISWAHILI_VIBESCHOOL_REVIEW,
} from '../lib/teaching/grade6KiswahiliCatalog.mjs'
import { GRADE8_MATHEMATICS_UNITS } from '../lib/teaching/grade8MathematicsCatalog.mjs'
import { GRADE8_ENGLISH_UNITS } from '../lib/teaching/grade8EnglishCatalog.mjs'
import { buildGrade1AnnualSchemeDraft } from '../lib/teaching/creativeSchemeDraft.mjs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const manifest = JSON.parse(read('content/curriculum/kicd-remaining-maps-audit.json'))
const grade9 = JSON.parse(read('content/curriculum/grade9-english-2024-index.json'))
function tsArray(path, name) {
  const src = read(path)
  const regex = new RegExp('export const ' + name + ' = (\\[[\\s\\S]*?\\]) as const')
  const match = src.match(regex)
  assert.ok(match, 'Missing source-index array: ' + name)
  return JSON.parse(match[1])
}
const grade4Kiswahili = tsArray('lib/curriculum/grade4KiswahiliReference.ts', 'GRADE4_KISWAHILI_UNITS')
const grade6KiswahiliSource = tsArray('lib/curriculum/grade6KiswahiliReference.ts', 'GRADE6_KISWAHILI_UNITS')
const grade8KiswahiliThemes = tsArray('lib/curriculum/grade8KiswahiliReference.ts', 'GRADE8_KISWAHILI_THEMES')
const grade8KiswahiliUnits = grade8KiswahiliThemes.flatMap(theme => theme.topics)

const data = new Map([
  ['Grade 4|Mathematics',GRADE4_MATHEMATICS_UNITS],
  ['Grade 4|English',GRADE4_ENGLISH_UNITS],
  ['Grade 4|Kiswahili',grade4Kiswahili],
  ['Grade 4|Indigenous Languages',GRADE4_INDIGENOUS_UNITS],
  ['Grade 6|Mathematics',GRADE6_MATHEMATICS_UNITS],
  ['Grade 6|English',GRADE6_ENGLISH_UNITS],
  ['Grade 6|Kiswahili',GRADE6_KISWAHILI_UNITS],
  ['Grade 8|Mathematics',GRADE8_MATHEMATICS_UNITS],
  ['Grade 8|English',GRADE8_ENGLISH_UNITS],
  ['Grade 8|Kiswahili',grade8KiswahiliUnits],
  ['Grade 9|English',grade9.themes.flatMap(theme => theme.units)],
])

assert.equal(manifest.subjects.length,11,'All 11 remaining maps need a source audit entry')
assert.equal(new Set(manifest.subjects.map(x=>x.grade+'|'+x.subject)).size,11)
for(const entry of manifest.subjects) {
  const key=entry.grade+'|'+entry.subject
  const units=data.get(key)
  assert.ok(units, 'Missing curriculum: '+key)
  assert.equal(units.length,entry.units,key+' expected structural topics')
  assert.ok(entry.sourceUrl.startsWith('https://kicd.ac.ke/'),key+' must identify the official publisher')
  assert.equal(entry.officialOutcomeVerification,'not_verified',
    key+' must not claim KICD outcome certification without a source-level crosswalk')
  assert.ok(read(entry.modulePath),key+' must have a real versioned source artifact')
  if(entry.authoredOutcomes>0) {
    assert.equal(units.reduce((sum,unit)=>sum+(unit.outcomes?.length??0),0),entry.authoredOutcomes,
      key+' must not silently lose independently authored outcomes')
  }
}
assert.equal(grade9.themes.length,15)
assert.equal(grade9.themes.flatMap(x=>x.units).length,75)
assert.match(grade9.verification,/outcomes_pending/)
assert.equal(grade8KiswahiliThemes.length,15)
assert.ok(grade8KiswahiliThemes.every(theme=>theme.topics.length===4))
assert.equal(grade8KiswahiliUnits.length*2,120)
assert.equal(grade4Kiswahili.reduce((sum,x)=>sum+x.suggestedLessons,0),121,
  'Grade 4 Kiswahili source rows add to 121; do not disguise the discrepancy with printed 120')
assert.equal(grade6KiswahiliSource.reduce((sum,x)=>sum+x.lessons,0),115)
assert.equal(GRADE6_KISWAHILI_SOURCE_ROW_TOTAL,115)
assert.equal(GRADE6_KISWAHILI_VIBESCHOOL_REVIEW,5)
assert.equal(GRADE6_KISWAHILI_UNITS.reduce((sum,x)=>sum+x.lessons,0),120)
assert.equal(GRADE6_KISWAHILI_UNITS.reduce((sum,x)=>sum+x.supportLessons,0),5)
// Exact revised-2024 KICD summary-table identity and pacing, not inferred
// from the catalogue itself. KICD Grade 6 Mathematics p. xii; Grade 8 p. x.
const officialGrade6Math = [
  ['1.1','Whole Numbers',20],['1.2','Multiplication',6],['1.3','Division',6],
  ['1.4','Fractions',12],['1.5','Decimals',12],['1.6','Inequalities',8],
  ['2.1','Length',14],['2.2','Area',6],['2.3','Capacity',6],['2.4','Mass',14],
  ['2.5','Time',10],['2.6','Money',8],['3.1','Lines',6],['3.2','Angles',6],
  ['3.3','3-D Objects',6],['4.1','Bar Graphs',10]
]
const officialGrade8Math = [
  ['1.1','Integers',6],['1.2','Fractions',6],['1.3','Decimals',8],
  ['1.4','Squares and Square Roots',6],['1.5','Rates, Ratio, Proportions and Percentages',14],
  ['2.1','Algebraic Expressions',6],['2.2','Linear Equations',7],
  ['3.1','Circles',5],['3.2','Area',10],['3.3','Money',9],
  ['4.1','Geometrical Constructions',12],['4.2','Coordinates and Graphs',14],
  ['4.3','Scale Drawing',14],['4.4','Common Solids',16],
  ['5.1','Data Presentation and Interpretation',10],['5.2','Probability',7]
]
// KICD Grade 6 English revised 2024, summary p. xii.
const officialGrade6English = [
  ['1.1','Pronunciation and Vocabulary',39],
  ['2.1','Extensive Reading',11],['2.2','Intensive Reading',22],['2.3','Fluency',3],
  ['3.1','Word Classes',33],['3.2','Tenses',6],
  ['4.1','Creative Writing',14],['4.2','Functional Writing',6],
  ['4.3','Mechanics of Writing',13],['4.4','Guided Compositions',3],
]
assert.deepEqual(GRADE6_ENGLISH_UNITS.map(u=>[u.id,u.title,u.lessons]),officialGrade6English,
  'All ten Grade 6 English KICD strands and lesson counts must match the official 2024 table')
for(const [label,source,units] of [
  ['Grade 6 Mathematics',officialGrade6Math,GRADE6_MATHEMATICS_UNITS],
  ['Grade 8 Mathematics',officialGrade8Math,GRADE8_MATHEMATICS_UNITS],
]) {
  assert.deepEqual(units.map(u=>[u.id,u.title,u.lessons]),source,
    label+' must match every KICD sub-strand identifier, heading and period count')
}
assert.equal(GRADE8_MATHEMATICS_UNITS.find(x=>x.id==='5.1')?.title,'Data Presentation and Interpretation',
  'KICD Grade 8 Mathematics source 5.1 title must match its revised 2024 summary')
const schoolTerms=[1,2,3].map(term=>({term,id:'term-'+term}))
const schoolWeeks=schoolTerms.flatMap(term=>Array.from({length:10},(_,i)=>({
  school_id:null,term_id:term.id,week_number:i+1,week_type:'normal'
})))
const kiswahiliDraft=buildGrade1AnnualSchemeDraft({
  units:GRADE6_KISWAHILI_UNITS,terms:schoolTerms,termWeeks:schoolWeeks,
  weeklyAllocation:4,expectedUnitCount:53,gradeLabel:'Grade 6'
})
assert.equal(kiswahiliDraft.error,null)
assert.equal(kiswahiliDraft.items.length,120)
assert.equal(kiswahiliDraft.items.filter(x=>x.isVibeSchoolReview).length,5,
  'Five supplementary periods require an explicit VibeSchool-only label')
const indigenousDraft=buildGrade1AnnualSchemeDraft({
  units:GRADE4_INDIGENOUS_UNITS,terms:schoolTerms,termWeeks:schoolWeeks,
  weeklyAllocation:2,expectedUnitCount:28,gradeLabel:'Grade 4'
})
assert.equal(indigenousDraft.error,null)
assert.equal(indigenousDraft.items.filter(x=>x.isVibeSchoolReview).length,6,
  'Six cross-strand showcase periods are VibeSchool supplementary, not KICD sub-strands')
assert.ok(read('components/teacher/scheme/AutoCreativeScheme.jsx')
  .includes('data-curriculum-source="vibeschool-supplementary"'),
  'The Scheme UI must distinguish supplementary review from KICD indexed lessons')
const migration=read('supabase/migrations/20261111195000_grade8_mathematics_kicd_data_presentation_title.sql')
assert.ok(migration.includes('VS-CUR-G08-MA-2026#5.1'))
assert.ok(migration.includes("sub_strand='Data Presentation and Interpretation'"))
assert.ok(migration.includes('GRADE8_MATH_KICD_5_1_RECONCILIATION_FAILED'))
console.log('Remaining KICD curriculum alignment contracts: 11 maps, title reconciliation and supplementary lesson provenance PASS')
