import fs from 'node:fs'

const protectedFiles = [
  'components/student/VibeTwin/index.tsx',
  'components/student/VibeTwin/ui/TwinHeader.tsx',
  'components/teacher/TwinDrawer.tsx',
  'components/parent/TwinDrawer.tsx',
  'components/admin/TwinDrawer.tsx',
  'components/hq/TwinDrawer.tsx',
  'components/teacher/SmartInsightSlides.tsx',
  'components/twin/TwinRoleSwitcher.tsx',
  'lib/teacher/twin.ts',
  'lib/twin/core.ts',
  'lib/twin/hq-brain.ts',
  'lib/student-context.tsx',
  'lib/admin/authority.ts',
  'app/parent/layout.tsx',
  'app/teacher/layout.tsx',
  'app/admin/page.tsx',
]

const bannedRuntimePatterns = [
  { label: 'twin-chat runtime call', pattern: /functions\/v1\/twin-chat/i },
  { label: 'super-action runtime call', pattern: /functions\/v1\/super-action/i },
  { label: 'learner AI fallback helper', pattern: /\baskLearnerTwin\b/ },
  { label: 'Teacher AI fallback helper', pattern: /\baskTeacherTwin\b/ },
  { label: 'Claude runtime dependency', pattern: /\bclaude(?:-|\b)/i },
  { label: 'Anthropic runtime dependency', pattern: /\banthropic\b/i },
  { label: 'OpenAI runtime dependency', pattern: /\bopenai\b/i },
  { label: 'Gemini runtime dependency', pattern: /\bgemini\b/i },
]

const failures = []
const contents = new Map()

for (const file of protectedFiles) {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: missing protected Twin file`)
    continue
  }
  const source = fs.readFileSync(file, 'utf8')
  contents.set(file, source)
  for (const rule of bannedRuntimePatterns) {
    if (rule.pattern.test(source)) failures.push(`${file}: contains banned ${rule.label}`)
  }
}

function source(file) {
  return contents.get(file) ?? (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')
}
function requireText(file, value, reason) {
  if (!source(file).includes(value)) failures.push(`${file}: ${reason} (missing ${JSON.stringify(value)})`)
}
function forbidText(file, value, reason) {
  if (source(file).includes(value)) failures.push(`${file}: ${reason} (found ${JSON.stringify(value)})`)
}

requireText('components/student/VibeTwin/index.tsx', 'routeTwinCore', 'Student Twin must route deterministic core first')
requireText('components/student/VibeTwin/index.tsx', 'getAdaptiveTeachingTurn', 'Student guided coaching must remain available without generative AI')
requireText('components/student/VibeTwin/ui/TwinHeader.tsx', '<TwinRoleSwitcher currentRole="student" />', 'Student Twin must expose authorized multi-role switching')

requireText('components/teacher/TwinDrawer.tsx', 'getTeacherTwinState', 'Teacher UI must load the server-authoritative Teacher adapter')
requireText('components/teacher/TwinDrawer.tsx', 'resolveTeacherTwinQuery', 'Teacher queries must use deterministic role resolution')
requireText('components/teacher/TwinDrawer.tsx', '<TwinRoleSwitcher currentRole="teacher" />', 'Teacher Twin must expose authorized multi-role switching')
requireText('lib/teacher/twin.ts', "rpc<Json>('teacher_get_twin_brain')", 'Teacher adapter must consume the production Teacher brain RPC')
requireText('lib/teacher/twin.ts', 'getTwinAuthorityContext', 'Teacher adapter must derive authority through the shared Twin core')
requireText('lib/teacher/twin.ts', "selectTwinRoleBinding(authority, 'teacher', schoolId)", 'Teacher brain must validate active school against relationship authority')
forbidText('lib/teacher/twin.ts', "selectTwinRoleBinding(authority, 'teacher')", 'Teacher adapter must not guess a multi-school Teacher scope')

requireText('components/parent/TwinDrawer.tsx', 'getTwinAuthorityContext', 'Parent Twin must derive roles from shared core')
requireText('components/parent/TwinDrawer.tsx', 'requireTwinRole(authority, "parent")', 'Parent Twin must require an active family relationship')
requireText('components/parent/TwinDrawer.tsx', 'get_parent_child_dashboard', 'Parent child detail remains server-authorized')

requireText('components/admin/TwinDrawer.tsx', 'getTwinAuthorityContext', 'Admin Twin must derive roles from shared core')
requireText('components/admin/TwinDrawer.tsx', 'requireTwinRole(authority, "admin")', 'Admin Twin must require an Admin relationship')
requireText('components/admin/TwinDrawer.tsx', 'selectTwinRoleBinding(authority, "admin")', 'Admin Twin must bind one school scope')
requireText('components/admin/TwinDrawer.tsx', 'admin_get_classroom_learning_health', 'Admin insight must use server-authorized school health')
requireText('components/admin/TwinDrawer.tsx', '<TwinRoleSwitcher currentRole="admin" />', 'Admin Twin must expose authorized multi-role switching')

requireText('lib/admin/authority.ts', 'getTwinAuthorityContext', 'Central Admin resolver must start from shared Twin authority')
requireText('lib/admin/authority.ts', "selectTwinRoleBinding(context, 'admin')", 'Central Admin resolver must require an Admin role binding')
requireText('lib/admin/authority.ts', "binding.scopeType !== 'school'", 'Central Admin resolver must fail closed without a school scope')
requireText('app/admin/page.tsx', 'getAdminSchoolAuthority', 'Admin portal must use the centralized relationship-derived Admin authority resolver')
forbidText('app/admin/page.tsx', 'p.school_id', 'Admin portal must not derive school scope from profiles.school_id')
forbidText('app/admin/page.tsx', 'full_name, school_id, schools', 'Admin portal must not join authority through the legacy profile school field')

requireText('components/hq/TwinDrawer.tsx', 'resolveHQReply', 'HQ Twin must use governed deterministic resolution')
requireText('components/hq/TwinDrawer.tsx', 'hqSupabase.auth.getUser()', 'HQ Twin must use isolated HQ session')
requireText('components/hq/TwinDrawer.tsx', 'hq_check_owner_access', 'HQ Twin must re-check owner authority')
forbidText('components/hq/TwinDrawer.tsx', 'getTwinAuthorityContext', 'HQ Twin must not use normal app auth session')
forbidText('components/hq/TwinDrawer.tsx', 'TwinRoleSwitcher', 'HQ isolation must not use normal-session role switching')
requireText('lib/twin/hq-brain.ts', 'hqSupabase as supabase', 'HQ brain must use isolated HQ client')

requireText('components/teacher/SmartInsightSlides.tsx', 'getTwinAuthorityContext', 'Teacher insights must derive shared authority')
requireText('components/teacher/SmartInsightSlides.tsx', "from('teacher_classes')", 'Teacher insight scope must use canonical teacher assignments')
requireText('components/teacher/SmartInsightSlides.tsx', "from('student_classes')", 'Teacher insight learner scope must use current enrollment')
requireText('components/teacher/SmartInsightSlides.tsx', 'Missing data is not positive or negative evidence.', 'Teacher insight must preserve evidence boundaries')

for (const marker of [
  "from('school_members')",
  "from('parent_student_links')",
  "from('teacher_classes')",
  "from('student_classes')",
  "rpc<boolean>('is_platform_owner')",
  'requireTwinRole',
  'selectTwinRoleBinding',
  'authorityReadError',
]) requireText('lib/twin/core.ts', marker, 'Shared Twin core is missing an authority invariant')

requireText('lib/student-context.tsx', 'getTwinAuthorityContext', 'Student portal must derive relationship authority')
requireText('lib/student-context.tsx', 'requireTwinRole(authority, "student")', 'Student portal must require a proven learner role')
requireText('lib/student-context.tsx', 'from("student_classes")', 'Student portal must use canonical current enrollment')
forbidText('lib/student-context.tsx', 'profile.role !== "student"', 'Student portal must not collapse multi-role identity to profiles.role')

requireText('app/parent/layout.tsx', 'getTwinAuthorityContext', 'Parent portal must derive relationship authority')
requireText('app/parent/layout.tsx', 'requireTwinRole(authority, "parent")', 'Parent portal must require a proven family role')
requireText('app/parent/layout.tsx', '<TwinRoleSwitcher currentRole="parent" />', 'Parent portal must expose authorized role switching')
forbidText('app/parent/layout.tsx', 'data?.role !== "parent"', 'Parent portal must not collapse multi-role identity to profiles.role')

requireText('app/teacher/layout.tsx', 'getTwinAuthorityContext', 'Teacher portal must derive relationship authority')
requireText('app/teacher/layout.tsx', 'selectTwinRoleBinding(authority, "teacher", teacherData?.school_id ?? undefined)', 'Teacher portal active-school hint must be membership-verified')
forbidText('app/teacher/layout.tsx', 'profileData.role !== "teacher"', 'Teacher portal must not collapse multi-role identity to profiles.role')
forbidText('app/teacher/layout.tsx', 'vs_role_', 'Teacher portal must not persist browser role authority')

requireText('components/twin/TwinRoleSwitcher.tsx', 'getTwinAuthorityContext', 'Role switcher must list only relationship-derived roles')
requireText('components/twin/TwinRoleSwitcher.tsx', 'window.location.assign', 'Role switch must force a full remount')
requireText('components/twin/TwinRoleSwitcher.tsx', 'Destination loaders derive authority again', 'Role switching must remain navigation, not authorization')

const constitution = 'docs/TWIN_CONSTITUTION_V1.md'
if (!fs.existsSync(constitution)) failures.push(`${constitution}: deterministic Twin constitution is missing`)
else for (const invariant of ['AI OFF = VibeSchool Twin works.', 'unsupported request must **not** silently escalate to generative AI', 'teacher_classes', 'parent_student_links', 'is_school_admin']) {
  if (!fs.readFileSync(constitution, 'utf8').includes(invariant)) failures.push(`${constitution}: missing invariant ${JSON.stringify(invariant)}`)
}

const vercelPath = 'vercel.json'
if (!fs.existsSync(vercelPath)) failures.push(`${vercelPath}: missing deployment guard`)
else {
  const enabled = JSON.parse(fs.readFileSync(vercelPath, 'utf8'))?.git?.deploymentEnabled
  if (!enabled || enabled.main !== true || enabled['*'] !== false || enabled['**'] !== false) failures.push('vercel.json: Git deployment guard must enable only main and disable * and ** branches')
}

if (failures.length) {
  console.error('Deterministic Twin Contract: FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Deterministic Twin Contract: PASS')
console.log(`Protected Twin files: ${protectedFiles.length}`)
console.log('Generative AI is not callable from protected Twin runtime surfaces; any future AI capability must enter through a separately governed optional-skill boundary.')
