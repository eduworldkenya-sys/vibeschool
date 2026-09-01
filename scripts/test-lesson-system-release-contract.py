from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text()


def require(src: str, needle: str, label: str) -> None:
    assert needle in src, f"{label}: missing {needle!r}"


def forbid(src: str, needle: str, label: str) -> None:
    assert needle not in src, f"{label}: forbidden {needle!r}"

baseline = text('lib/teaching/lessonGeneration.ts')
canonical = text('lib/teaching/canonicalLessonGeneration.ts')
source_bundle = text('lib/teaching/lessonSourceBundle.ts')
package_cache = text('lib/teaching/lessonPackageCache.ts')
package_migration = text('supabase/migrations/20260831203000_lesson_package_cache.sql')
legacy_ai = text('supabase/functions/generate-lesson-plan/index.ts')
canonical_ai = text('supabase/functions/generate-canonical-lesson-plan/index.ts')
modal = text('components/teacher/LessonPlanModal.tsx')
teach_mode = text('components/teacher/LessonTeachMode.tsx')

# Scheme-only baseline remains deterministic and provider-free.
forbid(baseline, 'api.groq.com', 'baseline')
forbid(baseline, 'api.tavily.com', 'baseline')
require(baseline, 'validateLessonPlanGrounding', 'baseline grounding')
require(baseline, 'allocateLessonTiming', 'baseline exact timing')

# Canonical assembly keeps curriculum/timing deterministic. AI is allowed only
# as a bounded pedagogical reasoning layer on a cache miss when certified
# content is structurally weak; failure must fall back without blocking class.
forbid(canonical, 'api.groq.com', 'canonical direct provider')
forbid(canonical, 'api.tavily.com', 'canonical research provider')
require(canonical, 'validateLessonPlanGrounding', 'canonical grounding')
require(canonical, 'allocateLessonTiming', 'canonical exact timing')
require(canonical, "intent: 'grounded_prepare'", 'grounded preparation intent')
require(canonical, 'needsPedagogicalReasoning', 'AI only when pedagogically needed')
require(canonical, 'loadExactLessonPackage(packageIdentity)', 'cache before AI')
require(canonical, 'grounded AI enrichment unavailable; using deterministic package', 'AI failure fallback')
require(canonical, "generationMode = 'ai_assisted'", 'AI provenance mode')
require(canonical, 'storeSchemeLessonPackage({ identity: packageIdentity, sections, generationMode })', 'cache enriched package')
require(canonical, 'creditsUsed: 0', 'canonical teacher-credit free')
require(canonical, 'Teaching points / teacher notes', 'canonical teacher notes')
require(canonical, 'Learner activities', 'canonical learner activities')
require(canonical, 'Expected answer', 'canonical answers')
require(canonical, 'Misconceptions to watch', 'canonical misconceptions')
require(canonical, 'Teacher actions: View · Edit · Assign · Share.', 'preloaded material actions')

# Exact Scheme resource boundary and certified content authority.
require(source_bundle, 'if (source?.schemeId)', 'exact Scheme boundary')
require(source_bundle, 'loadExplicitSchemeResources(source.schemeId)', 'exact Scheme resources')
require(source_bundle, ".eq('lifecycle_status', 'certified')", 'certified resource version')
require(source_bundle, '!version.certification_policy_version', 'resource certification policy')
require(source_bundle, '!version.certified_at', 'resource certification timestamp')

# Exact assembled package cache. Teacher writes remain Scheme-scoped; global
# reuse requires independent package certification and exact source bindings.
require(package_cache, ".eq('source_fingerprint', sourceFingerprint)", 'cache source fingerprint')
require(package_cache, ".eq('duration_minutes', identity.durationMinutes)", 'cache duration')
require(package_cache, ".eq('reuse_scope', 'global')", 'global cache scope')
require(package_cache, ".eq('certification_status', 'certified')", 'global cache certification')
require(package_cache, ".not('certification_policy_version', 'is', null)", 'global certification policy')
require(package_cache, ".not('certified_at', 'is', null)", 'global certification timestamp')
require(package_cache, 'LESSON_PACKAGE_SOURCE_BINDINGS_MISMATCH', 'source tuple integrity')
for scheme_field in ('learningResources', 'learningExperiences', 'assessmentMethods', 'reference'):
    require(package_cache, scheme_field, f'cache fingerprint {scheme_field}')
require(package_migration, "reuse_scope in ('scheme', 'global')", 'cache scope constraint')
require(package_migration, "certification_status in ('scheme_scoped', 'certified')", 'cache certification constraint')
require(package_migration, "s.teacher_id = (select auth.uid())", 'teacher Scheme ownership')
require(package_migration, 'security invoker', 'invoker package certification')
forbid(package_migration, 'security definer', 'public package certification')
require(package_migration, 'set search_path = \'\'', 'pinned function search path')
require(package_migration, 'revoke all on function public.certify_lesson_package_cache', 'function execute revoke')
require(package_migration, 'grant execute on function public.certify_lesson_package_cache(uuid, text, text) to service_role', 'service-only package certification')
require(package_migration, 'source_resource_version_ids', 'exact resource versions')
require(package_migration, 'source_hashes', 'source hashes')

# Legacy free-form AI stays explicit and credit gated.
require(legacy_ai, 'EXPLICIT_AI_INTENT = "ai_enhance"', 'legacy-ai')
require(legacy_ai, 'explicit_ai_enhancement_intent_required', 'legacy-ai')
legacy_gate = legacy_ai.index('if (body.intent !== EXPLICIT_AI_INTENT)')
legacy_providers = [i for i in (legacy_ai.find('api.groq.com'), legacy_ai.find('api.tavily.com')) if i >= 0]
assert legacy_providers and legacy_gate < min(legacy_providers), 'legacy-ai: intent gate must precede provider calls'
legacy_credits = [i for i in (legacy_ai.find('.from("vibe_credits")'), legacy_ai.find('cla_reserve_learning_resource_credit')) if i >= 0]
assert legacy_credits and legacy_gate < min(legacy_credits), 'legacy-ai: intent gate must precede credit work'

# Canonical AI has two disjoint modes: explicit free-form enhancement remains
# credit-gated; automatic grounded preparation is source-bound, teacher-owned,
# certified-content-only, routed through Cyborg, and never invokes Tavily.
require(canonical_ai, 'EXPLICIT_AI_INTENT = "ai_enhance"', 'canonical explicit AI')
require(canonical_ai, 'GROUNDED_PREPARE_INTENT = "grounded_prepare"', 'canonical grounded intent')
require(canonical_ai, 'invokeCyborgEdgeModelWithFallback', 'canonical governed model gateway')
require(canonical_ai, '.eq("teacher_id", userId)', 'grounded Scheme ownership')
require(canonical_ai, 'list_scheme_lesson_resources', 'grounded explicit Scheme resources')
require(canonical_ai, '.from("learning_resources")', 'grounded resource authority lookup')
require(canonical_ai, 'explicitlyLinked || curriculumMatch || subStrandMatch', 'grounded Scheme eligibility rule')
require(canonical_ai, 'grounded_source_not_eligible_for_scheme', 'grounded unrelated-resource rejection')
require(canonical_ai, '.eq("lifecycle_status", "certified")', 'grounded certified versions')
require(canonical_ai, 'grounded_source_verification_failed', 'grounded exact source verification')
require(canonical_ai, 'String(version.content_sha256) !== asset.contentSha256', 'grounded source hash verification')
require(canonical_ai, 'AUTHORITY RULE:', 'prompt injection/source authority boundary')
require(canonical_ai, 'Untrusted display label', 'client label distrust')
require(canonical_ai, 'Your job is HOW TO TEACH, not WHAT curriculum to teach.', 'AI pedagogical scope')
require(canonical_ai, 'credits: { used: 0 }', 'grounded preparation does not charge teacher credits')
require(canonical_ai, 'if (body.intent === GROUNDED_PREPARE_INTENT)', 'grounded branch')
grounded_branch = canonical_ai.index('if (body.intent === GROUNDED_PREPARE_INTENT)')
credit_reservation = canonical_ai.index('cla_reserve_learning_resource_credit')
assert grounded_branch < credit_reservation, 'grounded preparation must branch before legacy credit work'
require(canonical_ai, 'Legacy explicit enhancement remains separately credit-gated.', 'explicit/grounded economic separation')

# Teacher-facing normal path remains prepared rather than generation-centric.
require(modal, 'Built from Scheme + VibeSchool Content', 'teacher provenance')
for forbidden in ('Generated by Twin', 'Generate Homework', 'Generate Worksheet'):
    forbid(modal, forbidden, 'teacher prepared-package UX')
for required in ('objectives', 'development', 'assessmentHook', 'homework'):
    require(teach_mode, required, f'Teach Mode {required}')
require(teach_mode, 'Resources ready', 'Teach Mode prepared resources')
require(teach_mode, 'Differentiation ready', 'Teach Mode differentiation')
require(teach_mode, 'View · Edit · Assign · Share', 'Teach Mode prepared homework actions')
require(teach_mode, 'Prepared Teaching Pack', 'Teach Mode prepared-pack provenance')
require(teach_mode, 'Total lesson time:', 'Teach Mode exact total authority')
require(teach_mode, 'rangeEnds.length > 0 ? Math.max(...rangeEnds) : null', 'Teach Mode legacy timing recovery')
require(teach_mode, 'The timer is disabled rather than assuming a 40-minute period.', 'Teach Mode fail closed timing')
forbid(teach_mode, 'match ? Number(match[1]) : 40', 'Teach Mode hard-coded fallback')

print('lesson-system release contract: PASS')
