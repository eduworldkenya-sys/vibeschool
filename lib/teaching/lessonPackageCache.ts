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
  const maxLength = Math.max(
    identity.sourceResourceIds.length,
    identity.sourceResourceVersionIds.length,
    identity.sourceHashes.length,
  )

  return Array.from({ length: maxLength }, (_, index) => ({
    resourceId: identity.sourceResourceIds[index] ?? '',
    resourceVersionId: identity.sourceResourceVersionIds[index] ?? '',
    contentSha256: identity.sourceHashes[index] ?? '',
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
  ].every(key => typeof record[key] === 'string')
}

function untypedClient(): SupabaseClient<any> {
  return supabase as unknown as SupabaseClient<any>
}

export async function loadExactLessonPackage(identity: LessonPackageSourceIdentity): Promise<{
  sections: LessonPlanSections
  packageId: string
  reuseScope: 'scheme' | 'global'
} | null> {
  const cacheKey = buildLessonPackageCacheKey(identity)
  const sourceFingerprint = await buildLessonPackageSourceFingerprint(identity)
  const db = untypedClient()

  let query = db
    .from('lesson_package_cache')
    .select('id, sections, reuse_scope, certification_status, certification_policy_version, certified_at')
    .eq('cache_key', cacheKey)
    .eq('source_fingerprint', sourceFingerprint)
    .eq('duration_minutes', identity.durationMinutes)

  if (identity.schemeId) query = query.or(`scheme_id.eq.${identity.schemeId},reuse_scope.eq.global`)
  else query = query.eq('reuse_scope', 'global')

  const { data, error } = await query.limit(4)
  if (error) throw error

  const rows = (data ?? []) as PackageCacheRow[]
  const selected =
    rows.find(row => row.reuse_scope === 'scheme') ??
    rows.find(row =>
      row.reuse_scope === 'global' &&
      row.certification_status === 'certified' &&
      Boolean(row.certification_policy_version) &&
      Boolean(row.certified_at),
    )

  if (!selected || !isSections(selected.sections)) return null
  return { sections: selected.sections, packageId: selected.id, reuseScope: selected.reuse_scope }
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
