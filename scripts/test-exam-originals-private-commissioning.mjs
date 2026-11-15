import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('private original bank remains private and public leaked candidate is quarantined', () => {
  assert.equal(existsSync(new URL('../content/assessments/vibepapers-grade4-mathematics-001.draft.json',import.meta.url)),false,
    'Public Git must not contain original paper answer keys')
  const receipt=read('docs/exams/G4_MATH_VIBEPAPERS_001_PRIVATE_STAGING_20261115.md')
  assert.match(receipt,/vibepapers-g4-math-001-private-2026/)
  assert.match(receipt,/exposed and may never be published/)
  assert.match(receipt,/provisional/)
  // Staging alone is not publication proof: the current owner-directed release receipt
  // explicitly requires a production database readback before claiming the paper is live.
  assert.match(receipt,/Publication status must be verified by production DB readback/)
})

test('only reviewed owner-authored papers may enter Originals catalogue', () => {
  const sql=read('supabase/migrations/20261115143000_exam_originals_reviewed_paper_provenance.sql')
  for(const guard of [
    /private\.original_exam_drafts/,
    /review_evidence->>'independent_review'='passed'/,
    /review_evidence->>'public_repository_exposure'='false'/,
    /review_evidence->>'reviewed_content_md5'=md5\(d\.paper::text\)/,
    /publication_receipt->>'assignment_id'=p_assignment_id::text/,
    /private_editorial_provenance_required/,
    /if v_tagged<>v_count then raise exception 'cognitive_outcome_metadata_incomplete'/,
    /create unique index if not exists exam_original_series_paper_unique/,
    /is_platform_owner\(\)/,
    /revoke all on function public\.hq_list_original_exam_drafts\(\)/,
    /grant execute on function public\.hq_list_original_exam_drafts\(\) to authenticated/,
  ]) assert.match(sql,guard)
  assert.doesNotMatch(sql,/update public\.assessment_attempts|update public\.assessment_gradebook_entries|delete from public\.assessment_/i)
})

test('HQ review, publication and product certification remain three explicit owner actions', () => {
  const page=read('app/hq/exams/publish/page.tsx')
  assert.match(page,/hq_get_original_exam_draft_for_review/)
  assert.match(page,/hq_review_original_exam_draft/)
  assert.match(page,/hq_publish_staged_original_exam/)
  assert.match(page,/hq_certify_exam_original_assignment/)
  assert.match(page,/paper\.status === "reviewed"/)
  assert.match(page,/paper\.published && paper\.certified_series/)
  assert.match(page,/paper\.published && paper\.status === "reviewed" && !paper\.certified_series/)
  assert.match(page,/certifyId !== paper\.id/)
  assert.match(page,/Outcome-level mapping remains provisional/)
})
