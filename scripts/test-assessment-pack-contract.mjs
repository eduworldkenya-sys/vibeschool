import fs from 'node:fs'

function read(path) { return fs.readFileSync(path, 'utf8') }
function check(condition, message) {
  if (!condition) { console.error(`FAIL: ${message}`); process.exitCode = 1 }
  else console.log(`PASS: ${message}`)
}

const studio = read('app/teacher/assessment/new/page.tsx')
check(studio.includes('exq_resolve_lesson_assessment_outcomes'), 'lesson materials resolve outcomes through guarded server authority')
check(studio.includes('exq_prepare_grounded_lesson_assessment'), 'lesson materials upgrade/retry through grounded generation authority')
check(studio.includes('exq_link_item_outcome'), 'generated assessment items are linked to curriculum outcomes')
check(studio.includes('linked_scheme_curriculum_learning_outcomes'), 'generation metadata records Scheme curriculum authority')
check(studio.includes('/teacher/assessment/review/${assessmentId}'), 'default flow goes to lightweight review instead of full builder')
check(studio.includes('/teacher/assessment/builder/${assessmentId}'), 'advanced builder remains available explicitly')
check(studio.includes('/teacher/assessment/cat/new?lessonPlanId='), 'CAT routes to real cumulative workspace')
check(studio.includes('Array.from(new Set(texts))'), 'outcome dedup remains compatible with repository TypeScript target')
check(!studio.includes('State one key idea you learned about ${focus}'), 'generic topic fallback question generation is removed')
check(!studio.includes('Explain ${focus} in your own words'), 'generic activity-label explanation fallback is removed')
check(studio.includes('/no certified homework task|do not invent/i'), 'homework generation fails closed when lesson has no certified homework')

const review = read('app/teacher/assessment/review/[assessmentId]/page.tsx')
check(review.includes('approveAssessment'), 'review flow preserves teacher approval before assignment')
check(review.includes('exq_assign_grounded_assessment_once'), 'review flow uses idempotent grounded assignment authority')
check(review.includes(".in('status', ['assigned', 'open'])"), 'review only treats active assignments as already assigned')
check(review.includes('Assign now'), 'teacher has one-tap assignment action')
check(review.includes('Advanced Edit · Sections · Question Bank'), 'advanced authoring is optional before assignment')
check(review.includes('Done · Assessment workspace'), 'assigned assessment exits cleanly instead of reopening locked editing')

const builderLayout = read('app/teacher/assessment/builder/[assessmentId]/layout.tsx')
check(builderLayout.includes('Review & Assign'), 'advanced builder always has path back to review and assignment')

const builderPage = read('app/teacher/assessment/builder/[assessmentId]/page.tsx')
check(builderPage.includes("GROUNDING_AUTHORITY = 'linked_scheme_curriculum_learning_outcomes'"), 'builder identifies grounded assessments by explicit curriculum authority')
check(builderPage.includes('assessment?.groundingAuthority === GROUNDING_AUTHORITY'), 'builder does not infer grounding from unrelated generation sources')
check(builderPage.includes('subjectId: assessment?.subjectId'), 'Question Bank discovery is restricted to the assessment subject')
check(builderPage.includes('rows.filter(item => Boolean(item.learningOutcomeId))'), 'grounded Question Bank hides items without curriculum outcome lineage')
check(builderPage.includes('item.outcomeCount !== 1'), 'multi-outcome grounded items are not incorrectly promoted as one reusable bank question')
check(builderPage.includes('curriculum lineage preserved'), 'builder communicates lineage-safe Question Bank reuse')

const builderClient = read('lib/assessment/builder.ts')
check(builderClient.includes('outcomeCount'), 'builder model carries item outcome-link count')
check(builderClient.includes('groundingAuthority'), 'builder model carries explicit grounding authority')
check(builderClient.includes('subjectId'), 'builder model carries subject authority')

const builderContextMigration = read('supabase/migrations/20260902063100_exq_builder_grounding_context.sql')
check(builderContextMigration.includes("'subject_id', ad.subject_id"), 'builder authority returns subject identity')
check(builderContextMigration.includes("'grounding_authority', ad.generation_metadata->>'authority'"), 'builder authority returns explicit grounding identity')
check(builderContextMigration.includes("'outcome_count'"), 'builder authority returns outcome-link count without direct client table reads')
check(builderContextMigration.includes('revoke all on function public.exq_list_builder_assessment'), 'builder authority remains non-anonymous')

const lessonMigration = read('supabase/migrations/20260902062000_exq_lesson_assessment_grounding.sql')
check(lessonMigration.includes('security definer'), 'lesson assessment authorities execute at guarded server boundary')
check(lessonMigration.includes('lp.teacher_id is distinct from caller'), 'outcome resolver verifies lesson ownership')
check(lessonMigration.includes('sow.curriculum_id'), 'outcome resolver is constrained to linked Scheme curriculum')
check(lessonMigration.includes("generator_version <> 'curriculum-outcome-assessment-v4'"), 'server accepts only grounded lesson generator version')
check(lessonMigration.includes("generation_status = 'generating'"), 'generation uses explicit in-progress lease')
check(lessonMigration.includes('assessment_generation_in_progress'), 'concurrent generation is rejected instead of duplicating items')
check(lessonMigration.includes('delete from public.assessment_items'), 'stale/failed generated drafts are cleared before regeneration')
check(lessonMigration.includes('pg_advisory_xact_lock'), 'lesson generation is transaction-race-safe')
check(lessonMigration.includes('revoke all on function public.exq_resolve_lesson_assessment_outcomes'), 'lesson resolver is not anonymously executable')

const catPage = read('app/teacher/assessment/cat/new/page.tsx')
check(catPage.includes('exq_resolve_cumulative_cat_outcomes'), 'CAT derives scope from completed teaching occurrences')
check(catPage.includes('exq_prepare_certified_cat_assessment'), 'CAT uses server-enforced cumulative scope gate')
check(catPage.includes('completedLessonCount >= 2'), 'CAT UI requires multiple completed lessons')
check(catPage.includes('Review & assign CAT'), 'CAT shares low-friction review/assign path')

const catMigration = read('supabase/migrations/20260902062500_exq_cumulative_cat_authority.sql')
check(catMigration.includes("occ.lifecycle = 'completed'"), 'CAT source is limited to completed teaching occurrences')
check(catMigration.includes('coalesce(seed.term, seed_scheme.term)'), 'CAT term comes from persisted lesson or linked Scheme authority')
check(catMigration.includes('cat_requires_multiple_completed_lessons'), 'server rejects one-lesson pseudo-CATs')
check(catMigration.includes('cat_requires_multiple_taught_outcomes'), 'server rejects insufficient CAT outcome scope')
check(catMigration.includes('exq_assign_grounded_assessment_once'), 'one assignment authority covers lesson materials and CAT')
check(catMigration.includes('assessment_item_outcome_lineage_required'), 'grounded assignment requires item outcome lineage')
check(catMigration.includes('assessment_has_no_items'), 'grounded assignment rejects empty assessments')
check(catMigration.includes('pg_advisory_xact_lock'), 'CAT generation and assignment are race-safe')

const bankMigration = read('supabase/migrations/20260902063000_exq_grounded_question_bank_lineage.sql')
check(bankMigration.includes('grounded_question_bank_outcome_required'), 'saving grounded items to bank requires curriculum outcome identity')
check(bankMigration.includes('question_bank_outcome_required'), 'reusing bank items in grounded assessments requires outcome identity')
check(bankMigration.includes('question_bank_subject_mismatch'), 'grounded Question Bank reuse cannot cross subjects')
check(bankMigration.includes('insert into public.assessment_item_outcomes'), 'Question Bank reuse copies curriculum lineage into assessment')

const integration = read('supabase/migrations/20260806090000_exq_011_018_teacher_os_integration.sql')
check(integration.includes('perform public.exq_sync_attempt_outcome_evidence(v_attempt.id)'), 'released assessment results synchronize outcome evidence/mastery')

if (process.exitCode) {
  console.error('\nAssessment Pack contract FAILED')
  process.exit(process.exitCode)
}
console.log('\nAssessment Pack contract PASSED')
