import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const fail = (message) => { throw new Error(`TASK8_AUTH_CONTRACT: ${message}`) }
const mustContain = (text, needle, message) => { if (!text.includes(needle)) fail(message) }
const mustNotContain = (text, needle, message) => { if (text.includes(needle)) fail(message) }

const boundaryMigration = read('supabase/migrations/20260819030000_task8_authorization_privacy_boundaries.sql')
const leastPrivilegeMigration = read('supabase/migrations/20260819031500_task8_private_surface_least_privilege.sql')
const authenticatedPrivilegeMigration = read('supabase/migrations/20260819033000_task8_authenticated_privilege_minimization.sql')
const twinHelperMigration = read('supabase/migrations/20260819034500_task8_twin_privileged_helper_boundary.sql')
const defaultPrivilegeMigration = read('supabase/migrations/20260819040000_task8_public_default_privilege_hardening.sql')
const storagePolicyCleanupMigration = read('supabase/migrations/20260819041500_task8_storage_permissive_policy_cleanup.sql')
const activationMigration = read('supabase/migrations/20260820224500_learner_activation_parent_decoupling.sql')
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

mustContain(defaultPrivilegeMigration, 'alter default privileges for role postgres in schema public', 'postgres public defaults must be hardened')
mustContain(defaultPrivilegeMigration, 'alter default privileges for role supabase_admin in schema public', 'supabase_admin public defaults must be hardened')
mustContain(defaultPrivilegeMigration, 'revoke truncate, references, trigger on tables from anon, authenticated', 'future public tables must not grant PostgreSQL 15 structural authority to clients')
mustContain(defaultPrivilegeMigration, 'revoke update on sequences from anon, authenticated', 'future public sequences must not grant UPDATE by default')
mustContain(defaultPrivilegeMigration, 'revoke execute on functions from public, anon, authenticated', 'future public functions must require explicit EXECUTE grants')
mustContain(defaultPrivilegeMigration, "n.nspname = 'public'", 'existing structural-privilege cleanup must be constrained to public')
mustNotContain(defaultPrivilegeMigration, 'revoke truncate, references, trigger, maintain', 'PostgreSQL 15 security migration must not use unsupported MAINTAIN privilege syntax')

mustContain(storagePolicyCleanupMigration, 'drop policy if exists homework_photos_school_staff_select on storage.objects', 'legacy same-school homework photo read policy must be removed')
mustContain(storagePolicyCleanupMigration, 'drop policy if exists homework_photos_staff_read on storage.objects', 'legacy homework photo staff policy variants must remain removed')

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

// Learner activation is authorized by a school-issued shared claim, not by a
// family relationship. Parent access remains separately governed by parent RLS.
mustContain(createStudent, "rpc('lookup_student_claim'", 'learner provisioning must resolve an authoritative school claim')
mustContain(createStudent, ".eq('id', schoolId)", 'learner provisioning must resolve the school returned by the claim')
mustContain(activationMigration, 'sc.is_current=true', 'learner activation must require a current enrollment')
mustContain(activationMigration, "'class_not_found'", 'learner activation must fail closed without a current class')
mustContain(activationMigration, "'school_not_found'", 'learner activation must fail closed without a school')
mustContain(activationMigration, "current_user not in ('postgres','service_role')", 'learner finalization must remain service-role only')
mustNotContain(createStudent, ".from('parent_student_links')", 'learner activation must not inherit parent authority as an account prerequisite')

for (const [name, source] of [
  ['app lesson generator', generateLesson],
  ['edge lesson generator', edgeGenerateLesson],
  ['canonical lesson generator', canonicalGenerateLesson],
]) {
  mustContain(source, 'teacher_classes', `${name} must verify current teacher assignment before service-role work`)
  mustContain(source, 'role', `${name} must verify teacher role before service-role work`)
}

// Canonical lesson generation now has a source-grounded preparation branch in
// addition to explicit enhancement. Both must still authenticate and establish
// teacher assignment before any global recovery, canonical claim, wallet work,
// or model invocation.
const canonicalTeacherGate = canonicalGenerateLesson.indexOf('if (profile?.role !== "teacher" || !teacherAssignment)')
const canonicalRecovery = canonicalGenerateLesson.indexOf('cla_recover_expired_learning_resource_claims')
const canonicalGroundedModel = canonicalGenerateLesson.indexOf('invokeCyborgEdgeModelWithFallback')
if (canonicalTeacherGate < 0 || canonicalRecovery < 0 || canonicalGroundedModel < 0) {
  fail('canonical generator authorization/model markers are missing')
}
if (!(canonicalTeacherGate < canonicalRecovery)) {
  fail('canonical generator must authorize before global service recovery')
}
// The helper definition may textually precede serve(), so verify its invocation
// is reachable only through the post-auth grounded branch rather than comparing
// helper-definition source positions.
mustContain(canonicalGenerateLesson, 'if (body.intent === GROUNDED_PREPARE_INTENT)', 'grounded preparation must have a dedicated post-auth branch')
mustContain(canonicalGenerateLesson, 'return await prepareGroundedPedagogy({ db, userId: user.id, body })', 'grounded preparation must receive authenticated teacher identity')

for (const [path, source] of cronFiles) {
  mustContain(source, 'if (!cronSecret) return false', `${path} must fail closed without CRON_SECRET`)
  mustContain(source, "req.headers.get('authorization') === `Bearer ${cronSecret}`", `${path} must require bearer secret`)
  mustNotContain(source, "searchParams.get('secret')", `${path} must not accept secrets in URL query parameters`)
  mustNotContain(source, 'if (!cronSecret) return true', `${path} must never fail open`)
}

console.log('TASK8_AUTH_CONTRACT PASS')
