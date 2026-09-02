import fs from 'node:fs'

function read(path) { return fs.readFileSync(path, 'utf8') }
function check(condition, message) {
  if (!condition) { console.error(`FAIL: ${message}`); process.exitCode = 1 }
  else console.log(`PASS: ${message}`)
}

const studio = read('app/teacher/assessment/new/page.tsx')
check(studio.includes('exq_resolve_lesson_assessment_outcomes'), 'lesson materials resolve outcomes through guarded server authority')
check(studio.includes('exq_link_item_outcome'), 'generated assessment items are linked to curriculum outcomes')
check(studio.includes('linked_scheme_curriculum_learning_outcomes'), 'generation metadata records Scheme curriculum authority')
check(studio.includes('/teacher/assessment/review/${assessmentId}'), 'default flow goes to lightweight review instead of full builder')
check(studio.includes('/teacher/assessment/builder/${assessmentId}'), 'advanced builder remains available explicitly')
check(!studio.includes('State one key idea you learned about ${focus}'), 'generic topic fallback question generation is removed')
check(!studio.includes('Explain ${focus} in your own words'), 'generic activity-label explanation fallback is removed')
check(studio.includes('/no certified homework task|do not invent/i'), 'homework generation fails closed when lesson has no certified homework')
check(studio.includes("type === 'test'"), 'CAT has an explicit distinct policy')
check(studio.includes('formal CAT must not silently pretend one lesson is cumulative') || studio.includes('CAT is cumulative'), 'single-lesson CAT generation fails closed rather than misrepresenting scope')

const review = read('app/teacher/assessment/review/[assessmentId]/page.tsx')
check(review.includes('approveAssessment'), 'review flow preserves teacher approval before assignment')
check(review.includes('exq_assign_lesson_assessment_once'), 'review flow uses idempotent server assignment authority')
check(review.includes('Assign now'), 'teacher has one-tap assignment action')
check(review.includes('Advanced Edit · Sections · Question Bank'), 'advanced authoring is optional and explicit')

const migration = read('supabase/migrations/20260902062000_exq_lesson_assessment_grounding.sql')
check(migration.includes('security definer'), 'new lesson assessment authorities execute at the guarded server boundary')
check(migration.includes('lp.teacher_id is distinct from caller'), 'outcome resolver verifies lesson ownership')
check(migration.includes('sow.curriculum_id'), 'outcome resolver is constrained to the linked Scheme curriculum')
check(migration.includes('pg_advisory_xact_lock'), 'one-tap assignment is race-safe and idempotent')
check(migration.includes("status in ('assigned', 'open')"), 'assignment authority reuses an existing active class assignment')
check(migration.includes('revoke all on function public.exq_resolve_lesson_assessment_outcomes'), 'new resolver is not anonymously executable')
check(migration.includes('revoke all on function public.exq_assign_lesson_assessment_once'), 'new assignment authority is not anonymously executable')

if (process.exitCode) {
  console.error('\nAssessment Pack contract FAILED')
  process.exit(process.exitCode)
}
console.log('\nAssessment Pack contract PASSED')
