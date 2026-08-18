#!/usr/bin/env node
import fs from 'node:fs'

const contextMigrationPath = 'supabase/migrations/20260819020500_student_core_journey_pilot_context.sql'
const homeworkMigrationPath = 'supabase/migrations/20260819021500_student_homework_retry_integrity.sql'
const exerciseMigrationPath = 'supabase/migrations/20260819022000_student_exercise_submission_integrity.sql'
const releaseMigrationPath = 'supabase/migrations/20260819022500_student_pilot_content_release_reconciliation.sql'
const resumeMigrationPath = 'supabase/migrations/20260819022700_student_vibelearn_resume_grade_scope.sql'
const assessmentMigrationPath = 'supabase/migrations/20260819023000_assessment_item_grounding_rpc_reconciliation.sql'
const notificationMigrationPath = 'supabase/migrations/20260819023500_student_actionable_notification_events.sql'
const contextPath = 'lib/student-context.tsx'
const layoutPath = 'app/student/layout.tsx'
const vibeLearnLayoutPath = 'app/student/vibelearn/layout.tsx'
const exercisePath = 'app/student/exercises/page.tsx'
const notificationsPath = 'app/student/notifications/page.tsx'
const navPath = 'components/student/BottomNav.tsx'

const normalize = value => value.replace(/\s+/g, ' ').toLowerCase()
const migration = fs.readFileSync(contextMigrationPath, 'utf8')
const homework = normalize(fs.readFileSync(homeworkMigrationPath, 'utf8'))
const exerciseMigration = normalize(fs.readFileSync(exerciseMigrationPath, 'utf8'))
const releaseMigration = normalize(fs.readFileSync(releaseMigrationPath, 'utf8'))
const resumeMigration = normalize(fs.readFileSync(resumeMigrationPath, 'utf8'))
const assessmentMigration = normalize(fs.readFileSync(assessmentMigrationPath, 'utf8'))
const notificationMigration = normalize(fs.readFileSync(notificationMigrationPath, 'utf8'))
const normalized = normalize(migration)
const context = fs.readFileSync(contextPath, 'utf8')
const layout = fs.readFileSync(layoutPath, 'utf8')
const vibeLearnLayout = fs.readFileSync(vibeLearnLayoutPath, 'utf8')
const exercisePage = fs.readFileSync(exercisePath, 'utf8')
const notifications = fs.readFileSync(notificationsPath, 'utf8')
const nav = fs.readFileSync(navPath, 'utf8')

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) throw new Error(`missing ${label}`)
}

requireText(normalized, "set timezone = 'africa/nairobi'", 'Nairobi learner-day execution')
requireText(normalized, "alter function %s set timezone to %l", 'student current_date timezone normalization')
requireText(normalized, "coalesce(nullif(item->>'progress_percent', '')::numeric, 0) < 100", 'unfinished-only Continue Learning rule')
requireText(normalized, "v_class_key in ('form1', 'form2', 'form3', 'form4')", 'KCSE Form boundary')
requireText(normalized, "aa.status in ('assigned', 'open')", 'canonical assessment lifecycle')
requireText(normalized, 'cgm.student_id = v_student_id', 'target-group learner authorization')
requireText(normalized, 'revoke all on function public.student_get_vibelearn_workstation_base_20260819() from public, anon, authenticated', 'base workstation bypass revocation')

if (/aa\.status\s*=\s*'published'/i.test(migration)) {
  throw new Error('assessment assignment lifecycle regressed to impossible published state')
}

requireText(homework, "v_submission.status in ('submitted', 'received', 'under_review', 'marked')", 'received homework draft lock')
requireText(homework, "v_existing.status in ('submitted', 'received')", 'homework idempotent replay state')
requireText(homework, "'idempotent_replay', true", 'homework replay receipt')
requireText(homework, 'submitted_at = coalesce(submitted_at, clock_timestamp())', 'stable homework submission timestamp')
requireText(homework, 'received_at = coalesce(received_at, clock_timestamp())', 'stable homework receipt timestamp')
requireText(homework, 'h.school_id = sc.school_id', 'homework school boundary')
requireText(homework, 'cgm.student_id = s.id', 'homework target-group learner boundary')

requireText(exerciseMigration, "v_existing.status = 'submitted'", 'exercise idempotent replay state')
requireText(exerciseMigration, "v_submission.status in ('submitted', 'marked')", 'exercise draft lock')
requireText(exerciseMigration, "'idempotent_replay', true", 'exercise replay receipt')
requireText(exerciseMigration, "raise exception 'exercise_response_required'", 'exercise empty-submit rejection')
requireText(exerciseMigration, "e.homework_id is null", 'exercise/homework separation')
requireText(exercisePage, 'student_save_exercise_draft', 'exercise draft UI')
requireText(exercisePage, 'student_submit_exercise', 'exercise submit UI')
requireText(exercisePage, 'student_sync_task_execution_receipt', 'exercise progress synchronization')
requireText(exercisePage, 'disabled={locked || busy}', 'exercise post-submit lock')

requireText(releaseMigration, 'where vc.publication_id=p_publication_id', 'unambiguous publication chapter release')
requireText(releaseMigration, 'and (v_school_id is null or s.school_id=v_school_id)', 'school-scoped textbook subject reconciliation')
requireText(releaseMigration, "perform public.sync_vibelearn_textbook_index(p_publication_id)", 'release to VibeLearn index synchronization')

requireText(resumeMigration, "nullif(btrim(p.cbc_grade),'') is not null", 'explicit-grade resume eligibility')
requireText(resumeMigration, "regexp_replace(lower(p.cbc_grade), '[^a-z0-9]+', '', 'g')=v_class_key", 'exact current-grade resume scope')
requireText(resumeMigration, "coalesce(nullif(item->>'progress_percent','')::numeric,0) < 100", 'unfinished resume promotion')
requireText(resumeMigration, 'revoke all on function public.student_get_vibelearn_workstation_scoped_base_20260819() from public, anon, authenticated', 'resume base bypass revocation')

requireText(vibeLearnLayout, 'const isForm4 = classKey === "form4"', 'Form 4 exam-mode boundary')
requireText(vibeLearnLayout, 'return isForm4 ? children : <GeneralLearnerVibeLearn />;', 'non-Form learner workstation boundary')
requireText(vibeLearnLayout, '.in("subject_id", subjectIds)', 'canonical class-subject resource scope')
requireText(vibeLearnLayout, '.eq("status", "live")', 'live-resource-only discovery')
requireText(vibeLearnLayout, 'Learn what belongs to your class.', 'non-Form learner-mode UX')

requireText(assessmentMigration, "p_source_exercise_ref ? 'source_block_id'", 'assessment source-block grounding input')
requireText(assessmentMigration, 'source_resource_id,source_exercise_ref,source_block_id,question_type,prompt', 'assessment source-block persistence')
requireText(assessmentMigration, "raise exception 'source_block_not_found'", 'invalid assessment grounding rejection')

requireText(notificationMigration, 'notifications_active_event_uniq', 'notification deduplication index')
requireText(notificationMigration, "'homework_assigned'", 'homework assignment notification')
requireText(notificationMigration, "'assessment_available'", 'assessment availability notification')
requireText(notificationMigration, "'homework_feedback'", 'homework feedback notification')
requireText(notificationMigration, "'assessment_result'", 'assessment result notification')
requireText(notificationMigration, 'is_read=false', 'notification re-open on meaningful update')

requireText(context, 'retry:    () => void', 'student identity retry contract')
requireText(context, 'const [retryNonce, setRetryNonce] = useState(0)', 'student identity retry state')
requireText(context, 'setRetryNonce(value => value + 1)', 'student identity retry action')
requireText(layout, 'const { identity, loading, error, retry } = useStudent();', 'student shell retry consumption')
requireText(layout, 'onClick={retry}', 'real identity retry control')

requireText(nav, 'label: "Progress"', 'student Progress primary navigation')
requireText(nav, 'aria-label="Student primary navigation"', 'student navigation accessibility label')
requireText(notifications, '.select("id, title, body, type, related_id, is_read, created_at")', 'notification destination identity')
requireText(notifications, 'router.push(notificationTarget(n))', 'actionable student notification navigation')
requireText(notifications, 'Check my tasks', 'notification empty-state next action')

console.log('PASS: Task 5 student pilot contract covers learner-day semantics, grade-safe VibeLearn, release reconciliation, grounded assessments, homework/exercise retry integrity, authoritative notifications, navigation, and recoverable identity loading')
