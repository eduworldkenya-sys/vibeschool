import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const reader = readFileSync(new URL('../components/teacher/curriculum/Grade1EnglishMap.tsx', import.meta.url), 'utf8')
const scheme = readFileSync(new URL('../app/teacher/scheme/AuthoritySchemePage.jsx', import.meta.url), 'utf8')
const subject = readFileSync(new URL('../app/teacher/subjecthub/page.tsx', import.meta.url), 'utf8')

function extractJson(begin, end) {
  assert.ok(reader.includes(begin), 'Cannot find curriculum structure: ' + begin)
  return JSON.parse(reader.split(begin)[1].split(end)[0])
}
const themes = JSON.parse(reader.split('export const GRADE1_ENGLISH_THEMES = ')[1].split(' as const\n\n/** Reader index IDs')[0])
const units = extractJson('export const GRADE1_ENGLISH_UNITS: readonly CurriculumUnit[] = ', '\n\nconst card: CSSProperties')

assert.equal(themes.length, 15, 'Grade 1 English uses fifteen teaching themes')
assert.equal(new Set(themes.map(theme => theme.id)).size, 15)
assert.deepEqual(themes.map(theme => theme.id), Array.from({ length: 15 }, (_, i) => i + 1))
assert.equal(units.length, 13, 'English has thirteen recurring sub-strands')
assert.equal(new Set(units.map(unit => unit.id)).size, 13)
assert.deepEqual(units.map(unit => unit.id), ['1.1', '2.1', '2.2', '2.3', '2.4', '3.1', '3.2', '3.3', '4.1', '4.2', '4.3', '4.4', '4.5'])
assert.deepEqual(units.map(unit => unit.lessons), [60,6,4,12,8,22,6,2,4,6,6,4,10])
assert.equal(units.reduce((sum, unit) => sum + unit.lessons, 0), 150)
assert.deepEqual([1,2,3,4].map(strand => units.filter(unit => unit.strand === strand).length), [1,4,3,5])
assert.equal(units.reduce((sum, unit) => sum + unit.outcomes.length, 0), 58)
for (const unit of units) {
  assert.ok(unit.outcomes.length >= 3 && unit.outcomes.every(s => s.trim().length > 20))
  assert.ok(unit.experiences.length >= 2 && unit.inquiry.length >= 1)
  assert.ok(unit.resources && unit.assessment && unit.competencies)
}
for (const theme of themes) assert.ok(theme.title && theme.words && theme.context)

for (const token of [
  'View original KICD source', 'source-to-outcome certification is pending',
  'All 13 sub-strands', 'Find a sub-strand or outcome', 'Next topic',
  'Suggested learning experiences', 'Learning resources', 'Assessment guidance',
  'GRADE1_ENGLISH_THEMES.map', 'Teaching theme (15 KICD contexts)',
  'without explicit grammar labels',
  'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-1-3-English-Activities-Revised-Sept.pdf',
]) assert.ok(reader.includes(token), 'Missing English reader requirement: ' + token)
assert.ok(scheme.includes('isGrade1English') && scheme.includes('<Grade1EnglishMap />'))
assert.ok(subject.includes('grade1EnglishClass') && subject.includes('<Grade1EnglishMap compact />'))
assert.ok(scheme.includes('commit_curriculum_scheme') && scheme.includes('curriculumOutcomes[row.id]'), 'Canonical workflow must be preserved')
assert.ok(scheme.includes('<Grade1MathematicsMap />'), 'Preserve Mathematics map')
assert.ok(subject.includes('<Grade1MathematicsMap compact />'), 'Preserve Mathematics hub')
assert.ok(scheme.includes('<Grade1CreativeActivitiesMap'), 'Preserve Creative Activities map')
assert.ok(subject.includes('<Grade1CreativeActivitiesMap compact />'), 'Preserve Creative Activities hub')
assert.ok(scheme.includes('<Grade4EnglishMap'), 'Preserve Grade 4 English map')
assert.ok(!reader.includes('supabase.from('), 'Reader must not mutate canonical records')
console.log('Grade 1 English KICD source structure and teacher reader routing: PASS')
