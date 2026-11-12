import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { deriveTeachingWorkspace } from '../lib/teaching/workspace'

const fixture = {
  key: { timetableSlotId: 'slot-1', occurrenceDate: '2026-11-12' },
  occurrenceId: 'original-1',
  persistedLifecycle: 'missed',
  schoolId: 'school-1', teacherId: 'teacher-1',
  classId: 'class-1', subjectId: 'subject-1',
  dayOfWeek: 4, startTime: '16:10:00', endTime: '16:40:00',
  lessonPlanId: 'plan-1',
  attendance: { state: 'complete', markedCount: 5, expectedCount: 5 },
  evidence: { count: 1, latestEvidenceId: 'evidence-1' },
  homework: { homeworkId: null, issued: false },
  assessment: { count: 0, learnerCount: 0, latestAssessmentId: null },
  reflection: { reflectionId: null, completed: false },
  progress: { progressRecordId: null, recorded: false, teacherRemarks: null, nextSteps: null },
  lifecycle: 'missed',
}

const missed = deriveTeachingWorkspace(fixture)
assert.equal(missed.primaryAction, 'recover_lesson', 'Missed must not start directly')
assert.equal(missed.canStart, false)
assert.equal(missed.canRecover, true)
assert.equal(deriveTeachingWorkspace({ ...fixture, persistedLifecycle: 'planned' }).canRecover, false,
  'Overdue UI inference must not authorize a writer that requires persisted missed state')
assert.equal(missed.stages.find(x => x.stage === 'teach')?.state, 'blocked')
assert.equal(deriveTeachingWorkspace({ ...fixture, occurrenceId: null }).canRecover, false,
  'Recovery requires an actual persisted original UUID')
const ready = deriveTeachingWorkspace({ ...fixture, lifecycle: 'ready' })
assert.equal(ready.canStart, true)
assert.equal(ready.canRecover, false)
const teaching = deriveTeachingWorkspace({ ...fixture, lifecycle: 'in_progress' })
assert.equal(teaching.canComplete, true)
assert.equal(teaching.canStart, false)
const finished = deriveTeachingWorkspace({
  ...fixture, lifecycle: 'completed', persistedLifecycle: 'completed',
  progress: { ...fixture.progress, progressRecordId: 'progress-1', recorded: true },
  reflection: { reflectionId: 'reflection-1', completed: true },
})
assert.equal(finished.primaryAction, 'review_lesson')
assert.equal(finished.canComplete, false)

const read = relative => readFile(new URL('../' + relative, import.meta.url), 'utf8')
const [occurrence, note, modal, teach, recoveryWriter] = await Promise.all([
  read('lib/teaching/occurrence.ts'),
  read('app/teacher/lesson-notes/page.tsx'),
  read('components/teacher/LessonPlanModal.tsx'),
  read('components/teacher/LessonTeachMode.tsx'),
  read('supabase/migrations/20260722124812_tbl009a_recovery_writer.sql'),
])
assert.match(occurrence, /'rescheduled', 'missed'\]\.includes\(persisted\.lifecycle\)/)
assert.match(occurrence, /if \(!persistedOccurrence &&/)
assert.match(note, /startTeachingOccurrence\(\{/)
assert.match(note, /\.eq\("timetable_slot_id", typedPlan\.timetable_slot_id!\)/)
assert.match(note, /\.eq\("occurrence_date", typedPlan\.taught_date!\)/)
assert.match(note, /recovered_from_id/)
assert.match(note, /finalize_teaching_occurrence_v2/)
assert.match(note, /Saved completed lesson history/)
assert.match(note, /setCompletedRecord\(\{/)
assert.match(note, /finalizedRow\?\.occurrence_id !== occurrence\.id/)
assert.doesNotMatch(note, /onTeach=\{\(\) => setTeachMode\(true\)\}/)
assert.match(modal, /function handleCompleteLesson\(\) \{[\s\S]*?openPreparedTeachMode\(\)/)
assert.doesNotMatch(modal, /await completeLessonOccurrence\(/)
assert.match(modal, /void handleStartLesson\(\)/)
assert.match(teach, /!completionFacts\.attendanceSaved && !attendanceUnavailableReason\.trim\(\)/)
assert.match(teach, /!completionFacts\.evidenceSaved && !noEvidenceReason\.trim\(\)/)
assert.doesNotMatch(teach, /setAttendanceResolved|setEvidenceResolved/)
assert.match(recoveryWriter, /recovered_from_id/)
assert.match(recoveryWriter, /uq_active_recovery_ancestry/)
assert.match(recoveryWriter, /update public\.teaching_occurrences\s+set lifecycle = 'rescheduled'/)
console.log('TBL-08 occurrence replay and recovery regression: PASS')
