import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
const sql=readFileSync('supabase/migrations/20261121235900_g4_whole_numbers_private_candidate_verification_deadlock.sql','utf8')
const staged=sql.slice(sql.indexOf('    -- A verified CANDIDATE'),sql.indexOf('    -- Status is still VERIFIED only'))
test('promotion limited to exact Word Numbers private v3 verified transition',()=>{
 for(const token of [
  "tg_op = 'UPDATE'","old.lifecycle_status = 'candidate'","new.lifecycle_status = 'verified'",
  "v_package_id = 'VS-G04-MA-1.1-WHOLE-NUMBERS-20261120'","new.version=3",
  "new.rights_status = 'cleared'","new.provenance->>'authoring' = 'VibeSchool original manuscript'",
  "new.payload->>'schema' = 'vibeschool.originals.editorial-textbook-unit.v1'",
  "extensions.digest(convert_to(new.payload::text,'UTF8'),'sha256')",
  "and p.status='draft'","p.author_id='c49bf987-357f-46bc-98fb-9a326882e437'",
  "o.status='draft'","o.source_type='official'","o.source_locator=req.source_locator",
  "root.status='inactive'","root.visibility='private'","root.owner_type='platform'",
  "root.source_type='platform_authored'","public.vs_curriculum_resource_aliases",
  ") = 11",") = 6", "is distinct from true then"
 ])assert.ok(staged.includes(token),'missing fail closed predicate: '+token)
 assert.ok(staged.includes('state->\'blockers\' = \'["outcome_identity_or_locator_invalid","resource_scope_or_alias_missing"]\'::jsonb'))
})
test('all other resources and certification still require exact original PASS',()=>{
 assert.ok(sql.includes("state := public.vs_curriculum_package_gate(v_package_id);"))
 assert.match(sql,/if state->>'state' <> 'PASS' then/)
 assert.match(sql,/new.lifecycle_status not in \('verified','certified'\)/)
 assert.match(sql,/if r.asset_kind = 'visual_aid' then/)
 assert.match(sql,/VS_VISUAL_PROMOTION_METADATA_INVALID/)
 assert.match(sql,/VS_CURRICULUM_VERSION_ALIASES_REQUIRED/)
 assert.match(sql,/VS_CURRICULUM_VERSION_ALIASES_MISMATCH/)
 assert.match(sql,/VS_CURRICULUM_RESOURCE_PACKAGE_MISMATCH/)
 assert.match(sql,/BLOCKED_CURRICULUM_RECONCILIATION/)
 assert.doesNotMatch(sql,/create or replace function public\.cla_certify_learning_resource_version|grant\s+execute|update\s+public\.learning_resource_versions|update\s+public\.vibe_publications|update\s+public\.curriculum_learning_outcomes|security definer/i)
})
test('trigger body is complete, atomic, and does not manufacture approvals or source records',()=>{
 assert.match(sql,/^begin;\n/m)
 assert.match(sql,/\ncommit;\s*$/)
 assert.match(sql,/\$guard\$;/)
 assert.doesNotMatch(sql,/insert\s+into|delete\s+from|drop\s+trigger|disable\s+trigger|approved_by|curriculum_authority_artifacts|curriculum_authority_snapshots/i)
})
