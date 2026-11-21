import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const sql=readFileSync(new URL('./sql/g4_whole_numbers_release_preflight.sql',import.meta.url),'utf8')
test('single exact-grade Whole Numbers scope; no second approval authority or writes',()=>{
  for(const s of ['VS-G04-MA-1.1-WHOLE-NUMBERS-20261120','6fc551d7-c9ae-4402-ac52-3d0a46461e87','0f130af0-8f3c-433a-a0df-453927dece7f']) assert.ok(sql.includes(s),s)
  assert.doesNotMatch(sql,/\b(?:insert\s+into|update\s+public\.|delete\s+from|alter\s+table|create\s+or\s+replace|drop\s+(?:table|function|policy)|grant\s+|revoke\s+|publish_publication\s*\(|set_config\s*\()\b/i)
  assert.match(sql,/no_mutation_performed.*true/)
})
test('release preflight covers source, outcomes, rights, sensitive-asset privacy, QA and actual learner visibility',()=>{
  for(const gate of ['official_source_review_pending','official_source_hierarchy_pending','curriculum_outcomes_not_all_active_and_reconciled','resource_manifest_or_hash_mismatch','original_resource_rights_pending','resource_certification_pending','learner_resource_activation_pending','sensitive_resources_must_remain_private','teacher_guide_source_lineage_incomplete','teacher_guide_independent_approval_pending','assessment_content_lineage_incomplete','assessment_moderation_pending','publication_release_approval_pending','authenticated_publisher_identity_unavailable_in_this_connection','student_catalogue_publication_pending']) assert.ok(sql.includes(gate),gate)
  assert.match(sql,/and exists \(select 1 from public\.content_assessment_sources cas/)
  assert.match(sql,/vs_curriculum_package_gate/)
  assert.match(sql,/content_sha256=encode\(extensions\.digest/)
  assert.match(sql,/coalesce\(s\.promoted_snapshots,0\)=0/)
})
