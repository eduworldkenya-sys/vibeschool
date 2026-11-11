import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const scheme = readFileSync(new URL('../app/teacher/scheme/AuthoritySchemePage.jsx', import.meta.url), 'utf8')
const hub = readFileSync(new URL('../app/teacher/subjecthub/page.tsx', import.meta.url), 'utf8')
const math = readFileSync(new URL('../components/teacher/curriculum/Grade1MathematicsMap.tsx', import.meta.url), 'utf8')
const english = readFileSync(new URL('../components/teacher/curriculum/Grade1EnglishMap.tsx', import.meta.url), 'utf8')

function readUnits(reader, marker) {
  const start = 'export const ' + marker + '_UNITS: readonly CurriculumUnit[] = '
  const json = reader.split(start)[1]?.split('\n\nconst card: CSSProperties')[0]
  assert.ok(json, 'Native Curriculum Map units must remain present: ' + marker)
  return JSON.parse(json)
}
const mathUnits = readUnits(math,'GRADE1_MATHEMATICS')
const englishUnits = readUnits(english,'GRADE1_ENGLISH')
assert.equal(mathUnits.length,11)
assert.equal(englishUnits.length,13)
assert.equal(mathUnits.reduce((sum,unit)=>sum+unit.lessons,0),150)
assert.equal(englishUnits.reduce((sum,unit)=>sum+unit.lessons,0),150)
assert.equal(mathUnits.reduce((sum,unit)=>sum+unit.outcomes.length,0),54)
assert.equal(englishUnits.reduce((sum,unit)=>sum+unit.outcomes.length,0),58)

for (const [name, reader] of [['Mathematics',math],['English',english]]) {
  assert.ok(reader.includes('VIBESCHOOL CURRICULUM MAP · GRADE 1'),name+' must be the primary Curriculum Map reader')
  assert.ok(reader.includes('curriculum strands'),name+' strand buttons are required')
  assert.ok(reader.includes('aria-pressed={active}'),name+' strand must be visibly selected')
  assert.ok(reader.includes('onClick={() => choose(units[0].id)}'),name+' strand selection must navigate to its first unit')
  assert.ok(reader.includes('onSelectUnit?.(id)'),name+' selected unit must notify Curriculum Map')
  assert.ok(reader.includes('selectedUnitId'),name+' must restore a deep-linked unit')
  assert.ok(reader.includes('setSelectedId(validUnitId)'),name+' must react to deep link changes')
  assert.ok(reader.includes('source-to-outcome certification is pending'),name+' must not be labelled KICD verified')
  assert.ok(!reader.includes('supabase.from('),name+' reference reader must never mutate canonical data')
}
assert.ok(scheme.includes('isGrade1Mathematics')&&scheme.includes('isGrade1English'))
assert.ok(scheme.includes('<Grade1MathematicsMap key={selectedSubject} selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}'))
assert.ok(scheme.includes('<Grade1EnglishMap key={selectedSubject} selectedUnitId={mapUnitId} selectedThemeId={Number(initial.current.themeId)||1} onSelectUnit={setMapUnitId}'))
assert.ok(scheme.includes("if(curriculumView&&(isGrade1Mathematics||isGrade1English))p.set('unitId',mapUnitId)"),
  'Selected sub-strand must survive URL changes, refresh and sharing')
assert.ok(scheme.includes("unitId:searchParams.get('unitId')"), 'Direct sub-strand links must be restored')
assert.ok(scheme.includes("display:isGrade1Creative||((isGrade1Mathematics||isGrade1English)&&!allCurriculumRows.length)"),
  'Only the empty legacy annual grid should be hidden; never hide existing canonical rows')
assert.ok(scheme.includes("curriculumOutcomes[row.id]"),'Preserve verified canonical outcome rendering')
assert.ok(scheme.includes("commit_curriculum_scheme"),'Preserve canonical scheme authority')
assert.ok(scheme.includes("<Grade1CreativeActivitiesMap selectedUnitId="),'Preserve Grade 1 Creative Activities')
assert.ok(scheme.includes('<Grade4EnglishMap'),'Preserve Grade 4 English')
assert.ok(hub.includes('grade1MathematicsUnitId')&&hub.includes('grade1EnglishUnitId'),
  'Subject Hub must preserve separate selected unit identities')
assert.ok(hub.includes("'&unitId=' + encodeURIComponent(grade1MathematicsUnitId)") &&
  hub.includes("'&unitId=' + encodeURIComponent(grade1EnglishUnitId)"),
  'Opening full Curriculum Map must preserve the currently selected reader unit')
assert.ok(hub.includes('<Grade1MathematicsMap compact selectedUnitId={grade1MathematicsUnitId} onSelectUnit={setGrade1MathematicsUnitId} />'))
assert.ok(hub.includes('<Grade1EnglishMap compact selectedUnitId={grade1EnglishUnitId} onSelectUnit={setGrade1EnglishUnitId} />'))
assert.ok(scheme.includes('get_operating_context')||scheme.includes('teacher_get_operating_context'),'Preserve assigned teacher scoping')
console.log('Grade 1 Mathematics and English unified Curriculum Map and deep links: PASS')
