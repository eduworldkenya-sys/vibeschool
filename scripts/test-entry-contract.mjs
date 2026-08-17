import fs from 'node:fs'

const middleware = fs.readFileSync('middleware.ts', 'utf8')
const home = fs.readFileSync('app/page.tsx', 'utf8')
const welcome = fs.readFileSync('app/welcome/page.tsx', 'utf8')
const sitemap = fs.readFileSync('app/sitemap.ts', 'utf8')
const robots = fs.readFileSync('app/robots.ts', 'utf8')
const teacherSignup = fs.readFileSync('app/signup/teacher/page.tsx', 'utf8')
const parentSignup = fs.readFileSync('app/signup/parent/page.tsx', 'utf8')
const studentSignup = fs.readFileSync('app/signup/student/page.tsx', 'utf8')
const studentAccountRoute = fs.readFileSync('app/api/create-student-account/route.ts', 'utf8')
const roleLogin = fs.readFileSync('app/login/[role]/page.tsx', 'utf8')

const checks = [
  [middleware.includes("loginUrl.pathname = '/login'"), 'protected routes redirect signed-out users to /login'],
  [!middleware.includes("welcomeUrl.pathname = '/welcome'") && home.includes('<PublicHeader') && home.includes('id="main-content"'), 'signed-out root renders the canonical public homepage directly'],
  [welcome.includes('href="/login"'), 'legacy public landing exposes generic sign in'],
  [welcome.includes('/signup/teacher'), 'teacher leads have a direct signup path'],
  [welcome.includes('/login/student') && welcome.includes('/login/parent'), 'learner and parent leads preserve role intent'],

  // Signup role is claimed through a server-owned RPC; user-editable metadata is not authority.
  [teacherSignup.includes("claim_my_initial_role") && teacherSignup.includes("p_role: 'teacher'") && !teacherSignup.includes("data: { role: 'teacher'"), 'teacher signup creates the teacher role through the authority boundary'],
  [teacherSignup.includes("get_my_onboarding_state") && teacherSignup.includes('router.replace(destination)'), 'teacher signup continues through the canonical onboarding resolver'],
  [parentSignup.includes("claim_my_initial_role") && parentSignup.includes("p_role: 'parent'") && !parentSignup.includes("data: { role: 'parent'"), 'parent signup creates the parent role through the authority boundary'],
  [parentSignup.includes("get_my_onboarding_state") && parentSignup.includes('router.replace(destination)'), 'parent signup continues through the canonical onboarding resolver'],

  [studentSignup.includes("'/api/create-student-account'"), 'learner signup uses the server-side account creation boundary'],
  [studentAccountRoute.includes(".from('student_claim_codes')") && studentAccountRoute.includes(".eq('role', 'student')"), 'learner claim is validated server-side'],
  [studentAccountRoute.includes('parent_linked_at') && studentAccountRoute.includes(".from('parent_student_links')") && studentAccountRoute.includes("code: 'guardian_required'"), 'learner credentials require an established parent or guardian connection'],
  [studentSignup.includes('guardianRequired') && studentSignup.includes('Parent or guardian connects'), 'learner UX explains the guardian-first activation path'],
  [roleLogin.includes("href=\"/signup/student\"") && roleLogin.includes("href=\"/signup/parent\""), 'focused sign in connects new learners and parents to direct signup'],

  // The selected login page is presentation/intent only. DB access state + onboarding own routing.
  [roleLogin.includes("get_my_auth_access_state") && roleLogin.includes("get_my_onboarding_state") && roleLogin.includes('roleCanVisit(actualRole'), 'focused sign in verifies authoritative role and onboarding state before routing'],
  [roleLogin.includes("student: { label: 'Learner', destination: '/student', email: false }"), 'learner sign in uses admission number and PIN'],
  [roleLogin.includes("parent: { label: 'Parent', destination: '/parent', email: true }"), 'parent sign in uses the focused parent path'],
  [home.includes("alternates:{canonical:'/'}") || home.includes("alternates: { canonical: '/' }"), 'canonical public homepage declares the root canonical URL'],
  [sitemap.includes('{ url: SITE_URL,'), 'sitemap includes the canonical root'],
  [robots.includes("'/signup/'") && robots.includes("'/teacher/'") && robots.includes("'/student/'"), 'robots keeps auth and private workspaces out of crawl paths'],
]

let failed = false
for (const [ok, description] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${description}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
