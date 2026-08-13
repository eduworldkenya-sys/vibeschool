import fs from 'node:fs'

const middleware = fs.readFileSync('middleware.ts', 'utf8')
const welcome = fs.readFileSync('app/welcome/page.tsx', 'utf8')
const sitemap = fs.readFileSync('app/sitemap.ts', 'utf8')
const robots = fs.readFileSync('app/robots.ts', 'utf8')

const checks = [
  [middleware.includes("loginUrl.pathname = '/login'"), 'protected routes redirect signed-out users to /login'],
  [middleware.includes("pathname === '/'"), 'root has explicit entry handling'],
  [middleware.includes("welcomeUrl.pathname = '/welcome'"), 'signed-out root renders the public welcome experience'],
  [middleware.includes("pathname === '/login'"), 'login has explicit entry handling'],
  [welcome.includes('href="/login"'), 'public landing exposes a dedicated sign-in path'],
  [welcome.includes('/login?mode=signup&role=teacher'), 'public landing exposes a direct conversion path'],
  [welcome.includes("alternates: { canonical: '/' }"), 'public landing declares the root canonical URL'],
  [sitemap.includes('{ url: SITE_URL,'), 'sitemap includes the canonical root'],
  [robots.includes("'/admin/'") && robots.includes("'/teacher/'") && robots.includes("'/parent/'"), 'robots keeps private role workspaces out of crawl paths'],
]

let failed = false
for (const [ok, description] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${description}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
