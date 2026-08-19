import fs from 'node:fs'

const migration = fs.readFileSync(
  'supabase/migrations/20260819214200_task8_postmerge_production_authorization_reconciliation.sql',
  'utf8',
)
const canaryInvoker = fs.readFileSync(
  'supabase/functions/content-factory-r2-canary-invoker/index.ts',
  'utf8',
)

const fail = (message) => {
  throw new Error(`TASK8_POSTMERGE_CONTRACT: ${message}`)
}
const mustContain = (text, needle, message) => {
  if (!text.includes(needle)) fail(message)
}
const mustNotContain = (text, needle, message) => {
  if (text.includes(needle)) fail(message)
}

mustContain(
  migration,
  'alter default privileges for role postgres in schema public',
  'postgres default privileges must be hardened',
)
mustContain(
  migration,
  'revoke select, insert, update, delete, truncate, references, trigger',
  'future postgres-created tables must be opt-in for ordinary clients',
)
mustContain(
  migration,
  'revoke usage, select, update on sequences from anon, authenticated',
  'future public sequences must not be automatically exposed to ordinary clients',
)
mustContain(
  migration,
  'revoke execute on functions from public, anon, authenticated',
  'future public functions must require explicit EXECUTE grants',
)
mustContain(
  migration,
  "current_setting('server_version_num')::integer >= 170000",
  'PostgreSQL 17 MAINTAIN cleanup must be version-gated for PostgreSQL 15 reconstruction',
)
mustContain(
  migration,
  "execute 'revoke maintain on all tables in schema public from anon, authenticated'",
  'PostgreSQL 17 existing relations must lose ordinary-client MAINTAIN',
)
mustContain(
  migration,
  'revoke truncate, references, trigger\n  on all tables in schema public\n  from anon, authenticated',
  'all current public relation types must lose ordinary-client structural privileges',
)
mustContain(
  migration,
  'revoke update on all sequences in schema public from anon, authenticated',
  'all current public sequences must lose ordinary-client UPDATE',
)

for (const policy of [
  'storage_objects_homework_photos_staff_select',
  'homework_photos_school_staff_select',
  'homework_photos_staff_read',
]) {
  mustContain(
    migration,
    `drop policy if exists ${policy} on storage.objects`,
    `${policy} must remain removed`,
  )
}

mustContain(
  migration,
  "pg_has_role(current_user, 'supabase_admin', 'member')",
  'managed-role defaults may only be changed through legitimate role authority',
)
mustNotContain(
  migration,
  'grant supabase_admin to',
  'Task 8 must never manufacture supabase_admin membership for default-ACL mutation',
)
mustContain(
  migration,
  "raise exception 'TASK8_POSTMERGE: % public relations retain ordinary-client structural privileges'",
  'migration must fail closed if structural relation privileges survive',
)
mustContain(
  migration,
  "raise exception 'TASK8_POSTMERGE: % public sequences retain ordinary-client UPDATE'",
  'migration must fail closed if sequence UPDATE survives',
)
mustContain(
  migration,
  "raise exception 'TASK8_POSTMERGE: legacy homework Storage policy survived cleanup'",
  'migration must fail closed if the legacy Storage bypass survives',
)

mustContain(
  canaryInvoker,
  'req.headers.get("authorization") === `Bearer ${SERVICE_ROLE_KEY}`',
  'internal canary invocation must require exact service authority',
)
mustContain(
  canaryInvoker,
  'if (!hasInternalAuthority(req)) return json(401',
  'missing or wrong internal canary authorization must fail closed',
)
mustContain(
  canaryInvoker,
  'const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY',
  'canary invoker must use the service client only after its trust boundary',
)
const authorityCheck = canaryInvoker.indexOf('if (!hasInternalAuthority(req)) return json(401')
const elevatedClient = canaryInvoker.indexOf('const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY')
if (authorityCheck === -1 || elevatedClient === -1 || authorityCheck > elevatedClient) {
  fail('internal canary authorization must be established before service-role elevation')
}
mustNotContain(
  canaryInvoker,
  'searchParams.get(',
  'internal canary secrets or capability checks must never come from query parameters',
)

console.log('TASK8_POSTMERGE_CONTRACT PASS')
