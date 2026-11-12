import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20261112191500_grade4_place_value_revealed_examples_nonassessable.sql')
const preflight = read('scripts/sql/grade4_place_value_reconciliation_preflight.sql')

// These are integrity tests of the tracked artifact. Real DB checks/negative
// fixtures and exact-head CI remain separate mandatory evidence before release.
const ids = [
  '02b9a7e6-87ac-4471-a5ce-549997be9781',
  '2cae20c4-7908-4a56-8134-a3521f1852c1',
]
function validateGuardedMigration(sql) {
  const guards = [
    'v_valid <> 2', 'v_true = 2', 'v_true = 0',
    "b.block_type = 'activity'", "b.status = 'draft'",
    "c.status = 'draft'", "p.status = 'draft'",
    "b.plain_text = $example1$", "b.plain_text = $example2$",
    "from public.assessment_items", "from public.generated_assessment_items",
    "source_block_id in (", "set is_assessable = false",
    "if v_true = 2 then", "elsif v_true = 0 then",
    "raise exception 'Grade 4 Place Value repair blocked:",
    "repair postcondition failed", "set local lock_timeout",
    'for update', 'where id in (',
  ]
  for (const guard of guards)
    assert.ok(sql.includes(guard), 'Missing fail-closed guard: ' + guard)
  for (const id of ids)
    assert.ok(sql.includes(id), 'Missing exact ID: ' + id)
  assert.equal((sql.match(/update\s+public\.content_blocks\s+set/gi) || []).length, 1,
    'Exactly one scoped eligibility update')
  assert.doesNotMatch(sql, /\b(?:delete|truncate|drop|alter)\s+(?:table\s+)?public\./i)
  assert.doesNotMatch(sql, /\bupdate\s+public\.(?:curriculum_learning_outcomes|scheme_of_work|learning_resources|assessment_items|generated_assessment_items)\b/i)
  assert.doesNotMatch(sql, /\b(?:commit|rollback)\s*;/i,
    'Migration lifecycle belongs to canonical migration runner')
}

validateGuardedMigration(migration)
// Negative controls: the checker must notice missing identity/safety gates.
for (const forbiddenRemoval of [
  "v_valid <> 2",
  "b.plain_text = $example1$",
  "c.status = 'draft'",
  "from public.generated_assessment_items",
  "if v_true = 2 then",
  "source_block_id in (",
]) {
  assert.throws(() => validateGuardedMigration(
    migration.replace(forbiddenRemoval, 'REMOVED_GUARD')
  ), /Missing fail-closed guard/)
}
assert.match(preflight, /BLOCKED_CURRICULUM_RECONCILIATION/)
assert.match(preflight, /REQUIRES_AUTHORIZED_PACKAGE_GATE_AND_EXACT_READBACK/)
assert.match(preflight, /approved_official_sources/)
assert.match(preflight, /promoted_official_snapshots/)
assert.match(preflight, /verified_official_outcomes/)
assert.match(preflight, /explicit_manuscript_aliases/)
assert.match(preflight, /scheme_rows_without_exact_outcome/)
assert.doesNotMatch(preflight, /\b(update|delete|insert|drop|alter|truncate)\s+public\./i)
console.log('Grade 4 Place Value: scoped draft repair and fail-closed source preflight PASS')
