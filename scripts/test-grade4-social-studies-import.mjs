import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {validateSocialStudiesImport} from './validate-grade4-social-studies-import.mjs'
const plan=JSON.parse(readFileSync(new URL('../docs/content/grade4-social-studies-scheme-draft.json',import.meta.url),'utf8'))
const bytes=Buffer.from('%PDF-1.7 synthetic unit-test bytes; not an official artifact')
function fixture(){
  return {grade:plan.grade,subject:plan.subject,sourceUrl:plan.source.url,
    sourceSha256:createHash('sha256').update(bytes).digest('hex'),rightsReference:'synthetic test only',
    outcomes:plan.units.flatMap(u=>u.sourceOutcomeReferences.map(r=>({code:r.code,pdfPage:r.pdfPage,text:'Synthetic test statement '+r.code})))}
}
test('all 72 reviewed input slots produce canonical observation arguments without database writes',()=>{
  const result=validateSocialStudiesImport(fixture(),bytes)
  assert.equal(result.units,19)
  assert.equal(result.count,72)
  assert.equal(new Set(result.observations.map(o=>o.p_observation_key)).size,72)
  assert.ok(result.observations.every(o=>o.p_source_locator.includes('&outcome=')))
})
test('incomplete or duplicate imports fail closed',()=>{
  const short=fixture();short.outcomes.pop()
  assert.throws(()=>validateSocialStudiesImport(short,bytes),/72 outcome/)
  const duplicate=fixture();duplicate.outcomes[1]=duplicate.outcomes[0]
  assert.throws(()=>validateSocialStudiesImport(duplicate,bytes),/duplicate/)
})
test('wrong grade, source bytes, page or rights reference fail closed',()=>{
  const grade=fixture();grade.grade='Grade 5'
  assert.throws(()=>validateSocialStudiesImport(grade,bytes),/scope mismatch/)
  const hash=fixture();hash.sourceSha256='bad'
  assert.throws(()=>validateSocialStudiesImport(hash,bytes),/checksum/)
  const page=fixture();page.outcomes[0].pdfPage=99
  assert.throws(()=>validateSocialStudiesImport(page,bytes),/source page/)
  const rights=fixture();rights.rightsReference=''
  assert.throws(()=>validateSocialStudiesImport(rights,bytes),/rights reference/)
})
