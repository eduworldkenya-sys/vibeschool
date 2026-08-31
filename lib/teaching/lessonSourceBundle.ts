import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { LessonContext } from '@/lib/teaching/lessonContext'
import type { LessonSourceSuggestion } from '@/lib/teaching/lessonSource'

export interface CertifiedLessonContentAsset {
  resourceId: string
  resourceVersionId: string
  title: string
  assetKind: string | null
  purpose: string | null
  payload: Json
  contentSha256: string
  certificationPolicyVersion: string
  certifiedAt: string
}

export interface PublishedLessonContentAsset {
  resourceId: string
  resourceVersionId: string
  publicationId: string
  chapterId: string
  title: string
  payload: Json
  contentSha256: string
  lifecycleStatus: 'candidate' | 'verified'
  alignmentStatus: string | null
  verifiedAt: string | null
  publishedAt: string | null
}

export interface CanonicalLessonSourceBundle {
  timetableOccurrence: {
    timetableSlotId: string
    occurrenceDate: string
    classId: string
    subjectId: string
    subjectName: string
  }
  classContext: {
    teacherName: string
    schoolName: string
    schoolId: string
    grade: string | null
    studentCount: number
    previousTopics: string[]
  }
  scheme: LessonSourceSuggestion | null
  certifiedContent: CertifiedLessonContentAsset[]
  publishedContent: PublishedLessonContentAsset[]
  provenance: {
    schemeId: string | null
    curriculumId: string | null
    subStrandId: string | null
    resourceIds: string[]
    resourceVersionIds: string[]
    publicationIds: string[]
    chapterIds: string[]
  }
}

interface ResourceCandidate {
  id: string
  title: string
  sourceType: string | null
  publicationId: string | null
  chapterId: string | null
  assetKind: string | null
  purpose: string | null
}

interface ReusableVersionRow {
  id?: string
  resource_id?: string
  lifecycle_status?: string
  payload?: Json
  content_sha256?: string
  certification_policy_version?: string | null
  certified_at?: string | null
  verified_at?: string | null
  provenance?: Json
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function isTeachingContentCandidate(resource: ResourceCandidate): boolean {
  return (
    resource.assetKind !== 'lesson_plan' &&
    (
      resource.purpose === null ||
      resource.purpose === 'teach' ||
      resource.purpose === 'reference'
    )
  )
}

function jsonObject(value: Json | undefined): Record<string, Json | undefined> {
  if (
    value === undefined ||
    value === null ||
    Array.isArray(value) ||
    typeof value !== 'object'
  ) {
    return {}
  }
  return value as Record<string, Json | undefined>
}

async function loadExplicitSchemeResources(
  schemeId: string,
): Promise<ResourceCandidate[]> {
  const { data, error } = await supabase.rpc(
    'list_scheme_lesson_resources',
    { p_scheme_lesson_id: schemeId },
  )

  if (error) throw error

  const payload = data as {
    ok?: boolean
    resources?: Array<{
      resource_id?: string
      publication_id?: string | null
      chapter_id?: string | null
      chapter_title?: string | null
    }>
  } | null

  if (!payload?.ok) return []

  return (payload.resources ?? []).flatMap(resource =>
    resource.resource_id
      ? [{
          id: resource.resource_id,
          title: resource.chapter_title ?? 'Approved learning resource',
          sourceType: resource.chapter_id ? 'chapter' : null,
          publicationId: resource.publication_id ?? null,
          chapterId: resource.chapter_id ?? null,
          assetKind: null,
          purpose: null,
        }]
      : [],
  )
}

async function loadCurriculumResourceCandidates(
  source: LessonSourceSuggestion,
): Promise<ResourceCandidate[]> {
  if (!source.id && !source.strandId) return []

  let query = supabase
    .from('learning_resources')
    .select('*')
    .eq('status', 'active')

  if (source.id && source.strandId) {
    query = query.or(
      `curriculum_id.eq.${source.id},sub_strand_id.eq.${source.strandId}`,
    )
  } else if (source.id) {
    query = query.eq('curriculum_id', source.id)
  } else if (source.strandId) {
    query = query.eq('sub_strand_id', source.strandId)
  }

  const { data, error } = await query.limit(25)
  if (error) throw error

  return (data ?? [])
    .map(resource => ({
      id: resource.id,
      title: resource.title,
      sourceType:
        'source_type' in resource && typeof resource.source_type === 'string'
          ? resource.source_type
          : null,
      publicationId:
        'publication_id' in resource && typeof resource.publication_id === 'string'
          ? resource.publication_id
          : null,
      chapterId:
        'chapter_id' in resource && typeof resource.chapter_id === 'string'
          ? resource.chapter_id
          : null,
      assetKind:
        'asset_kind' in resource && typeof resource.asset_kind === 'string'
          ? resource.asset_kind
          : null,
      purpose:
        'purpose' in resource && typeof resource.purpose === 'string'
          ? resource.purpose
          : null,
    }))
    .filter(isTeachingContentCandidate)
}

/**
 * Reads only database-approved reusable versions. RLS remains strict on the
 * table itself; the guarded RPC additionally permits exact immutable snapshots
 * of currently published chapters without claiming those snapshots are certified.
 */
async function loadReusableVersions(
  candidates: ResourceCandidate[],
): Promise<{
  certified: CertifiedLessonContentAsset[]
  published: PublishedLessonContentAsset[]
}> {
  if (candidates.length === 0) {
    return { certified: [], published: [] }
  }

  const candidateById = new Map(
    candidates.map(candidate => [candidate.id, candidate]),
  )

  const { data, error } = await supabase.rpc(
    'cla_list_reusable_lesson_resource_versions',
    { p_resource_ids: candidates.map(candidate => candidate.id) },
  )

  if (error) throw error

  const response = data as {
    ok?: boolean
    versions?: ReusableVersionRow[]
  } | null

  if (!response?.ok) return { certified: [], published: [] }

  const certified: CertifiedLessonContentAsset[] = []
  const published: PublishedLessonContentAsset[] = []
  const chosenResources = new Set<string>()

  // RPC order is assurance first, newest version second. Keep only the best
  // reusable version per resource to prevent duplicate content assembly.
  for (const version of response.versions ?? []) {
    if (
      !version.id ||
      !version.resource_id ||
      version.payload === undefined ||
      !version.content_sha256 ||
      chosenResources.has(version.resource_id)
    ) {
      continue
    }

    const resource = candidateById.get(version.resource_id)
    if (!resource) continue

    if (
      version.lifecycle_status === 'certified' &&
      version.certification_policy_version &&
      version.certified_at
    ) {
      certified.push({
        resourceId: resource.id,
        resourceVersionId: version.id,
        title: resource.title,
        assetKind: resource.assetKind,
        purpose: resource.purpose,
        payload: version.payload,
        contentSha256: version.content_sha256,
        certificationPolicyVersion: version.certification_policy_version,
        certifiedAt: version.certified_at,
      })
      chosenResources.add(resource.id)
      continue
    }

    if (
      version.lifecycle_status !== 'candidate' &&
      version.lifecycle_status !== 'verified'
    ) {
      continue
    }

    const provenance = jsonObject(version.provenance)
    const publicationId = provenance.publication_id
    const chapterId = provenance.chapter_id
    const alignmentStatus = provenance.alignment_status
    const publishedAt = provenance.published_at

    if (
      provenance.source_kind !== 'published_chapter' ||
      typeof publicationId !== 'string' ||
      typeof chapterId !== 'string'
    ) {
      continue
    }

    published.push({
      resourceId: resource.id,
      resourceVersionId: version.id,
      publicationId,
      chapterId,
      title: resource.title,
      payload: version.payload,
      contentSha256: version.content_sha256,
      lifecycleStatus: version.lifecycle_status,
      alignmentStatus:
        typeof alignmentStatus === 'string' ? alignmentStatus : null,
      verifiedAt: version.verified_at ?? null,
      publishedAt:
        typeof publishedAt === 'string' ? publishedAt : null,
    })
    chosenResources.add(resource.id)
  }

  return { certified, published }
}

export async function buildCanonicalLessonSourceBundle({
  timetableSlotId,
  occurrenceDate,
  classId,
  subjectId,
  subjectName,
  context,
  source,
}: {
  timetableSlotId: string
  occurrenceDate: string
  classId: string
  subjectId: string
  subjectName: string
  context: LessonContext
  source: LessonSourceSuggestion | null
}): Promise<CanonicalLessonSourceBundle> {
  let explicitResources: ResourceCandidate[] = []
  let curriculumResources: ResourceCandidate[] = []

  if (source?.schemeId) {
    explicitResources = await loadExplicitSchemeResources(source.schemeId)
  }

  if (source) {
    curriculumResources = await loadCurriculumResourceCandidates(source)
  }

  const candidates = uniqueById([
    ...explicitResources,
    ...curriculumResources,
  ])

  const reusable = await loadReusableVersions(candidates)

  return {
    timetableOccurrence: {
      timetableSlotId,
      occurrenceDate,
      classId,
      subjectId,
      subjectName,
    },
    classContext: {
      teacherName: context.teacherName,
      schoolName: context.schoolName,
      schoolId: context.schoolId,
      grade: context.grade,
      studentCount: context.studentCount,
      previousTopics: context.previousTopics,
    },
    scheme: source,
    certifiedContent: reusable.certified,
    publishedContent: reusable.published,
    provenance: {
      schemeId: source?.schemeId ?? null,
      curriculumId: source?.id ?? null,
      subStrandId: source?.strandId ?? null,
      resourceIds: Array.from(new Set([
        ...reusable.certified.map(asset => asset.resourceId),
        ...reusable.published.map(asset => asset.resourceId),
      ])),
      resourceVersionIds: [
        ...reusable.certified.map(asset => asset.resourceVersionId),
        ...reusable.published.map(asset => asset.resourceVersionId),
      ],
      publicationIds: reusable.published.map(asset => asset.publicationId),
      chapterIds: reusable.published.map(asset => asset.chapterId),
    },
  }
}
