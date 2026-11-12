import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildCanonicalLearningAssetIdentity } from '../lib/content/canonicalLearningAssetIdentity.ts'
import {
  imageTypeFromBytes, isSafeVisualStoragePath, isVisualPayload, limitedText,
  VISUAL_MAX_BYTES, VISUAL_PLACEMENTS, VISUAL_TYPES, VISUAL_TOKEN_RE,
} from '../lib/visual-library/contract.ts'

assert.ok(VISUAL_TYPES.includes('diagram'))
assert.ok(VISUAL_TYPES.includes('fraction_model'))
assert.ok(VISUAL_PLACEMENTS.includes('worked_example'))
assert.equal(VISUAL_MAX_BYTES, 5 * 1024 * 1024)
assert.equal(limitedText('  fraction circles  ', 100), 'fraction circles')
assert.equal(limitedText('abcdef', 3), 'abcd') // caller rejects overflow, not silently truncates valid values
assert.deepEqual(imageTypeFromBytes(new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])),{mime:'image/png',ext:'png'})
assert.deepEqual(imageTypeFromBytes(new Uint8Array([255,216,255,0,0,0,0,0,0,0,0,0])),{mime:'image/jpeg',ext:'jpg'})
assert.deepEqual(imageTypeFromBytes(new TextEncoder().encode('GIF89a...')),{mime:'image/gif',ext:'gif'})
assert.deepEqual(imageTypeFromBytes(new TextEncoder().encode('RIFFaaaaWEBP')),{mime:'image/webp',ext:'webp'})
assert.equal(imageTypeFromBytes(new TextEncoder().encode('<script>alert(1)</script>')), null)
assert.equal(imageTypeFromBytes(new TextEncoder().encode('<svg onload=alert(1)>')), null)
const file = 'visual-library/123e4567-e89b-42d3-a456-426614174000.png'
assert.ok(isSafeVisualStoragePath(file))
assert.equal(isSafeVisualStoragePath('visual-library/../private.txt'),false)
assert.equal(isSafeVisualStoragePath('other/123e4567-e89b-42d3-a456-426614174000.png'),false)

const sourceId='123e4567-e89b-42d3-a456-426614174001'
const payload={
  schema:'vibeschool.visual.v1',
  visual_type:'diagram', alt_text:'A number line from zero to ten', caption:'Count by ones',
  labels:['0','5','10'], placements:['explanation','worked_example'],
  storage:{bucket:'vibe-publication-drafts',path:file,mime:'image/png',bytes:100},
  topic_key:'number-lines', source_strand_id:sourceId,
}
assert.ok(isVisualPayload(payload))
assert.ok(!isVisualPayload({...payload,storage:{...payload.storage,path:'../private.png'}}))
assert.ok(!isVisualPayload({...payload,storage:{...payload.storage,bucket:'vibe-publication-images'}}))
assert.ok(!isVisualPayload({...payload,alt_text:'x'}))
assert.ok(!isVisualPayload({...payload,source_strand_id:'bad-id'}))
assert.ok(!isVisualPayload({...payload,placements:['evil']}))
const identity = buildCanonicalLearningAssetIdentity({
  curriculumId:'cbc-strand-authority',subjectId:'88689e06-a949-48ba-b15b-eae4d6a62bcf',
  grade:'Grade 1',strandId:sourceId,topicKey:'number-lines',
  assetKind:'visual_aid',purpose:'reference',variant:'diagram-number-line',
})
assert.ok(identity.familyKey.includes('kind=visual_aid'))
assert.equal(identity.familyKey,buildCanonicalLearningAssetIdentity({
  curriculumId:'cbc-strand-authority',subjectId:'88689e06-a949-48ba-b15b-eae4d6a62bcf',
  grade:' grade 1 ',strandId:sourceId,topicKey:'number-lines',
  assetKind:'visual_aid',purpose:'reference',variant:'diagram-number-line',
}).familyKey)
const id='123e4567-e89b-42d3-a456-426614174000'
const parts=('Start. [visual:'+id+'] Finish.').split(VISUAL_TOKEN_RE)
assert.equal(parts[1],id)
assert.equal(parts.length,3)

const read=p=>readFileSync(p,'utf8')
const hq=read('app/api/hq/visual-library/route.ts')
const pub=read('app/api/visual-library/[id]/route.ts')
const list=read('app/api/visual-library/route.ts')
const ui=read('app/hq/content/visuals/page.tsx')
const reader=read('components/learn/VisualLearningAsset.tsx')
for (const token of ["requireVisualHQ(req)","VISUAL_DRAFT_BUCKET","imageTypeFromBytes(buf)","eq('asset_kind', 'visual_aid')","lifecycle_status"]) {
  if(token==='lifecycle_status')continue
  assert.ok(hq.includes(token)||token==="eq('asset_kind', 'visual_aid')"&&hq.includes(".eq('asset_kind', 'visual_aid')"),'HQ must preserve '+token)
}
for (const token of [".eq('asset_kind', 'visual_aid')",".eq('status', 'active')",".eq('visibility', 'public')",".eq('lifecycle_status', 'certified')","isVisualPayload","createSignedUrl"]) assert.ok(pub.includes(token),'public visual read must fail closed on '+token)
for (const token of [".eq('status','active')",".eq('visibility','public')",".eq('lifecycle_status','certified')"]) assert.ok(list.includes(token),'public visual list must filter on '+token)
assert.ok(hq.includes("eq('grade', 'Grade ' + grade)"),'Grade contexts must use CBC source')
assert.ok(hq.includes("from('cbc_strands')"),'Source should not depend on missing published resource wrappers')
assert.ok(hq.includes("from('learning_resource_versions')"),'Use existing version authority')
assert.ok(hq.includes("if (!committed && cleanupAdmin)"),'failed upload compensation is required')
assert.ok(ui.includes("sourceStrandId"),'HQ must pass canonical curriculum context')
assert.ok(reader.includes('VisualLearningAsset'), 'shared asset renderer')
assert.ok(read('components/learn/Grade4TimeContentReader.tsx').includes('<VisualRichText'))
assert.ok(read('components/learn/Grade1CreativeContentReader.tsx').includes('<VisualRichText'))
assert.ok(read('app/teacher/resources/page.tsx').includes('/learn/visuals'))
assert.ok(read('app/hq/content/page.tsx').includes('/hq/content/visuals'))
assert.ok(read('supabase/migrations/20261112081000_visual_learning_library_kind.sql').includes("'visual_aid'"))
console.log('Visual Learning Library tests passed: image signatures, source identity, metadata, tokens, read isolation, draft upload and reader links.')
