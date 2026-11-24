import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
const sql = readFileSync(new URL('../supabase/migrations/20261122180000_legacy_publication_pause.sql', import.meta.url), 'utf8')
test('legacy publication lifecycle pause is database enforced and reversible', () => {
  assert.match(sql, /create trigger vs_legacy_publication_pause/)
  assert.match(sql, /create trigger vs_legacy_chapter_pause/)
  assert.match(sql, /before insert or update of status on public\.vibe_publications/)
  assert.match(sql, /before insert or update of status on public\.vibe_chapters/)
  assert.match(sql, /old\.status is distinct from new\.status/)
  assert.match(sql, /PUBLISHING_PAUSED/)
  assert.match(sql, /errcode='42501'/)
  assert.match(sql, /drop trigger if exists vs_legacy_publication_pause/)
  assert.doesNotMatch(sql, /\b(delete from|truncate|drop table|revoke\s+select)\b/i)
})
