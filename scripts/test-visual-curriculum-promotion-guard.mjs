import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync('supabase/migrations/20261112195305_visual_aid_promotion_guard_scoped.sql','utf8')

test('visual library verification is narrowly exempted from manuscript package gate', () => {
  const start = migration.indexOf("if r.asset_kind = 'visual_aid' then")
  const end = migration.indexOf("  v_package_id :=")
  assert.ok(start > 0 && end > start, 'visual-only case must precede unchanged manuscript package reconciliation')
  for (const proof of [
    "new.payload->>'schema' is distinct from 'vibeschool.visual.v1'",
    "new.payload->>'source_strand_id' is distinct from r.sub_strand_id::text",
    "new.payload->'storage'->>'bucket' is distinct from 'vibe-publication-drafts'",
    "visual-library/[0-9a-f]",
    "new.payload->'storage'->>'mime'",
    "new.payload->>'alt_text'",
    "new.payload->>'caption'",
    "jsonb_typeof(new.payload->'labels')",
    "jsonb_typeof(new.payload->'placements')",
    "VS_VISUAL_PROMOTION_METADATA_INVALID",
    "return new;"
  ]) assert.ok(migration.slice(start,end).includes(proof), 'visual validation missing: '+proof)
})

test('all other platform manuscript gates and owner certification stay protected', () => {
  for(const proof of [
    "VS_CURRICULUM_PACKAGE_ID_REQUIRED",
    "public.vs_curriculum_package_gate(v_package_id)",
    "BLOCKED_CURRICULUM_RECONCILIATION",
    "VS_CURRICULUM_RESOURCE_PACKAGE_MISMATCH",
    "VS_CURRICULUM_VERSION_ALIASES_REQUIRED",
    "VS_CURRICULUM_VERSION_ALIASES_MISMATCH",
    "r.owner_type is distinct from 'platform'",
    "r.source_type is distinct from 'platform_authored'"
  ]) assert.ok(migration.includes(proof), 'manuscript guard changed: '+proof)
  assert.doesNotMatch(migration,/create or replace function public\.cla_certify_learning_resource_version/i)
  assert.doesNotMatch(migration,/grant\s+execute\s+on\s+function/i)
  assert.doesNotMatch(migration,/alter table public\.learning_resources/i)
})

test('Time source diagram accurately shows six groups with exactly ten counters', () => {
  const svg = readFileSync('content/curriculum/production/grade4-time-expanded-visuals/six-groups-of-ten.svg','utf8')
  assert.equal((svg.match(/<circle /g)||[]).length,60)
  assert.equal((svg.match(/10 minutes<\/text>/g)||[]).length,6)
  assert.match(svg,/6 × 10 minutes = 60 minutes = 1 hour/)
  assert.match(svg,/<desc id="desc">Six separate boxes, each containing exactly ten dots/)
})
