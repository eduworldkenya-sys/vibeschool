import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { mergePinnedCandidates, selectPinnedVersion } = process.argv[2]
  ? createRequire(import.meta.url)(process.argv[2])
  : await import('../lib/teaching/lessonSourceVersionPins.ts')

const old = {id:'old',resource_id:'a'}
const latest = {id:'latest',resource_id:'a'}
const other = {id:'other',resource_id:'b'}
const versions = new Map([old,latest,other].map(v=>[v.id,v]))
const newest = new Map([['a',latest],['b',other]])
const resolve = candidates => mergePinnedCandidates(candidates).map(c=>selectPinnedVersion(c,versions,newest)?.id)
assert.deepEqual(resolve([{id:'a',pinnedVersionId:'old'},{id:'a'}]),['old'])
assert.deepEqual(resolve([{id:'a'},{id:'a',pinnedVersionId:'old'}]),['old'])
assert.deepEqual(resolve([{id:'a'}]),['latest'])
assert.deepEqual(resolve([{id:'a',pinnedVersionId:'absent'},{id:'a'}]),[undefined])
assert.deepEqual(resolve([{id:'a',pinnedVersionId:'other'}]),[undefined])
assert.deepEqual(resolve([{id:'a',pinnedVersionId:'old'},{id:'a',pinnedVersionId:'latest'}]),[undefined])
assert.deepEqual(resolve([{id:'b'},{id:'a',pinnedVersionId:'old'},{id:'a',pinnedVersionId:'old'}]),['other','old'])
console.log('Lesson exact version pin regression: PASS')
