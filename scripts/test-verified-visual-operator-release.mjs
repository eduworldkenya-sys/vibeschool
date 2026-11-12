import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync('supabase/migrations/20261112230130_verified_visual_operator_release.sql','utf8')
const route = readFileSync('app/api/operator/visual-library/release/route.ts','utf8')
const server = readFileSync('lib/visual-library/server.ts','utf8')
const original = readFileSync('supabase/migrations/20260818142200_canonical_learning_resource_promotion_authority.sql','utf8')

test('scoped visual publishing does not alter general owner certification or RLS',()=>{
  assert.match(original,/CLA_PLATFORM_OWNER_REQUIRED/)
  assert.match(migration,/function public\.vs_release_verified_visual\(/)
  assert.doesNotMatch(migration,/create or replace function public\.cla_certify_learning_resource_version/)
  assert.doesNotMatch(migration,/alter table public\.learning_resources (?:disable|enable) row level security/i)
  assert.match(migration,/auth\.role\(\)/)
  assert.match(migration,/VS_VISUAL_RELEASE_SERVICE_ROLE_REQUIRED/)
  assert.match(migration,/r\.asset_kind is distinct from 'visual_aid'/)
  assert.match(migration,/r\.owner_type is distinct from 'platform'/)
  assert.match(migration,/r\.source_type is distinct from 'platform_authored'/)
  assert.match(migration,/revoke all on function public\.vs_release_verified_visual\(uuid,text,jsonb\)/)
  assert.match(migration,/from public,anon,authenticated/)
  assert.match(migration,/grant execute on function public\.vs_release_verified_visual\(uuid,text,jsonb\)\s+to service_role/)
})

test('only properly verified immutable visual versions can be released',()=>{
  for(const token of [
    'VS_VISUAL_RELEASE_CONTENT_HASH_MISMATCH',
    'VS_VISUAL_RELEASE_REQUIRES_VERIFIED_RIGHTS_AND_QA',
    'VS_VISUAL_RELEASE_NOT_PRIVATE_UNIQUE_CANDIDATE',
    'VS_VISUAL_RELEASE_PRIVATE_FILE_UNVERIFIED',
    'VS_VISUAL_RELEASE_METADATA_OR_FILE_EVIDENCE_INVALID',
    "v.verified_at is null",
    "v.lifecycle_status is distinct from 'verified'",
    "v.rights_status is distinct from 'cleared'",
    "p->'storage'->>'bucket' is distinct from 'vibe-publication-drafts'",
    "from storage.objects",
    "is_delete_marker",
    "object_row.metadata->>'mimetype'",
    "object_row.metadata->>'size'",
    "certification_evidence=jsonb_build_object(",
    "set status='active',visibility='public'",
    "when already"
  ].filter(v=>v!=='when already')) assert.ok(migration.includes(token),token)
  assert.match(migration,/lifecycle_status='certified'/)
  assert.match(migration,/certified_at=now\(\)/)
  assert.match(migration,/status','already_released'/)
})

test('independent release token required, not intake or browser session token',()=>{
  assert.match(server,/VIBESCHOOL_VISUAL_RELEASE_TOKEN/)
  assert.match(server,/secret === intakeSecret/)
  assert.match(server,/timingSafeEqual\(actual, expected\)/)
  assert.match(route,/requireVisualReleaseOperator\(req\)/)
  assert.match(route,/vs_release_verified_visual/)
  assert.match(route,/p_expected_sha256: expectedSha256/)
  assert.match(route,/quality_check: qualityCheck/)
  assert.match(route,/rights_check: rightsCheck/)
  assert.match(route,/accessibility_check: accessibilityCheck/)
  assert.doesNotMatch(route,/CLA_PLATFORM_OWNER_REQUIRED|auth\.uid/)
  assert.doesNotMatch(route,/from\('learning_resource_versions'\)\.update/)
})

test('candidate intake token itself cannot certify or publish',()=>{
  const intake=readFileSync('app/api/operator/visual-library/route.ts','utf8')
  assert.match(intake,/requireVisualOperator\(req\)/)
  assert.doesNotMatch(intake,/vs_release_verified_visual/)
})
