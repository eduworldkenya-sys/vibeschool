import assert from 'node:assert/strict'
import { buildCanonicalLearningAssetIdentity } from '../lib/content/canonicalLearningAssetIdentity.ts'
import { buildOutcomePackageManifest, OUTCOME_PACKAGE_SCHEMA } from '../lib/content/outcomePackageManifest.ts'

const o = '123e4567-e89b-42d3-a456-426614174000'
const coreId = '123e4567-e89b-42d3-a456-426614174001'
const coreVersion = '123e4567-e89b-42d3-a456-426614174002'
const q = '123e4567-e89b-42d3-a456-426614174003'
const p = buildOutcomePackageManifest({
  outcomeId: o.toUpperCase(),
  assets: { core: [{ resource_id: coreId, resource_version_id: coreVersion }] },
  release: { core: 'released' },
})

assert.equal(p.schema, OUTCOME_PACKAGE_SCHEMA)
assert.equal(p.outcome_id, o)
assert.deepEqual(p.assets.activities, [])
assert.deepEqual(p.assets.revision, [])
assert.deepEqual(p.assets.teacher_guidance, [])
assert.deepEqual(p.assets.visual_assets, [])
assert.deepEqual(p.question_ids, { activities: [], revision: [] })
assert.deepEqual(p.release, { core: 'released', activities: 'draft', revision: 'draft' })
assert.equal(p.requirements.teacher_guidance, false)
assert.equal(p.requirements.visual_assets, false)

const activitiesReady = buildOutcomePackageManifest({
  outcomeId: o,
  questionIds: { activities: [q] },
  requirements: { teacherGuidance: false, visualAssets: true },
  release: { activities: 'ready' },
})
assert.equal(activitiesReady.release.activities, 'ready')
assert.equal(activitiesReady.release.core, 'draft')
assert.equal(activitiesReady.requirements.visual_assets, true)
assert.throws(() => buildOutcomePackageManifest({ outcomeId:o, release:{revision:'released'} }), /without content/)
assert.throws(() => buildOutcomePackageManifest({ outcomeId:o, questionIds:{revision:[q,q]} }), /duplicate revision question/)
assert.throws(() => buildOutcomePackageManifest({ outcomeId:o, assets:{core:[
  {resource_id:coreId,resource_version_id:coreVersion},
  {resource_id:coreId,resource_version_id:coreVersion},
]} }), /duplicate core version/)
assert.throws(() => buildOutcomePackageManifest({ outcomeId:'not-an-id' }), /invalid outcome ID/)
assert.throws(() => buildOutcomePackageManifest({ outcomeId:o, assets:{visual_assets:[
  {resource_id:coreId,resource_version_id:'bad'},
]} }), /invalid visual_assets.resource_version_id/)
assert.throws(() => buildOutcomePackageManifest({ outcomeId:o, release:{core:'published'} }), /invalid core release state/)

const identity = buildCanonicalLearningAssetIdentity({
  curriculumId: 'curriculum-id', subjectId: 'math', grade: '4',
  outcomeIds: [o], assetKind: 'outcome_package', purpose: 'reference',
})
assert.ok(identity.familyKey.includes('kind=outcome_package'))
assert.ok(identity.familyKey.includes(o))
console.log('P0 outcome package assembly contract: PASS')
