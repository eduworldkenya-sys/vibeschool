import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const compat = readFileSync('supabase/migrations/20261111133000_grade1_jumping_certified_content_teacher_compat.sql', 'utf8')
const release = readFileSync('scripts/sql/grade1_jumping_owner_delegated_operator_release_20261111.sql', 'utf8')

for (const fragment of [
  "pg_get_functiondef('public.vs_read_linked_jumping_scheme_content(uuid,integer)'::regprocedure)",
  "pg_get_functiondef('public.vs_pin_jumping_draft_to_plan(uuid,uuid,integer)'::regprocedure)",
  "version.lifecycle_status in (''candidate'',''certified'')",
  "rv.lifecycle_status in (''candidate'',''certified'')",
  "r.canonical_key like ''vs:g1:jumping:learner:%''",
]) assert.ok(compat.includes(fragment), 'Scheme compatibility lacks: ' + fragment)

for (const fragment of [
  "current_user <> 'postgres'",
  "if v_count <> 33",
  "GRADE1_RELEASE_VERIFICATION_FAILED",
  "public.cla_verify_learning_resource_candidate",
  "v.lifecycle_status='verified'",
  "certification_evidence=jsonb_build_object",
  "status='active',visibility='public'",
  "canonical_key ~ '^vs:g1:jumping:learner:(intro|lesson:[0-9]{2})$'",
  "r.status='inactive' and r.visibility='private' and v.lifecycle_status='certified'",
  "GRADE1_RELEASE_PUBLIC_READER_FAILED",
]) assert.ok(release.includes(fragment), 'Operator release lacks: ' + fragment)
assert.ok(!release.includes("set_config('request.jwt"), 'Never impersonate owner identity')
assert.ok(!compat.includes('grant execute to anon'), 'No anonymous certification')
console.log('PASS: bounded operator release, canonical learner-only publishing and teacher Scheme compatibility')
