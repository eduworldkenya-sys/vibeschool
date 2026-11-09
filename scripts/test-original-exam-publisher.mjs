import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const sql=readFileSync("supabase/migrations/20261110130000_hq_original_practice_publisher.sql","utf8")
const page=readFileSync("app/hq/exams/publish/page.tsx","utf8")

test("publishing is restricted to authenticated platform owners",()=>{
  assert.match(sql,/auth\.uid\(\)/)
  assert.match(sql,/is_platform_owner\(\)/)
  assert.match(sql,/explicit_owner_approval_required/)
  assert.match(sql,/revoke all on function public\.hq_publish_original_practice/)
  assert.match(page,/is_platform_owner/)
})
test("preview and publish share canonical validation",()=>{
  assert.match(sql,/if not p_publish then/)
  assert.match(sql,/jsonb_array_length\(v_issues\)/)
  assert.match(sql,/published_question_duplicate/)
  assert.match(sql,/bank_key_already_used/)
  assert.match(sql,/total_marks_mismatch/)
  assert.match(sql,/title_already_exists/)
  assert.match(sql,/pg_advisory_xact_lock/)
})
test("successful publication reuses canonical authorities",()=>{
  for (const asset of ["vibe_publications","vibe_chapters","content_blocks","curriculum_learning_outcomes","chapter_learning_outcome_links","content_block_outcome_links","assessment_items","assessment_item_outcomes","assessment_definitions","exq_validate_assessment","exq_publish_public_practice"]) {
    assert.ok(sql.includes(asset), `Expected canonical ${asset}`)
  }
  assert.match(sql,/v_caller,now\(\),now\(\),now\(\)/)
  assert.match(sql,/public\.exq_publish_public_practice\(v_assessment,v_grade,v_attempts\)/)
  assert.match(sql,/curriculum_verification','provisional'/)
  assert.doesNotMatch(sql,/status','verified'/)
})
test("HQ workflow has upload, validation, explicit approval and publish",()=>{
  assert.match(page,/type="file"/)
  assert.match(page,/Validate paper/)
  assert.match(page,/setApproved/)
  assert.match(page,/p_publish: publish/)
  assert.match(page,/p_approved: publish && approved/)
  assert.match(page,/setValidatedText\(raw\)/)
  assert.match(page,/validatedText === raw/)
})

test("publisher SQL is a single fully terminated function, not a malformed concatenation",()=>{
  assert.equal((sql.match(/create or replace function public\\.hq_publish_original_practice\\(/g)||[]).length,1)
  assert.equal((sql.match(/\\$fn\\$;/g)||[]).length,1)
  assert.match(sql,/grant execute on function public\\.hq_publish_original_practice\\(jsonb,boolean,boolean\\)\\s+to authenticated;/)
  assert.doesNotMatch(sql,/to authenticated;\\s+then\\b/)
})
test("grade-scoped independent practice does not bypass class assessment permissions",()=>{
  const gate=readFileSync("supabase/migrations/20261110010000_exq_independent_public_practice.sql","utf8")
  assert.match(gate,/aa\\.audience='class' and sc\\.student_id is not null/)
  assert.match(gate,/aa\\.audience='public_practice'/)
  assert.match(gate,/exq_public_practice_eligible\\(aa\\.audience_grade\\)/)
  assert.match(gate,/aa\\.school_id is null and aa\\.class_id is null/)
})
test("owner approval is not inferred from an uploaded paper",()=>{
  assert.match(sql,/if not p_approved then raise exception 'explicit_owner_approval_required'/)
  assert.match(page,/const canPublish = Boolean\\(preview\\?\\.valid/)
  assert.match(page,/validatedText === raw/)
  assert.match(page,/setApproved\\(false\\)/)
})
