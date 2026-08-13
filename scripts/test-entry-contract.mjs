import fs from 'node:fs'

const middleware = fs.readFileSync('middleware.ts', 'utf8')
const welcome = fs.readFileSync('app/welcome/page.tsx', 'utf8')
const sitemap = fs.readFileSync('app/sitemap.ts', 'utf8')
const robots = fs.readFileSync('app/robots.ts', 'utf8')
const teacherSignup = fs.readFileSync('app/signup/teacher/page.tsx', 'utf8')
const studentSignup = fs.readFileSync('app/signup/student/page.tsx', 'utf8')
const roleLogin = fs.readFileSync('app/login/[role]/page.tsx', 'utf8')

const checks = [
  [middleware.includes("loginUrl.pathname = '/login'"), 'protected routes redirect signed-out users to /login'],
  [middleware.includes("welcomeUrl.pathname = '/welcome'"), 'signed-out root renders the public welcome experience'],
  [welcome.includes('href="/login"'), 'public landing exposes generic sign in'],
  [welcome.includes('/signup/teacher'), 'teacher leads have a direct signup path'],
  [welcome.includes('/login/student') && welcome.includes('/login/parent'), 'learner and parent leads preserve role intent'],
  [teacherSignup.includes("role: 'teacher'"), 'teacher signup creates the teacher role'],
  [teacherSignup.includes("router.replace('/teacher/onboarding/school')"), 'teacher signup continues into school onboarding'],
  [studentSignup.includes("redeem_student_claim"), 'learner signup validates and redeems the teacher claim'],
  [studentSignup.includes("'/api/create-student-account'"), 'learner signup uses the existing server-side account creation boundary'],
  [roleLogin.includes("href=\"/signup/student\""), 'new learners move directly from sign in to claim signup'],
  [roleLogin.includes("actualRole !== expectedRole"), 'focused sign in verifies the authenticated role before routing'],
  [roleLogin.includes("student: { label: 'Learner', destination: '/student', email: false }"), 'learner sign in uses admission number and PIN'],
  [roleLogin.includes("parent: { label: 'Parent', destination: '/parent', email: true }"), 'parent sign in uses the focused parent path'],
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
