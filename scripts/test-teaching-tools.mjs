import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  TEACHING_TOOL_CATALOG, isTeachingToolId, isTeachingToolSubject,
  isUsableTeachingToolSpec, resolveTeachingTools, suggestTeachingTools,
} from '../lib/learn/teachingToolCatalog.ts'
import { learnSubjectMode } from '../lib/learn/toolSubject.mjs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const reader = read('../components/learn/UniversalLearnReader.tsx')
const shelf = read('../components/learn/tools/TeachingToolShelf.tsx')
const math = read('../components/learn/tools/MathTeachingTools.tsx')
const languageScience = read('../components/learn/tools/LanguageScienceTeachingTools.tsx')
const css = read('../components/learn/tools/TeachingTools.module.css')
const grade4 = read('../components/learn/Grade4TimeContentReader.tsx')
const outcome = read('../components/learn/Grade4TimeOutcomePackage.tsx')

const pairs = [
  { term:'observe', definition:'To look carefully' },
  { term:'compare', definition:'To find differences or similarities' },
]
const science = {groups:['Living','Non-living'],items:[
  {label:'Grass',group:'Living'},{label:'Stone',group:'Non-living'}]}
const variables = {items:[
  {label:'Time in light',group:'Changed (independent)'},
  {label:'Height of plant',group:'Measured (dependent)'},
  {label:'Type of soil',group:'Kept the same (controlled)'}]}

test('15 distinct grade-neutral tools across Mathematics, Languages and Science',()=>{
  assert.equal(TEACHING_TOOL_CATALOG.length,15)
  assert.equal(new Set(TEACHING_TOOL_CATALOG.map(x=>x.id)).size,15)
  assert.equal(TEACHING_TOOL_CATALOG.filter(x=>x.subject==='math').length,7)
  assert.equal(TEACHING_TOOL_CATALOG.filter(x=>x.subject==='language').length,5)
  assert.equal(TEACHING_TOOL_CATALOG.filter(x=>x.subject==='science').length,3)
  for(const tool of TEACHING_TOOL_CATALOG) {
    assert.ok(isTeachingToolId(tool.id))
    assert.ok((math+languageScience).includes("case '"+tool.id+"'"), tool.id+' missing component')
  }
  assert.equal(learnSubjectMode('Grade 8 Mathematics'),'math')
  assert.equal(learnSubjectMode('Kiswahili'),'language')
  assert.equal(learnSubjectMode('Integrated Science'),'science')
})

test('unknown, wrong-subject, future-version and invalid activities never render',()=>{
  assert.deepEqual(resolveTeachingTools('English','Grammar', [{id:'food-chain',sequence:['A','B','C']}]),[])
  assert.deepEqual(resolveTeachingTools('Mathematics','', [{id:'vocabulary-match',pairs}]),[])
  assert.deepEqual(resolveTeachingTools('Science','', [{id:'constructor'}]),[])
  assert.deepEqual(resolveTeachingTools('Science','', [{id:'classification',...science,version:2}]),[])
  assert.deepEqual(resolveTeachingTools('Science','', [{id:'classification'}]),[])
  assert.deepEqual(resolveTeachingTools('English','', [{id:'word-builder',word:'planet'}]),[])
  assert.deepEqual(resolveTeachingTools('English','', [{id:'sentence-order',sentence:'Hi'}]),[])
  assert.deepEqual(resolveTeachingTools('Mathematics','', [{id:'data-chart',points:[{label:'A',value:-4},{label:'B',value:8}]}]),[])
  assert.equal(isTeachingToolSubject('Science','data-chart'),true)
  assert.equal(isTeachingToolSubject('Science','clock'),false)
})

test('subject and topic alone do not invent content or suggest unrelated exercises',()=>{
  for(const [subject,topic] of [['Mathematics','Time'],['English','Comprehension'],['Kiswahili','Lugha'],['Science','Living things']]) {
    assert.deepEqual(resolveTeachingTools(subject,topic),[])
    assert.deepEqual(suggestTeachingTools(subject,topic),[])
  }
  assert.deepEqual(resolveTeachingTools('Mathematics','Time',[]),[])
  assert.match(reader,/sectionTools = validSections[\s\S]*?\.filter\(\(\{ section, index \}\) =>/)
  assert.match(reader,/<TeachingToolShelf/)
  assert.match(reader,/toolContext \? sectionTools/)
  assert.match(grade4,/topic="time"/)
  assert.match(outcome,/topic="time"/)
  assert.match(grade4,/vs_public_grade4_math_time_learner_lessons/)
  assert.match(outcome,/vs_published_grade4_time_outcome/)
})

test('approved tool data is accepted, de-duplicated and limited to five meaningful aids',()=>{
  const approved=[
    {id:'word-builder',word:'ndizi',prompt:'A fruit we eat'},
    {id:'sentence-order',sentence:'We all love reading.'},
    {id:'vocabulary-match',pairs},
    {id:'reading-comprehension',passage:'The young farmer watered the maize each morning. One week later, the plants were taller.',question:'What did the farmer do?',sampleAnswer:'The farmer watered maize each morning.'},
    {id:'writing-planner',prompt:'Write about a favourite place.'},
  ]
  assert.equal(resolveTeachingTools('Kiswahili','',approved).length,5)
  assert.equal(resolveTeachingTools('English','',[...approved,...approved]).length,5)
  assert.ok(approved.every(s=>isUsableTeachingToolSpec(s,'English')))
  assert.deepEqual(resolveTeachingTools('Creative Arts','',approved),[])
})

test('Mathematics extends earlier fixed-range models and admits authored Science data',()=>{
  assert.ok(isUsableTeachingToolSpec({id:'number-line',min:-500,max:500,step:10,number:300},'Mathematics'))
  assert.ok(isUsableTeachingToolSpec({id:'place-value',number:999999999999},'Mathematics'))
  assert.deepEqual(resolveTeachingTools('Maths','', [{id:'number-line',min:100,max:10}]),[])
  assert.deepEqual(resolveTeachingTools('Maths','', [{id:'place-value',number:1000000000000}]),[])
  const points=[{label:'Monday',value:4},{label:'Tuesday',value:6}]
  assert.equal(resolveTeachingTools('Science','Results',[{id:'data-chart',points}]).length,1)
  assert.equal(resolveTeachingTools('Mathematics','Data',[{id:'data-chart',points}]).length,1)
  assert.match(math,/999999999999/)
  assert.match(math,/function FractionBars/)
  assert.match(math,/Math\.ceil\(n\/den\)/)
  assert.match(math,/capacity: \{ millilitre: 1, litre: 1000 \}/)
  assert.match(math,/function DataChart/)
  assert.match(math,/useId/)
})

test('Science classification, fair-test variables and food chains require real supplied examples',()=>{
  assert.equal(resolveTeachingTools('Science','',[
    {id:'classification',...science},
    {id:'experiment-variables',...variables},
    {id:'food-chain',sequence:['Grass','Grasshopper','Frog']},
  ]).length,3)
  assert.equal(resolveTeachingTools('Science','',[{id:'classification',groups:science.groups,
    items:[{label:'Grass',group:'Unknown'}]}]).length,0)
  assert.equal(resolveTeachingTools('Science','',[{id:'food-chain',sequence:['Grass','Grass','Frog']}]).length,0)
  assert.doesNotMatch(languageScience,/const defaultGroups/)
  assert.doesNotMatch(languageScience,/const defaultPairs/)
  assert.match(languageScience,/spec\.items \?\? \[\]/)
})

test('language activity fixes protect spelling recall and accept visually repeated words',()=>{
  assert.doesNotMatch(languageScience,/Build this word/)
  assert.match(languageScience,/Use the letters to build the word/)
  assert.match(languageScience,/values\[index\] === values\[i\]/)
  assert.match(languageScience,/function ReadingComprehension/)
  assert.match(languageScience,/function WritingPlanner/)
  assert.match(languageScience,/Your writing stays on this page and is not submitted or marked/)
  assert.match(languageScience,/aria-expanded=\{revealed\}/)
  assert.match(css,/textarea:focus-visible/)
  assert.match(css,/@media\(max-width:600px\)/)
})

test('tools are ephemeral, use native controls, and cannot bypass the canonical content gate',()=>{
  for(const src of [shelf,math,languageScience,read('../lib/learn/teachingToolCatalog.ts')]) {
    for(const forbidden of ['supabase.', 'localStorage', 'service_role', '/api/', 'fetch(', 'document.cookie', 'student_outcome_mastery']) {
      assert.ok(!src.includes(forbidden),'unexpected side effect: '+forbidden)
    }
  }
  assert.match(shelf,/not graded or saved/)
  assert.match(languageScience,/Check word/)
  assert.match(languageScience,/Check order/)
  assert.match(languageScience,/Check matches/)
  assert.match(languageScience,/Check groups/)
  assert.match(math,/type="range"/)
  assert.match(math,/role="img"/)
})
