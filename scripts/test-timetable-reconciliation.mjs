import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import childProcess from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

const read = path => fs.readFileSync(path, 'utf8')

const migrations = fs.readdirSync(
  'supabase/migrations',
)

function migration(suffix) {
  const matches = migrations.filter(name =>
    name.endsWith(suffix)
  )

  assert.equal(
    matches.length,
    1,
    `Expected one migration ending with ${suffix}`,
  )

  return read(`supabase/migrations/${matches[0]}`)
}

const grades = migration(
  '_timetable_canonical_grades_and_allocations.sql',
)

const periods = migration(
  '_timetable_school_period_authority.sql',
)

const binding = migration(
  '_timetable_dated_scheme_binding.sql',
)

const source = read('lib/teaching/lessonSource.ts')
const workspace = read('lib/teaching/lessonWorkspace.ts')
const modal = read('components/teacher/AddSlotModal.tsx')
const timetable = read('app/teacher/timetable/page.tsx')
const schoolSetup = read('app/teacher/timetable/setup/page.tsx')

test('class grades have canonical identities', () => {
  assert.match(grades, /grade_code/)
  assert.match(grades, /Grade 7/)
  assert.match(grades, /Grade 8/)
  assert.match(grades, /Grade 9/)
})

test('junior school has verified allocation coverage', () => {
  assert.match(grades, /junior_school/)
  assert.match(grades, /v_total <> 40/)
  assert.match(grades, /lesson_minutes/)
  assert.match(grades, /global_subject_id/)
})

test('period validation uses real school periods', () => {
  assert.match(periods, /school_periods/)
  assert.match(periods, /GRADE_IDENTITY_REQUIRED/)
  assert.match(periods, /SCHOOL_PERIOD_REQUIRED/)
  assert.match(periods, /LESSON_DURATION_MISMATCH/)
})

test('the modal writes a real period ID', () => {
  assert.match(
    modal,
    /p_period_id:\s*selectedBlock\?\.\[0\]\?\.id/,
  )

  assert.doesNotMatch(
    modal,
    /upperPrimaryPeriods\(/,
  )
})

test('dated teaching uses saved Scheme identity', () => {
  assert.match(source, /plan\?\.scheme_id/)
  assert.match(source, /loadCheckedScheme/)
  assert.doesNotMatch(
    source,
    /loadSchemeSourceForOccurrenceFallback/,
  )
})

test('suggestions are not confirmed Scheme links', () => {
  assert.match(workspace, /existingPlan\.scheme_id/)
  assert.match(workspace, /sourceLinked/)
})

test('binding checks the instructional week', () => {
  assert.match(
    binding,
    /resolve_instructional_week_for_date/,
  )

  assert.match(
    binding,
    /scheme_occurrence_week_mismatch/,
  )

  assert.match(
    binding,
    /occurrence_outcome_immutable/,
  )
})

test('teacher timetable checks outcome readiness', () => {
  assert.match(
    timetable,
    /plan\.curriculum_outcome_id/,
  )

  assert.match(
    timetable,
    /grade_code/,
  )
})


test('planned timetable and unscheduled teaching deltas are explicit, exact and never production parity', () => {
  const baseline = JSON.parse(read('supabase/reconciliation/tbl012_production_core_schema_hashes.json'))
  const planned = JSON.parse(read('supabase/reconciliation/tbl012_pending_forward_deltas.json'))
  assert.equal(planned.deltas.length, 4)
  const keys = planned.deltas.map(delta => delta.table + '.' + delta.section)
  assert.deepEqual(keys, [
    'timetable_slots.triggers',
    'teaching_occurrences.columns',
    'teaching_occurrences.constraints',
    'teaching_occurrences.indexes',
  ])
  for (const delta of planned.deltas) {
    assert.equal(delta.production_hash, baseline.tables[delta.table][delta.section+'_hash'])
    assert.match(delta.rebuilt_hash, /^[a-f0-9]{32}$/)
    assert.notEqual(delta.production_hash, delta.rebuilt_hash)
    assert.ok(delta.rationale.length > 35)
  }
  assert.equal(planned.deltas[0].migration, '20261112101600_timetable_school_period_authority.sql')
  const unscheduled = read('supabase/migrations/20261112104242_unscheduled_teaching_occurrence.sql')
  assert.match(unscheduled, /teaching_occurrences_one_source_check/)
  assert.match(unscheduled, /teaching_occurrences_unscheduled_plan_key/)
  assert.match(unscheduled, /start_unscheduled_teaching/)
  assert.match(unscheduled, /complete_unscheduled_teaching/)
  assert.match(periods, /effective_from, effective_until/)
  assert.match(read('scripts/tbl012-compare-schema-hashes.py'), /release_requires_forward_migration/)
})

test('TBL-012 rejects an observed production fingerprint that differs from the recorded baseline', () => {
  const { spawnSync } = requireNodeChildProcess()
  const { dir, baseline, observed } = makeBaselineFixtures()
  try {
    observed.tables.teacher_classes.indexes_hash = '0'.repeat(32)
    fs.writeFileSync(`${dir}/live.json`, JSON.stringify(observed))
    const proc = spawnSync('python3', [
      'scripts/tbl012-compare-schema-hashes.py',
      '--rebuilt', `${dir}/rebuilt.json`,
      '--target', `${dir}/target.json`,
      '--live-observation', `${dir}/live.json`,
      '--report', `${dir}/report.json`,
    ], { encoding: 'utf8' })
    assert.equal(proc.status, 1, proc.stderr)
    assert.match(proc.stderr, /LIVE PRODUCTION REFERENCE MISMATCH/)
    const report = JSON.parse(fs.readFileSync(`${dir}/report.json`, 'utf8'))
    assert.equal(report.passed, false)
    assert.equal(report.error, 'STALE_PRODUCTION_REFERENCE')
    assert.ok(report.baseline_differences.some(x =>
      x.table === 'teacher_classes' && x.section === 'indexes'))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('TBL-012 permits only the exact declared forward trigger and never calls it deployed', () => {
  const { spawnSync } = requireNodeChildProcess()
  const { dir, baseline, observed } = makeBaselineFixtures()
  try {
    const planned = JSON.parse(read('supabase/reconciliation/tbl012_pending_forward_deltas.json'))
    const rebuilt = structuredClone(baseline)
    rebuilt.tables.timetable_slots.triggers_hash = planned.deltas[0].rebuilt_hash
    fs.writeFileSync(`${dir}/rebuilt.json`, JSON.stringify(rebuilt))
    const proc = spawnSync('python3', [
      'scripts/tbl012-compare-schema-hashes.py',
      '--rebuilt', `${dir}/rebuilt.json`,
      '--target', `${dir}/target.json`,
      '--live-observation', `${dir}/live.json`,
      '--forward-deltas', 'supabase/reconciliation/tbl012_pending_forward_deltas.json',
      '--report', `${dir}/report.json`,
    ], { encoding: 'utf8' })
    assert.equal(proc.status, 0, proc.stderr)
    const report = JSON.parse(fs.readFileSync(`${dir}/report.json`, 'utf8'))
    assert.equal(report.production_reference_verified, true)
    assert.equal(report.production_parity, false)
    assert.equal(report.release_requires_forward_migration, true)
    assert.equal(report.unexplained_differences, 0)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function requireNodeChildProcess() {
  return { spawnSync: childProcess.spawnSync }
}

function makeBaselineFixtures() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tbl012-'))
  const baseline = JSON.parse(read('supabase/reconciliation/tbl012_production_core_schema_hashes.json'))
  const observed = structuredClone(baseline)
  fs.writeFileSync(`${dir}/target.json`, JSON.stringify(baseline))
  fs.writeFileSync(`${dir}/rebuilt.json`, JSON.stringify(baseline))
  fs.writeFileSync(`${dir}/live.json`, JSON.stringify(observed))
  return { dir, baseline, observed }
}

test('school day setup does not present invented times as verified school periods', () => {
  assert.match(schoolSetup, /const \[startTime, setStartTime\] = useState\(''\)/)
  assert.match(schoolSetup, /const \[endTime, setEndTime\] = useState\(''\)/)
  assert.match(schoolSetup, /school-confirmed start and end times/)
  assert.match(schoolSetup, /Existing test and historical timetable slots are preserved/)
  assert.doesNotMatch(schoolSetup, /setStartTime\('08:00'\)/)
  assert.doesNotMatch(schoolSetup, /setEndTime\('08:40'\)/)
  assert.match(modal, /Open school day setup/)
  assert.match(modal, /Existing test slots cannot establish these times/)
})

test('weekly allocation failures are visible and can be retried', () => {
  assert.match(timetable, /setWeeklyLoadError\('Weekly subject allocation could not be verified/)
  assert.match(timetable, /weeklyLoadRetry/)
  assert.match(timetable, /role="alert" className="no-print"/)
  assert.match(timetable, /Weekly allocation not verified/)
  assert.match(timetable, /Retry check/)
  assert.match(timetable, /setWeeklyLoadRows\(\[\]\)/)
})

test('upper-primary invalid legacy lessons are visible but not certified', () => {
  assert.match(timetable, /slot\.dayOfWeek < 1 \|\| slot\.dayOfWeek > 5/)
  assert.match(timetable, /timeToMin\(slot\.endTime\) - timeToMin\(slot\.startTime\) !== 35/)
  assert.match(timetable, /period\.id === slot\.periodId/)
  assert.match(timetable, /period\.kind === 'lesson'/)
  assert.match(timetable, /weekly allocation totals/i)
  assert.match(timetable, /Configure school periods/)
  assert.match(timetable, /historical continuity/)
})
