import './test-operational-school-authority.mjs'
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

function routeExists(href) {
  const pathname = href.split('?')[0]
  if (!pathname.startsWith('/teacher')) return true
  const relative = pathname.replace(/^\//, '')
  const appRelative = `app/${relative}`
  return fs.existsSync(`${appRelative}/page.tsx`) || fs.existsSync(appRelative)
}

const teacherRoot = read('app/teacher/page.tsx')
requireText(teacherRoot.includes('PublicHeader'), 'public /teacher remains the intentional teacher marketing gateway')
requireText(teacherRoot.includes('/teacher/pulse'), 'public teacher gateway exposes an explicit Teacher OS entry')

const teacherLayout = read('app/teacher/layout.tsx')
const teacherNav = read('components/teacher/navigation.ts')
const teacherNavHrefs = Array.from(
  teacherNav.matchAll(/href:\s*["'](\/teacher\/[^"']+)["']/g),
  match => match[1],
)
requireText(teacherNavHrefs.length >= 20, 'teacher mobile navigation exposes the operating-system destinations')
for (const href of new Set(teacherNavHrefs)) {
  requireText(routeExists(href), `teacher navigation destination exists: ${href}`)
}
requireText(teacherLayout.includes('TeacherNavigation') && read('components/teacher/TeacherNavigation.tsx').includes('teacher-bottom-nav'), 'teacher layout retains mobile bottom navigation')
requireText(teacherLayout.includes('OfflineBar'), 'teacher layout exposes network/offline state')
requireText(teacherLayout.includes('href="/teacher/pulse"'), 'authenticated VibeSchool brand returns to canonical Teacher OS Today home')
requireText(!teacherLayout.includes('onClick={() => router.push("/teacher")}'), 'authenticated teacher shell cannot escape into the public teacher gateway through the brand')

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
requireText(!contextMigration.includes('teacher_profiles'), 'teacher operating context has no production-only teacher_profiles rebuild dependency')
requireText(contextMigration.includes('-- authorization-test: public.teacher_active_school_preferences'), 'active-school preference declares its authorization-test contract')

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

const studentsRoster = read('app/teacher/students/page.tsx')
requireText(studentsRoster.includes('.from("student_classes")'), 'Students derives roster from canonical enrollment')
requireText(studentsRoster.includes('.from("students")'), 'Students resolves learner identity separately from enrollment')
requireText(!studentsRoster.includes('students(id,name,admission_number,profile_id,deleted_at)'), 'Students does not depend on nested learner RLS join')

const classHubRoster = read('app/teacher/classhub/[id]/page.tsx')
requireText(classHubRoster.includes(".from('student_classes')"), 'ClassHub derives roster from canonical enrollment')
requireText(classHubRoster.includes(".from('students')"), 'ClassHub resolves learner identity separately from enrollment')
requireText(classHubRoster.includes('Retry instead of adding duplicate learners'), 'ClassHub does not translate roster read failures into zero learners')

const assessmentRoster = read('app/teacher/assessment/page.tsx')
requireText(assessmentRoster.includes("teacher_get_operating_context"), 'Assessment uses canonical teacher operating context')
requireText(assessmentRoster.includes(".from('student_classes')"), 'Assessment derives learners from canonical current enrollment')
requireText(assessmentRoster.includes('Retry instead of treating this class as empty'), 'Assessment does not translate roster read failures into zero learners')

const attendanceRoster = read('app/teacher/attendance/page.tsx')
requireText(attendanceRoster.includes('.select("student_id")'), 'Attendance derives roster IDs from canonical enrollment')
requireText(attendanceRoster.includes('.from("students")'), 'Attendance resolves learner identity separately from enrollment')
requireText(!attendanceRoster.includes('students(id,name,admission_number,deleted_at)'), 'Attendance does not depend on nested learner RLS join')
requireText(attendanceRoster.includes('.from("student_classes")'), 'attendance register derives roster from canonical current enrollment')
requireText(attendanceRoster.includes('.eq("is_current", true)'), 'attendance register restricts roster to current enrollment')
requireText(!attendanceRoster.includes('.not("profile_id"') && !attendanceRoster.includes('.not(\'profile_id\''), 'attendance register does not require a Student OS profile link')
requireText(attendanceRoster.includes('upsert_attendance_batch'), 'attendance writes through guarded batch authority')

const schemePage = read('app/teacher/scheme/AuthoritySchemePage.jsx')
requireText(schemePage.includes('ensureMyActiveSchoolTerm(todayIso())'), 'Scheme self-heals the teacher active school calendar before term/week reads')
requireText(schemePage.includes('school calendar could not be prepared automatically') && schemePage.includes('Instructional weeks could not be prepared automatically'), 'Scheme distinguishes term recovery failure from instructional-week recovery failure')
requireText(schemePage.includes('Your class and subject assignment are still connected'), 'Scheme preserves assignment truth when calendar recovery fails')

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
requireText(assessmentStudio.includes('exq_prepare_grounded_lesson_assessment'), 'lesson assessment uses canonical guarded grounded assessment authority')
requireText(assessmentStudio.includes('p_request_key:'), 'assessment generation carries retry/idempotency key')
requireText(assessmentStudio.includes('teacher_review_required'), 'generated assessment remains teacher-reviewed before release')

const teacherError = read('app/teacher/error.tsx')
requireText(teacherError.includes('reset={reset}'), 'teacher route has recoverable render-error handling')
requireText(teacherError.includes('homeHref="/teacher/pulse"'), 'teacher route error recovery returns to canonical Today home')
requireText(fs.existsSync('app/teacher/loading.tsx'), 'teacher route has a global loading state')

if (process.exitCode) {
  console.error('\nTeacher Pilot Task 4 contract FAILED')
  process.exit(process.exitCode)
}
console.log('\nTeacher Pilot Task 4 contract PASSED')
