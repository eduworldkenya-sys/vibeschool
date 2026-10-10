import fs from 'node:fs'
import assert from 'node:assert/strict'

const resourcePage = fs.readFileSync('app/teacher/resources/page.tsx', 'utf8')
const lessonModal = fs.readFileSync('components/teacher/LessonPlanModal.tsx', 'utf8')
const teachMode = fs.readFileSync('components/teacher/LessonTeachMode.tsx', 'utf8')
const lessonNotes = fs.readFileSync('app/teacher/lesson-notes/page.tsx', 'utf8')

const mustContain = [
  "resolve_instructional_week_for_date",
  "list_scheme_lesson_resources_batch",
  ".from('learning_resources')",
  ".eq('status', 'active')",
  ".eq('visibility', 'public')",
  ".from('teacher_classes')",
  ".from('scheme_of_work')",
  "Ready this week",
  "My teaching library",
  "Teacher-added resources stay class-scoped",
  "assignments.some(row => row.class_id === form.class_id && row.subject_id === form.subject_id)",
  "if (!form.external_url.trim() && !form.content.trim())",
  "isSafeUrl(form.external_url.trim())",
  "is_school_wide: false",
  "class_id: form.class_id",
  "/read/textbook/${publicationId}/${chapterId}",
]

for (const needle of mustContain) {
  assert.ok(resourcePage.includes(needle), `Teacher Resource OS contract missing: ${needle}`)
}

const forbidden = [
  "const isSchoolWide = !form.class_id",
  "No class selected — resource will be school-wide",
  "-- School-wide (all classes) --",
  "is_school_wide: form.school_wide",
  "class_id: form.school_wide ? null : form.class_id",
]
for (const needle of forbidden) {
  assert.ok(!resourcePage.includes(needle), `Unsafe legacy Resources behavior reintroduced: ${needle}`)
}

assert.ok(resourcePage.indexOf(".from('scheme_of_work')") < resourcePage.indexOf("list_scheme_lesson_resources_batch"), 'Scheme authority must be resolved before resource links')
assert.ok(resourcePage.indexOf("list_scheme_lesson_resources_batch") < resourcePage.indexOf(".from('learning_resources')"), 'Exact Scheme links must be resolved before canonical resource hydration')
assert.ok(resourcePage.indexOf(".from('teacher_classes')") < resourcePage.indexOf(".from('resources').insert"), 'Teacher assignment authority must be loaded before resource mutation')

for (const needle of [
  "list_teaching_resources",
  "listOccurrenceResourceUsage",
  "markOccurrenceResourceUsed",
  "lessonResources.map",
  "Used ✓",
  "onTeach={openPreparedTeachMode}",
]) {
  assert.ok(lessonModal.includes(needle), `Lesson workspace resource continuity missing: ${needle}`)
}

for (const needle of ["lessonPlanId: planId", "classId: slot.class_id", "subjectId: slot.subject_id", "teach: '1'", "query.set('occurrenceId', teachingOccurrence.occurrenceId)", "router.push(`/teacher/lesson-notes?${query}`)"]) {
  assert.ok(lessonModal.includes(needle), `Unified Teach Mode must retain exact lesson context: ${needle}`)
}
for (const needle of ['<LessonTeachMode', 'lessonPlanId: plan.id', 'occurrenceId: occurrence.id', 'linkedResources={resources.map', 'available: Boolean(resource.publicationId)', 'if (resource) openResource(resource)']) {
  assert.ok(lessonNotes.includes(needle), `Unified Teach Mode resource/occurrence continuity missing: ${needle}`)
}
assert.ok(teachMode.includes('disabled={!resource.available || !onOpenResource}'), 'Unavailable resource readers must not become active controls')

for (const needle of [
  'Now teaching',
  "sections[step.key]",
  "sections.differentiation",
  "Private scratchpad",
  "Use in reflection",
  "Classroom actions · same occurrence",
  "mode: 'lesson'",
  "timetableSlotId: context.timetableSlotId",
  "date: context.occurrenceDate",
  "onCaptureEvidence",
  "Finish lesson",
  "Lesson already completed",
  "Teaching companion · canonical lesson content",
  "Board / explanation / examples",
  "Questions · expected answers / evidence",
  "Misconception → correction → re-check",
  "Formative checkpoint",
  "Completed · content covered",
  "Partially covered",
  "Reteach required",
  "never marks learner mastery",
]) {
  assert.ok(teachMode.includes(needle), `Teach Now classroom contract missing: ${needle}`)
}

for (const forbiddenNeedle of [
  ".from('lesson_notes')",
  "startTeachingOccurrence(",
  "insert({",
]) {
  assert.ok(!teachMode.includes(forbiddenNeedle), `Teach Mode must not create parallel lesson authority: ${forbiddenNeedle}`)
}

const atomicFinishMigration = fs.readFileSync('supabase/migrations/20261001122500_atomic_teach_mode_finalization.sql', 'utf8')
for (const needle of [
  'security invoker',
  'complete_teaching_occurrence',
  'save_teaching_progress_record',
  'mark_scheme_item_covered',
  "p_outcome = 'covered'",
  'grant execute on function public.finalize_teaching_occurrence',
]) {
  assert.ok(atomicFinishMigration.includes(needle), `Atomic lesson finalization contract missing: ${needle}`)
}


for (const needle of [
  'finalize_teaching_occurrence',
  'p_outcome: outcome',
  'p_what_was_taught: whatWasTaught',
  'no partial completion was accepted',
  'Coverage outcome:',
  'teaching-coverage statement, not learner mastery',
]) {
  assert.ok(lessonNotes.includes(needle), `Lesson completion authority contract missing: ${needle}`)
}
assert.ok(!lessonNotes.includes('completeTeachingOccurrence({'), 'Lesson Notes must not split occurrence completion from progress persistence')
assert.ok(!lessonNotes.includes('markSchemeItemCovered(completed.id)'), 'Lesson Notes must not split Scheme coverage from atomic finalization')

console.log('Teacher Resource OS contract: PASS')
