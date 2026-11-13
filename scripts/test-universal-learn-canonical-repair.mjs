import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { adaptCanonicalLearnSections } from '../lib/learn/learningBlockContract.ts'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const reader = read('../components/learn/UniversalLearnReader.tsx')
const outcome = read('../components/learn/Grade4TimeOutcomePackage.tsx')
const time = read('../components/learn/Grade4TimeContentReader.tsx')
const visualApi = read('../app/api/visual-library/route.ts')
const visualAssetApi = read('../app/api/visual-library/[id]/route.ts')
const visuals = read('../components/learn/Grade4TimeVisualModels.tsx')
const blocks = read('../components/learn/LearningBlockRenderer.tsx')

test('canonical published blocks preserve order and reject invalid or unsafe content', () => {
  const uuid = '123e4567-e89b-42d3-a456-426614174000'
  const converted = adaptCanonicalLearnSections([{
    id: 'learn', title: 'Understand', body: '',
    blocks: [
      {kind:'paragraph',text:'Start here.'},
      {kind:'formula',expression:'60 × 2 = 120',explanation:'Two hours.'},
      {kind:'table',columns:['Hours','Minutes'],rows:[['1','60'],['2','120']]},
      {kind:'list',items:['First','Second'],ordered:true},
      {kind:'passage',text:'The clock struck noon.',attribution:'Narrator'},
      {kind:'activity',instructions:'Draw a clock.',materials:['paper','pencil']},
      {kind:'visual',id:uuid},
      {kind:'visual',id:'../../private'},
      {kind:'html',markup:'<script>secret</script>'},
    ],
  }])
  assert.equal(converted.length, 1)
  assert.deepEqual(converted[0].blocks?.map(x=>x.kind),[
    'paragraph','formula','table','list','passage','activity','visual'
  ])
  assert.equal(adaptCanonicalLearnSections([{id:'x',title:'No body',blocks:[]}]).length,0)
  assert.equal(adaptCanonicalLearnSections([{id:'invalid html',title:'Title',body:'Body'}]).length,0)
  assert.equal(adaptCanonicalLearnSections(null).length,0)
})

test('reader accepts content blocks and never chooses generic suggestion tools implicitly',()=>{
  assert.match(reader, /<LearningBlockRenderer blocks=\{section\.blocks\}/)
  assert.match(reader, /tools !== undefined \|\| sectionTools\.length > 0/)
  assert.match(reader, /<TeachingToolHost subject=\{subject\} section=\{section\}/)
  assert.match(reader, /id=\{\x60\$\{anchorPrefix\}-title\x60\} tabIndex=\{-1\}/)
  for(const kind of ['formula','table','list','passage','activity','visual']) {
    assert.ok(blocks.includes(`block.kind === '${kind}'`), 'missing block '+kind)
  }
  assert.doesNotMatch(blocks,/dangerouslySetInnerHTML|iframe|window\.open/)
  assert.match(blocks, /VisualLearningAsset/)
})

test('content-bound learning tools keep the released source authority',()=>{
  assert.match(reader, /getLearningToolSectionBinding/)
  assert.ok(reader.includes('sourceValid && (tools !== undefined || sectionTools.length > 0)'))
  for(const source of [time,outcome]) {
    assert.ok(source.includes('buildLearningToolContext'))
    assert.ok(source.includes('toolContext={toolContext'))
    assert.ok(source.includes('sections={adaptCanonicalLearnSections'))
    assert.ok(source.includes('getLearningToolSectionBinding'))
  }
})

test('published visual catalogue exposes only certified metadata at matching section',()=>{
  assert.match(visualApi, /placements:p\.placements/)
  assert.match(visualApi, /sourceStrandId:p\.source_strand_id/)
  assert.match(visualApi, /rights_status/)
  assert.match(visualApi, /certified_at/)
  assert.match(visualAssetApi, /rights_status/)
  assert.match(visualAssetApi, /certified_at/)
  assert.match(visualAssetApi, /\.eq\('lifecycle_status', 'certified'\)/)
  assert.match(visuals, /understand: 'explanation'/)
  assert.match(visuals, /example: 'worked_example'/)
  assert.match(visuals, /row\.sourceStrandId === GRADE4_TIME_SUBSTRAND_ID/)
  assert.match(visuals, /row\.placements\.includes\(placement\)/)
  for(const source of [time,outcome]) {
    assert.match(source, /afterSection=\{\(section, index\)/)
    assert.match(source, /<Grade4TimeVisualModels\s+lessonOrder=/)
    assert.match(source, /sectionId=\{section\.id\}/)
    assert.equal((source.match(/<Grade4TimeVisualModels/g)||[]).length,1)
  }
})

test('catalogue failure cannot block already released outcome and paging is linkable',()=>{
  assert.match(outcome,/const \[catalogueError, setCatalogueError\]/)
  assert.match(outcome,/setCatalogueError\(true\)/)
  assert.doesNotMatch(outcome,/setError\('Published outcome catalogue is unavailable/)
  assert.match(outcome,/window\.history\.replaceState/)
  assert.match(outcome,/url\.searchParams\.set\('lesson'/)
  assert.match(outcome,/heading\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(outcome,/setTab\('core'\)/)
  assert.match(outcome,/chooseLesson\(lessons\[selectedIndex \+ 1\]\.lesson_order\)/)
  assert.match(outcome,/setSelectedLesson\(ordered\.some/)
})
