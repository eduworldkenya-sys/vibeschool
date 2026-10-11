import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/20261011060627_teacher_os_canonical_lifecycle.sql', import.meta.url), 'utf8')
const teachMode = await readFile(new URL('../components/teacher/LessonTeachMode.tsx', import.meta.url), 'utf8')
const planModal = await readFile(new URL('../components/teacher/LessonPlanModal.tsx', import.meta.url), 'utf8')
const pulseFetcher = await readFile(new URL('../lib/pulse/fetcher.ts', import.meta.url), 'utf8')
const teacherGuide = await readFile(new URL('../app/teacher/teacher-guide/page.tsx', import.meta.url), 'utf8')
const lessonWorkspace = await readFile(new URL('../lib/teaching/lessonWorkspace.ts', import.meta.url), 'utf8')
const workspaceNav = await readFile(new URL('../components/teacher/TeachingWorkspaceNav.tsx', import.meta.url), 'utf8')

for (const contract of [
  'curriculum_outcome_id',
  'create table if not exists public.learning_tasks',
  'create table if not exists public.learning_task_submissions',
  'create or replace function public.get_teacher_day',
  'create or replace function public.finalize_teaching_occurrence_v2',
  'attendance_resolution_required',
  'evidence_resolution_required',
  'follow_up_decision_required',
  'reflection_required',
  'academic_task_outcome_required',
  'task_occurrence_identity_mismatch',
  'grant execute on function public.get_teacher_day(date) to authenticated',
]) assert.ok(migration.toLowerCase().includes(contract.toLowerCase()), `missing lifecycle contract: ${contract}`)

assert.doesNotMatch(migration, /grant execute on function public\.(?:get_teacher_day|finalize_teaching_occurrence_v2).*\b(?:public|anon)\b/i)
assert.match(teachMode, /!teachingStarted/)
assert.match(teachMode, />\s*Start teaching\s*</)
assert.match(teachMode, /teachingStarted: started/)
assert.match(planModal, /router\.push\(`\/teacher\/lesson-notes\?\$\{q\.toString\(\)\}`\)/)
assert.doesNotMatch(planModal, /router\.push\(attendanceUrl\)/)
assert.match(pulseFetcher, /rpc\(\s*["']get_teacher_day["']/)
assert.match(pulseFetcher, /attendance_state === ["']complete["']/)
assert.match(teacherGuide, /Incomplete Teacher Guide/)
assert.match(teacherGuide, /expectedLessonPlanId:lessonPlanId,expectedOccurrenceId:occurrenceId/)
assert.match(lessonWorkspace, /requested lesson plan does not belong to this scheduled lesson/)
assert.match(lessonWorkspace, /requested occurrence does not belong to this scheduled lesson/)
assert.match(workspaceNav, /context\.set\('lessonPlanId'/)
assert.match(workspaceNav, /context\.set\('occurrenceId'/)
assert.match(workspaceNav, /context\.set\('timetableSlotId'/)
assert.match(workspaceNav, /context\.set\('date'/)

console.log('Teacher OS canonical lifecycle contract: PASS')
