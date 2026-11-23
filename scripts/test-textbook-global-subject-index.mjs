// Regression for canonical textbook subject selection with duplicate school copies.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync('supabase/migrations/20261123144500_textbook_global_subject_index_resolution.sql', 'utf8')

test('global subject is selected before identically named school copies', () => {
  assert.match(sql, /from public\.subjects[\s\S]*?and school_id is null/)
  assert.match(sql, /if coalesce\(array_length\(v_subject_ids,1\),0\)=0 then/)
  assert.match(sql, /if coalesce\(array_length\(v_subject_ids,1\),0\)=1 then/)
  assert.match(sql, /v_subject_id:=null/)
})

test('publication/index synchronization and auth checks are preserved', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.ce_reconcile_textbook_index_internal/)
  assert.match(sql, /SECURITY DEFINER/)
  assert.match(sql, /v_pub\.status <> 'published'/)
  assert.match(sql, /v_pub\.status='published'/)
  assert.match(sql, /vibe_publications/)
  assert.match(sql, /vibelearn_content/)
  assert.match(sql, /on conflict \(vibe_publication_id\)/)
  assert.doesNotMatch(sql, /grant\s|alter\s+policy|disable\s+row\s+level\s+security/i)
})

test('fallback refuses ambiguous subjects and preserves edition identity', () => {
  assert.match(sql, /where lower\(name\)=lower\(coalesce\(v_pub\.cbc_subject,''\)\)/)
  assert.match(sql, /select id into v_existing_id/)
  assert.match(sql, /vibe_publication_id=p_publication_id/)
  assert.match(sql, /v_subject_ids\[1\]/)
  assert.match(sql, /else\s*v_subject_id:=null/)
})
