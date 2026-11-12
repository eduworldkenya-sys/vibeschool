import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20261112214500_scheme_outcome_reconciliation_automation.sql', import.meta.url),
  'utf8',
)
const weekly = readFileSync(
  new URL('../components/teacher/scheme/WeeklyLessonSlots.tsx', import.meta.url),
  'utf8',
)

test('source-verified curriculum identity is exact, not a title or keyword guess', () => {
  assert.match(migration, /o\.curriculum_id\s*=\s*new\.curriculum_id/)
  assert.match(migration, /o\.sub_strand_id\s*=\s*v_sub_strand/)
  assert.match(migration, /o\.status='verified'/)
  assert.match(migration, /o\.verified_at is not null/)
  assert.match(migration, /source_locator/)
  assert.match(migration, /if v_count=1 then new\.curriculum_outcome_id:=v_candidate/)
  assert.doesNotMatch(migration, /similarity\(|levenshtein\(|ilike.*topic|ilike.*outcome_text/)
})

test('new teaching starts require a resolved outcome, but historical completion is preserved', () => {
  assert.match(migration, /new\.status in \('teaching','done'\)/)
  assert.match(migration, /old\.status is distinct from 'teaching'/)
  assert.match(migration, /SCHEME_OUTCOME_REQUIRED_BEFORE_TEACHING/)
  assert.match(migration, /SCHEME_TEACHING_LINEAGE_IMMUTABLE/)
  assert.match(migration, /new\.curriculum_outcome_id is null/)
  assert.match(migration, /from public\.scheme_lesson_outcomes slo/)
})

test('explicit outcome links must match the parent curriculum identities', () => {
  assert.match(migration, /SCHEME_LINK_SUBSTRAND_MISMATCH/)
  assert.match(migration, /SCHEME_LINK_CURRICULUM_MISMATCH/)
  assert.match(migration, /SCHEME_OUTCOME_SUBSTRAND_MISMATCH/)
  assert.match(migration, /SCHEME_OUTCOME_CURRICULUM_MISMATCH/)
  assert.match(migration, /s\.status='planned'/)
  assert.match(migration, /having count\(\*\)=1/)
})

test('the audit uses invoker RLS and is not an alternate approval system', () => {
  assert.match(migration, /with \(security_invoker=true\)/)
  assert.match(migration, /grant select on public\.scheme_outcome_reconciliation_status to authenticated/)
  assert.match(migration, /OUTCOME_MISSING/)
  assert.match(migration, /LINKED_SOURCE_VERIFICATION_PENDING/)
  assert.match(migration, /SOURCE_VERIFIED_LINKED/)
  assert.doesNotMatch(migration, /update public\.curriculum_learning_outcomes\s+set\s+status/)
})

test('teacher scheme view does not confuse a curriculum topic with a linked learning outcome', () => {
  assert.match(weekly, /Curriculum topic saved · learning outcome not linked/)
  assert.match(weekly, /item\.curriculum_outcome_id\?'Curriculum outcome selected'/)
  assert.doesNotMatch(weekly, /'Curriculum record linked'/)
})
