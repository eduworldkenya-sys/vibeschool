import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {GRADE3_MATHEMATICS_UNITS,GRADE3_MATHEMATICS_LESSONS,GRADE3_MATHEMATICS_SOURCE_URL} from '../../lib/teaching/grade3MathematicsCatalog.mjs'

const crosswalk=JSON.parse(readFileSync(new URL('../../content/curriculum/grade3-mathematics-scheme-crosswalk-20261113.json',import.meta.url),'utf8'))
const page=readFileSync(new URL('../../app/teacher/scheme/AuthoritySchemePage.jsx',import.meta.url),'utf8')
const map=readFileSync(new URL('../../components/teacher/curriculum/Grade3MathematicsMap.jsx',import.meta.url),'utf8')

test('Grade 3 Mathematical Activities 2024 source outline has 14 units in 3 strands with 150 suggested lessons',()=>{
  assert.equal(GRADE3_MATHEMATICS_UNITS.length,14)
  assert.equal(new Set(GRADE3_MATHEMATICS_UNITS.map(unit=>unit.id)).size,14)
  assert.deepEqual([...new Set(GRADE3_MATHEMATICS_UNITS.map(unit=>unit.strand))],['Numbers','Measurement','Geometry'])
  assert.equal(GRADE3_MATHEMATICS_UNITS.reduce((sum,x)=>sum+x.lessons,0),150)
  assert.equal(GRADE3_MATHEMATICS_LESSONS,150)
  assert.match(GRADE3_MATHEMATICS_SOURCE_URL,/GRADE\.3\.MATHEMATICS\.ACTIVITIES\.pdf$/)
  assert.equal(crosswalk.source_pdf,GRADE3_MATHEMATICS_SOURCE_URL)
  assert.deepEqual(crosswalk.rows.map(r=>({id:r.code,strand:r.strand,title:r.sub_strand,lessons:r.suggested_lessons})),GRADE3_MATHEMATICS_UNITS.map(unit=>({id:unit.id,strand:unit.strand,title:unit.title,lessons:unit.lessons})))
})

test('Legacy mapping never silently becomes a private source transcription or saved Scheme',()=>{
  assert.equal(crosswalk.production_state.legacy_math_units,14)
  assert.equal(crosswalk.production_state.linked_atomic_outcomes,0)
  assert.equal(crosswalk.production_state.saved_scheme_rows,0)
  assert.equal(crosswalk.source_text_status,'PRIVATE_VERBATIM_TRANSCRIPTION_NOT_PERFORMED')
  assert.equal(crosswalk.rows.filter(row=>row.legacy_heading_pair_id).length,6)
  assert.equal(new Set(crosswalk.rows.filter(row=>row.legacy_heading_pair_id).map(x=>x.legacy_heading_pair_id)).size,6)
  assert.ok(crosswalk.rows.every(row=>row.scheme_connection==='PENDING_MIGRATION_AND_AUTHENTICATED_TEACHER_SAVE'))
  assert.ok(crosswalk.rows.every(row=>row.mapping_status==='NO_EXACT_LEGACY_HEADING_PAIR'||row.mapping_status==='LEGACY_HEADING_PAIR_MATCH_ONLY'))
  assert.ok(crosswalk.rows.every(row=>!Object.hasOwn(row,'source_exact_text')))
})

test('The existing teacher curriculum and scheme workspace can navigate the Grade 3 outline without authorizing fabricated lesson saves',()=>{
  assert.match(page,/isGrade3Mathematics/)
  assert.match(page,/Grade3MathematicsMap/)
  assert.match(page,/isGrade3Mathematics && <Grade3MathematicsMap/)
  assert.match(map,/onOpenScheme/)
  assert.doesNotMatch(map,/commit_mapped_scheme_lesson|commit_custom_scheme_item|\.insert\(/)
  assert.match(map,/Not yet linked to verified learning outcomes/)
})
