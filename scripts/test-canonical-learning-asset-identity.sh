#!/usr/bin/env bash
set -euo pipefail

TMP_DIR=".tmp-canonical-learning-asset-identity"
trap 'rm -rf "$TMP_DIR"' EXIT
rm -rf "$TMP_DIR"

npx tsc lib/content/canonicalLearningAssetIdentity.ts \
  --ignoreConfig \
  --target ES2020 --module commonjs --moduleResolution node --skipLibCheck --outDir "$TMP_DIR"

node <<'NODE'
const assert = require('node:assert/strict')
const { buildCanonicalLearningAssetIdentity, CANONICAL_LEARNING_ASSET_KEY_VERSION } = require('./.tmp-canonical-learning-asset-identity/canonicalLearningAssetIdentity.js')

const base = {
  jurisdiction: ' KE ', curriculumId: 'CURRICULUM-1', subjectId: 'SUBJECT-1',
  grade: ' Grade 6 ', outcomeIds: ['OUTCOME-B', 'outcome-a', 'OUTCOME-B'],
  assetKind: 'lesson_plan', purpose: 'teach', language: 'EN',
}
const a = buildCanonicalLearningAssetIdentity(base)
const b = buildCanonicalLearningAssetIdentity({ ...base, jurisdiction: 'ke', curriculumId: 'curriculum-1', subjectId: 'subject-1', grade: 'grade 6', outcomeIds: ['outcome-a', 'outcome-b'], language: 'en' })
assert.equal(a.keyVersion, CANONICAL_LEARNING_ASSET_KEY_VERSION)
assert.equal(a.familyKey, b.familyKey, 'equivalent curriculum identities must converge')
assert.deepEqual(a.normalized.outcomeIds, ['outcome-a', 'outcome-b'])
assert.notEqual(a.familyKey, buildCanonicalLearningAssetIdentity({ ...base, assetKind: 'quiz', purpose: 'assess' }).familyKey)
assert.notEqual(a.familyKey, buildCanonicalLearningAssetIdentity({ ...base, variant: 'extension' }).familyKey)
assert.throws(() => buildCanonicalLearningAssetIdentity({ curriculumId:'curriculum-1', subjectId:'subject-1', grade:'grade-6', assetKind:'lesson_plan', purpose:'teach' }), /strandId, outcomeIds or an authority-backed topicKey is required/)
for (const forbidden of ['teacherId','schoolId','classId','studentId','learnerId','timetableSlotId','taughtDate','learnerCount','deadline']) {
  assert.equal(Object.prototype.hasOwnProperty.call(a.normalized, forbidden), false, `delivery field ${forbidden} must not enter canonical identity`)
}
console.log('canonical learning asset identity contract: PASS')
NODE
