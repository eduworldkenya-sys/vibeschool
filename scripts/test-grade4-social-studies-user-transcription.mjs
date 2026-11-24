import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read = name => JSON.parse(readFileSync(new URL('../docs/content/'+name, import.meta.url),'utf8'))
const source = read('grade4-social-studies-outcomes-user-transcription.json')
const plan = read('grade4-social-studies-scheme-draft.json')
test('user-supplied transcript has complete and unique coverage of the main curriculum',()=>{
  assert.equal(source.outcomes.length,72)
  assert.equal(source.generalLearningOutcomes.length,8)
  assert.equal(plan.units.length,19)
  assert.equal(plan.units.flatMap(u=>u.lessons).length,90)
  const codes = new Map(source.outcomes.map(o=>[o.code,o]))
  assert.equal(codes.size,72)
  for(const u of plan.units){
    for(const r of u.sourceOutcomeReferences){
      const o=codes.get(r.code)
      assert.ok(o?.text.trim(),r.code)
      assert.equal(o.printedPage,u.sourcePrintedPage)
      assert.deepEqual(o.lessonSequences,r.lessonSequences)
    }
    for(const l of u.lessons){
      assert.ok(l.sourceOutcomeCodes.length)
      assert.ok(l.sourceOutcomeCodes.every(c=>codes.has(c)))
    }
  }
  assert.ok(!source.outcomes.some(o=>o.code.startsWith('4.4.')))
})
test('transcription never impersonates a certified PDF or verified import',()=>{
  assert.equal(source.provenance.kind,'user-supplied-text')
  assert.equal(source.sourceSha256,undefined)
  assert.match(source.provenance.artifactStatus,/no PDF checksum/)
})
