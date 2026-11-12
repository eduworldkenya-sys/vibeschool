import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync('lib/timetable/schoolDaySamples.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText
const { SCHOOL_DAY_SAMPLES, isSampleBlock, sampleBlockErrors } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
assert.equal(SCHOOL_DAY_SAMPLES.length, 4)
assert.equal(new Set(SCHOOL_DAY_SAMPLES.map(s => s.id)).size, 4)

for (const sample of SCHOOL_DAY_SAMPLES) {
  assert.ok(sample.blocks.length > 0, sample.id + ' should contain actual editable blocks')
  assert.deepEqual(sampleBlockErrors(sample.blocks), [], sample.id + ' must not contain overlaps or invalid times')
  assert.ok(sample.blocks.every(b => isSampleBlock(b)))
  assert.ok(sample.blocks.every(b => b.kind === 'lesson' || b.protected), sample.id + ': breaks must stay protected')
}
const upper = SCHOOL_DAY_SAMPLES[0]
assert.equal(upper.blocks.filter(p => p.kind === 'lesson').length, 7)
assert.ok(upper.blocks.filter(p => p.kind === 'lesson').every(p => {
  const [a,b] = [p.start_time,p.end_time].map(t => Number(t.slice(0,2))*60+Number(t.slice(3)))
  return b-a === 35
}), 'Grades 4–6 sample uses 35-minute periods')
const lower = SCHOOL_DAY_SAMPLES[1]
assert.ok(lower.blocks.filter(p => p.kind === 'lesson').every(p => {
  const [a,b] = [p.start_time,p.end_time].map(t => Number(t.slice(0,2))*60+Number(t.slice(3)))
  return b-a === 30
}), 'Lower-primary illustrative durations are consistent')
const junior = SCHOOL_DAY_SAMPLES[2]
assert.equal(junior.blocks.filter(p=>p.kind==='lesson').length,9)
assert.ok(junior.blocks.filter(p => p.kind === 'lesson').every(p => {
  const [a,b] = [p.start_time,p.end_time].map(t => Number(t.slice(0,2))*60+Number(t.slice(3)))
  return b-a === 40
}))
const tuition = SCHOOL_DAY_SAMPLES[3]
assert.deepEqual([...new Set(tuition.blocks.map(p => p.schedule_day))], [2,4,6])
assert.ok(sampleBlockErrors([{ ...upper.blocks[0], start_time: '10:00', end_time: '09:00' }]).length > 0)
assert.ok(sampleBlockErrors([upper.blocks[1], {...upper.blocks[1], label:'duplicate'}]).some(s => s.includes('overlap')))
assert.deepEqual(sampleBlockErrors([{ ...upper.blocks[1], schedule_day: 1 }, { ...upper.blocks[1], schedule_day: 2 }]), [])
assert.ok(sampleBlockErrors([upper.blocks[1], {...upper.blocks[1], schedule_day: 1}]).some(s => s.includes('overlap')))
assert.equal(isSampleBlock({ ...upper.blocks[1], kind: 'break', protected: false }), false)
assert.equal(isSampleBlock({ ...upper.blocks[1], label: '', start_time: '' }), false)

const ui = fs.readFileSync('components/teacher/SchoolDaySampleBuilder.tsx', 'utf8')
const setup = fs.readFileSync('app/teacher/timetable/setup/page.tsx', 'utf8')
for (const pattern of [
  "periodCount === 0", "get_school_day_blocks_for_member", "can_manage_my_school_timetable",
  "save_school_period_block", "delete_school_period_block",
  "window.confirm(", "sampleBlockErrors(draft)", "localStorage.setItem",
  "Export template", "Import shared template",
]) assert.ok(ui.includes(pattern), 'missing safety/UX contract: ' + pattern)
assert.ok(setup.includes('SchoolDaySampleBuilder'), 'samples must be available from existing setup page')
const timetable = fs.readFileSync('app/teacher/timetable/page.tsx', 'utf8')
assert.ok(timetable.includes("import SchoolDaySampleBuilder"), 'starter must use existing template editor, not duplicate one')
assert.ok(timetable.includes('totalLessons === 0'), 'first-time teacher must discover the sample panel')
assert.ok(timetable.includes("activeSchoolId ?? 'independent'"), 'independent teacher must see personal draft samples without school membership')
assert.ok(timetable.includes('canManage={false}'), 'timetable preview cannot grant school admin rights')
assert.ok(timetable.includes('activeSchoolId !== null && !schoolError'), 'unlinked teacher cannot create school timetable slots')
assert.ok(ui.includes('SCHOOL_DAY_SAMPLES.map(sample => <button'), 'show samples as directly visible selectable cards')
assert.ok(ui.includes('setDraft(clone(sample.blocks))'), 'preview cards must open editable local drafts')
assert.ok(!ui.includes('onClick={() => void applyToSchool()} disabled={canApply}'), 'school publishing must stay guarded')
assert.ok(!setup.includes("useState('08:00')"), 'school day must not be auto-filled from a sample')
assert.ok(!ui.includes("setDraft(clone(SCHOOL_DAY_SAMPLES[0]")), 'samples may not auto-activate')
console.log('PASS: optional school-day samples, validation, protected blocks and guarded application')
