import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EXAM_ORIGINALS, examOriginalKeyFromTitle } from '../lib/assessment/exam-originals.ts'

const expected = ['VibeCAT', 'VibeTry', 'VibeTerm', 'VibePapers', 'VibeMock']
assert.deepEqual(EXAM_ORIGINALS.map(series => series.name), expected, 'Five agreed brands must remain unique and ordered')
assert.equal(new Set(EXAM_ORIGINALS.map(series => series.key)).size, 5, 'No duplicate product identifiers')
assert.equal(new Set(EXAM_ORIGINALS.map(series => series.name)).size, 5, 'No duplicate product names')

for (const series of EXAM_ORIGINALS) {
  assert.ok(series.length && series.summary && series.tagline, series.name + ' needs a complete presentation')
  assert.equal(examOriginalKeyFromTitle(series.name + ' — Grade 4 Mathematics Paper 001'), series.key)
  assert.equal(examOriginalKeyFromTitle('  ' + series.name.toLowerCase() + ': Revision Test  '), series.key)
}
for (const legacy of [
  'Grade 4 Mathematics Pilot 01',
  'Maths CAT 001',
  'KNEC Grade 9 Mock',
  'VibeCATapult practice',
  'Practice',
  '',
]) {
  assert.equal(examOriginalKeyFromTitle(legacy), null, 'Legacy/unverified title must not inherit Originals identity: ' + legacy)
}

const page = readFileSync(new URL('../app/student/vibelearn/exams/page.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../app/student/vibelearn/exams/exams.css', import.meta.url), 'utf8')
assert.match(page, /EXAM_ORIGINALS\.map\(series/, 'Render products from one shared registry')
assert.match(page, /aria-pressed=\{originalSeries === series\.key\}/, 'Selected series must be accessible')
assert.match(page, /examOriginalKeyFromTitle\(item\.title\) === originalSeries/, 'Filter by genuine approved title')
assert.match(page, /setOriginalSeries\('all'\)/, 'Existing exams must remain accessible')
assert.match(page, /No papers available yet/, 'No invented published exams')
assert.match(page, /start\(item\)/, 'Keep canonical start action')
assert.match(page, /viewResult\(item\.attemptId\)/, 'Keep canonical released result flow')
assert.match(css, /\.vs-originals-grid/, 'Responsive product grid is present')
assert.match(css, /@media\(max-width:640px\)/, 'Mobile layout is present')
console.log('Exam Originals catalogue contract passed')
