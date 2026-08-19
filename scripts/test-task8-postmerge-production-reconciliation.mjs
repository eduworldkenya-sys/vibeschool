import fs from 'node:fs'

const migration = fs.readFileSync(
  'supabase/migrations/20260819214200_task8_postmerge_production_authorization_reconciliation.sql',
  'utf8',
)

const fail = (message) => {
  throw new Error(`TASK8_POSTMERGE_CONTRACT: ${message}`)
}
const mustContain = (needle, message) => {
  if (!migration.includes(needle)) fail(message)
}
const mustNotContain = (needle, message) => {
  if (migration.includes(needle)) fail(message)
}

mustContain(
  'alter default privileges for role postgres in schema public',
  'postgres default privileges must be hardened',
)
mustContain(
  'revoke select, insert, update, delete, truncate, references, trigger',
  'future postgres-created tables must be opt-in for ordinary clients',
)
mustContain(
  'revoke usage, select, update on sequences from anon, authenticated',
  'future public sequences must not be automatically exposed to ordinary clients',
)
mustContain(
  'revoke execute on functions from public, anon, authenticated',
  'future public functions must require explicit EXECUTE grants',
)
mustContain(
  "current_setting('server_version_num')::integer >= 170000",
  'PostgreSQL 17 MAINTAIN cleanup must be version-gated for PostgreSQL 15 reconstruction',
)
mustContain(
  "execute 'revoke maintain on all tables in schema public from anon, authenticated'",
  'PostgreSQL 17 existing relations must lose ordinary-client MAINTAIN',
)
mustContain(
  'revoke truncate, references, trigger\n  on all tables in schema public\n  from anon, authenticated',
  'all current public relation types must lose ordinary-client structural privileges',
)
mustContain(
  'revoke update on all sequences in schema public from anon, authenticated',
  'all current public sequences must lose ordinary-client UPDATE',
)

for (const policy of [
  'storage_objects_homework_photos_staff_select',
  'homework_photos_school_staff_select',
  'homework_photos_staff_read',
]) {
  mustContain(
    `drop policy if exists ${policy} on storage.objects`,
    `${policy} must remain removed`,
  )
}

mustContain(
  "pg_has_role(current_user, 'supabase_admin', 'member')",
  'managed-role defaults may only be changed through legitimate role authority',
)
mustNotContain(
  'grant supabase_admin to',
  'Task 8 must never manufacture supabase_admin membership for default-ACL mutation',
)
mustContain(
  "raise exception 'TASK8_POSTMERGE: % public relations retain ordinary-client structural privileges'",
  'migration must fail closed if structural relation privileges survive',
)
mustContain(
  "raise exception 'TASK8_POSTMERGE: % public sequences retain ordinary-client UPDATE'",
  'migration must fail closed if sequence UPDATE survives',
)
mustContain(
  "raise exception 'TASK8_POSTMERGE: legacy homework Storage policy survived cleanup'",
  'migration must fail closed if the legacy Storage bypass survives',
)

console.log('TASK8_POSTMERGE_CONTRACT PASS')
