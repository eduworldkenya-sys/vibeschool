import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(path,'utf8')

test('public visual catalogue stays certified-only and searches the complete catalogue',()=>{
  const source = read('app/api/visual-library/route.ts')
  for (const marker of [
    ".eq('asset_kind','visual_aid')", ".eq('owner_type','platform')",
    ".eq('status','active')", ".eq('visibility','public')",
    ".eq('lifecycle_status','certified')", "isVisualPayload(p)",
    "isSafeVisualStoragePath(p.storage.path)", "sourceStrandId",
    "p.source_strand_id !== sourceStrandId",
    "p.topic_key.toLowerCase() !== topicKey", "resourceVersionId:version.id",
    "PAGE_SIZE = 24", "scanOffset", "hasMore",
  ]) assert.ok(source.includes(marker),'Missing catalogue boundary: '+marker)
  assert.doesNotMatch(source,/vibe-publication-drafts/)
})

test('shared visual renderer requires an exact source, topic and certified version',()=>{
  const component=read('components/learn/SectionVisualModels.tsx')
  for (const marker of [
    "UUID_RE.test(sourceStrandId)", "UUID_RE.test(row.id)",
    "UUID_RE.test(row.resourceVersionId)",
    "row.sourceStrandId === sourceStrandId",
    "row.topicKey === topicKey", "row.placements.includes(placement)",
    "cache:'no-store'", "resourceVersionId={visual.resourceVersionId}",
  ]) assert.ok(component.includes(marker),'Missing visual guard: '+marker)
  assert.doesNotMatch(component,/visual-library\/[0-9a-f-]+[.]png/)
  assert.doesNotMatch(component,/80105423-2661-40c8|9c6b5131-0ed9/)
})

test('both Time readers use the shared placement once and only for linked Lesson 4',()=>{
  const universal=read('components/learn/UniversalLearnReader.tsx')
  assert.match(universal,/SectionVisualModels/)
  assert.match(universal,/!toolContext \|\| !!sourceBinding/)
  assert.match(universal,/visualContext/)
  for(const path of [
    'components/learn/Grade4TimeContentReader.tsx',
    'components/learn/Grade4TimeOutcomePackage.tsx',
  ]){
    const source=read(path)
    assert.match(source,/<UniversalLearnReader/)
    assert.match(source,/visualContext=\{/)
    assert.match(source,/time-hours-minutes/)
    assert.match(source,/e975dcc6-32a9-4274-a2a3-3d19e409cf5c/)
    assert.match(source,/\.order === 4|\.lesson_order === 4/)
    assert.doesNotMatch(source,/Grade4TimeVisualModels/)
  }
})

test('gallery uses Learn shell, pinned images, lesson context and retry',()=>{
  const page=read('app/learn/visuals/page.tsx')
  for(const marker of [
    'SchoolLearnLibrary.module.css','SCHOOL_LEVELS','resourceVersionId={visual.resourceVersionId}',
    'topicKey','hasMore','setRetry','relatedLesson','subjectHref',
  ]) assert.ok(page.includes(marker),'Missing gallery functionality: '+marker)
  const detail=read('app/api/visual-library/[id]/route.ts')
  assert.match(detail,/.order\('version', \{ ascending: false \}\).limit\(1\).maybeSingle\(\)/)
})
