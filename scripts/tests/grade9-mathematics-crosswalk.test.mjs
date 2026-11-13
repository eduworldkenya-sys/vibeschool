// Read-only Grade 9 Mathematics source/legacy/Scheme crosswalk regression.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const crosswalk=JSON.parse(readFileSync(new URL('../../content/curriculum/grade9-mathematics-scheme-crosswalk-20261113.json',import.meta.url),'utf8'))
const candidate=JSON.parse(readFileSync(new URL('../../content/curriculum/grade9-mathematics-hierarchy-2024-candidate.json',import.meta.url),'utf8'))

test('Grade 9 Maths crosswalk covers the 19 source-summary units, without adding a second curriculum',()=>{
  assert.equal(crosswalk.schema_version,1)
  assert.equal(crosswalk.totals.observed_strands,5)
  assert.equal(crosswalk.totals.observed_sub_strands,19)
  assert.equal(crosswalk.rows.length,19)
  assert.equal(new Set(crosswalk.rows.map(x=>x.code)).size,19)
  assert.equal(crosswalk.totals.observed_suggested_lessons,150)
  assert.equal(crosswalk.rows.reduce((sum,r)=>sum+r.suggested_lessons,0),150)
  assert.deepEqual(crosswalk.rows.map(r=>({code:r.code,strand:r.strand,sub_strand:r.sub_strand,suggested_lessons:r.suggested_lessons})),
    candidate.april_2024_summary.sub_strands.map(r=>({code:r.code,strand:r.strand,sub_strand:r.sub_strand,suggested_lessons:r.suggested_lessons})))
})

test('Grade 9 Maths preserves all legacy identities and only records truly exact pairs as candidates',()=>{
  assert.equal(crosswalk.totals.existing_grade9_math_legacy_units,20)
  assert.equal(crosswalk.totals.exact_legacy_heading_pairs,2)
  const exact=crosswalk.rows.filter(x=>x.mapping_status==='LEGACY_HEADING_PAIR_MATCH_ONLY')
  assert.deepEqual(exact.map(x=>x.code),['1.1','5.2'])
  assert.equal(exact.find(x=>x.code==='1.1').existing_exact_id,'2c590eb4-c69e-4412-8827-ef44cd300691')
  assert.equal(exact.find(x=>x.code==='5.2').existing_exact_id,'af9de857-3046-4053-9914-0d1c7f500fdf')
  const aliases=crosswalk.rows.filter(x=>x.mapping_status==='REVIEW_STRAND_ALIAS_NOT_BOUND')
  assert.deepEqual(aliases.map(x=>x.code),['3.1'])
  assert.equal(aliases[0].existing_title_only_candidates[0].existing_strand,'Measurement')
  assert.ok(crosswalk.rows.every(x=>!x.existing_exact_id||x.mapping_status==='LEGACY_HEADING_PAIR_MATCH_ONLY'))
})

test('A candidate title never becomes a verified outcome or saved teacher Scheme',()=>{
  assert.equal(crosswalk.registered_july_source_url,candidate.registered_source_url)
  assert.equal(crosswalk.totals.registered_source_artifacts,0)
  assert.equal(crosswalk.totals.registered_source_snapshots,0)
  assert.equal(crosswalk.totals.existing_grade9_math_atomic_outcomes,0)
  assert.equal(crosswalk.totals.existing_grade9_math_scheme_rows,0)
  assert.ok(crosswalk.rows.every(x=>x.verified_atomic_outcomes===0))
  assert.ok(crosswalk.rows.every(x=>x.scheme_connection==='BLOCKED_NO_VERIFIED_CANONICAL_OUTCOMES'))
  assert.ok(crosswalk.rows.every(x=>x.july_2024_observation==='SECONDARY_PDF_SUMMARY_OBSERVED_OFFICIAL_ARTIFACT_NOT_CAPTURED'))
  assert.ok(crosswalk.safe_handling.includes('authorized teacher save'))
  assert.ok(!Object.hasOwn(crosswalk,'source_exact_text'))
  assert.ok(crosswalk.canonical_tables.includes('scheme_lesson_outcomes'))
  assert.ok(crosswalk.canonical_tables.includes('curriculum_learning_outcomes'))
})
