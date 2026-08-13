import fs from 'node:fs'

const middleware = fs.readFileSync('middleware.ts', 'utf8')
const welcome = fs.readFileSync('app/welcome/page.tsx', 'utf8')
const sitemap = fs.readFileSync('app/sitemap.ts', 'utf8')
const robots = fs.readFileSync('app/robots.ts', 'utf8')
const teacherSignup = fs.readFileSync('app/signup/teacher/page.tsx', 'utf8')

const checks = [
  [middleware.includes("loginUrl.pathname = '/login'"), 'protected routes redirect signed-out users to /login'],
  [middleware.includes("welcomeUrl.pathname = '/welcome'"), 'signed-out root renders the public welcome experience'],
  [welcome.includes('href="/login"'), 'public landing exposes sign in'],
  [welcome.includes('/signup/teacher'), 'teacher leads have a direct signup path'],
  [teacherSignup.includes("role: 'teacher'"), 'teacher signup creates the teacher role'],
  [teacherSignup.includes("router.replace('/teacher/onboarding/school')"), 'teacher signup continues into school onboarding'],
  [welcome.includes("alternates: { canonical: '/' }"), 'public landing declares the root canonical URL'],
  [sitemap.includes('{ url: SITE_URL,'), 'sitemap includes the canonical root'],
  [robots.includes("'/signup/'") && robots.includes("'/teacher/'") && robots.includes("'/student/'"), 'robots keeps auth and private workspaces out of crawl paths'],
]

let failed = false
for (const [ok, description] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${description}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
