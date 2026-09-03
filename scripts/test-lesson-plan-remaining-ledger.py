from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text()


def executable_text(src: str) -> str:
    """Remove JS/TS comments before checking forbidden executable patterns."""
    without_blocks = re.sub(r'/\*[\s\S]*?\*/', '', src)
    return re.sub(r'//[^\n]*', '', without_blocks)


def require(src: str, needle: str, label: str) -> None:
    assert needle in src, f"{label}: missing {needle!r}"


def forbid(src: str, needle: str, label: str) -> None:
    assert needle not in src, f"{label}: forbidden {needle!r}"


modal = text('components/teacher/LessonPlanModal.tsx')
modal_code = executable_text(modal)
canonical = text('lib/teaching/canonicalLessonGeneration.ts')
baseline = text('lib/teaching/lessonGeneration.ts')
grounding = text('lib/teaching/lessonPlanGrounding.ts')
lifecycle = text('lib/teaching/lessonLifecycle.ts')
lifecycle_code = executable_text(lifecycle)
attendance = text('lib/teaching/lessonAttendance.ts')
coverage = text('components/teacher/CoverageSheet.tsx')
coverage_code = executable_text(coverage)
source_bundle = text('lib/teaching/lessonSourceBundle.ts')
delivery = text('lib/teaching/lessonDelivery.ts')

# File 2 — modal must orchestrate through canonical boundaries rather than
# becoming an independent persistence/lifecycle implementation.
for required in (
    'loadLessonWorkspace({',
    'saveGeneratedLessonPlan({',
    'updateLessonPlanBody({',
    'generateCanonicalLessonPlan(',
    'generateLessonPlan({',
    'startLessonOccurrence({',
    'completeLessonOccurrence({',
    'markLessonSchemeCovered(',
    'buildLessonAttendanceUrl({',
    'coveragePromptOccurrenceId',
    'planSchemeIdRef.current',
):
    require(modal, required, f'modal boundary {required}')
forbid(modal_code, ".from('teaching_occurrences').insert", 'modal direct occurrence mutation')
forbid(modal_code, ".from('scheme_of_work').update", 'modal direct Scheme mutation')

# Files 5/6/7 — authoritative lists must preserve line granularity before
# normalization, and canonical content selection must be exact/deterministic.
require(canonical, 'splitAuthorityList', 'canonical authority list')
require(baseline, '.split(/\\s*[|;]\\s*|\\n+/)', 'baseline preserves Scheme list lines')
require(grounding, '.split(/\\s*[|;]\\s*|\\n+/)', 'grounding validates Scheme objectives independently')
forbid(grounding, 'allowedContentFragments', 'grounding dead API')
require(source_bundle, "if (source.strandId)", 'sub-strand resource authority')
require(source_bundle, "return queryCurriculumCandidates('curriculum_id', source.id)", 'curriculum fallback authority')
forbid(executable_text(source_bundle), '.or(', 'broad canonical resource matching')
require(source_bundle, ".order('certified_at', { ascending: false })", 'deterministic certified version order')
require(source_bundle, 'newestCertifiedByResource', 'single deterministic certified version')
require(source_bundle, 'return candidates.flatMap(resource =>', 'candidate order preserved')

# File 10 — lifecycle remains a thin adapter over the canonical occurrence
# authority. No second client-side lifecycle state machine or direct Supabase.
for required in (
    'resolveOccurrence(key)',
    'startTeachingOccurrence(key)',
    'completeTeachingOccurrence(key)',
    'markSchemeItemCovered(occurrenceId)',
):
    require(lifecycle, required, f'lifecycle adapter {required}')
forbid(lifecycle_code, "from('teaching_occurrences')", 'lifecycle direct occurrence query')
forbid(lifecycle_code, "from('scheme_of_work')", 'lifecycle direct Scheme mutation')

# File 12 — attendance completion means every learner in canonical current
# enrollment has a row for the exact school/class/teacher/slot/date occurrence.
require(attendance, ".from('student_classes')", 'attendance canonical roster')
require(attendance, ".eq('is_current', true)", 'attendance current enrollment')
require(attendance, ".eq('school_id', schoolId)", 'attendance school scope')
require(attendance, ".eq('teacher_id', teacherId)", 'attendance teacher scope')
require(attendance, ".eq('timetable_slot_id', slot.id)", 'attendance exact slot')
require(attendance, ".eq('date', occurrenceDate)", 'attendance exact date')
require(attendance, 'expectedStudentCount > 0', 'attendance non-empty roster completion')
require(attendance, 'recordedStudentCount === expectedStudentCount', 'attendance full roster completion')
forbid(attendance, '(attendanceResult.count ?? 0) > 0', 'partial attendance cannot mean complete')

# Consequence boundary — weak/placeholder plans may be saved for teacher review,
# but they cannot be published or shared downstream as if teaching-ready.
require(delivery, 'evaluateLessonReadiness', 'delivery readiness evaluator')
require(delivery, 'assertLessonReadyForDelivery', 'delivery readiness boundary')
require(delivery, 'lesson_delivery_authority_mismatch', 'delivery school authority')
require(delivery, 'lesson_not_ready_for_delivery', 'delivery fail-closed readiness')
publish_guard = delivery.index('await assertLessonReadyForDelivery(lessonPlanId, schoolId)')
publish_status = delivery.index("await updateLessonPlanStatus({ lessonPlanId, status: 'published' })")
assert publish_guard < publish_status, 'delivery: readiness must precede publication status'
share_fn = delivery.index('export async function shareLessonToParents')
share_guard = delivery.index('await assertLessonReadyForDelivery(lessonPlanId, schoolId)', share_fn)
parent_delivery = delivery.index('deliverLessonPlanToParents({', share_fn)
assert share_guard < parent_delivery, 'delivery: readiness must precede parent consequences'

# File 15 — coverage sheet stays presentation-only; guarded mutation ownership
# remains in the modal/lifecycle boundary and errors remain visible/retryable.
require(coverage, 'onMarkCovered: () => void', 'coverage callback boundary')
require(coverage, 'error: string | null', 'coverage visible error')
require(coverage, 'disabled={marking}', 'coverage duplicate-submit guard')
forbid(coverage_code, 'supabase', 'coverage direct database access')
forbid(coverage_code, 'scheme_of_work', 'coverage direct Scheme access')

print('lesson-plan remaining ledger: PASS')
