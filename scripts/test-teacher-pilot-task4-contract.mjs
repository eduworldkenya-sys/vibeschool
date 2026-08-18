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
requireText(contextMigration.includes('pol_teacher_profiles_update'), 'legacy teacher profile school pointer is membership-checked')

const homework = read('app/teacher/homework/page.tsx')
requireText(homework.includes('.from("student_classes")'), 'homework overview counts current enrollment through student_classes')
requireText(homework.includes('teacher_get_operating_context'), 'homework overview uses canonical active-school context')
requireText(!homework.includes('.from("students").select("id, class_id")'), 'homework overview no longer counts legacy students.class_id')

const students = read('app/teacher/students/page.tsx')
requireText(students.includes('.from("student_classes")'), 'teacher learner roster comes from canonical student_classes')
requireText(students.includes('.eq("is_current", true)'), 'teacher learner roster only includes current enrollment')
requireText(students.includes('teacher_get_operating_context'), 'teacher learner roster uses canonical active-school context')
requireText(!students.includes(".eq('is_class_teacher', true)") && !students.includes('.eq("is_class_teacher", true)'), 'subject teachers are not excluded from authorized learner roster')

const profile = read('app/teacher/profile/page.tsx')
requireText(profile.includes('teacher_get_operating_context'), 'teacher profile uses canonical operating context for school/classes/subjects')
for (const staleField of ['first_name', 'last_name', 'job_title', 'department', 'teaching_philosophy', 'classroom_management', 'assessment_approach', 'professional_development']) {
  requireText(!profile.includes(staleField), `teacher profile does not query nonexistent production field ${staleField}`)
}
requireText(profile.includes('designation') && profile.includes('teaching_style'), 'teacher profile uses production professional fields')

const progress = read('app/teacher/progress/page.tsx')
requireText(progress.includes('saveTeachingProgressRecord'), 'lesson progress writes through guarded occurrence RPC')
requireText(progress.includes('teaching_occurrence_id'), 'lesson progress is anchored to teaching occurrence identity')
requireText(progress.includes('.not("teaching_occurrence_id", "is", null)'), 'teacher progress history excludes disconnected legacy records')
requireText(!progress.includes('.from("progress_records").insert') && !progress.includes(".from('progress_records').insert"), 'teacher progress cannot create disconnected records client-side')
requireText(progress.includes('teacher_get_operating_context'), 'teacher progress history is scoped by canonical active school')

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
