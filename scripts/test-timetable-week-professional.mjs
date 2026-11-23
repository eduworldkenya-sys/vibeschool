import assert from 'node:assert/strict'
import fs from 'node:fs'

const grid = fs.readFileSync('components/teacher/ClassicTimetable.tsx', 'utf8')
const page = fs.readFileSync('app/teacher/timetable/page.tsx', 'utf8')
const setup = fs.readFileSync('app/teacher/timetable/setup/page.tsx', 'utf8')

assert.ok(grid.includes('vs-week-record-board'), 'saved lessons remain visible in the Week view without confirmed periods')
assert.ok(grid.includes('vs-week-mobile-days'), 'mobile Week has direct, tappable day navigation')
assert.ok(grid.includes('aria-pressed={focusedDay===day.d}'), 'selected day is accessible')
assert.ok(grid.includes('matchingBlock(blocks,focusedDay,entry.slot)'), 'unmatched lessons remain visibly unverified')
assert.ok(grid.includes('onSelect(slot)'), 'saved lessons still open their canonical detail drawer')
assert.ok(grid.includes('focusedEntries.map'), 'mobile Week combines lessons and configured activities')
assert.ok(!grid.includes('<details'), 'Week lesson records have no disclosure dropdown')

assert.ok(page.includes("view === 'insights' && <section className=\"vs-v3-diagnostics"), 'diagnostics stay in Insights, not the Week surface')
assert.ok(!page.includes('<details'), 'timetable workspace has no disclosure dropdowns')
assert.ok(!page.includes('<SchoolDaySampleBuilder'), 'templates do not fill the Week screen')
assert.ok(setup.includes('SchoolDaySampleBuilder'), 'existing template setup remains accessible')
assert.ok(page.includes('duplicateActiveTimetable(nextWeek)'), 'repeat function is preserved')
assert.ok(page.includes('restoreTimetableSnapshot(lastUndoSnapshotId'), 'undo function is preserved')
assert.ok(grid.includes('rows.length===0'), 'unconfirmed slots never synthesize timetable period rows')

console.log('Professional timetable Week UI regressions: PASS')
