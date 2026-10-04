import fs from 'node:fs'
import assert from 'node:assert/strict'

const page = fs.readFileSync('app/teacher/lesson-notes/page.tsx', 'utf8')
const migration = fs.readFileSync('supabase/migrations/20261004092000_teacher_note_overlays.sql', 'utf8')

for (const needle of [
  'Quick notes',
  'Full notes',
  'Teacher extras',
  'Shared approved notes',
  'My concept note',
  'My lesson note',
  '.from("teacher_note_overlays")',
  '.eq("note_kind", "concept")',
  '.eq("note_kind", "lesson")',
  'source_chapter_id',
  'source_derivative_id',
]) {
  assert.ok(page.includes(needle), `Canonical Notes UI contract missing: ${needle}`)
}

for (const needle of [
  'create table if not exists public.teacher_note_overlays',
  "note_kind in ('concept','lesson')",
  'uq_teacher_note_overlays_concept',
  'uq_teacher_note_overlays_lesson',
  'enable row level security',
  '(select auth.uid()) = teacher_id',
  'lesson_plans lp',
  'teaching_occurrences o',
]) {
  assert.ok(migration.includes(needle), `Teacher Notes persistence contract missing: ${needle}`)
}

assert.ok(!page.includes('.from("lesson_notes")'), 'Canonical Notes must not revive deprecated lesson_notes authority')
assert.ok(!migration.includes('security definer'), 'Private overlays do not need RLS bypass')
assert.ok(!migration.includes('grant all'), 'Teacher overlay privileges must stay least-privilege')

console.log('Canonical teacher notes contract: PASS')
