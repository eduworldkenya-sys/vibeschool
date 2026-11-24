import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

// Read-only import preflight: never fetch or reproduce the publisher's text.
// Use only an authorized supplied PDF and a reviewed transcription of its outcome rows.
const plan = JSON.parse(readFileSync(new URL('../docs/content/grade4-social-studies-scheme-draft.json', import.meta.url), 'utf8'))
export function validateSocialStudiesImport(input, pdfBytes) {
  if (!pdfBytes || !pdfBytes.length) throw new Error('Authorized source PDF bytes required')
  if (pdfBytes.subarray(0,5).toString() !== '%PDF-') throw new Error('Source must be a PDF')
  if (input?.grade !== plan.grade || input?.subject !== plan.subject || input?.sourceUrl !== plan.source.url) throw new Error('Source scope mismatch')
  const sha = createHash('sha256').update(pdfBytes).digest('hex')
  if (input.sourceSha256 !== sha) throw new Error('Source checksum mismatch')
  if (!input.rightsReference?.trim()) throw new Error('Source rights reference required')
  const expected = new Map(plan.units.flatMap(u => u.sourceOutcomeReferences.map(r => [r.code, {u,r}])))
  if (!Array.isArray(input.outcomes) || input.outcomes.length !== expected.size || expected.size !== 72) throw new Error('Expected 72 outcome rows')
  const seen = new Set()
  const observations = input.outcomes.map(row => {
    const slot = expected.get(row.code)
    if (!slot || seen.has(row.code)) throw new Error('Unexpected or duplicate outcome code: '+row.code)
    seen.add(row.code)
    if (typeof row.text !== 'string' || !row.text.trim() || row.text.trim() === row.code) throw new Error('Missing outcome text: '+row.code)
    if (!Number.isInteger(row.pdfPage) || row.pdfPage !== slot.r.pdfPage) throw new Error('Unexpected source page: '+row.code)
    const unit = slot.u
    return {
      p_observation_key: 'G04-SST-'+row.code,
      p_curriculum_framework: 'CBC',
      p_grade: plan.grade, p_subject_label: plan.subject,
      p_strand: unit.strand, p_sub_strand: unit.code+' '+unit.sourceHeading,
      p_topic: null, p_outcome_text: row.text.trim(), p_outcome_code: row.code,
      p_outcome_ordinal: row.code.charCodeAt(row.code.length-1)-96,
      p_difficulty: null, p_competencies: [], p_values: [], p_key_inquiry_questions: [],
      p_suggested_experiences: [], p_assessment_guidance: [],
      p_source_locator: 'page='+row.pdfPage+'&unit='+unit.code+'&outcome='+row.code,
      p_source_page: String(row.pdfPage), p_source_section: unit.code,
      p_raw_payload: {sourceSha256:sha, rightsReference:input.rightsReference}
    }
  })
  return {sourceSha256:sha, grade:plan.grade, subject:plan.subject, units:plan.units.length, count:observations.length, observations}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [pdfPath, rowsPath] = process.argv.slice(2)
  if (!pdfPath || !rowsPath) throw new Error('Usage: node scripts/validate-grade4-social-studies-import.mjs <authorized.pdf> <reviewed-outcomes.json>')
  const result = validateSocialStudiesImport(JSON.parse(readFileSync(rowsPath,'utf8')),readFileSync(pdfPath))
  // Do not write outcome text to CI or console logs.
  console.log(JSON.stringify({sourceSha256:result.sourceSha256, grade:result.grade, subject:result.subject, units:result.units, count:result.count, status:'input-shape-valid; no database writes or certification'}))
}
