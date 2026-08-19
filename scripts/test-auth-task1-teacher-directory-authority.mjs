import fs from 'node:fs'
import assert from 'node:assert/strict'

const migration = fs.readFileSync('supabase/migrations/20260819224500_auth_teacher_directory_connect_authority_guard.sql', 'utf8')

assert.match(migration, /create or replace function public\.connect_teacher_to_directory_school/i)
assert.match(migration, /security definer/i)
assert.match(migration, /set search_path = public, auth, extensions, pg_temp/i)
assert.match(migration, /v_uid uuid := auth\.uid\(\)/i)
assert.match(migration, /select p\.role::text, p\.account_status::text, coalesce\(p\.is_anonymized, false\)/i)
assert.match(migration, /v_role is distinct from 'teacher'/i)
assert.match(migration, /v_status is distinct from 'active'/i)
assert.match(migration, /or v_anonymized/i)
assert.match(migration, /teacher_authority_required/i)
assert.match(migration, /reviewed_by is not null/i)
assert.match(migration, /reviewed_at is not null/i)
assert.match(migration, /revoke all on function public\.connect_teacher_to_directory_school\(uuid,text\) from public, anon, service_role/i)
assert.match(migration, /grant execute on function public\.connect_teacher_to_directory_school\(uuid,text\) to authenticated/i)

console.log('Task 1 teacher directory authority regression: PASS')
