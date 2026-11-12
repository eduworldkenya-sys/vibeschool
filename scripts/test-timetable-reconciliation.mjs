import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read = path => fs.readFileSync(path, 'utf8')
const migrations = fs.readdirSync('supabase/migrations')
function migration(suffix) {
  const matches = migrations.filter(name => name.endsWith(suffix))
  assert.equal(matches.length, 1, `Expected one migration ending with ${suffix}`)
  return read(`supabase/migrations/${matches[0]}`)
}
const grades = migration('_timetable_canonical_grades_and_allocations.sql')
const periods = migration('_timetable_school_period_authority.sql')
const binding = migration('_timetable_dated_scheme_binding.sql')
const source = read('lib/teaching/lessonSource.ts')
const workspace = read('lib/teaching/lessonWorkspace.ts')
const modal = read('components/teacher/AddSlotModal.tsx')
const timetable = read('app/teacher/timetable/page.tsx')

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

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


test('the planned period-guard delta is explicit, exact and not mislabeled production parity', () => {
  const baseline = JSON.parse(read('supabase/reconciliation/tbl012_production_core_schema_hashes.json'))
  const planned = JSON.parse(read('supabase/reconciliation/tbl012_pending_forward_deltas.json'))
  assert.equal(planned.deltas.length, 1)
  const delta = planned.deltas[0]
  assert.equal(delta.table, 'timetable_slots')
  assert.equal(delta.section, 'triggers')
  assert.equal(delta.production_hash, baseline.tables.timetable_slots.triggers_hash)
  assert.match(delta.rebuilt_hash, /^[a-f0-9]{32}$/)
  assert.notEqual(delta.production_hash, delta.rebuilt_hash)
  assert.match(periods, /effective_from, effective_until/)
  assert.match(read('scripts/tbl012-compare-schema-hashes.py'), /release_requires_forward_migration/)
})
