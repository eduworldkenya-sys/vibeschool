import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8')
const cross=JSON.parse(read('content/curriculum/grade9-english-scheme-crosswalk-20261113.json'))
const index=JSON.parse(read('content/curriculum/grade9-english-2024-index.json'))
const map=read('components/teacher/curriculum/Grade9EnglishMap.tsx')
const scheme=read('app/teacher/scheme/AuthoritySchemePage.jsx')
const expected=index.themes.flatMap(theme=>theme.units.map(unit=>({code:unit.code,theme:theme.title,strand:unit.strand,title:unit.title,lessons:unit.suggestedLessons})))
test('Grade 9 English: retain all 75 persisted canonical heading IDs and 150 source suggested lessons',()=>{
 assert.equal(cross.source_indexed_rows,75)
 assert.equal(cross.rows.length,75)
 assert.equal(new Set(cross.rows.map(row=>row.code)).size,75)
 assert.equal(new Set(cross.rows.map(row=>row.canonical_sub_strand_id)).size,75)
 assert.equal(index.themes.length,15)
 assert.equal(cross.rows.reduce((n,row)=>n+row.lessons,0),150)
 assert.deepEqual(cross.rows.map(row=>({code:row.code,theme:row.theme,strand:row.strand,title:row.title,lessons:row.lessons})),expected)
 for(const row of cross.rows){
  assert.match(row.canonical_sub_strand_id,/^[0-9a-f]{8}-[0-9a-f-]{27,}$/)
  assert.equal(row.reference_source_ref,'VS-REF-G09-EN-2024#'+row.code)
  assert.equal(row.status,'CANONICAL_HEADING_REGISTERED_OUTCOMES_MISSING')
 }
})
test('Grade 9 English: preserve legacy records and deny false curriculum or Scheme certification',()=>{
 assert.equal(cross.legacy_rows_preserved,12)
 assert.equal(cross.verified_atomic_outcomes,0)
 assert.equal(cross.scheme_records,0)
 assert.equal(cross.teacher_save_state,'NO_OUTCOME_BACKED_SCHEME_LINK')
 assert.equal(cross.source_edition,index.edition)
 assert.equal(cross.source_preview_url,index.officialPreviewUrl)
 assert.ok(!map.includes('supabase.from('))
 assert.ok(!map.includes('commit_mapped_scheme_lesson'))
 assert.ok(scheme.includes("supabase.rpc('commit_mapped_scheme_lesson'"))
})
test('Grade 9 English: selected sub-strand travels from Map to existing Scheme and back',()=>{
 assert.ok(map.includes('GRADE9_ENGLISH_UNITS'))
 assert.ok(map.includes('grade9-english-scheme-crosswalk-20261113.json'))
 assert.ok(map.includes('onOpenScheme(unit.code)'))
 assert.ok(map.includes('onSelectUnit?.(unit.code)'))
 assert.ok(map.includes('View selected unit in Scheme'))
 assert.ok(scheme.includes('selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}'))
 assert.ok(scheme.includes('unitId:unitId||mapUnitId'))
 assert.ok(scheme.includes('grade9EnglishDraftUnit'))
 assert.ok(scheme.includes('Grade 9 English planning reference'))
 assert.ok(scheme.includes('This unit does not yet have all required active VibeSchool-authored outcomes'))
 assert.ok(scheme.includes('Back to selected English sub-strand'))
 assert.ok(scheme.includes('curriculumOutcomes[row.id]'))
})
