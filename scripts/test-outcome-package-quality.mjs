import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Lightweight repository contract. Actual trigger behavior is exercised by the
// rollback-only SQL fixture on disposable Postgres, not by this static test.
const sql = readFileSync(resolve('supabase/migrations/20261112115000_outcome_package_quality_gate.sql'),'utf8')
const smoke = readFileSync(resolve('scripts/sql/outcome_package_quality_verify.sql'),'utf8')
const guide = readFileSync(resolve('docs/curriculum/OUTCOME_PACKAGE_QUALITY_AND_RELEASE.md'),'utf8')

const must = (body,needle,label) =>
  assert.ok(body.includes(needle),`P1 package quality missing ${label || needle}`)

for (const check of [
  'curriculum_match','mathematical_correctness','worked_steps','answer_keys',
  'teacher_usefulness','rights','accessibility','cross_surface_links'
]) must(sql,`'${check}'`,`check ${check}`)
for (const item of [
  'public.cla_audit_outcome_package',
  'public.vs_curriculum_package_gate',
  'public.vs_curriculum_alias_outcomes',
  'SOURCE_TO_DATABASE_RECONCILIATION_BLOCKED',
  'CURRICULUM_MANUSCRIPT_ALIASES_NOT_RECONCILED',
  'public.curriculum_learning_outcomes',
  'public.assessment_questions',
  'public.learning_resource_versions',
  'public.cla_require_outcome_package_quality',
  'before insert or update of lifecycle_status',
  "old.lifecycle_status is distinct from 'verified'",
  "message='CLA_OUTCOME_PACKAGE_QUALITY_BLOCKED'",
  'PACKAGE_PAYLOAD_HASH_MISMATCH',
  'PINNED_VERSION_NOT_CERTIFIED_OR_RIGHTS_CLEARED',
  'MATH_WORKED_STEPS_NOT_STRUCTURED',
  'QUESTION_ANSWER_KEY_MISSING',
  'QUESTION_REVIEW_NOT_RECORDED',
  'VISUAL_ACCESSIBILITY_OR_STORAGE_INVALID',
  'DELIVERY_TEST_NOT_VERIFIED',
  'CLA_OUTCOME_PACKAGE_UNSUPPORTED_HUMAN_APPROVAL_CLAIM',
  "quality->>'independent_human_review' is distinct from 'false'",
  "coalesce(quality->>'reviewer_kind','') not in",
  "revoke all on function public.cla_outcome_package_quality_gate",
  "to service_role;"
]) must(sql,item)
assert.doesNotMatch(sql,/create\s+table\s+/i,'No second publishing/QA table is allowed')
assert.doesNotMatch(sql,/\binsert\s+into\s+public\.publication_release_approvals\b/i)
assert.doesNotMatch(sql,/\bupdate\s+public\.assessment_questions\b/i)

for (const item of [
  'begin;','rollback;',
  'Candidate skipped verified transition',
  'Fabricated human approval accepted',
  'Missing evidence was accepted',
  'Wrong manuscript alias accepted',
  'Manifest source mismatch accepted',
  'Unreconciled source package accepted',
  'Stale checksum was accepted',
  'Unproven teacher delivery was accepted',
  'Blank diagram caption accepted'
]) must(smoke,item)
for (const item of [
  'not a certification',
  'a string saying',
  'independent_human_review',
  'No new publishing engine',
  'disposable'
]) must(guide.toLowerCase(),item.toLowerCase())

console.log('P1 outcome-package quality static contract: PASS (database smoke is separate)')
