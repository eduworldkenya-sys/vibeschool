#!/usr/bin/env node
import fs from 'node:fs'

const contextMigrationPath = 'supabase/migrations/20260819020500_student_core_journey_pilot_context.sql'
const homeworkMigrationPath = 'supabase/migrations/20260819021500_student_homework_retry_integrity.sql'
const exerciseMigrationPath = 'supabase/migrations/20260819022000_student_exercise_submission_integrity.sql'
const contextPath = 'lib/student-context.tsx'
const layoutPath = 'app/student/layout.tsx'
const exercisePath = 'app/student/exercises/page.tsx'
const notificationsPath = 'app/student/notifications/page.tsx'
const navPath = 'components/student/BottomNav.tsx'

const migration = fs.readFileSync(contextMigrationPath, 'utf8')
const homework = fs.readFileSync(homeworkMigrationPath, 'utf8')
const exerciseMigration = fs.readFileSync(exerciseMigrationPath, 'utf8')
const normalized = migration.replace(/\s+/g, ' ').toLowerCase()
const homeworkNormalized = homework.replace(/\s+/g, ' ').toLowerCase()
const exerciseNormalized = exerciseMigration.replace(/\s+/g, ' ').toLowerCase()
const context = fs.readFileSync(contextPath, 'utf8')
const layout = fs.readFileSync(layoutPath, 'utf8')
const exercisePage = fs.readFileSync(exercisePath, 'utf8')
const notifications = fs.readFileSync(notificationsPath, 'utf8')
const nav = fs.readFileSync(navPath, 'utf8')

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) throw new Error(`missing ${label}`)
}

requireText(normalized, "set timezone = 'africa/nairobi'", 'Nairobi learner-day execution')
requireText(normalized, "alter function %s set timezone to %l", 'student current_date timezone normalization')
requireText(normalized, "coalesce(nullif(item->>'progress_percent', '')::numeric, 0) < 100", 'unfinished-only Continue Learning rule')
requireText(normalized, "regexp_replace(lower(p.cbc_grade), '[^a-z0-9]+', '', 'g') = v_class_key", 'active grade Continue Learning scope')
requireText(normalized, "v_class_key in ('form1', 'form2', 'form3', 'form4')", 'KCSE Form boundary')
requireText(normalized, "aa.status in ('assigned', 'open')", 'canonical assessment lifecycle')
requireText(normalized, 'cgm.student_id = v_student_id', 'target-group learner authorization')
requireText(normalized, 'revoke all on function public.student_get_vibelearn_workstation_base_20260819() from public, anon, authenticated', 'base workstation bypass revocation')
requireText(normalized, 'revoke all on function public.student_get_vibelearn_workstation() from public, anon', 'public/anon workstation revocation')

if (/aa\.status\s*=\s*'published'/i.test(migration)) {
  throw new Error('assessment assignment lifecycle regressed to impossible published state')
}

requireText(homeworkNormalized, "v_submission.status in ('submitted', 'received', 'under_review', 'marked')", 'received homework draft lock')
requireText(homeworkNormalized, "v_existing.status in ('submitted', 'received')", 'homework idempotent replay state')
requireText(homeworkNormalized, "'idempotent_replay', true", 'homework replay receipt')
requireText(homeworkNormalized, 'submitted_at = coalesce(submitted_at, clock_timestamp())', 'stable homework submission timestamp')
requireText(homeworkNormalized, 'received_at = coalesce(received_at, clock_timestamp())', 'stable homework receipt timestamp')
requireText(homeworkNormalized, 'h.school_id = sc.school_id', 'homework school boundary')
requireText(homeworkNormalized, 'cgm.student_id = s.id', 'homework target-group learner boundary')
requireText(homeworkNormalized, 'revoke all on function public.submit_student_homework(uuid,jsonb,text) from public, anon', 'homework public/anon revocation')

requireText(exerciseNormalized, "v_existing.status = 'submitted'", 'exercise idempotent replay state')
requireText(exerciseNormalized, "v_submission.status in ('submitted', 'marked')", 'exercise draft lock')
requireText(exerciseNormalized, "'idempotent_replay', true", 'exercise replay receipt')
requireText(exerciseNormalized, "raise exception 'exercise_response_required'", 'exercise empty-submit rejection')
requireText(exerciseNormalized, "e.homework_id is null", 'exercise/homework separation')
requireText(exerciseNormalized, 'revoke all on function public.student_submit_exercise(uuid,text,text) from public, anon', 'exercise public/anon revocation')
requireText(exercisePage, 'student_save_exercise_draft', 'exercise draft UI')
requireText(exercisePage, 'student_submit_exercise', 'exercise submit UI')
requireText(exercisePage, 'student_sync_task_execution_receipt', 'exercise progress synchronization')
requireText(exercisePage, 'disabled={locked || busy}', 'exercise post-submit lock')

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

console.log('PASS: Task 5 student pilot contract covers learner-day semantics, active learning context, assessment lifecycle, homework/exercise retry integrity, actionable notifications, navigation, and recoverable identity loading')
