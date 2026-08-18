import fs from 'node:fs'

const failures = []

function read(path) {
  if (!fs.existsSync(path)) {
    failures.push(`${path}: missing portal authority surface`)
    return ''
  }
  return fs.readFileSync(path, 'utf8')
}
function requireText(path, source, value, reason) {
  if (!source.includes(value)) failures.push(`${path}: ${reason} (missing ${JSON.stringify(value)})`)
}
function forbidText(path, source, value, reason) {
  if (source.includes(value)) failures.push(`${path}: ${reason} (found ${JSON.stringify(value)})`)
}

const core = read('lib/twin/core.ts')
requireText('lib/twin/core.ts', core, "membership.role === 'teacher'", 'Teacher role must start from current school membership')
requireText('lib/twin/core.ts', core, "relationship: 'teacher_school_membership'", 'Teacher role binding must describe membership as the authority relationship')
requireText('lib/twin/core.ts', core, 'assignment_count: assignments.length', 'Teacher class assignments must remain scoped evidence/capability data')
forbidText('lib/twin/core.ts', core, 'if (assignments.length > 0)', 'A valid Teacher membership must not disappear merely because no class has been assigned yet')

const admin = read('app/admin/layout.tsx')
requireText('app/admin/layout.tsx', admin, 'getTwinAuthorityContext', 'Admin subroutes must re-resolve authenticated relationship authority')
requireText('app/admin/layout.tsx', admin, 'selectTwinRoleBinding(authority, "admin")', 'Admin subroutes must select one explicit authorized school scope')
requireText('app/admin/layout.tsx', admin, 'authority.userId !== user.id', 'Admin layout must reject identity drift during role resolution')
forbidText('app/admin/layout.tsx', admin, 'p.role !== "admin"', 'Admin subroutes must not use profiles.role as the authority root')
forbidText('app/admin/layout.tsx', admin, 'full_name, school_id, role', 'Admin layout must not use the legacy profile school/role tuple')
forbidText('app/admin/layout.tsx', admin, 'if (p.school_id)', 'Admin layout must not derive school scope from profiles.school_id')

const hq = read('app/hq/layout.tsx')
requireText('app/hq/layout.tsx', hq, 'hqSupabase.auth.getUser()', 'HQ portal must require its authenticated session')
requireText('app/hq/layout.tsx', hq, 'hq_check_owner_access', 'HQ portal must perform owner authority verification on protected routes')
requireText('app/hq/layout.tsx', hq, 'signOut({ scope: "local" })', 'HQ denial must clear only the local isolated HQ session')
requireText('app/hq/layout.tsx', hq, 'setAllowed(false)', 'HQ protected navigation must fail closed while checking authority')

if (failures.length) {
  console.error('Twin Portal Authority: FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Twin Portal Authority: PASS')
console.log('Teacher membership, Admin subroutes and HQ owner boundaries are fail-closed and relationship-derived.')
