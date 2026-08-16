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
forbidText('reconciliation migration', migration, "raw_user_meta_data->>'role'")
forbidText('reconciliation migration', migration, "raw_app_meta_data->>'role'")

const rootFiles = fs.readdirSync('.')
const forbiddenPatchScripts = rootFiles.filter((name) => {
  const lower = name.toLowerCase()
  return lower.endsWith('.py') && /(fix|patch|signup|auth|profile)/.test(lower)
})
if (forbiddenPatchScripts.length) {
  failures.push(`root patch scripts are forbidden: ${forbiddenPatchScripts.join(', ')}`)
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
