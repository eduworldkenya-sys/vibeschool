import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { TEACHING_TOOL_CATALOG, resolveTeachingTools } from '../lib/learn/teachingToolCatalog.ts'
import { adaptCanonicalLearnSections } from '../lib/learn/learningBlockContract.ts'

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const tool = read('../components/learn/tools/EarlyYearsPracticalTools.tsx')
const shelf = read('../components/learn/tools/TeachingToolShelf.tsx')
const reader = read('../components/learn/UniversalLearnReader.tsx')
const library = read('../components/learn/VisualLearningAsset.tsx')
const bridge = read('../lib/learn/teachingToolContentBridge.mjs')

test('Stage 3 adds nine distinct activities to the original shared catalogue', () => {
  const ids = [
    'visual-explorer', 'audio-learning', 'observation-journal', 'drawing-pad',
    'practical-steps', 'sorting-groups', 'map-explorer', 'timeline-explorer', 'evidence-notes',
  ]
  assert.equal(TEACHING_TOOL_CATALOG.length, 21)
  assert.deepEqual(TEACHING_TOOL_CATALOG.slice(12).map(x => x.id), ids)
  for (const id of ids) {
    assert.deepEqual(resolveTeachingTools('Creative Arts','',[{id}]).map(x => x.id), [id])
    assert.ok((tool + read('../components/learn/tools/LanguageScienceTeachingTools.tsx'))
      .includes("case '" + id + "'"), 'missing functional UI for ' + id)
  }
  assert.match(shelf, /EarlyYearsPracticalTool/)
  assert.match(shelf, /current\.id === 'sorting-groups'/)
})

test('already-authorised sections retain bounded tool inputs and exact body', () => {
  const visual = '123e4567-e89b-42d3-a456-426614174000'
  const result = adaptCanonicalLearnSections([{
    id:'explore',title:'Explore plants',body:'Look at the certified seed illustration.',
    tools:[{id:'visual-explorer',visualId:visual,visualNotes:[{label:'Seed',detail:'A seed can germinate.'}],evil:'script'},
      {id:'observation-journal',observationQuestions:['What changed?']},
      {id:'practical-steps',steps:['Place a seed in moist soil','Observe each day'],materials:['Soil','Seed']},
      {id:'constructor',spokenText:'Do not execute'},{id:'audio-learning',spokenText:'Listen to the instructions'}],
  }])
  assert.equal(result[0].body,'Look at the certified seed illustration.')
  assert.equal(result[0].tools?.length,5)
  assert.equal(result[0].tools?.[0].visualId,visual)
  assert.equal(result[0].tools?.[0].evil,undefined)
  assert.deepEqual(result[0].tools?.[1].observationQuestions,['What changed?'])
  assert.deepEqual(resolveTeachingTools('Agriculture','',result[0].tools).map(x=>x.id),
    ['visual-explorer','observation-journal','practical-steps','audio-learning'])
  assert.match(reader,/getLearningToolSectionBinding/)
  assert.match(bridge,/resourceVersionId/)
})

test('reject unsupported asset identities, oversized lesson prompts and event fields',()=>{
  const result=adaptCanonicalLearnSections([{
    id:'explore',title:'Explore',body:'Use an approved lesson.',
    tools:[{id:'visual-explorer',visualId:'javascript:alert(1)',resourceVersionId:'../secret',
      visualNotes:[{label:'Label',detail:'Details'}]},
      {id:'map-explorer',places:[{label:'Farm',description:'Place to grow crops',x:500,y:60}]},
      {id:'timeline-explorer',events:[{date:'1',label:'First',untrusted:'hidden'}]},
      {id:'drawing-pad',prompt:'a'.repeat(9000)}],
  }])
  assert.equal(result[0].tools?.[0].visualId,undefined)
  assert.equal(result[0].tools?.[0].resourceVersionId,undefined)
  assert.equal(result[0].tools?.[1].places?.[0].x,undefined)
  assert.equal(result[0].tools?.[1].places?.[0].y,60)
  assert.equal(result[0].tools?.[2].events?.[0].untrusted,undefined)
  assert.equal(result[0].tools?.[3].prompt,undefined)
})

test('privacy, accessibility and certified visual admission are preserved',()=>{
  for(const text of ['VisualLearningAsset','onPointerDown','onPointerMove','onPointerCancel',
    'textarea','speechSynthesis','aria-label','Copy my work','Save drawing to device','not submitted',
    'Schematic positions only']) assert.ok(tool.includes(text),text)
  assert.match(library,/api\/visual-library/)
  assert.match(tool,/This is a private, unsaved worksheet/)
  assert.match(tool,/role="status"/)
  for(const forbidden of ['localStorage','service_role','supabase.rpc','supabase.from',
    'dangerouslySetInnerHTML','navigator.mediaDevices','getUserMedia','<audio src','eval(']) {
    assert.ok(!tool.includes(forbidden), forbidden)
  }
  // The tools must not create another progress, publication or assessment authority.
  assert.doesNotMatch(tool,/student_outcome_mastery|assessment_attempts|content_blocks|insert\(/)
})
