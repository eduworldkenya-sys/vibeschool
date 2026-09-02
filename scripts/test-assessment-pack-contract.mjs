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
check(studio.includes('/teacher/assessment/cat/new?lessonPlanId='), 'CAT routes to a real cumulative workspace')
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
check(builderLayout.includes('Review & Assign'), 'advanced builder always has a path back to review and assignment')

const lessonMigration = read('supabase/migrations/20260902062000_exq_lesson_assessment_grounding.sql')
check(lessonMigration.includes('security definer'), 'lesson assessment authorities execute at guarded server boundary')
check(lessonMigration.includes('lp.teacher_id is distinct from caller'), 'outcome resolver verifies lesson ownership')
check(lessonMigration.includes('sow.curriculum_id'), 'outcome resolver is constrained to linked Scheme curriculum')
check(lessonMigration.includes("generator_version <> 'curriculum-outcome-assessment-v4'"), 'server accepts only the grounded lesson generator version')
check(lessonMigration.includes("generation_status = 'generating'"), 'generation uses an explicit in-progress lease')
check(lessonMigration.includes('assessment_generation_in_progress'), 'concurrent generation is rejected instead of duplicating items')
check(lessonMigration.includes('delete from public.assessment_items'), 'stale/failed generated drafts are cleared before regeneration')
check(lessonMigration.includes('assessment_item_outcome_lineage_required'), 'assignment is blocked when any generated item lacks curriculum lineage')
check(lessonMigration.includes('pg_advisory_xact_lock'), 'lesson generation/assignment is transaction-race-safe')
check(lessonMigration.includes('revoke all on function public.exq_resolve_lesson_assessment_outcomes'), 'lesson resolver is not anonymously executable')

const catPage = read('app/teacher/assessment/cat/new/page.tsx')
check(catPage.includes('exq_resolve_cumulative_cat_outcomes'), 'CAT derives scope from completed teaching occurrences')
check(catPage.includes('exq_prepare_certified_cat_assessment'), 'CAT uses server-enforced cumulative scope gate')
check(catPage.includes('completedLessonCount >= 2'), 'CAT UI requires multiple completed lessons')
check(catPage.includes('Review & assign CAT'), 'CAT shares the low-friction review/assign path')

const catMigration = read('supabase/migrations/20260902062500_exq_cumulative_cat_authority.sql')
check(catMigration.includes("occ.lifecycle = 'completed'"), 'CAT source is limited to completed teaching occurrences')
check(catMigration.includes('exq_assign_grounded_assessment_once'), 'one assignment authority covers lesson materials and CAT')
check(catMigration.includes('assessment_item_outcome_lineage_required'), 'generic grounded assignment requires item outcome lineage')

const catGate = read('supabase/migrations/20260902062600_exq_cat_scope_gate.sql')
check(catGate.includes('cat_requires_multiple_completed_lessons'), 'server rejects one-lesson pseudo-CATs')
check(catGate.includes('cat_requires_multiple_taught_outcomes'), 'server rejects insufficient CAT outcome scope')

const bankMigration = read('supabase/migrations/20260902063000_exq_grounded_question_bank_lineage.sql')
check(bankMigration.includes('grounded_question_bank_outcome_required'), 'saving grounded items to bank requires curriculum outcome identity')
check(bankMigration.includes('question_bank_outcome_required'), 'reusing bank items in grounded assessments requires outcome identity')
check(bankMigration.includes('question_bank_subject_mismatch'), 'grounded Question Bank reuse cannot cross subjects')
check(bankMigration.includes('insert into public.assessment_item_outcomes'), 'Question Bank reuse copies curriculum lineage into the assessment')

const integration = read('supabase/migrations/20260806090000_exq_011_018_teacher_os_integration.sql')
check(integration.includes('perform public.exq_sync_attempt_outcome_evidence(v_attempt.id)'), 'released assessment results synchronize outcome evidence/mastery')

if (process.exitCode) {
  console.error('\nAssessment Pack contract FAILED')
  process.exit(process.exitCode)
}
console.log('\nAssessment Pack contract PASSED')
