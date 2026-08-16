import fs from 'node:fs'

function read(path) { return fs.readFileSync(path, 'utf8') }
function assert(ok, label) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed = true }
let failed = false

const landing = read('app/pathways/page.tsx')
const check = read('app/pathways/check/page.tsx')
const checkRules = read('lib/pathways/quickCheck.ts')
const continuation = read('app/pathways/continue/page.tsx')
const continuationLayout = read('app/pathways/continue/layout.tsx')
const roleLogin = read('app/login/[role]/page.tsx')
const studentSignup = read('app/signup/student/page.tsx')
const profile = read('app/student/profile/page.tsx')
const parentSupport = read('app/parent/pathways/page.tsx')
const teacherSupport = read('app/teacher/pathways/page.tsx')
const graphMigration = read('supabase/migrations/20260816070000_pathways_canonical_domain.sql')
const passportMigration = read('supabase/migrations/20260816071000_pathways_passport_and_adoption.sql')
const schoolMigration = read('supabase/migrations/20260816072000_pathways_public_school_read.sql')
const supportMigration = read('supabase/migrations/20260816073000_pathways_support_projections.sql')
const funnelMigration = read('supabase/migrations/20260816074000_pathways_privacy_safe_funnel.sql')
const telemetry = read('lib/pathways/telemetry.ts')
const sitemap = read('app/sitemap.ts')
const robots = read('app/robots.ts')

assert(landing.includes('Answer first. Sign in later.'), 'public Pathways promises value before authentication')
assert(landing.includes('href="/pathways/check"'), 'public Pathways exposes the free Quick Check')
assert(check.includes('No login required') && check.includes('Save my pathway and continue'), 'Quick Check is free before the save trigger')
assert(!check.includes("from '@/lib/supabase'") && !check.includes('.from(') && !check.includes('.rpc('), 'Quick Check has no direct database dependency before consent')
assert(check.includes('localStorage') || check.includes('window.localStorage'), 'anonymous Quick Check persists locally')
assert(checkRules.includes("QUICK_CHECK_RULE_VERSION = 'pathways-quick-v1'"), 'Quick Check scoring has an explicit version')
assert((checkRules.match(/id: '/g) ?? []).length === 6, 'Quick Check v1 has exactly six decision prompts')
assert(checkRules.includes('calculateQuickCheck') && checkRules.includes('rankQuickCheck'), 'Quick Check scoring/ranking is centralized and deterministic')
assert(check.includes('close = scores[leader] - scores[runnerUp] <= 2'), 'Quick Check exposes close-result uncertainty instead of forcing false precision')
assert(continuation.includes("get_my_role") && continuation.includes("role !== 'student'"), 'only learner accounts may enter Passport adoption flow')
assert(continuation.includes('adoptQuickCheck') && continuation.includes('idempotency'), 'save bridge uses the idempotent learner adoption boundary')
assert(continuationLayout.includes('index: false') && continuationLayout.includes('follow: false'), 'private continuation bridge is noindex/nofollow')
assert(roleLogin.includes("get_my_onboarding_state") && roleLogin.includes("state === 'ready' && next"), 'password sign-in cannot use continuation to bypass onboarding')
assert(studentSignup.includes("get_my_onboarding_state") && studentSignup.includes("state === 'ready' && next"), 'learner signup cannot use continuation to bypass onboarding')
assert(profile.includes('My Pathway Passport') && profile.includes('getPathwayPassport'), 'Pathway Passport projects into canonical Student Profile')

for (const table of ['pathway_sources','pathways','pathway_tracks','pathway_subject_combinations','pathway_combination_subjects','pathway_careers','pathway_career_links','pathway_school_offerings']) {
  assert(graphMigration.includes(`create table public.${table}`), `canonical graph creates ${table}`)
  assert(graphMigration.includes(`alter table public.${table} enable row level security`), `${table} is RLS-enabled`)
}
assert(graphMigration.includes('references public.subjects(id)'), 'Pathways combinations reuse canonical subject identity')
assert(graphMigration.includes('references public.schools(id)'), 'Pathways offerings reuse canonical school identity')
assert(graphMigration.includes("offering_status = 'verified'") && graphMigration.includes('verified_at is not null'), 'public offering policy requires explicit verification evidence')
assert(!graphMigration.includes('create table public.pathway_students'), 'Pathways does not create a duplicate learner identity')
assert(!graphMigration.includes('create table public.pathway_schools'), 'Pathways does not create a duplicate school identity')

assert(passportMigration.includes('references public.students(id)'), 'Pathway Passport references canonical learner identity')
assert(passportMigration.includes('unique(student_id, idempotency_key)'), 'learner decision writes are idempotent')
assert(passportMigration.includes("where profile_id = caller and deleted_at is null"), 'adoption resolves the authenticated canonical learner')
assert(passportMigration.includes('grant execute on function public.student_adopt_pathway_quick_check') && !passportMigration.includes('to anon;\ngrant execute on function public.student_adopt_pathway_quick_check'), 'anonymous users cannot invoke Passport adoption')

assert(schoolMigration.includes('security definer'), 'public school search uses a bounded server-side projection')
assert(schoolMigration.includes("s.status = 'active'"), 'public school finder returns active canonical schools only')
assert(!schoolMigration.includes('from public.schools_directory'), 'public Pathways school finder excludes unmatched directory candidates')
assert(schoolMigration.includes("o.offering_status = 'verified'") && schoolMigration.includes('o.verified_at is not null'), 'pathway-filtered school results require verified offering evidence')
assert(schoolMigration.includes('limit greatest(1, least(coalesce(p_limit,30),50))'), 'anonymous school search is bounded')

assert(supportMigration.includes("caller_role = 'parent'") && supportMigration.includes('parent_student_links'), 'parent support requires existing parent-learner relationship')
assert(supportMigration.includes("caller_role = 'teacher'") && supportMigration.includes('teacher_classes'), 'teacher support requires active class authority')
assert(!supportMigration.includes("'answers'"), 'support projection does not expose raw Quick Check answers')
assert(supportMigration.includes('revoke all on function public.pathways_get_supported_learner_passport(uuid) from public, anon'), 'anonymous users cannot invoke support projection')
assert(parentSupport.includes('read-only support view') && teacherSupport.includes('read-only'), 'parent and teacher UX communicates non-owner support authority')

assert(funnelMigration.includes('create table public.pathways_funnel_events'), 'Pathways has a dedicated privacy-safe funnel plane')
assert(funnelMigration.includes('revoke all on table public.pathways_funnel_events from public, anon, authenticated'), 'raw funnel table is not directly client-readable/writable')
for (const forbidden of ['answers','marks','date_of_birth','school_id','pathway_result']) {
  const columnPattern = new RegExp(`^\\s*${forbidden}\\s+(uuid|text|jsonb|numeric|integer|boolean|date|timestamp|timestamptz)\\b`, 'im')
  assert(!columnPattern.test(funnelMigration), `funnel schema excludes ${forbidden} column`)
}
assert(funnelMigration.includes('unsupported_pathways_event'), 'funnel RPC enforces an event whitelist')
assert(funnelMigration.includes('events_today >= 200'), 'anonymous event volume is bounded per session')
assert(telemetry.includes('p_anonymous_session_id'), 'client telemetry uses a random anonymous session id rather than learner answers')

assert(sitemap.includes('`${SITE_URL}/pathways`') && sitemap.includes('`${SITE_URL}/pathways/check`') && sitemap.includes('`${SITE_URL}/pathways/schools`'), 'Pathways public acquisition surfaces are in the canonical sitemap')
assert(robots.includes("'/pathways'") && robots.includes("'/pathways/'") && robots.includes("'/student/'"), 'robots permits public Pathways while private learner routes stay excluded')

if (failed) process.exit(1)
