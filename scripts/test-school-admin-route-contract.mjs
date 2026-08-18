import fs from 'node:fs'
import path from 'node:path'

const root = 'app/admin'
const failures = []
const routeFiles = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(tsx|ts)$/.test(entry.name)) routeFiles.push(full)
  }
}

walk(root)

const literalRoutePattern = /(?:href\s*[:=]\s*|router\.push\(\s*|router\.replace\(\s*|window\.location\.(?:assign|replace)\(\s*)["'`]((?:\/admin)(?:\/[^"'`?#$]*)?)/g
const discovered = new Map()

for (const file of routeFiles) {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(literalRoutePattern)) {
    const route = match[1].replace(/\/+$/, '') || '/admin'
    if (!discovered.has(route)) discovered.set(route, [])
    discovered.get(route).push(file)
  }
}

function routeExists(route) {
  if (route === '/admin') return fs.existsSync('app/admin/page.tsx')
  const relative = route.replace(/^\/admin\/?/, '')
  const direct = path.join('app/admin', relative, 'page.tsx')
  if (fs.existsSync(direct)) return true

  const parts = relative.split('/').filter(Boolean)
  let candidates = ['app/admin']
  for (const segment of parts) {
    const next = []
    for (const base of candidates) {
      const exact = path.join(base, segment)
      if (fs.existsSync(exact) && fs.statSync(exact).isDirectory()) next.push(exact)
      if (fs.existsSync(base)) {
        for (const child of fs.readdirSync(base, { withFileTypes: true })) {
          if (child.isDirectory() && /^\[[^\]]+\]$/.test(child.name)) next.push(path.join(base, child.name))
        }
      }
    }
    candidates = [...new Set(next)]
    if (!candidates.length) return false
  }
  return candidates.some(dir => fs.existsSync(path.join(dir, 'page.tsx')))
}

for (const [route, files] of discovered) {
  if (!routeExists(route)) failures.push(`${route} referenced by ${[...new Set(files)].join(', ')} has no Admin page route`)
}

const criticalRoutes = [
  '/admin',
  '/admin/students',
  '/admin/teachers',
  '/admin/attendance',
  '/admin/academics',
  '/admin/academics/gradebook',
  '/admin/timetable',
  '/admin/communication',
  '/admin/notifications',
  '/admin/reports',
  '/admin/settings',
  '/admin/settings/school',
  '/admin/settings/classes',
  '/admin/settings/subjects',
  '/admin/settings/term',
  '/admin/profile',
]
for (const route of criticalRoutes) {
  if (!routeExists(route)) failures.push(`critical Admin route missing: ${route}`)
}

if (failures.length) {
  console.error('School Admin route contract: FAIL')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('School Admin route contract: PASS')
console.log(`Checked ${discovered.size} literal Admin navigation targets and ${criticalRoutes.length} critical journey routes.`)
