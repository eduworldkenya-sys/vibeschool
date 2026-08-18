import fs from 'node:fs'

const migrationPath = 'supabase/migrations/20260818082800_student_twin_date_results_skills.sql'
const clientPath = 'lib/student/twinCore.ts'
const failures = []

function requireText(source, value, reason) {
  if (!source.includes(value)) failures.push(`${reason} (missing ${JSON.stringify(value)})`)
}

function forbidText(source, pattern, reason) {
  if (pattern.test(source)) failures.push(reason)
}

if (!fs.existsSync(migrationPath)) failures.push(`${migrationPath}: migration missing`)
if (!fs.existsSync(clientPath)) failures.push(`${clientPath}: client adapter missing`)

const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : ''
const client = fs.existsSync(clientPath) ? fs.readFileSync(clientPath, 'utf8') : ''

requireText(migration, 'student_twin_date_results_route', 'Deterministic date/results RPC must exist')
requireText(migration, "time zone 'Africa/Nairobi'", 'Current date must use VibeSchool Kenya local time')
requireText(migration, "'intent', 'current_date'", 'Current-date intent must be explicit')
requireText(migration, "'intent', 'results_release_status'", 'Results-release intent must be explicit')
requireText(migration, 'public.exq_list_my_results()', 'Results status must reuse learner-authorized released-results truth')
requireText(migration, "'I do not see any results released to you yet.'", 'No-result answer must not guess about teacher marking state')
requireText(migration, "'requires_ai', false", 'Both skills must remain AI-independent')
requireText(migration, 'revoke all on function public.student_twin_date_results_route(text) from public, anon;', 'RPC must not be anonymously executable')
requireText(migration, 'grant execute on function public.student_twin_date_results_route(text) to authenticated, service_role;', 'RPC execution must be explicit')

forbidText(migration, /\b(openai|anthropic|claude|gemini|twin-chat)\b/i, 'Date/results migration must not introduce a generative runtime dependency')

requireText(client, "rpc<Json>('student_twin_date_results_route'", 'Student Twin must check deterministic date/results facts first')
requireText(client, "rpc<Json>('student_twin_core_route'", 'Existing Twin router must remain the fallback')
requireText(client, 'if (factRoute.handled) return factRoute', 'Handled date/results queries must stop before fallback routing')
requireText(client, 'if (!factError)', 'Missing forward migration must fail soft rather than outage the existing Twin')

if (failures.length) {
  console.error('Student Twin Date + Results Contract: FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Student Twin Date + Results Contract: PASS')
console.log('Current date is Nairobi-local and deterministic.')
console.log('Results status reads only learner-authorized released assessment results.')
