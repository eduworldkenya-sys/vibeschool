import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(path,'utf8')

test('public visual catalogue remains certified-only and filters subject/topic',()=>{
 const s=read('app/api/visual-library/route.ts')
 for(const marker of [
   ".eq('asset_kind','visual_aid')",
   ".eq('owner_type','platform')",
   ".eq('status','active')",
   ".eq('visibility','public')",
   ".eq('lifecycle_status','certified')",
   "isVisualPayload(p)",
   "isSafeVisualStoragePath(p.storage.path)",
   "if (subject) q = q.eq('subject',subject)",
   "p.topic_key.toLowerCase() !== topicKey",
   "resourceVersionId:version.id",
 ]) assert.ok(s.includes(marker),'Missing visibility guard: '+marker)
 assert.doesNotMatch(s,/vibe-publication-drafts/)
})

test('only published Grade 4 Time lesson displays source-linked diagrams',()=>{
 const component=read('components/learn/Grade4TimeVisualModels.tsx')
 assert.match(component,/lessonOrder !== 4 \|\| inlineVisualPresent/)
 assert.match(component,/cache: 'no-store'/)
 assert.match(component,/subject: 'Mathematics', topicKey: 'time-hours-minutes'/)
 assert.match(component,/<VisualLearningAsset id=\{visual.id\} resourceVersionId=\{visual.resourceVersionId\}/)
 assert.match(component,/UUID_RE.test\(row.id\)/)
 assert.match(component,/UUID_RE.test\(row.resourceVersionId\)/)
 assert.doesNotMatch(component,/visual-library\/[0-9a-f-]+[.]png/)
 assert.doesNotMatch(component,/80105423-2661-40c8|9c6b5131-0ed9/)
})

test('both learner and teacher readers use one shared panel and suppress duplicate inline visuals',()=>{
 for(const path of [
   'components/learn/Grade4TimeContentReader.tsx',
   'components/learn/Grade4TimeOutcomePackage.tsx'
 ]){
   const s=read(path)
   assert.match(s,/import Grade4TimeVisualModels from/)
   assert.match(s,/<Grade4TimeVisualModels lessonOrder=/)
   assert.match(s,/inlineVisualPresent=\{/)
 }
})
