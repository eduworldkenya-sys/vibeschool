import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { selectCanonicalLessonNotes } from '../lib/teaching/canonicalLessonNotes.ts'

// Regression: never publish drafts, private roots or uncertified versions
// while attaching source-correct materials to a teacher's prepared lesson.
const root = (id, overrides = {}) => ({
  id,
  title: id,
  asset_kind: 'teacher_notes',
  status: 'active',
  visibility: 'public',
  curriculum_outcome_id: 'outcome-A',
  sub_strand_id: 'strand-A',
  ...overrides,
})
const version = (resource_id, overrides = {}) => ({
  id: resource_id + '-version',
  resource_id,
  version: 1,
  lifecycle_status: 'certified',
  certified_at: '2026-11-12T08:00:00Z',
  ...overrides,
})
const roots = [
  root('exact'),
  root('same-strand-different-outcome', { curriculum_outcome_id: 'outcome-B' }),
  root('same-outcome-wrong-strand', { sub_strand_id: 'strand-B' }),
  root('sub-strand-only', { curriculum_outcome_id: null, asset_kind: 'learner_notes' }),
  root('private', { visibility: 'private' }),
  root('inactive', { status: 'inactive' }),
  root('not-notes', { asset_kind: 'worksheet' }),
  root('other-strand', { curriculum_outcome_id: null, sub_strand_id: 'strand-B' }),
  root('unversioned'),
  root('candidate-version'),
]
const versions = [
  version('exact', { id: 'exact-old' }),
  version('exact', { id: 'exact-new', version: 2 }),
  version('same-strand-different-outcome'),
  version('same-outcome-wrong-strand'),
  version('sub-strand-only'),
  version('private'),
  version('inactive'),
  version('not-notes'),
  version('other-strand'),
  version('candidate-version', { lifecycle_status: 'candidate', certified_at: null }),
]
const items = selectCanonicalLessonNotes(roots, versions, 'outcome-A', 'strand-A')
assert.deepEqual(items.map(item => [item.resourceId, item.scope]), [
  ['exact', 'exact_outcome'],
  ['sub-strand-only', 'related_sub_strand'],
])
assert.equal(items[0].resourceVersionId, 'exact-new', 'newest certified version takes precedence')
assert.equal(items[1].kind, 'learner_notes')
assert.equal(selectCanonicalLessonNotes(roots, versions, 'outcome-Z', null).length, 0, 'never guess a match from title')
assert.deepEqual(
  selectCanonicalLessonNotes(roots, versions, null, 'strand-A').map(item => item.scope),
  ['related_sub_strand'],
  'missing outcome ID may show related notes but not certify their identity',
)
assert.equal(selectCanonicalLessonNotes([root('candidate')], [version('candidate', { lifecycle_status: 'candidate' })], 'outcome-A', 'strand-A').length, 0)
assert.equal(selectCanonicalLessonNotes([root('no-cert-date')], [version('no-cert-date', { certified_at: null })], 'outcome-A', 'strand-A').length, 0)

const panel = readFileSync('components/teacher/CanonicalLessonNotesPanel.tsx', 'utf8')
const notesPage = readFileSync('app/teacher/lesson-notes/page.tsx', 'utf8')
const reader = readFileSync('app/teacher/resources/read/[resourceId]/page.tsx', 'utf8')
for (const required of [
  "supabase.auth.getUser()",
  ".from('learning_resources')",
  ".in('asset_kind', ['teacher_notes', 'learner_notes'])",
  ".eq('status', 'active')",
  ".eq('visibility', 'public')",
  ".eq('curriculum_outcome_id', outcomeId)",
  ".eq('sub_strand_id', subStrandId)",
  ".is('curriculum_outcome_id', null)",
  ".eq('lifecycle_status', 'certified')",
  ".not('certified_at', 'is', null)",
  "selectCanonicalLessonNotes(",
  "outcome mapping pending",
  "/teacher/resources/read/",
]) assert.ok(panel.includes(required), 'Certified note discovery boundary: ' + required)
for (const prohibited of [
  ".update(", ".insert(", "service_role", "status', 'draft'",
  "lifecycle_status', 'candidate'", "dangerouslySetInnerHTML",
]) assert.ok(!panel.includes(prohibited), 'No draft promotion or unsafe client operations allowed: ' + prohibited)
for (const required of [
  "CanonicalLessonNotesPanel", "setCanonicalNotesScope",
  "curriculum_outcome_id", "schemeOutcomeId",
  "different learning outcomes; reconcile",
  "Prepared Lesson Plan outline",
  "approved",
]) assert.ok(notesPage.includes(required), 'Lesson page must preserve authority or distinguish note types: ' + required)
assert.ok(reader.includes(".eq('id', versionId).eq('resource_id', root.id)"))
assert.ok(reader.includes(".eq('lifecycle_status', 'certified')"))
assert.ok(reader.includes(".eq('status', 'active')"))
assert.ok(reader.includes(".eq('visibility', 'public')"))
console.log('Canonical Lesson Notes: exact outcome, related-not-exact, private/draft/candidate exclusion, version identity and page contract PASS')
