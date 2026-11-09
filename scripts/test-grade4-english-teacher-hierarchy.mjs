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
  'Existing weekly records:',
  'setShowYear(true)',
  'View existing weekly curriculum',
  'Open my scheme of work',
  'Only canonical curriculum records may be used',
]) assert.ok(component.includes(token), 'Missing curriculum browser requirement: '+token)
assert.ok(page.includes('verifiedOutcomeCount={Object.values(curriculumOutcomes)'), 'Verified outcomes must be counted from loaded curriculum')
assert.ok(page.includes('schemeCount={schemeItems.length}'), 'Scheme count must reflect the teacher records')
assert.ok(page.includes('<Grade4EnglishMap'), 'Teacher page must mount the new browser')
assert.ok(page.includes('showEnglishLegacy'), 'Existing records must remain accessible')
assert.ok(page.includes("display:isGrade4English&&!showEnglishLegacy?'none':undefined"), 'Legacy grid must hide by default')
assert.ok(page.includes('commit_curriculum_scheme'), 'Existing Scheme flow must be preserved')
assert.ok(reference.includes('GRADE4_ENGLISH_THEMES'), 'Source theme index must remain available')
assert.equal((reference.match(/"number": \d+/g)||[]).length,13, 'Expected 13 English themes')
console.log('Grade 4 English teacher hierarchy checks passed')
