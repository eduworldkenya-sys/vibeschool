import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// CI uses Node versions where node:module.registerHooks is unavailable.
// Compile this small pure registry in memory; do not change app source.
const registrySource = readFileSync(new URL('../lib/assessment/exam-originals.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(registrySource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const { EXAM_ORIGINALS, parseExamOriginalKey } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
)

const expected = ['VibeCAT', 'VibeTry', 'VibeTerm', 'VibePapers', 'VibeMock']
assert.deepEqual(EXAM_ORIGINALS.map(series => series.name), expected, 'Five agreed brands must remain unique and ordered')
assert.equal(new Set(EXAM_ORIGINALS.map(series => series.key)).size, 5, 'No duplicate product identifiers')
assert.equal(new Set(EXAM_ORIGINALS.map(series => series.name)).size, 5, 'No duplicate product names')

for (const series of EXAM_ORIGINALS) {
  assert.ok(series.length && series.summary && series.tagline, series.name + ' needs a complete presentation')
  assert.equal(parseExamOriginalKey(series.key), series.key, 'Server product code must be recognised')
  assert.equal(parseExamOriginalKey(series.name), null, 'Brand title is not an authority token')
}
for (const value of [
  'Grade 4 Mathematics Pilot 01', 'Maths CAT 001', 'VibeCAT',
  'VibeCATapult practice', 'cat:spoofed', 'CAT', '', null, undefined, true,
]) {
  assert.equal(parseExamOriginalKey(value), null, 'Untrusted/noncanonical series code must be rejected')
}

const page = readFileSync(new URL('../app/student/vibelearn/exams/page.tsx', import.meta.url), 'utf8')
const discovery = readFileSync(new URL('../lib/assessment/discovery.ts', import.meta.url), 'utf8')
const css = readFileSync(new URL('../app/student/vibelearn/exams/exams.css', import.meta.url), 'utf8')
assert.match(page, /EXAM_ORIGINALS\.map\(series/, 'Render products from one shared registry')
assert.match(page, /aria-pressed=\{originalSeries === series\.key\}/, 'Selected series must be accessible')
assert.match(page, /item\.originalSeries === originalSeries/, 'Filter only by server classification')
assert.match(discovery, /parseExamOriginalKey\(item\.original_product_series\)/, 'Only canonical assignment discovery may provide product code')
assert.doesNotMatch(page, /examOriginalKeyFromTitle/, 'No marketing by title alone')
assert.match(page, /setOriginalSeries\('all'\)/, 'Existing exams must remain accessible')
assert.match(page, /No papers available yet/, 'No invented published exams')
assert.match(page, /start\(item\)/, 'Keep canonical start action')
assert.match(page, /viewResult\(item\.attemptId\)/, 'Keep canonical released result flow')
assert.match(css, /\.vs-originals-grid/, 'Responsive product grid is present')
assert.match(css, /@media\(max-width:640px\)/, 'Mobile layout is present')
assert.match(page, /parseExamOriginalKey\(searchParams\.get\('series'\)\)/, 'Catalogue selection is validated and URL-backed')
assert.match(page, /router\.push\(series === 'all' \? path :/, 'Brand tap navigates, not just toggles a filter')
assert.match(page, /!activeSeriesName && <section className="vs-originals"/, 'Hide brand grid inside a catalogue')
assert.match(page, /catalogueOngoing = groups\.ongoing\.filter\(belongsToSelectedSeries\)/, 'Resume only papers in the selected brand')
assert.match(page, /catalogueAwaiting = groups\.awaiting\.filter\(belongsToSelectedSeries\)/, 'Awaiting results stay in the selected brand')
assert.match(page, /catalogueCompleted = groups\.completed\.filter\(belongsToSelectedSeries\)/, 'Completed papers remain discoverable')
assert.match(page, /onClick=\{resetFilters\}/, 'Clear filters must not exit the selected brand')
assert.match(page, /!assessmentError && view === 'for-you'/, 'A discovery error is not an empty catalogue')
assert.match(page, /setGrade\('All grades'\)/, 'Grade selection resets on brand change')
assert.match(page, /catalogue\.map\(item => subjectFromTitle/, 'Subject filters are scoped to authorised catalogue')
assert.match(page, /ready\} new · \$\{ongoing\} ongoing · \$\{retakes\} retakes/, 'Separate counts without duplicating completed papers')
assert.match(page, /kind === 'new'\) openRetake/, 'New exams require an explicit start confirmation')
const runner = readFileSync(new URL('../app/student/assessment/[assignmentId]/page.tsx', import.meta.url), 'utf8')
assert.match(runner, /setLoadRetry\(n => n \+ 1\)/, 'Opening failure can be retried')
assert.match(runner, /window\.addEventListener\('online', onOnline\)/, 'Reconnect retries dirty answers')
assert.match(runner, /setLocalDraftUnavailable\(true\)/, 'Storage failure is handled without crashing')
assert.match(runner, /router\.push\(returnPath\)/, 'Returning from an exam preserves brand context')
console.log('Exam Originals catalogue contract passed')
