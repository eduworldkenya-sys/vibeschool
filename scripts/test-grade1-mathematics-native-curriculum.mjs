import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const reader = readFileSync(new URL('../components/teacher/curriculum/Grade1MathematicsMap.tsx', import.meta.url), 'utf8')
const curriculum = readFileSync(new URL('../app/teacher/scheme/AuthoritySchemePage.jsx', import.meta.url), 'utf8')
const subject = readFileSync(new URL('../app/teacher/subjecthub/page.tsx', import.meta.url), 'utf8')

const begin = 'export const GRADE1_MATHEMATICS_UNITS: readonly CurriculumUnit[] = '
const end = '\n\nconst card: CSSProperties'
assert.ok(reader.includes(begin), 'The native reader must export its curriculum data')
const json = reader.split(begin)[1].split(end)[0]
const units = JSON.parse(json)

assert.equal(units.length, 11, 'KICD Grade 1 Mathematics has 11 sub-strands')
assert.equal(new Set(units.map(unit => unit.id)).size, 11, 'Sub-strand IDs must be unique')
assert.deepEqual(units.map(unit => unit.id), ['1.1','1.2','1.3','1.4','2.1','2.2','2.3','2.4','2.5','3.1','3.2'])
assert.deepEqual(units.map(unit => unit.lessons), [20,25,25,20,10,10,12,8,8,6,6])
assert.equal(units.reduce((sum,unit) => sum + unit.lessons, 0), 150, 'Suggested lessons must total 150')
assert.deepEqual([1,2,3].map(strand => units.filter(unit => unit.strand === strand).length), [4,5,2])
assert.deepEqual(units.map(unit => unit.outcomes.length), [5,7,7,6,4,4,4,4,5,5,3], 'Keep the source-aligned outcome count for each sub-strand')
assert.equal(units.reduce((sum,unit) => sum + unit.outcomes.length, 0), 54)
for(const unit of units) {
  assert.ok(unit.outcomes.every(text => text.trim().length > 15), 'Each outcome needs authored text')
  assert.ok(unit.experiences.length >= 2, 'Each unit needs real learning experiences')
  assert.ok(unit.inquiry.length > 0 && unit.resources && unit.assessment && unit.competencies)
}
for (const token of [
  'View original KICD source', 'source-to-outcome certification is pending',
  'All 11 topics', 'Find a sub-strand or outcome', 'Next topic',
  'Suggested learning experiences', 'Learning resources', 'Assessment guidance',
  'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-1-3-Mathematics-Revised.pdf',
]) assert.ok(reader.includes(token), 'Missing read-only curriculum element: ' + token)

assert.ok(curriculum.includes('isGrade1Mathematics'), 'Curriculum route must resolve Grade 1 Mathematics')
assert.ok(curriculum.includes('<Grade1MathematicsMap key={selectedSubject} selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}') && curriculum.includes('mappedUnits={grade1ReaderCatalog}'), 'Curriculum must render the Mathematics map')
assert.ok(subject.includes('grade1MathematicsClass'), 'Subject Hub must verify an assigned Grade 1 class')
assert.ok(subject.includes('<Grade1MathematicsMap compact selectedUnitId={grade1MathematicsUnitId} onSelectUnit={setGrade1MathematicsUnitId} />'), 'Subject Hub must render the same map')
assert.ok(curriculum.includes('commit_curriculum_scheme'), 'Preserve the canonical Scheme engine')
assert.ok(curriculum.includes('curriculumOutcomes[row.id]'), 'Preserve canonical outcome records')
assert.ok(curriculum.includes('<Grade1CreativeActivitiesMap selectedUnitId='), 'Keep Creative Activities map')
assert.ok(subject.includes('<Grade1CreativeActivitiesMap compact'), 'Keep Creative Activities subject map')
assert.ok(!reader.includes('supabase.from('), 'Do not create duplicate canonical curriculum records')
console.log('Grade 1 Mathematics native curriculum reference and assigned-teacher routing: PASS')
