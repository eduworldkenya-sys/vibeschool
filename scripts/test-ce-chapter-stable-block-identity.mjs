import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../supabase/migrations/20261122211500_content_block_identity_preserving_reconciliation.sql', import.meta.url), 'utf8')
const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.ce_reconcile_chapter_blocks_trigger()'))

test('chapter autosave must preserve block UUIDs rather than delete and reinsert', () => {
  assert.match(fn, /new\.blocks IS NOT DISTINCT FROM old\.blocks/)
  assert.match(fn, /SET sequence = sequence \+ v_shift/)
  assert.match(fn, /WHERE chapter_id = new\.id AND legacy_block_id = v_legacy/)
  assert.match(fn, /WHERE id = v_existing\.id/)
  assert.match(fn, /CHAPTER_BLOCK_DUPLICATE_STABLE_ID/)
  assert.match(fn, /CHAPTER_BLOCK_OBJECT_REQUIRED/)
  assert.ok(fn.indexOf('UPDATE public.content_blocks') < fn.indexOf('DELETE FROM public.content_blocks'))
  assert.match(fn, /v_existing\.id IS NOT NULL/)
})

test('insertion and reordering preserve independent sequence and stable IDs', () => {
  assert.match(fn, /jsonb_array_elements\(coalesce\(new\.blocks, '\[\]'::jsonb\)\)[\s\S]*?WITH ORDINALITY/)
  assert.match(fn, /GREATEST|greatest/)
  assert.match(fn, /sequence = v_seq/)
  assert.match(fn, /sequence > v_shift/)
  assert.match(fn, /legacy_block_id IS NULL/)
  assert.match(fn, /payload = v_payload/)
})

test('source-bound question changes and deletion are fail closed', () => {
  assert.match(fn, /generated_assessment_items/)
  assert.match(fn, /assessment_items/)
  assert.match(fn, /LINKED_QUESTION_EDIT_REQUIRES_ASSESSMENT_REVISION/)
  assert.match(fn, /LINKED_CONTENT_BLOCK_DELETE_REQUIRES_REVIEW/)
  assert.match(fn, /pg_constraint/)
  assert.match(fn, /EXECUTE format\('SELECT EXISTS/)
})

test('interactive block remains its own canonical type, without new grants', () => {
  assert.match(fn, /WHEN v_type = 'interactive' THEN 'interactive'/)
  assert.match(fn, /WHEN v_type = 'question' THEN 'question'/)
  assert.match(fn, /WHEN v_type IN \('image','diagram'/)
  assert.doesNotMatch(sql, /^\s*(?:GRANT\s+|REVOKE\s+|CREATE\s+POLICY|DROP\s+POLICY|UPDATE\s+public\.publication_release_approvals)/im)
})

test('Creative Arts repair reuses same draft, question keys and citations; never mints approval', () => {
  const repair = readFileSync(new URL('./sql/grade4_painting_montage_existing_draft_relink.sql', import.meta.url), 'utf8')
  for (const k of ['CA_QUESTION_LINEAGE_MISMATCH', 'CA_GUIDE_SOURCE_MATCH_MISMATCH',
                   'CA_INTERACTIVE_RECHECK_FAILED', 'CA_QUESTION_RECHECK_FAILED',
                   'CA_GUIDE_RECHECK_FAILED', 'creative_arts_montage_builder',
                   'generated_assessment_items', 'content_derivatives']) {
    assert.ok(repair.includes(k), 'Missing required guarded repair: ' + k)
  }
  assert.match(repair, /v_good<>15/)
  assert.match(repair, /v_guide_matched<>31/)
  assert.match(repair, /status='draft'/)
  assert.doesNotMatch(repair, /UPDATE\s+public\.vibe_publications\s+SET\s+status\s*=\s*'published'/i)
  assert.doesNotMatch(repair, /UPDATE\s+public\.publication_release_approvals|INSERT\s+INTO\s+public\.publication_release_approvals/i)
})
