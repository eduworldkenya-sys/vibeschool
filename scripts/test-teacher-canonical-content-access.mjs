// Regression guard: scheduled and unscheduled lessons share certified source authority.
// The Jumping pilot may be previewed as a private editorial draft only.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const bundle = read('lib/teaching/lessonSourceBundle.ts')
const ahead = read('app/teacher/lessonplan/prepare/page.tsx')
const modal = read('components/teacher/LessonPlanModal.tsx')
const picker = read('components/teacher/JumpingSchemeContent.jsx')

assert.ok(bundle.includes('export async function loadCertifiedContentForSource('), 'Shared certified resolver must be exported')
assert.ok(bundle.includes('const certifiedContent = await loadCertifiedContentForSource(source)'), 'Scheduled workspace must reuse shared resolver')
assert.ok(bundle.includes(".eq('lifecycle_status', 'certified')"), 'Only certified source versions are deliverable')
assert.ok(bundle.includes("includeGradeOneJumpingAsset(root.canonical_key,lessonNumber)"), 'Scheme lesson unit must be selected exactly')
assert.ok(ahead.includes("await loadCertifiedContentForSource({"), 'Prepare Ahead must reuse shared resolver')
assert.ok(ahead.includes("await generateCanonicalLessonPlan("), 'Prepared lessons must use the canonical generator when certified content exists')
assert.ok(ahead.includes("certifiedContent: approved"), 'Prepare Ahead must pass exact certified assets into the generator')
assert.ok(ahead.includes('buildJumpingDraftSections(chosenDraft,'), 'Jumping draft preview must use the same original manuscripts')
assert.ok(ahead.includes('No certified content is available for this Scheme lesson'), 'Uncertified fallback must be explicitly labelled')
assert.ok(ahead.includes("lesson_number: number | null"), 'Lesson identity must not be replaced by week')
assert.ok(ahead.includes('<JumpingSchemeContent schemeId={selectedScheme.id}'), 'Unscheduled teacher may inspect exact Jumping scheme manuscripts')
assert.ok(modal.includes('buildJumpingDraftSections(jumpingDraft, suggestion)'), 'Scheduled plan retains original Jumping draft source')
assert.ok(picker.includes("'vs_read_linked_jumping_scheme_content'"), 'Editorial reader stays behind teacher-authorized RPC')
console.log('Teacher canonical content lookup and independent preparation contract: PASS')
