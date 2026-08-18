import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const fail = (message) => { throw new Error(`TASK8_AUTH_CONTRACT: ${message}`) }
const mustContain = (text, needle, message) => { if (!text.includes(needle)) fail(message) }
const mustNotContain = (text, needle, message) => { if (text.includes(needle)) fail(message) }

const boundaryMigration = read('supabase/migrations/20260819030000_task8_authorization_privacy_boundaries.sql')
const leastPrivilegeMigration = read('supabase/migrations/20260819031500_task8_private_surface_least_privilege.sql')
const authenticatedPrivilegeMigration = read('supabase/migrations/20260819033000_task8_authenticated_privilege_minimization.sql')
const twinHelperMigration = read('supabase/migrations/20260819034500_task8_twin_privileged_helper_boundary.sql')
const resetPin = read('app/api/reset-student-pin/route.ts')
const createStudent = read('app/api/create-student-account/route.ts')
const generateLesson = read('app/api/generate-lesson-plan/route.ts')
const edgeGenerateLesson = read('supabase/functions/generate-lesson-plan/index.ts')
const canonicalGenerateLesson = read('supabase/functions/generate-canonical-lesson-plan/index.ts')
const cronFiles = [
  'app/api/cron/homework-reminders/route.ts',
  'app/api/cron/tpad-reminders/route.ts',
  'app/api/cron/invoice-reminders/route.ts',
].map((path) => [path, read(path)])

mustContain(boundaryMigration, 'public.is_school_admin(school_id)', 'pending actions must be school-scoped')
mustContain(boundaryMigration, 'requester_id = auth.uid()', 'pending action requester must be the caller')
mustContain(boundaryMigration, 'audit_logs_hq_owner_read', 'global audit log must be HQ-owner gated')
mustContain(boundaryMigration, 'public.is_teacher_of_student(al.student_id)', 'marking must use current teacher/learner authority')
mustContain(boundaryMigration, 'split_part(storage.objects.name', 'homework storage must resolve learner folder authority')
mustContain(boundaryMigration, 'drop policy if exists "Anonymous can view active shared links"', 'anonymous child-share enumeration policy must stay removed')
mustContain(leastPrivilegeMigration, 'revoke all privileges on table %I.%I from anon', 'private surfaces must not inherit broad anonymous privileges')
mustContain(authenticatedPrivilegeMigration, 'revoke truncate, trigger, references', 'application roles must not retain structural table privileges')
mustContain(authenticatedPrivilegeMigration, 'public.is_school_admin(school_id)', 'notification admin insert must be school-scoped')
mustContain(authenticatedPrivilegeMigration, 'sc.school_id = notifications.school_id', 'notification learner recipient must be tenant-bound')
mustContain(authenticatedPrivilegeMigration, "coalesce(psl.access_level,'full') <> 'none'", 'notification parent recipient must require active relationship')

for (const helper of [
  'twin_record_learning_representation_exposure',
  'twin_record_verified_practice_effect',
  'twin_resolve_learning_exposures',
  'twin_resolve_learning_representation_outcome',
]) {
  mustContain(twinHelperMigration, `revoke execute on function public.${helper}`, `${helper} must not be directly authenticated-callable`)
}
mustContain(twinHelperMigration, 'grant execute on function public.twin_record_verified_calibration', 'verified Twin calibration must remain service-role callable')

mustContain(resetPin, ".eq('profile_id', String(student_auth_id))", 'PIN reset must resolve auth id to canonical learner')
mustContain(resetPin, ".from('student_classes')", 'PIN reset must resolve current learner class')
mustContain(resetPin, ".from('teacher_classes')", 'PIN reset must verify teacher assignment')
mustContain(resetPin, ".from('school_members')", 'PIN reset must verify admin school membership')
mustContain(resetPin, 'if (!teacherAuthorized && !adminAuthorized)', 'PIN reset must deny unscoped callers')
mustNotContain(resetPin, "['teacher', 'admin'].includes(profile.role)", 'role label alone must never authorize PIN reset')

mustContain(createStudent, ".eq('school_id', klass.school_id)", 'learner provisioning guardian relationship must match current school')
mustContain(createStudent, ".neq('access_level', 'none')", 'learner provisioning must reject revoked guardian links')

for (const [name, source] of [
  ['app lesson generator', generateLesson],
  ['edge lesson generator', edgeGenerateLesson],
  ['canonical lesson generator', canonicalGenerateLesson],
]) {
  mustContain(source, 'teacher_classes', `${name} must verify current teacher assignment before service-role work`)
  mustContain(source, 'role', `${name} must verify teacher role before service-role work`)
}
mustContain(canonicalGenerateLesson, 'before global recovery', 'canonical generator must authorize before global service recovery')

for (const [path, source] of cronFiles) {
  mustContain(source, 'if (!cronSecret) return false', `${path} must fail closed without CRON_SECRET`)
  mustContain(source, "req.headers.get('authorization') === `Bearer ${cronSecret}`", `${path} must require bearer secret`)
  mustNotContain(source, "searchParams.get('secret')", `${path} must not accept secrets in URL query parameters`)
  mustNotContain(source, 'if (!cronSecret) return true', `${path} must never fail open`)
}

console.log('TASK8_AUTH_CONTRACT PASS')
