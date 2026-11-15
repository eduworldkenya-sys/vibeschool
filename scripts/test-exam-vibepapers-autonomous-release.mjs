import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
const source = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('Owner-directed one-time release is limited to the private, originally audited paper', () => {
  const s=source('supabase/migrations/20261115150000_vibepapers_g4_math001_owner_directed_release.sql')
  for (const match of [
    /paper_id='vibepapers-g4-math-001-private-2026'/,
    /Private paper changed since owner-directed review/,
    /v_all<>1/,/v_count<>50/,/v_sum<>50/,
    /v_position:=v_position\+1/,
    /Duplicate bank key or prompt/,
    /Invalid marking key/,
    /Previously published prompt/,
    /v_item->>'bloom_level'/,
    /clo\.status='active' and clo\.source_type='creator_claimed'/,
    /curriculum_candidate_code/,
    /public\.assessment_item_outcomes/,
    /public\.exam_original_assignment_series/,
    /'papers',2026,1/,
    /human_educational_review','not_performed'/,
    /independent_review','not_performed'/,
    /owner_authenticated_signoff','not_claimed'/,
    /curriculum_verification','provisional'/,
    /owner_directed_automated/,
    /if v_all=0 then/,
    /create or replace function public\.hq_list_original_exam_drafts/,
    /'review_mode',meta\.review_mode/,
  ])assert.match(s,match)
  assert.doesNotMatch(s,/insert into auth\.|update auth\.|delete from auth\./i)
  assert.doesNotMatch(s,/update public\.assessment_attempts|update public\.assessment_gradebook_entries|delete from public\.assessment_/i)
  assert.doesNotMatch(s,/owner_authenticated_signoff','true'|human_educational_review','passed'|independent_review','passed'/i)
  assert.doesNotMatch(s,/\b(grade4-original-exam-01|G4-DRAFT-001)\b/,'sample exam should not be published')
})

test('Existing security-separated catalogue remains authoritative', () => {
  const s=source('supabase/migrations/20261115143000_exam_originals_reviewed_paper_provenance.sql')
  assert.match(s,/private_editorial_provenance_required/)
  assert.match(s,/owner_only_original_certification/)
  assert.match(s,/cognitive_outcome_metadata_incomplete/)
  const page=source('app/hq/exams/publish/page.tsx')
  assert.match(page,/owner_directed_automated/)
  assert.match(page,/Automated review only · Provisional curriculum/)
  const docs=source('docs/exams/G4_MATH_VIBEPAPERS_001_PRIVATE_STAGING_20261115.md')
  assert.match(docs,/private\.original_exam_drafts/)
})
