import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}
function requireText(label, haystack, needle) {
  if (!haystack.includes(needle)) throw new Error(`missing ${label}: ${needle}`)
}
function forbidText(label, haystack, needle) {
  if (haystack.includes(needle)) throw new Error(`forbidden ${label}: ${needle}`)
}

const migration = read('supabase/migrations/20261004190000_timetable_modernization_closure.sql')
const timetable = read('app/teacher/timetable/page.tsx')
const modal = read('components/teacher/AddSlotModal.tsx')
const prepare = read('app/teacher/lessonplan/prepare/page.tsx')
const lessonPage = read('app/teacher/lessonplan/page.tsx')
const setup = read('app/teacher/timetable/setup/page.tsx')
const drafts = read('lib/teaching/lessonDrafts.ts')

for (const token of [
  'create table if not exists public.lesson_plan_drafts',
  'attach_lesson_plan_draft_to_occurrence',
  'create table if not exists public.school_lesson_duration_defaults',
  'create table if not exists public.school_calendar_exceptions',
  'create table if not exists public.teacher_absences',
  'assign_occurrence_substitute',
  'get_my_substitute_occurrences',
  "'school_id', s.school_id",
  'snapshot_school_access_denied',
  'get_school_day_blocks_for_member',
  'save_school_period_block',
  'delete_school_period_block',
  'set_school_lesson_duration_default',
]) requireText('closure migration authority', migration, token)

requireText('draft RLS teacher ownership', migration, 'teacher_id = (select auth.uid())')
requireText('draft school membership', migration, "sm.role::text = 'teacher'")
requireText('substitution admin guard', migration, 'public.is_school_admin(v.school_id)')
requireText('snapshot per-row school restore', migration, "nullif(v_row->>'school_id','')::uuid")
forbidText('no lesson plan nullable weakening', migration, 'alter column timetable_slot_id drop not null')

requireText('independent preparation headline', prepare, 'Prepare a lesson before it is scheduled')
requireText('independent preparation persistence', prepare, 'saveLessonPlanDraft')
requireText('independent preparation attachment', prepare, 'attachLessonPlanDraftToOccurrence')
requireText('independent preparation no evidence copy', prepare, 'without copying attendance, evidence or delivery history')
requireText('lesson page entry point', lessonPage, 'Prepare without timetable')

requireText('draft repository table', drafts, ".from('lesson_plan_drafts')")
requireText('draft attachment RPC', drafts, "'attach_lesson_plan_draft_to_occurrence'")

for (const token of [
  'schoolFilter',
  'isLessonPlanReadyToTeach',
  'Undo last change',
  'calendarExceptions',
  'get_my_substitute_occurrences',
  'Copy Lesson',
  'Substitute lesson',
  'School day setup',
  'Prepare lesson',
  'Repeat from next week',
]) requireText('timetable closure UI', timetable, token)

requireText('multi-school slot reader', timetable, 'schoolSlotGroups')
requireText('school-specific weekly periods', timetable, 'schoolBlocks[schoolFilter]')
requireText('substitute ownership boundary', timetable, 'recurring schedule edits are intentionally unavailable here')
requireText('undo server restore', timetable, 'restoreTimetableSnapshot')
requireText('readiness badge', timetable, "slot.readiness === 'ready'")

requireText('copy snapshot', modal, 'snapshotTimetable')
requireText('copy mode', modal, 'Copy lesson')
requireText('grade duration query', modal, ".from('school_lesson_duration_defaults')")
requireText('grade duration advice', modal, 'school default:')
requireText('configured periods remain primary', modal, 'teachingBlock')

requireText('setup member reader', setup, "'get_school_day_blocks_for_member'")
requireText('setup admin capability', setup, "'can_manage_my_school_timetable'")
requireText('setup period writer', setup, "'save_school_period_block'")
requireText('setup duration writer', setup, "'set_school_lesson_duration_default'")
requireText('setup human explanation', setup, 'Define the real teaching periods, breaks and grade-specific lesson lengths used by your school.')

console.log('PASS: timetable modernization closure covers independent preparation, governed school-day setup, copy/undo, multi-school visibility, readiness, exceptions and substitution boundaries')
