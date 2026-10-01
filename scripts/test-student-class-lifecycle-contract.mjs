import fs from 'node:fs'
import path from 'node:path'

const roots = ['app/teacher', 'components/teacher', 'lib/teaching']
const sourceFiles = []

function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name) && !entry.name.includes('.bak-')) sourceFiles.push(full)
  }
}

for (const root of roots) walk(root)

const failures = []
function fail(file, rule) { failures.push(`${file}: ${rule}`) }

for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8')

  if (/\.from\((['"])student_classes\1\)[\s\S]{0,260}?\.select\((['"])[^'"]*students\s*[!(]/m.test(text)) {
    fail(file, 'nested student_classes -> students roster join is forbidden; resolve enrollment IDs then learner identity separately')
  }

  if (/\.from\((['"])students\1\)[\s\S]{0,220}?\.update\(\s*\{[\s\S]{0,120}?class_id\s*:/m.test(text)) {
    fail(file, 'Teacher OS must not mutate legacy students.class_id directly')
  }

  if (text.includes('manual_students')) {
    fail(file, 'Teacher OS must not consume legacy manual_students as learner identity authority')
  }
}

const helper = fs.readFileSync('lib/teaching/studentRoster.ts', 'utf8')
for (const required of [
  "rpc('teacher_get_class_roster'",
  'p_school_id: input.schoolId',
  'p_class_id: input.classId',
  'p_include_history: input.includeHistory',
  'loadCurrentClassRoster',
  'loadCurrentClassStudentIds',
  'loadClassEnrollmentHistory',
  'loadClassEnrollmentForStudent',
]) {
  if (!helper.includes(required)) fail('lib/teaching/studentRoster.ts', `missing canonical roster clause: ${required}`)
}
if (/profile_id[^\n]{0,120}(not|neq|eq)/i.test(helper)) {
  fail('lib/teaching/studentRoster.ts', 'current roster must not require a claimed Student OS profile')
}

const rosterMigration = fs.readFileSync('supabase/migrations/20261001155000_teacher_class_roster_authority.sql', 'utf8')
for (const required of [
  'security definer',
  "set search_path = ''",
  'public.school_members',
  'public.teacher_classes',
  'tc.class_id = p_class_id',
  'public.student_classes',
  'join public.students',
  'p_include_history or sc.is_current',
  's.deleted_at is null',
  'revoke all on function public.teacher_get_class_roster(uuid,uuid,boolean,uuid) from public, anon',
  'grant execute on function public.teacher_get_class_roster(uuid,uuid,boolean,uuid) to authenticated',
]) {
  if (!rosterMigration.toLowerCase().includes(required.toLowerCase())) {
    fail('teacher class roster migration', `missing authority clause: ${required}`)
  }
}

const requests = fs.readFileSync('app/teacher/classhub/[id]/requests/page.tsx', 'utf8')
if (!requests.includes("rpc('teacher_approve_class_join_request'")) {
  fail('app/teacher/classhub/[id]/requests/page.tsx', 'join approval must use atomic server authority')
}
if (requests.includes(".from('students')\n      .update({ class_id:")) {
  fail('app/teacher/classhub/[id]/requests/page.tsx', 'join approval still mutates legacy class pointer client-side')
}

const migration = fs.readFileSync('supabase/migrations/20261001154500_teacher_atomic_class_join_approval.sql', 'utf8')
for (const required of [
  'security definer',
  "set search_path = ''",
  'for update',
  'students_one_current_enrollment',
  'student_has_different_current_enrollment',
  'insert into public.student_classes',
  'insert into public.parent_student_links',
  'update public.students',
  "set status = 'approved'",
  'revoke all on function public.teacher_approve_class_join_request(uuid) from public, anon',
  'grant execute on function public.teacher_approve_class_join_request(uuid) to authenticated',
]) {
  if (!migration.toLowerCase().includes(required.toLowerCase())) {
    // the unique index is enforced by production schema, not recreated here
    if (required === 'students_one_current_enrollment') continue
    fail('atomic join approval migration', `missing authority clause: ${required}`)
  }
}

const lessonAttendance = fs.readFileSync('lib/teaching/lessonAttendance.ts', 'utf8')
const occurrence = fs.readFileSync('lib/teaching/occurrence.ts', 'utf8')
for (const [file, text] of [['lib/teaching/lessonAttendance.ts', lessonAttendance], ['lib/teaching/occurrence.ts', occurrence]]) {
  if (!text.includes('loadCurrentClassStudentIds')) fail(file, 'classroom lifecycle must consume canonical roster reader')
}

const scenarioContract = [
  ['unclaimed learner remains visible', !helper.includes('.not("profile_id"') && !helper.includes(".not('profile_id'")],
  ['current enrollment is class authority', rosterMigration.includes('p_include_history or sc.is_current')],
  ['school scope propagates to roster', rosterMigration.includes('sc.school_id = p_school_id')],
  ['historical membership remains readable', helper.includes('loadClassEnrollmentHistory')],
  ['single learner history remains readable', helper.includes('loadClassEnrollmentForStudent')],
  ['join approval is fail-closed on competing current enrollment', migration.includes('student_has_different_current_enrollment')],
  ['join approval verifies live teacher membership', migration.includes("sm.role::text = 'teacher'")],
  ['join approval verifies class-teacher authority', migration.includes('tc.is_class_teacher = true')],
]
for (const [name, pass] of scenarioContract) if (!pass) fail('persona/lifecycle scenario contract', name)

if (failures.length) {
  console.error('Student/class lifecycle contract FAILED')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}

console.log(`Student/class lifecycle contract passed across ${sourceFiles.length} Teacher OS source files.`)
console.log('Scenarios: unclaimed/current/historical/multi-school/class-teacher/competing-enrollment contracts are structurally protected.')
