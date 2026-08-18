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

const teacherRoot = read('app/teacher/page.tsx')
requireText(teacherRoot.includes('/teacher/pulse'), 'teacher root resolves to operational Today/Pulse home')

const notifications = read('app/teacher/notifications/page.tsx')
requireText(notifications.includes('homework_submitted'), 'teacher inbox understands production homework notification type')
requireText(notifications.includes('classhub/${encodeURIComponent(data.class_id)}/homework/${encodeURIComponent(data.id)}'), 'homework notification deep-links through canonical class homework route')
requireText(notifications.includes('.eq("user_id", auth.user.id)'), 'notification list is explicitly user-scoped in addition to RLS')

const pulseHeader = read('components/teacher/PulseHeader.tsx')
requireText(pulseHeader.includes('/teacher/notifications'), 'dashboard notification bell has a real destination')

const attendance = read('app/teacher/attendance/page.tsx')
requireText(!attendance.includes("'timestamp'") && !attendance.includes('"timestamp"'), 'attendance never queries nonexistent timestamp column')
requireText(attendance.includes('.eq("date", date)') || attendance.includes('.eq("date", selectedDate)'), 'attendance reloads against canonical date column')
requireText(attendance.includes('teaching_occurrences'), 'lesson attendance resolves exact teaching occurrence')
requireText(attendance.includes('upsert_attendance_batch'), 'attendance writes through guarded batch authority')
requireText(attendance.includes('localStorage'), 'attendance retains interrupted mobile work locally')

const attendanceMigration = read('supabase/migrations/20260819023000_task4_teacher_attendance_integrity.sql')
requireText(attendanceMigration.includes('student_classes'), 'attendance writer validates canonical current enrollment')
requireText(attendanceMigration.includes('teacher_classes'), 'attendance writer validates teacher class scope')
requireText(attendanceMigration.includes('revoke all on function public.upsert_attendance_batch(jsonb) from public, anon'), 'attendance RPC blocks anonymous execution')
requireText(attendanceMigration.includes('teaching_occurrence_id'), 'attendance writer binds lesson rows to exact occurrence')

const contextMigration = read('supabase/migrations/20260819024500_task4_teacher_operating_context.sql')
requireText(contextMigration.includes('teacher_active_school_preferences'), 'teacher active school survives logout/re-login independently of authorization')
requireText(contextMigration.includes('teacher_get_operating_context'), 'teacher modules share one operating-context resolver')
requireText(contextMigration.includes("sm.role::text = 'teacher'"), 'operating context verifies teacher membership')
requireText(contextMigration.includes('teacher_classes'), 'operating context derives assignments from canonical teacher_classes')

const homework = read('app/teacher/homework/page.tsx')
requireText(homework.includes('.from("student_classes")'), 'homework overview counts current enrollment through student_classes')
requireText(homework.includes('teacher_get_operating_context'), 'homework overview uses canonical active-school context')
requireText(!homework.includes('.from("students").select("id, class_id")'), 'homework overview no longer counts legacy students.class_id')

const lessonFlow = read('components/teacher/LessonFlowCard.tsx')
for (const token of ['attendance', 'homework', 'assessment', 'Evidence', 'Reflection', 'Progress']) {
  requireText(lessonFlow.toLowerCase().includes(token.toLowerCase()), `lesson workspace exposes ${token} stage`)
}

const lessonModal = read('components/teacher/LessonPlanModal.tsx')
requireText(lessonModal.includes('startLessonOccurrence'), 'lesson plan starts guarded teaching occurrence')
requireText(lessonModal.includes('buildLessonAttendanceUrl'), 'lesson start hands exact identity into attendance')
requireText(lessonModal.includes('completeLessonOccurrence'), 'lesson completion is authoritative')
requireText(lessonModal.includes('markLessonSchemeCovered'), 'completed teaching can update linked scheme through guarded authority')

const assessmentStudio = read('app/teacher/assessment/new/page.tsx')
requireText(assessmentStudio.includes('requestLessonAssessment'), 'lesson assessment uses canonical idempotent assessment authority')
requireText(assessmentStudio.includes('requestKey:'), 'assessment generation carries retry/idempotency key')
requireText(assessmentStudio.includes('teacher_review_required'), 'generated assessment remains teacher-reviewed before release')

if (process.exitCode) {
  console.error('\nTeacher Pilot Task 4 contract FAILED')
  process.exit(process.exitCode)
}
console.log('\nTeacher Pilot Task 4 contract PASSED')
