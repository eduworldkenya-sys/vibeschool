import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const sql = read('supabase/migrations/20261122214000_publisher_auto_review_readiness.sql')
const hook = read('hooks/usePublicationDraft.ts')
const typedClient = read('lib/supabase.ts')

test('author-scoped readiness cannot expose commissions to arbitrary readers', () => {
  assert.match(sql, /v_actor uuid := auth\.uid\(\)/)
  assert.match(sql, /AUTHENTICATED_PUBLISHER_REQUIRED/)
  assert.match(sql, /v_actor IS DISTINCT FROM v_author AND NOT public\.is_platform_owner\(\)/)
  assert.match(sql, /PUBLICATION_OWNER_REQUIRED/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.ce_get_publication_auto_review_state/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.ce_get_publication_auto_review_state\(uuid\)/)
})

test('existing machine commission is required; no synthetic review or approval', () => {
  assert.match(sql, /ce_machine_content_commissions/)
  assert.match(sql, /revoked_at IS NULL/)
  assert.match(sql, /expires_at>clock_timestamp\(\)/)
  assert.match(sql, /c\.reviewer_user_id<>v_author/)
  assert.match(sql, /'teacher_guide','assessment','release'/)
  assert.match(sql, /publication_release_fingerprint/)
  assert.match(sql, /machine_reviewer_not_commissioned/)
  assert.doesNotMatch(sql, /INSERT INTO public\.publication_release_approvals|UPDATE public\.publication_release_approvals|INSERT INTO public\.ce_machine_content_review_receipts/i)
  assert.doesNotMatch(sql, /set_config\s*\(|request\.jwt|auth\.users.*INSERT/i)
})

test('publisher sees exact missing commissioning instead of human approval instruction', () => {
  assert.match(hook, /publication_release_approval_required/)
  assert.match(hook, /publication_release_approval_stale/)
  assert.match(hook, /ce_get_publication_auto_review_state/)
  assert.match(typedClient, /ce_get_publication_auto_review_state/)
  assert.match(hook, /p_publication_id: originalPub.id/)
  assert.match(hook, /No human sign-off is required/)
  assert.match(hook, /qualified independent machine reviewer must be authorized/)
  assert.match(hook, /draft is saved and private/)
  assert.match(hook, /rollbackPromotedMedia/)
})
