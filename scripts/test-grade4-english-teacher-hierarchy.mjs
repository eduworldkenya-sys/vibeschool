import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component = readFileSync(new URL('../components/teacher/curriculum/Grade4EnglishMap.tsx', import.meta.url),'utf8')
const page = readFileSync(new URL('../app/teacher/scheme/AuthoritySchemePage.jsx', import.meta.url),'utf8')
const reference = readFileSync(new URL('../lib/curriculum/grade4EnglishReference.ts', import.meta.url),'utf8')

for(const token of [
  'suggestedTermForTheme(theme.number) === selectedTerm',
  'showYear || !selectedTerm',
  'setSelectedTheme(null)',
  'aria-expanded={expanded}',
  'aria-controls={',
  'Theme-specific learning outcomes: not yet reconciled',
  'Selected-term weekly records:',
  'setShowYear(false)',
  'Week {selectedWeek} · Your teaching plan',
  'weekRows.map(row',
  'weekLessons.map(lesson',
  'View existing weekly curriculum',
  'Open my scheme of work',
  'Only canonical curriculum records may be used',
]) assert.ok(component.includes(token), 'Missing curriculum browser requirement: '+token)
assert.ok(page.includes('verifiedOutcomeCount={Object.values(curriculumOutcomes)'), 'Verified outcomes must be counted from loaded curriculum')
assert.ok(page.includes('selectedWeek={selectedWeek}'), 'Selected instructional week must reach the curriculum')
assert.ok(page.includes('weeklyRows={allCurriculumRows}'), 'Use stored weekly curriculum records')
assert.ok(page.includes('schemeLessons={schemeItems}'), 'Use teacher-owned scheme lessons')
assert.ok(page.includes('schemeCount={schemeItems.length}'), 'Scheme count must reflect the teacher records')
assert.ok(page.includes('<Grade4EnglishMap'), 'Teacher page must mount the new browser')
assert.ok(page.includes('showEnglishLegacy'), 'Existing records must remain accessible')
assert.ok(page.includes("display:isGrade4English&&!showEnglishLegacy?'none':undefined"), 'Legacy grid must hide by default')
assert.ok(page.includes('commit_curriculum_scheme'), 'Existing Scheme flow must be preserved')
assert.ok(reference.includes('GRADE4_ENGLISH_THEMES'), 'Source theme index must remain available')
assert.equal((reference.match(/"number": \d+/g)||[]).length,13, 'Expected 13 English themes')
assert.ok(reference.includes('https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.ENGLISH.LANGUAGE.pdf'), 'Must use first-party KICD 2024 source')
assert.deepEqual([...reference.matchAll(/"sourcePage": (\d+)/g)].map(match=>Number(match[1])),[1,8,15,22,30,37,44,50,56,62,69,75,81], 'Theme locators must match KICD 2024 contents')
console.log('Grade 4 English teacher hierarchy checks passed')
