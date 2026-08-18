import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const fail = (message) => { throw new Error(`TASK8_AUTH_CONTRACT: ${message}`) }
const mustContain = (text, needle, message) => { if (!text.includes(needle)) fail(message) }
const mustNotContain = (text, needle, message) => { if (text.includes(needle)) fail(message) }

const boundaryMigration = read('supabase/migrations/20260819030000_task8_authorization_privacy_boundaries.sql')
const leastPrivilegeMigration = read('supabase/migrations/20260819031500_task8_private_surface_least_privilege.sql')
const resetPin = read('app/api/reset-student-pin/route.ts')
const generateLesson = read('app/api/generate-lesson-plan/route.ts')
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

mustContain(resetPin, ".eq('profile_id', String(student_auth_id))", 'PIN reset must resolve auth id to canonical learner')
mustContain(resetPin, ".from('student_classes')", 'PIN reset must resolve current learner class')
mustContain(resetPin, ".from('teacher_classes')", 'PIN reset must verify teacher assignment')
mustContain(resetPin, ".from('school_members')", 'PIN reset must verify admin school membership')
mustContain(resetPin, 'if (!teacherAuthorized && !adminAuthorized)', 'PIN reset must deny unscoped callers')
mustNotContain(resetPin, "['teacher', 'admin'].includes(profile.role)", 'role label alone must never authorize PIN reset')

mustContain(generateLesson, ".from('teacher_classes')", 'service-role lesson generator must verify current teacher assignment')
mustContain(generateLesson, "profile?.role !== 'teacher'", 'service-role lesson generator must reject non-teachers')

for (const [path, source] of cronFiles) {
  mustContain(source, 'if (!cronSecret) return false', `${path} must fail closed without CRON_SECRET`)
  mustContain(source, "req.headers.get('authorization') === `Bearer ${cronSecret}`", `${path} must require bearer secret`)
  mustNotContain(source, "searchParams.get('secret')", `${path} must not accept secrets in URL query parameters`)
  mustNotContain(source, 'if (!cronSecret) return true', `${path} must never fail open`)
}

console.log('TASK8_AUTH_CONTRACT PASS')
