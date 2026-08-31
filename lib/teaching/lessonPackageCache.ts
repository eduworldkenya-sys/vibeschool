import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { LessonPlanSections } from '@/lib/teaching/lessonPlanCodec'

interface PackageCacheRow {
  id: string
  sections: Json
  reuse_scope: 'scheme' | 'global'
  certification_status: 'scheme_scoped' | 'certified'
  certification_policy_version: string | null
  certified_at: string | null
}

export interface LessonPackageSourceIdentity {
  curriculumId: string
  subjectId: string
  grade: string
  subStrandId: string
  topicTitle: string
  schemeId?: string | null
  durationMinutes: number
  sourceResourceIds: string[]
  sourceResourceVersionIds: string[]
  sourceHashes: string[]
  schemeObjectives?: string | null
  keyInquiryQuestion?: string | null
  learningResources?: string | null
  learningExperiences?: string | null
  assessmentMethods?: string | null
  reference?: string | null
}

function normalize(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '-')
}

export function buildLessonPackageCacheKey(identity: LessonPackageSourceIdentity): string {
  return [
    'lesson-package:v1',
    `curriculum=${normalize(identity.curriculumId)}`,
    `subject=${normalize(identity.subjectId)}`,
    `grade=${normalize(identity.grade)}`,
    `sub-strand=${normalize(identity.subStrandId)}`,
    `topic=${normalize(identity.topicTitle)}`,
  ].join('|')
}

function sourceTuples(identity: LessonPackageSourceIdentity): Array<{
  resourceId: string
  resourceVersionId: string
  contentSha256: string
}> {
  const lengths = [
    identity.sourceResourceIds.length,
    identity.sourceResourceVersionIds.length,
    identity.sourceHashes.length,
  ]
  if (!lengths.every(length => length === lengths[0])) {
    throw new Error('LESSON_PACKAGE_SOURCE_BINDINGS_MISMATCH')
  }

  return identity.sourceResourceIds.map((resourceId, index) => ({
    resourceId,
    resourceVersionId: identity.sourceResourceVersionIds[index],
    contentSha256: identity.sourceHashes[index],
  })).sort((left, right) =>
    `${left.resourceId}|${left.resourceVersionId}|${left.contentSha256}`.localeCompare(
      `${right.resourceId}|${right.resourceVersionId}|${right.contentSha256}`,
    ),
  )
}

function stableSourceMaterial(identity: LessonPackageSourceIdentity): string {
  return JSON.stringify({
    curriculumId: identity.curriculumId,
    subjectId: identity.subjectId,
    grade: identity.grade,
    subStrandId: identity.subStrandId,
    topicTitle: identity.topicTitle,
    durationMinutes: identity.durationMinutes,
    sourceAssets: sourceTuples(identity),
    schemeObjectives: identity.schemeObjectives?.trim() ?? '',
    keyInquiryQuestion: identity.keyInquiryQuestion?.trim() ?? '',
    learningResources: identity.learningResources?.trim() ?? '',
    learningExperiences: identity.learningExperiences?.trim() ?? '',
    assessmentMethods: identity.assessmentMethods?.trim() ?? '',
    reference: identity.reference?.trim() ?? '',
  })
}

export async function buildLessonPackageSourceFingerprint(identity: LessonPackageSourceIdentity): Promise<string> {
  const bytes = new TextEncoder().encode(stableSourceMaterial(identity))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

function isSections(value: unknown): value is LessonPlanSections {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return [
    'objectives',
    'resources',
    'introduction',
    'development',
    'consolidation',
    'assessmentHook',
    'homework',
    'differentiation',
  ].every(key => typeof record[key] === 'string' && String(record[key]).trim().length > 0)
}

function untypedClient(): SupabaseClient<any> {
  return supabase as unknown as SupabaseClient<any>
}

async function loadSchemeScopedPackage({
  db,
  cacheKey,
  sourceFingerprint,
  identity,
}: {
  db: SupabaseClient<any>
  cacheKey: string
  sourceFingerprint: string
  identity: LessonPackageSourceIdentity & { schemeId: string }
}): Promise<PackageCacheRow | null> {
  const { data, error } = await db
    .from('lesson_package_cache')
    .select('id, sections, reuse_scope, certification_status, certification_policy_version, certified_at')
    .eq('cache_key', cacheKey)
    .eq('source_fingerprint', sourceFingerprint)
    .eq('duration_minutes', identity.durationMinutes)
    .eq('reuse_scope', 'scheme')
    .eq('scheme_id', identity.schemeId)
    .maybeSingle()
  if (error) throw error
  return (data as PackageCacheRow | null) ?? null
}

async function loadCertifiedGlobalPackage({
  db,
  cacheKey,
  sourceFingerprint,
  durationMinutes,
}: {
  db: SupabaseClient<any>
  cacheKey: string
  sourceFingerprint: string
  durationMinutes: number
}): Promise<PackageCacheRow | null> {
  const { data, error } = await db
    .from('lesson_package_cache')
    .select('id, sections, reuse_scope, certification_status, certification_policy_version, certified_at')
    .eq('cache_key', cacheKey)
    .eq('source_fingerprint', sourceFingerprint)
    .eq('duration_minutes', durationMinutes)
    .eq('reuse_scope', 'global')
    .eq('certification_status', 'certified')
    .not('certification_policy_version', 'is', null)
    .not('certified_at', 'is', null)
    .maybeSingle()
  if (error) throw error
  return (data as PackageCacheRow | null) ?? null
}

export async function loadExactLessonPackage(identity: LessonPackageSourceIdentity): Promise<{
  sections: LessonPlanSections
  packageId: string
  reuseScope: 'scheme' | 'global'
} | null> {
  const cacheKey = buildLessonPackageCacheKey(identity)
  const sourceFingerprint = await buildLessonPackageSourceFingerprint(identity)
  const db = untypedClient()

  if (identity.schemeId) {
    const schemePackage = await loadSchemeScopedPackage({
      db,
      cacheKey,
      sourceFingerprint,
      identity: { ...identity, schemeId: identity.schemeId },
    })
    if (schemePackage && isSections(schemePackage.sections)) {
      return { sections: schemePackage.sections, packageId: schemePackage.id, reuseScope: 'scheme' }
    }
  }

  const globalPackage = await loadCertifiedGlobalPackage({
    db,
    cacheKey,
    sourceFingerprint,
    durationMinutes: identity.durationMinutes,
  })
  if (!globalPackage || !isSections(globalPackage.sections)) return null
  return { sections: globalPackage.sections, packageId: globalPackage.id, reuseScope: 'global' }
}

export async function storeSchemeLessonPackage({
  identity,
  sections,
  generationMode = 'deterministic',
}: {
  identity: LessonPackageSourceIdentity
  sections: LessonPlanSections
  generationMode?: 'deterministic' | 'ai_assisted'
}): Promise<string | null> {
  if (!identity.schemeId) return null
  if (!isSections(sections)) throw new Error('LESSON_PACKAGE_SECTIONS_INVALID')

  const cacheKey = buildLessonPackageCacheKey(identity)
  const sourceFingerprint = await buildLessonPackageSourceFingerprint(identity)
  const db = untypedClient()
  const payload = {
    cache_key: cacheKey,
    scheme_id: identity.schemeId,
    reuse_scope: 'scheme',
    certification_status: 'scheme_scoped',
    duration_minutes: identity.durationMinutes,
    source_fingerprint: sourceFingerprint,
    source_resource_ids: identity.sourceResourceIds,
    source_resource_version_ids: identity.sourceResourceVersionIds,
    source_hashes: identity.sourceHashes,
    source_provenance: {
      curriculumId: identity.curriculumId,
      subjectId: identity.subjectId,
      grade: identity.grade,
      subStrandId: identity.subStrandId,
      topicTitle: identity.topicTitle,
      schemeId: identity.schemeId,
      schemeObjectives: identity.schemeObjectives ?? null,
      keyInquiryQuestion: identity.keyInquiryQuestion ?? null,
      learningResources: identity.learningResources ?? null,
      learningExperiences: identity.learningExperiences ?? null,
      assessmentMethods: identity.assessmentMethods ?? null,
      reference: identity.reference ?? null,
    },
    sections,
    generation_mode: generationMode,
  }

  const { data: existing, error: lookupError } = await db
    .from('lesson_package_cache')
    .select('id')
    .eq('cache_key', cacheKey)
    .eq('source_fingerprint', sourceFingerprint)
    .eq('duration_minutes', identity.durationMinutes)
    .eq('reuse_scope', 'scheme')
    .eq('scheme_id', identity.schemeId)
    .maybeSingle()
  if (lookupError) throw lookupError

  if (existing?.id) {
    const { error: updateError } = await db
      .from('lesson_package_cache')
      .update({
        sections,
        source_resource_ids: identity.sourceResourceIds,
        source_resource_version_ids: identity.sourceResourceVersionIds,
        source_hashes: identity.sourceHashes,
        source_provenance: payload.source_provenance,
        generation_mode: generationMode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (updateError) throw updateError
    return String(existing.id)
  }

  const { data, error } = await db.from('lesson_package_cache').insert(payload).select('id').single()
  if (error) throw error
  return typeof data?.id === 'string' ? data.id : null
}
