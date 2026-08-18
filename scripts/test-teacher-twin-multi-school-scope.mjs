import fs from 'node:fs'

const scopeMigration = 'supabase/migrations/20260818050000_teacher_twin_multi_school_scope.sql'
const preferenceMigration = 'supabase/migrations/20260818050100_teacher_twin_active_school_preference.sql'
const switcherPath = 'components/twin/TwinRoleSwitcher.tsx'
const historical = [
  'supabase/migrations/20260807150121_teacher_twin_authoritative_brain.sql',
  'supabase/migrations/20260807150508_teacher_twin_student_signal_bridge.sql',
  'supabase/migrations/20260807151514_teacher_twin_operational_context_completion.sql',
  'supabase/migrations/20260807152114_teacher_twin_context_integrity_fix.sql',
]

const failures = []
for (const file of [...historical, scopeMigration, preferenceMigration, switcherPath]) {
  if (!fs.existsSync(file)) failures.push(`${file}: required Teacher Twin contract file is missing`)
}

const scope = fs.existsSync(scopeMigration) ? fs.readFileSync(scopeMigration, 'utf8') : ''
const preference = fs.existsSync(preferenceMigration) ? fs.readFileSync(preferenceMigration, 'utf8') : ''
const switcher = fs.existsSync(switcherPath) ? fs.readFileSync(switcherPath, 'utf8') : ''

function requireText(source, file, value, reason) {
  if (!source.includes(value)) failures.push(`${file}: ${reason} (missing ${JSON.stringify(value)})`)
}

function rejectText(source, file, value, reason) {
  if (source.includes(value)) failures.push(`${file}: ${reason} (found ${JSON.stringify(value)})`)
}

for (const value of [
  'primary key (teacher_id, school_id)',
  'unique (teacher_id, school_id, claim_key)',
  'teacher_get_twin_brain(p_school_id uuid)',
  'teacher_refresh_twin_memory(p_school_id uuid)',
  'teacher_get_twin_tutor_context(p_school_id uuid)',
  "sm.role = 'teacher'",
  "raise exception 'teacher_school_scope_not_authorized'",
  'on conflict(teacher_id,school_id)',
  'on conflict(teacher_id,school_id,claim_key)',
  'and t.school_id = p_school_id',
  'and h.school_id = p_school_id',
  'and ai.school_id = p_school_id',
  'and sw.school_id = p_school_id',
  'join public.student_classes sc',
  'sc.is_current = true',
  'where teacher_id = v_uid\n    and school_id = p_school_id',
  'grant execute on function public.teacher_get_twin_brain(uuid) to authenticated, service_role',
]) {
  requireText(scope, scopeMigration, value, 'multi-school school-scope invariant is missing')
}

// The new scoped Student signal must not depend on the legacy students.class_id authority path.
rejectText(scope, scopeMigration, 'join public.students s on s.class_id=tc.class_id', 'Student Twin attention regressed to legacy class identity')

for (const value of [
  'teacher_set_active_twin_school(p_school_id uuid)',
  "sm.role = 'teacher'",
  'update public.teacher_profiles tp',
  "raise exception 'teacher_school_scope_not_authorized'",
  'return public.teacher_get_twin_brain(v_preferred)',
  "raise exception 'teacher_school_scope_required'",
  'grant execute on function public.teacher_set_active_twin_school(uuid) to authenticated, service_role',
]) {
  requireText(preference, preferenceMigration, value, 'active-school preference invariant is missing')
}

for (const value of [
  'teacher_set_active_twin_school',
  'p_school_id: nextScopeId',
  'getTwinRoleBindings(context, "teacher")',
  'window.location.assign(`/teacher/pulse?twin_scope=${encodeURIComponent(nextScopeId)}`)',
]) {
  requireText(switcher, switcherPath, value, 'Teacher scope switcher is not bound to governed school selection')
}

for (const file of historical) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  if (!text.trim()) failures.push(`${file}: restored production ledger entry is empty`)
}

if (failures.length) {
  console.error('Teacher Twin Multi-School Contract: FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Teacher Twin Multi-School Contract: PASS')
console.log('State identity: teacher + school')
console.log('Memory identity: teacher + school + claim')
console.log('Scope changes: membership-authorized + full remount')
