from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text()


def require(haystack: str, needle: str, label: str) -> None:
    assert needle in haystack, f'{label}: missing {needle!r}'


def forbid(haystack: str, needle: str, label: str) -> None:
    assert needle not in haystack, f'{label}: forbidden {needle!r}'


baseline = text('lib/teaching/lessonGeneration.ts')
canonical = text('lib/teaching/canonicalLessonGeneration.ts')
source_bundle = text('lib/teaching/lessonSourceBundle.ts')
package_cache = text('lib/teaching/lessonPackageCache.ts')
package_migration = text('supabase/migrations/20260831140000_lesson_package_cache.sql')
legacy_ai = text('supabase/functions/generate-lesson-plan/index.ts')
canonical_ai = text('supabase/functions/generate-canonical-lesson-plan/index.ts')
pin = text('lib/teaching/canonicalLessonResource.ts')

# Deterministic builders must stay provider-free and zero-credit.
for name, src in [('baseline', baseline), ('canonical', canonical)]:
    forbid(src, 'api.groq.com', name)
    forbid(src, 'api.tavily.com', name)
    require(src, 'creditsUsed: 0', name)
    require(src, 'TEACHING POINTS', name)
    require(src, 'LEARNER ACTIVITIES', name)
    require(src, 'EXPECTED ANSWERS / EVIDENCE', name)
    require(src, 'MISCONCEPTIONS TO WATCH', name)

# Scheme objective grounding is a hard pre-return validation.
require(baseline, 'validateLessonPlanGrounding', 'baseline grounding')
require(canonical, 'validateLessonPlanGrounding', 'canonical grounding')
require(baseline, 'schemeObjectives: curriculumObjectives', 'baseline objectives')
require(canonical, 'schemeObjectives: identity.schemeObjectives', 'canonical objectives')

# Published/broad curriculum content must not be unioned into an exact Scheme
# lesson. Exact lesson-number/period filtering is represented by the exact
# Scheme row -> explicit resource link boundary.
require(source_bundle, 'if (source?.schemeId)', 'scheme exact-source boundary')
require(source_bundle, 'candidates = await loadExplicitSchemeResources(source.schemeId)', 'scheme exact-source boundary')
assert source_bundle.index('} else if (source) {') > source_bundle.index('if (source?.schemeId)')
require(source_bundle, ".eq('lifecycle_status', 'certified')", 'certified version gate')
require(source_bundle, '!version.certification_policy_version', 'certification policy gate')
require(source_bundle, '!version.certified_at', 'certification timestamp gate')

# Package cache: ordinary teachers can only create Scheme-scoped packages;
# global rows require independent package certification and service role.
require(package_migration, "reuse_scope in ('scheme', 'global')", 'package scope')
require(package_migration, "certification_status in ('scheme_scoped', 'certified')", 'package certification')
require(package_migration, "reuse_scope = 'global'", 'global package gate')
require(package_migration, "certification_policy_version is not null", 'global package policy')
require(package_migration, "certified_at is not null", 'global package timestamp')
require(package_migration, "reuse_scope = 'scheme'", 'scheme package gate')
require(package_migration, "s.teacher_id = auth.uid()", 'scheme package ownership')
require(package_migration, "auth.jwt() ->> 'role'", 'service certification gate')
require(package_migration, "<> 'service_role'", 'service certification gate')
require(package_migration, 'source_fingerprint', 'source fingerprint')
require(package_migration, 'source_resource_version_ids', 'exact version provenance')
require(package_migration, 'source_hashes', 'source hash provenance')

# Cache reads are exact on key + source fingerprint + timetable duration.
require(package_cache, ".eq('source_fingerprint', sourceFingerprint)", 'cache fingerprint lookup')
require(package_cache, ".eq('duration_minutes', identity.durationMinutes)", 'cache duration lookup')
require(package_cache, "row.certification_status === 'certified'", 'cache certified reuse')
require(package_cache, 'row.certification_policy_version', 'cache policy reuse')
require(package_cache, 'row.certified_at', 'cache timestamp reuse')

# Old model-backed endpoints are unreachable without explicit enhancement
# intent, and the check happens before credits/providers.
for name, src in [('legacy-ai', legacy_ai), ('canonical-ai', canonical_ai)]:
    require(src, 'EXPLICIT_AI_INTENT = "ai_enhance"', name)
    require(src, 'explicit_ai_enhancement_intent_required', name)
    gate = src.index('if (body.intent !== EXPLICIT_AI_INTENT)')
    provider = min(
        [i for i in [src.find('api.groq.com'), src.find('api.tavily.com')] if i >= 0]
    )
    assert gate < provider, f'{name}: AI intent gate must precede provider call'

# Exact resource pin is mandatory and fails closed on RPC error or a non-ok
# payload. This covers wrong/missing resource-version negative paths.
require(pin, 'p_resource_version_id: resourceVersionId', 'resource pin exact version')
require(pin, 'if (error)', 'resource pin RPC failure')
require(pin, 'if (!payload?.ok)', 'resource pin payload failure')

print('zero-AI lesson release contract: PASS')
