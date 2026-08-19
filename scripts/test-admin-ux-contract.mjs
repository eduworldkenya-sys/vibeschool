import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function exists(path) {
  return fs.existsSync(new URL(`../${path}`, import.meta.url))
}

const layout = read('app/admin/layout.tsx')
const hub = read('app/admin/page.tsx')
const error = read('app/admin/error.tsx')
const loading = read('app/admin/loading.tsx')
const portalState = read('components/shared/PortalState.tsx')

const requiredRoutes = [
  'app/admin/page.tsx',
  'app/admin/students/page.tsx',
  'app/admin/staff/page.tsx',
  'app/admin/academics/page.tsx',
  'app/admin/attendance/page.tsx',
  'app/admin/communication/page.tsx',
  'app/admin/reports/page.tsx',
  'app/admin/settings/page.tsx',
]

const checks = [
  ['school context is resolved from authorized role binding', layout.includes('selectTwinRoleBinding(authority, "admin")') && layout.includes('binding.schoolId')],
  ['school identity is persistent in shell', layout.includes('profile?.schoolName') && layout.includes('SchoolAvatar')],
  ['admin shell has explicit sign-out action', layout.includes('handleSignOut') && layout.includes('SvgSignOut')],
  ['mobile bottom navigation exists', layout.includes('BOTTOM_NAV') && layout.includes('position: "fixed", bottom: 0')],
  ['mobile navigation exposes a secondary More entry', layout.includes('label: "More"') && layout.includes('setSidebar(true)')],
  ['dashboard is school-scoped', hub.includes('.eq("school_id", sid)')],
  ['dashboard starts from authorized school scope', hub.includes('selectTwinRoleBinding(authority, "admin")') && hub.includes('Admin portal has no authorized school scope')],
  ['dashboard has attention/briefing model', hub.includes('interface Briefing') && hub.includes('const briefings')],
  ['attendance routes from actionable briefing', hub.includes('href: "/admin/attendance"')],
  ['shared loading state is wired', loading.includes('PortalLoading') && portalState.includes('PortalLoading')],
  ['recoverable error state is wired', error.includes('PortalError') && portalState.includes('Retry') && portalState.includes('Return to workspace')],
  ['core admin routes exist', requiredRoutes.every(exists)],
  ['no raw UUID wording is used in the admin shell', !layout.match(/\bUUID\b/i)],
]

const failed = checks.filter(([, ok]) => !ok)
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)

if (failed.length) {
  console.error(`Admin UX contract failed: ${failed.map(([name]) => name).join(', ')}`)
  process.exit(1)
}

console.log(`Admin UX contract passed (${checks.length}/${checks.length}).`)
