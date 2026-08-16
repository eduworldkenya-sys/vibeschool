import fs from 'node:fs'
import path from 'node:path'

const migrationPath = 'supabase/migrations/20260816193000_auth_identity_reconciliation.sql'
const migration = fs.readFileSync(migrationPath, 'utf8')
const failures = []
const requireText = (name, source, token) => {
  if (!source.includes(token)) failures.push(`${name}: missing ${token}`)
}
const forbidText = (name, source, token) => {
  if (source.includes(token)) failures.push(`${name}: forbidden ${token}`)
}

requireText('reconciliation migration', migration, 'auth_identity_reconciliation_findings')
requireText('reconciliation migration', migration, 'AUTH_PROFILE_MISSING')
requireText('reconciliation migration', migration, 'STUDENT_DOMAIN_MISSING')
requireText('reconciliation migration', migration, 'ADMIN_MEMBERSHIP_MISSING')
requireText('reconciliation migration', migration, 'MULTI_PROVIDER_IDENTITY')
requireText('reconciliation migration', migration, 'repair_missing_neutral_profile')
requireText('neutral recovery', migration, "values(p_user_id,coalesce(v_user.raw_user_meta_data->>'full_name',''),null,'active'::account_status)")
requireText('neutral recovery', migration, "jsonb_build_object('role',null,'authority_granted',false)")
requireText('admin fail closed', migration, "p.role='admin' and not exists(")
requireText('admin fail closed', migration, "then 'ADMIN_MEMBERSHIP_MISSING'")
requireText('operator reason codes', migration, "'reason_code'")
requireText('service boundary', migration, 'grant execute on function public.refresh_auth_identity_reconciliation() to service_role;')
requireText('service boundary', migration, 'grant execute on function public.repair_missing_neutral_profile(uuid) to service_role;')
requireText('migration contract', migration, '-- access: service-only public.auth_identity_reconciliation_findings')
requireText('migration contract', migration, '-- authorization-test: public.auth_identity_reconciliation_findings')
requireText('migration contract', migration, '-- access: service-only public.auth_identity_reconciliation_actions')
requireText('migration contract', migration, '-- authorization-test: public.auth_identity_reconciliation_actions')
forbidText('reconciliation migration', migration, "raw_user_meta_data->>'role'")
forbidText('reconciliation migration', migration, "raw_app_meta_data->>'role'")

// Historical scripts that directly rewrite authentication/session code must not
// reappear at repository root. Unrelated legacy maintenance scripts are outside
// this auth contract and are handled separately.
const forbiddenAuthPatchScripts = new Set([
  'signup_fix.py',
  'session_fix.py',
  'auth_fix.py',
  'auth_patch.py',
  'profile_auth_fix.py',
])
for (const name of fs.readdirSync('.')) {
  if (forbiddenAuthPatchScripts.has(name.toLowerCase())) {
    failures.push(`historical auth patch script is forbidden: ${name}`)
  }
}

if (!fs.existsSync(path.dirname(migrationPath))) {
  failures.push('supabase migrations directory missing')
}

if (failures.length) {
  console.error('Auth identity reconciliation contract failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Auth identity reconciliation contract passed.')
