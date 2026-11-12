import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Repository contract tests do NOT replace the database gate or assert KICD endorsement.
const load = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const manuscript = JSON.parse(load('../content/curriculum/grade4/mathematics/time.v1.json'))
const migration = load('../supabase/migrations/20261112103000_p0_curriculum_identity_grade4_time.sql')

function audit(m) {
  const blockers = []
  const aliases = m.canonical?.manuscript_alias_to_stable_outcome_ids || {}
  const declared = new Set(m.outcomes.map(o => o.id))
  const mappedIds = new Set()
  if (declared.size !== 7) blockers.push('missing_or_duplicate_source_requirement')
  for (const outcome of m.outcomes) {
    if (!/^[a-g]$/.test(outcome.kicd || '')) blockers.push('invalid_requirement_code')
    if (!outcome.source_locator?.includes('2.6 Time;')) blockers.push('missing_source_locator')
    if (!Array.isArray(aliases[outcome.id]) || !aliases[outcome.id].length) {
      blockers.push('alias_unresolved')
      continue
    }
    if (JSON.stringify(outcome.stable_outcome_ids) !== JSON.stringify(aliases[outcome.id])) {
      blockers.push('alias_identity_disagreement')
    }
    for (const id of aliases[outcome.id]) {
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(id)) blockers.push('invalid_database_uuid')
      if (mappedIds.has(id)) blockers.push('database_outcome_reused_for_two_requirements')
      mappedIds.add(id)
    }
  }
  if (Object.keys(aliases).length !== declared.size) blockers.push('extra_alias')
  if (m.lessons.length !== 10) blockers.push('incomplete_content_units')
  for (const lesson of m.lessons) {
    const matched = lesson.outcomes.flatMap(alias => aliases[alias] || [])
    if (lesson.outcomes.some(alias => !declared.has(alias))) blockers.push('unknown_lesson_alias')
    if (JSON.stringify(lesson.canonical_outcome_ids) !== JSON.stringify([...new Set(matched)])) {
      blockers.push('lesson_identity_disagreement')
    }
  }
  for (const alias of declared) {
    if (!m.lessons.some(l => l.outcomes.includes(alias))) blockers.push('untaught_source_requirement')
  }
  return [...new Set(blockers)]
}

assert.deepEqual(audit(manuscript), [])
assert.equal(manuscript.canonical.sub_strand_id, 'e975dcc6-32a9-4274-a2a3-3d19e409cf5c')
assert.equal(manuscript.source.section, 'Measurement 2.6 Time, printed pages 32–33')
assert.equal(new Set(manuscript.outcomes.flatMap(o => o.stable_outcome_ids)).size, 9)

const damaged = mutate => {
  const copy = structuredClone(manuscript)
  mutate(copy)
  return audit(copy)
}
assert.ok(damaged(m => { m.outcomes[0].source_locator = null }).includes('missing_source_locator'))
assert.ok(damaged(m => { m.outcomes[0].stable_outcome_ids = [] }).includes('alias_identity_disagreement'))
assert.ok(damaged(m => { m.lessons[0].outcomes = ['unknown'] }).includes('unknown_lesson_alias'))
assert.ok(damaged(m => { m.canonical.manuscript_alias_to_stable_outcome_ids['VS-G04-MA-T-F'] = [] }).includes('alias_unresolved'))
assert.ok(damaged(m => { m.lessons[0].canonical_outcome_ids = [] }).includes('lesson_identity_disagreement'))
assert.ok(damaged(m => { m.canonical.manuscript_alias_to_stable_outcome_ids['VS-G04-MA-T-G'] =
  [...m.canonical.manuscript_alias_to_stable_outcome_ids['VS-G04-MA-T-A']] }).includes('database_outcome_reused_for_two_requirements'))

for (const o of manuscript.outcomes) {
  assert.ok(migration.includes("'" + o.source_locator + "'"), 'KICD locator absent from migration: ' + o.id)
  assert.ok(migration.includes("'" + o.id + "'"), 'Alias absent from migration: ' + o.id)
  for (const id of o.stable_outcome_ids) {
    assert.ok(migration.includes("'" + id + "'"), 'Database identity absent from migration: ' + id)
  }
}
for (const marker of [
  'create table if not exists public.vs_curriculum_package_scopes',
  'create table if not exists public.vs_curriculum_source_requirements',
  'create table if not exists public.vs_curriculum_alias_outcomes',
  'create table if not exists public.vs_curriculum_resource_aliases',
  'revoke all on public.vs_curriculum_alias_outcomes from public, anon, authenticated, service_role',
  'unresolved_kicd_requirement',
  'unresolved_manuscript_alias',
  'outcome_identity_or_locator_invalid',
  'resource_scope_or_alias_missing',
  'required_outcome_not_taught',
  'VS_CURRICULUM_PACKAGE_ID_REQUIRED',
  'VS_CURRICULUM_VERSION_ALIASES_REQUIRED',
  'VS_CURRICULUM_VERSION_ALIASES_MISMATCH',
  "new.lifecycle_status not in ('verified','certified')",
  'before insert or update of lifecycle_status on public.learning_resource_versions',
  "public.vs_curriculum_package_gate('VS-G04-MA-2.6-TIME-20261111')->>'state'",
  'P0_GRADE4_TIME_READER_NOT_TEN_AFTER_GATE'
]) assert.ok(migration.includes(marker), 'Missing fail-closed DB enforcement: ' + marker)

console.log('PASS: P0 grade4 Time alias→stable-ID manifest, all source locators, negative cases, and DB promotion/reader gates')
