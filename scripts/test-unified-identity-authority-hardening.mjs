import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration=readFileSync('supabase/migrations/20261123110000_unified_identity_authority_hardening.sql','utf8')
const parent=readFileSync('app/parent/managed-learners/page.tsx','utf8')
const first=migration.indexOf('create or replace function public.vs_claim_my_username(')
const second=migration.indexOf('create or replace function public.vs_create_managed_learner(')
const claim=migration.slice(first,second)
const child=migration.slice(second)

test('correction migration recreates only the existing RPCs',()=>{
  assert.ok(first>=0 && second>first)
  assert.equal((migration.match(/create or replace function /g)||[]).length,2)
  assert.equal((migration.match(/as \$\$/g)||[]).length,2)
  assert.equal((migration.match(/\$\$;/g)||[]).length,2)
  assert.equal((migration.match(/\bcommit;/g)||[]).length,1)
  assert.ok(migration.trimEnd().endsWith('commit;'))
  assert.doesNotMatch(migration,/drop table|truncate|delete from public\.students|alter table public\.profiles/i)
})

test('null/restricted auth state is explicitly denied for both RPCs',()=>{
  for (const fn of [claim,child]) {
    assert.match(fn,/account_status' is distinct from 'active'/)
    assert.match(fn,/is_anonymized' is distinct from 'false'/)
    assert.match(fn,/v_uid is null then raise exception/)
    assert.doesNotMatch(fn,/account_status'<> 'active'|account_status'<>'active'/)
  }
})

test('managed children require a canonical adult role and explicit guardian declaration',()=>{
  assert.match(child,/coalesce\(v_access->>'role',''\) not in \('parent','teacher'\)/)
  assert.match(child,/p_guardian_confirmed is distinct from true/)
  assert.match(child,/email_confirmed_at is not null/)
  assert.match(child,/auth_user_id=v_uid and kind='person' for update/)
  assert.match(child,/Managed learner limit reached/)
  assert.match(child,/p_guardian_confirmed boolean default false/)
})

test('privileged RPC execute grants remain authenticated-only',()=>{
  assert.match(migration,/revoke all on function public\.vs_claim_my_username\(text\) from public,anon/)
  assert.match(migration,/grant execute on function public\.vs_claim_my_username\(text\) to authenticated/)
  assert.match(migration,/revoke all on function public\.vs_create_managed_learner\(text,text,text,boolean\) from public,anon/)
  assert.match(migration,/grant execute on function public\.vs_create_managed_learner\(text,text,text,boolean\) to authenticated/)
})

test('inactive managed-child route has no visible parent screen',()=>{
  assert.match(parent,/if \(!unifiedIdentityEnabled\) notFound\(\)/)
})
