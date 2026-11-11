import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) { return readFileSync(path, 'utf8') }
const launcher = read('app/teacher/scheme/generate/page.tsx')
const prepare = read('app/teacher/lessonplan/prepare/page.tsx')
const drafts = read('lib/teaching/lessonDrafts.ts')
const scheduled = read('app/teacher/lessonplan/page.tsx')
const migration = read('supabase/migrations/20261111105000_scheme_unscheduled_preparation_authority.sql')

assert.match(launcher, /if \(!scheduledMode\)\s*\{/)
assert.match(launcher, /\/teacher\/lessonplan\/prepare\?/)
assert.ok(launcher.indexOf('if (!scheduledMode)') <
          launcher.indexOf('const { data: weekRows'),
          'independent preparation must not read timetable or term weeks first')
assert.ok(launcher.includes("params.get('mode') === 'scheduled'"),
          'exact-week scheduled mode must remain accessible')
for (const field of ['schemeId', 'classId', 'subjectId']) {
  assert.ok(launcher.includes(field), 'scheme context lost: '+field)
}
assert.ok(prepare.includes("setScopeKey('class:' + assignment.assignment_id)"),
          'deep link must resolve to a teacher assignment')
assert.ok(prepare.includes("setRequestedSchemeId(linkScheme)"))
assert.ok(prepare.includes('draft.scheme_id === requestedSchemeId'),
          'repeated Prepare must resume the same draft')
assert.ok(prepare.includes('id: editingDraftId ?? matchingDraft?.id ?? null'),
          'saving a Scheme must update instead of cloning existing draft')
assert.ok(prepare.includes('generateLessonPlan({'),
          'unscheduled preparation must reuse the existing lesson generator')
assert.ok(prepare.includes('serializeLessonPlanBody(generated.sections)'),
          'generated plan must use the canonical eight-section body codec')
assert.ok(prepare.includes('window.print()'), 'unscheduled plans must print')
assert.ok(drafts.includes('resolve_instructional_week_for_date'),
          'auto-attachment must check the actual instructional calendar')
assert.ok(drafts.includes('if (matchingDrafts.length !== 1) return null'),
          'ambiguous matches must never attach arbitrarily')
assert.ok(drafts.includes('attachLessonPlanDraftToOccurrence({'),
          'auto-attachment must reuse the existing guarded RPC')
assert.ok(scheduled.includes('attachMatchingPreparedDraftToOccurrence({'),
          'scheduled opening must reuse an already prepared lesson')
assert.ok(migration.includes("co.status in ('active', 'verified')"),
          'active outcome must be available for unscheduled drafting')
assert.ok(migration.includes("co.status = 'verified'"),
          'Ready-to-Teach must still require verified outcome')
assert.ok(migration.includes('lesson_plan_drafts_one_open_per_scheme'),
          'there must be no duplicate active prepared draft for a Scheme item')
assert.ok(migration.includes('DRAFT_SCHEME_OCCURRENCE_WEEK_MISMATCH'),
          'attachment must not move lesson into a different instructional week')
for (const forbidden of [
  'insert into public.attendance',
  'insert into public.teaching_occurrences',
  'delete from public.lesson_plans'
]) assert.ok(!migration.includes(forbidden), 'migration must not mutate teaching delivery: '+forbidden)

console.log('PASS: unscheduled Scheme preparation, canonical source, and guarded attach')
