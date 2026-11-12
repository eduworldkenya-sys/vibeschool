import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(path, 'utf8')
const prepare = read('app/teacher/lessonplan/prepare/page.tsx')
const teach = read('app/teacher/lessonplan/teach-unscheduled/page.tsx')
const sql = read('supabase/migrations/20261112104242_unscheduled_teaching_occurrence.sql')

test('missing timetable remains nonblocking for assigned teachers preparing lessons', () => {
  assert.match(prepare, /Promise\.allSettled\(\[/)
  assert.match(prepare, /loadTeacherTimetableForRange/)
  assert.match(prepare, /loadLessonPlanDrafts\(user\.id, sid\)/)
  assert.match(prepare, /Scheduled lesson choices could not load\. Saved drafts remain available\./)
  assert.match(prepare, /Save prepared lesson/)
})

test('Scheme topic search supports all school terms but never drops teacher or class scope', () => {
  assert.match(prepare, /<option value="all">Search all school terms<\/option>/)
  const query = prepare.split('let schemeRequest = supabase.from(\'scheme_of_work\')')[1]
    ?.split('const { data: schemeRows')[0]
  assert.ok(query, 'Canonical scoped Scheme query must exist')
  for (const predicate of [
    ".eq('school_id', schoolId)",
    ".eq('teacher_id', teacherId)",
    ".eq('class_id', selectedScope.classId)",
    ".eq('subject_id', selectedScope.subjectId)",
    ".not('curriculum_outcome_id', 'is', null)",
  ]) assert.ok(query.includes(predicate), 'Missing scoped Scheme predicate: ' + predicate)
  assert.match(query, /schemeTermScope === 'current' && activeTermId/)
  assert.match(query, /\.ilike\('topic', '%' \+ schemeQuery \+ '%'\)/)
  assert.match(prepare, /academic_term_id,topic/)
  assert.match(prepare, /s\.term_label.*Week \{s\.week\}/)
})

test('unscheduled Teach resumes only this Nairobi date and the teacher-owned occurrence', () => {
  assert.match(teach, /import \{ nairobiDateStr \} from '@\/lib\/time'/)
  assert.match(teach, /\.eq\('taught_date', nairobiDateStr\(\)\)\.is\('timetable_slot_id', null\)/)
  assert.match(teach, /\.eq\('prepared_draft_id', typed\.id\)\.eq\('teacher_id', user\.id\)/)
  assert.match(teach, /\.eq\('unscheduled_plan_id', plan\.id\)\.eq\('teacher_id', user\.id\)/)
  assert.match(teach, /occurrence\?\.lifecycle === 'in_progress'/)
  assert.match(teach, /occurrence\?\.lifecycle === 'completed'/)
  assert.match(teach, /setActive\(\{ occurrence: occurrence as Occurrence, plan \}\)/)
  assert.match(teach, /\|\| busy \|\| completed\}/)
})

test('teaching and completion stay under one verified, audited canonical RPC', () => {
  assert.match(teach, /supabase\.rpc\('start_unscheduled_teaching'/)
  assert.match(teach, /supabase\.rpc\('complete_unscheduled_teaching'/)
  assert.match(sql, /co\.status='verified'/)
  assert.match(sql, /lesson_draft_authorized/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /bind_teaching_occurrence_outcome/)
  assert.match(sql, /'attendance_recorded',false/)
  assert.match(sql, /'learning_evidence_recorded',false/)
})
