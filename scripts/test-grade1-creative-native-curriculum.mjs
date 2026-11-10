import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const reader = readFileSync(new URL('../components/teacher/curriculum/Grade1CreativeActivitiesMap.tsx', import.meta.url), 'utf8')
const mapPage = readFileSync(new URL('../app/teacher/scheme/AuthoritySchemePage.jsx', import.meta.url), 'utf8')
const subjectHub = readFileSync(new URL('../app/teacher/subjecthub/page.tsx', import.meta.url), 'utf8')

const entries = [...reader.matchAll(/id: '(\d\.\d)', title: '([^']+)', strand: ([123]), lessons: (\d+)/g)]
assert.equal(entries.length, 16, 'The native curriculum must contain all 16 Grade 1 Creative Activities sub-strands')
assert.equal(new Set(entries.map(match => match[1])).size, 16, 'Every sub-strand ID must be unique')
assert.equal(entries.reduce((sum, match) => sum + Number(match[4]), 0), 210, 'Annual lesson allocation must remain 210')
assert.deepEqual([1, 2, 3].map(strand => entries.filter(match => Number(match[3]) === strand).length), [7, 7, 2])

const outcomeLists = reader.split(/\s*outcomes: \[/).slice(1).map(section => section.split('],')[0])
assert.equal(outcomeLists.length, 16, 'Every sub-strand must have outcome descriptions')
const outcomeCount = outcomeLists.reduce((sum, outcomes) => sum + (outcomes.match(/'[^']*'/g) ?? []).length, 0)
assert.equal(outcomeCount, 68, 'Expected 68 authored outcome descriptions')
for (const token of [
  'Specific learning outcomes', 'Suggested learning experiences', 'Key inquiry questions',
  'Assessment guidance', 'Learning resources', 'Safety and inclusion',
  'View original KICD source', 'source-to-outcome certification is pending',
  'All 16 topics', 'Next topic', 'Find a sub-strand or outcome',
]) assert.ok(reader.includes(token), 'Missing native reader content: ' + token)

assert.ok(mapPage.includes('isGrade1Creative'), 'Curriculum must resolve assigned Grade 1 Creative Activities')
assert.ok(mapPage.includes('<Grade1CreativeActivitiesMap />'), 'Canonical teacher curriculum route must show native reader')
assert.ok(mapPage.includes("commit_curriculum_scheme"), 'Do not replace the existing canonical scheme engine')
assert.ok(mapPage.includes('curriculumOutcomes[row.id]'), 'Existing canonical outcome records must remain available')
assert.ok(mapPage.includes("display:isGrade4English&&!showEnglishLegacy?'none':undefined"), 'Preserve Grade 4 English map regression contract')

assert.ok(subjectHub.includes('grade1CreativeClass'), 'SubjectHub must scope the reader to an assigned Grade 1 class')
assert.ok(mapPage.includes('creative arts and sports'), 'Existing Grade 1 subject label must resolve to the VibeSchool curriculum reader')
assert.ok(subjectHub.includes('creative arts and sports'), 'Mumbi2 Grade 1 Bluezzz existing subject label must open the curriculum')
assert.ok(subjectHub.includes('<Grade1CreativeActivitiesMap compact />'), 'Subject page must show the native curriculum inline')
assert.ok(subjectHub.includes("'/teacher/curriculum?classId='"), 'Full curriculum link must pass the assigned class identity')
assert.ok(subjectHub.includes("'&subjectId='"), 'Full curriculum link must pass the actual subject identity')
assert.ok(!reader.includes("supabase.from("), 'Annual reference reader must not insert duplicate canonical records')
console.log('Grade 1 Creative Activities native curriculum and teacher subject mapping: PASS')
