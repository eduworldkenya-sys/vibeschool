import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function requireText(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exitCode = 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

const authority = read('lib/admin/authority.ts')
requireText(authority.includes('getTwinAuthorityContext'), 'Admin authority starts from canonical identity graph')
requireText(authority.includes("selectTwinRoleBinding(context, 'admin')"), 'Admin authority requires an Admin role binding')
requireText(authority.includes("binding.scopeType !== 'school'"), 'Admin authority fails closed without a canonical school scope')

for (const path of [
  'app/admin/page.tsx',
  'app/admin/students/page.tsx',
  'app/admin/attendance/page.tsx',
  'app/admin/academics/page.tsx',
  'app/admin/settings/classes/page.tsx',
]) {
  const source = read(path)
  requireText(source.includes('getAdminSchoolAuthority'), `${path} resolves canonical Admin school authority`)
  requireText(!source.includes('.select("school_id").eq("id", user.id)') && !source.includes(".select('school_id').eq('id', user.id)"), `${path} does not derive authority from profiles.school_id`)
}

const home = read('app/admin/page.tsx')
for (const token of ['student_classes', 'school_members', 'attendance', 'teaching_occurrences', 'assessment_definitions', 'parent_student_links', 'academic_terms']) {
  requireText(home.includes(token), `Admin Home uses ${token} operational evidence`)
}
requireText(!home.includes('attendance").select("id", { count: "exact", head: true }).eq("school_id", sid).gte("timestamp"'), 'Admin Home does not query nonexistent attendance.timestamp')

const students = read('app/admin/students/page.tsx')
requireText(students.includes('.from("student_classes")'), 'Admin learner roster is enrollment-derived')
requireText(students.includes('.eq("is_current", true)'), 'Admin learner roster uses current enrollment only')
requireText(!students.includes('.from("students").select("id, class_id")'), 'Admin learner roster does not use legacy students.class_id')
requireText(students.includes('admin_add_student'), 'Admin learner creation uses guarded RPC')

const attendance = read('app/admin/attendance/page.tsx')
requireText(attendance.includes('.from("student_classes")'), 'Attendance expected roster uses canonical enrollment')
requireText(attendance.includes('.from("attendance")'), 'Attendance oversight reads teacher-recorded attendance')
requireText(!attendance.includes('.from("attendance").insert') && !attendance.includes('.from("attendance").upsert') && !attendance.includes('.from("attendance").update'), 'Admin attendance surface is oversight-only')

const academics = read('app/admin/academics/page.tsx')
for (const token of ['scheme_of_work', 'teaching_occurrences', 'assessment_definitions', 'exam_results']) {
  requireText(academics.includes(token), `Academic oversight reads canonical ${token}`)
}
requireText(!academics.includes('traditional_grades') && !academics.includes('cbc_assessments'), 'Academic oversight does not split reporting across legacy grade stores')

const classes = read('app/admin/settings/classes/page.tsx')
requireText(classes.includes('student_classes') && classes.includes('teacher_classes') && classes.includes('timetable_slots'), 'Class deletion checks live and historical operational dependencies')
requireText(classes.includes('Historical school records are preserved'), 'Used classes cannot be hard-deleted from Admin UI')

const commMigration = read('supabase/migrations/20260819020500_school_admin_cross_school_communication_hardening.sql')
requireText(commMigration.includes('is_school_community_profile'), 'Communication hardening validates school community recipients')
requireText(commMigration.includes('is_school_admin(school_id)'), 'Notification insert is bound to the administered school')
requireText(commMigration.includes('vc_circular_recipients.profile_id'), 'Circular recipient insert validates target profile')
requireText(commMigration.includes('vc_participants.profile_id'), 'Thread participant mutation validates target profile')

const structureMigration = read('supabase/migrations/20260819022500_school_admin_academic_structure_integrity.sql')
requireText(structureMigration.includes('alter column school_id set not null'), 'Operational classes require canonical school identity')
requireText(structureMigration.includes('uq_classes_school_normalized_name_stream'), 'Repeated class setup cannot create normalized duplicate class/stream identities')

if (process.exitCode) {
  console.error('\nSchool Admin Task 7 contract FAILED')
  process.exit(process.exitCode)
}
console.log('\nSchool Admin Task 7 contract PASSED')
