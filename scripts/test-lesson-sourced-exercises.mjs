import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { savedLessonTask } from '../lib/assessment/lessonTaskSource.ts'
import { EMPTY_LESSON_PLAN_SECTIONS, serializeLessonPlanBody } from '../lib/teaching/lessonPlanCodec.ts'

const taskSections = {
  ...EMPTY_LESSON_PLAN_SECTIONS,
  objectives: 'Compare two lengths.',
  consolidation: 'Measure a book in centimetres and record the result.',
  assessmentHook: 'What is the length of your pencil?',
  homework: 'Find and measure two objects at home.',
}
const body = serializeLessonPlanBody(taskSections)
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('class exercise, quiz and homework reuse exact saved lesson sections', () => {
  assert.deepEqual(savedLessonTask(body, 'exercise'), {
    section: 'consolidation',
    text: taskSections.consolidation,
  })
  assert.deepEqual(savedLessonTask(body, 'quiz'), {
    section: 'assessmentHook',
    text: taskSections.assessmentHook,
  })
  assert.deepEqual(savedLessonTask(body, 'homework'), {
    section: 'homework',
    text: taskSections.homework,
  })
  assert.ok(!savedLessonTask(body, 'exercise')?.text.includes(taskSections.objectives))
})

test('missing or broken lesson task fails closed instead of inventing questions', () => {
  assert.equal(savedLessonTask(serializeLessonPlanBody({ ...taskSections, consolidation: '' }), 'exercise'), null)
  assert.equal(savedLessonTask(serializeLessonPlanBody({ ...taskSections, homework: 'No certified homework task' }), 'homework'), null)
  assert.equal(savedLessonTask(serializeLessonPlanBody({ ...taskSections, assessmentHook: 'Do not invent questions' }), 'quiz'), null)
  assert.equal(savedLessonTask('Compare two lengths.', 'exercise'), null)
})

test('class Exercise workspace requires a current, owned saved lesson before drafting', () => {
  const page = read('app/teacher/classhub/[id]/exercises/page.tsx')
  assert.match(page, /ensureLessonExerciseDraft/)
  assert.match(page, /savedLessonTask\(fresh\.body \?\? "", "exercise"\)/)
  assert.match(page, /\.eq\("teacher_id", authority\.teacherId\)/)
  assert.match(page, /\.eq\("class_id", classId\)/)
  assert.match(page, /\.eq\("school_id", authority\.schoolId\)/)
  assert.match(page, /authority\.subjects\.some\(subject => subject\.id === fresh\.subject_id\)/)
  assert.doesNotMatch(page, /supabase\.from\("exercises"\)\.insert\(/)
  assert.match(page, /preserv/)
})

test('assessment generator copies lesson task and retains outcome lineage and review', () => {
  const studio = read('app/teacher/assessment/new/page.tsx')
  assert.match(studio, /savedLessonTask\(body, type\)/)
  assert.match(studio, /question\(source\.text, marks/)
  assert.match(studio, /exq_prepare_grounded_lesson_assessment/)
  assert.match(studio, /exq_link_item_outcome/)
  assert.match(studio, /teacher_review_required: true/)
  assert.doesNotMatch(studio, /\$\{outcome\} Use relevant lesson evidence/)
})
