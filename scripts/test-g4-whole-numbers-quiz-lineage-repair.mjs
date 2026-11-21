import {readFileSync} from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
const sql=readFileSync(new URL('./sql/g4_whole_numbers_quiz_source_lineage_repair.sql',import.meta.url),'utf8')
test('exact existing publication and assessment; never changes release status or answer keys',()=>{
  for(const s of ['6fc551d7-c9ae-4402-ac52-3d0a46461e87','b23413c2-f7ae-44c2-9f5e-98f3cdeeeb8a','c49bf987-357f-46bc-98fb-9a326882e437','Whole Numbers — Grade 4 Mathematics (v3 moderation)','ga.status=\'moderation\'','ga.total_marks=16','v_count<>11','v_actual<>11'])assert.ok(sql.includes(s),s)
  assert.match(sql,/G4_WN_DRAFT_OWNER_AND_CHAPTER_REQUIRED/)
  assert.match(sql,/G4_WN_UNAUTHORIZED_ITEM_SOURCE/)
  assert.match(sql,/G4_WN_ITEM_OUTCOME_BLOCK_MISMATCH/)
  assert.doesNotMatch(sql,/\b(?:delete\s+from|truncate\s+|drop\s+table|alter\s+table|grant\s+|revoke\s+|publish_publication\s*\(|update\s+public\.generated_assessments|update\s+public\.vibe_publications|update\s+public\.learning_resource_versions)\b/i)
})
test('preserves 11 exact content references and teacher-only privacy',()=>{
  assert.match(sql,/wn-v3-WN-intro-p/)
  assert.match(sql,/wn-v3-WN-'\|\|lpad\(i\.sequence::text,2,'0'\)\|\|'-p'/)
  assert.match(sql,/is_teacher_only IS DISTINCT FROM false/)
  assert.match(sql,/content_block_outcome_links/)
  assert.match(sql,/relationship,created_by/)
  assert.match(sql,/ON CONFLICT \(content_block_id,outcome_id\) DO NOTHING/)
  assert.match(sql,/source_block_id=rec\.matching_block/)
  assert.doesNotMatch(sql,/set\s+status\s*=|\banswer_key\s*=|\bmarks\s*=/i)
})
test('single atomic transaction with fail-closed account and lineage checks',()=>{
  assert.match(sql,/^BEGIN;\nDO \$repair\$/m)
  assert.match(sql,/END \$repair\$;\nCOMMIT;\s*$/)
  for(const s of ['G4_WN_EXACT_ASSESSMENT_IDENTITY_REQUIRED','G4_WN_EXACT_11_ITEM_16_MARK_SCOPE_REQUIRED','G4_WN_CHAPTER_OUTCOME_NOT_LINKED','G4_WN_LINEAGE_NOT_COMPLETE']) assert.ok(sql.includes(s),s)
})
