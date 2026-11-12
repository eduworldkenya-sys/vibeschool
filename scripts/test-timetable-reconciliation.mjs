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

test('KICD Grades 1–9 baseline contains exactly the verified learning-area matrix', () => {
  const sourceMatrix = grades.split('with learning_areas(band, subject_label, kicd_learning_area, units) as (')[1]
  assert.ok(sourceMatrix, 'Official KICD source matrix missing')
  const rows = sourceMatrix.split('grades(grade, band, source_ref')[0]
  const matches = [...rows.matchAll(/\\('(lower_primary|upper_primary|junior_school)', '([^']+)', '([^']+)', (\\d+)\\)/g)]
  const expected = {
    lower_primary: { count: 7, lessons: 30 },
    upper_primary: { count: 8, lessons: 34 },
    junior_school: { count: 9, lessons: 40 },
  }
  for (const [band, { count, lessons }] of Object.entries(expected)) {
    const items = matches.filter(row => row[1] === band)
    assert.equal(items.length, count, band + ' area count')
    assert.equal(items.reduce((sum, row) => sum + Number(row[4]), 0), lessons, band + ' weekly lessons')
    assert.equal(new Set(items.map(row => row[2])).size, count, band + ' unique canonical subjects')
  }
  assert.equal(matches.length, 24, '7 lower + 8 upper + 9 junior learning areas')

  // The exact source text and stable VibeSchool identity are both retained.
  assert.match(rows, /'Mathematics', 'Mathematical Activities', 5/)
  assert.match(rows, /'Agriculture and Nutrition', 'Agriculture', 4/)
  assert.match(rows, /'Creative Arts and Sports', 'Creative Arts', 6/)
  assert.match(grades, /Grade-1-3-English-Activities-Revised-Sept\\.pdf/)
  assert.match(grades, /AGRICULTURE-Grade-6-30\\.07\\.2024\\.pdf/)
  assert.match(grades, /Agriculture-Grade-9-Formatted-April-2024\\.pdf/)
  assert.match(grades, /KICD_ALLOCATION_MISMATCH/)
  assert.match(grades, /v_expected_count/)
  assert.match(grades, /v_expected_lessons/)
  assert.match(grades, /global_subject_id/)
  assert.match(grades, /kicd_learning_area/)
})

test('PPI is exactly one separate programme period, never an assessed subject', () => {
  assert.match(grades, /1::integer as ppi_periods/)
  assert.match(grades, /\\(sum\\(swa\\.lessons_per_week\\) \\+ 1\\)::integer as total_periods/)
  assert.match(grades, /security_invoker = true/)
  assert.doesNotMatch(
    grades.split('with learning_areas(band, subject_label, kicd_learning_area, units) as (')[1]
      .split('grades(grade, band, source_ref')[0],
    /\\('(?:lower_primary|upper_primary|junior_school)', 'Pastoral/,
  )
  assert.match(grades, /Kenyan Sign Language/)
  assert.match(grades, /Christian Religious Education/)
  assert.match(grades, /CONFLICTING_KICD_ALTERNATIVE/)
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


test('only the timetable period guard is a pending forward delta; live unscheduled teaching is already applied', () => {
  const baseline = JSON.parse(read('supabase/reconciliation/tbl012_production_core_schema_hashes.json'))
  const planned = JSON.parse(read('supabase/reconciliation/tbl012_pending_forward_deltas.json'))
  assert.equal(planned.deltas.length, 1)
  const keys = planned.deltas.map(delta => delta.table + '.' + delta.section)
  assert.deepEqual(keys, [
    'timetable_slots.triggers',
  ])
  // The actual production ledger stored this unchanged SQL under 20261112104242.
  // Live catalogue hashes were measured using scripts/sql/tbl012_core_schema_hashes.sql
  // and matched the clean rebuild for all three unscheduled structural sections.
  assert.equal(baseline.tables.teaching_occurrences.columns_hash, 'b6267cbed72bb9835de6d402a11c305b')
  assert.equal(baseline.tables.teaching_occurrences.constraints_hash, 'f2402925362f1d18e908fe7decabd3c1')
  assert.equal(baseline.tables.teaching_occurrences.indexes_hash, 'cab1e33e79b43929983e8e49d54f02c0')
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
