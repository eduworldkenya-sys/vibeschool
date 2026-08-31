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
  publicationId: string
  chapterId: string
  title: string
  payload: Json
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

interface CertifiedVersionRow {
  id: string
  resource_id: string
  payload: Json
  content_sha256: string
  certification_policy_version: string | null
  certified_at: string | null
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

async function loadCertifiedVersions(
  candidates: ResourceCandidate[],
): Promise<CertifiedLessonContentAsset[]> {
  if (candidates.length === 0) return []

  const candidateById = new Map(
    candidates.map(candidate => [candidate.id, candidate]),
  )

  const { data, error } = await supabase
    .from('learning_resource_versions')
    .select(
      'id, resource_id, payload, content_sha256, certification_policy_version, certified_at',
    )
    .in('resource_id', candidates.map(candidate => candidate.id))
    .eq('lifecycle_status', 'certified')

  if (error) throw error

  return ((data ?? []) as CertifiedVersionRow[]).flatMap(version => {
    const resource = candidateById.get(version.resource_id)
    if (
      !resource ||
      !version.certification_policy_version ||
      !version.certified_at
    ) {
      return []
    }

    return [{
      resourceId: resource.id,
      resourceVersionId: version.id,
      title: resource.title,
      assetKind: resource.assetKind,
      purpose: resource.purpose,
      payload: version.payload,
      contentSha256: version.content_sha256,
      certificationPolicyVersion: version.certification_policy_version,
      certifiedAt: version.certified_at,
    }]
  })
}

/**
 * Published VibeSchool chapters are deterministic source material, but are
 * deliberately represented separately from certified versions. A published
 * creator-claimed chapter remains published/unverified until its real QA gate
 * certifies it; lesson preparation never fabricates that status.
 */
async function loadPublishedChapterAssets(
  candidates: ResourceCandidate[],
): Promise<PublishedLessonContentAsset[]> {
  const chapterCandidates = candidates.filter(
    candidate =>
      candidate.sourceType === 'chapter' &&
      candidate.publicationId &&
      candidate.chapterId,
  )

  if (chapterCandidates.length === 0) return []

  const byChapterId = new Map(
    chapterCandidates.map(candidate => [candidate.chapterId as string, candidate]),
  )

  const { data, error } = await supabase
    .from('vibe_chapters')
    .select(
      'id, publication_id, title, blocks, status, alignment_status, verified_at, published_at',
    )
    .in('id', Array.from(byChapterId.keys()))
    .eq('status', 'published')

  if (error) throw error

  return (data ?? []).flatMap(chapter => {
    const candidate = byChapterId.get(chapter.id)
    if (!candidate || !chapter.publication_id) return []

    return [{
      resourceId: candidate.id,
      publicationId: chapter.publication_id,
      chapterId: chapter.id,
      title: chapter.title ?? candidate.title,
      payload: chapter.blocks as Json,
      alignmentStatus: chapter.alignment_status ?? null,
      verifiedAt: chapter.verified_at ?? null,
      publishedAt: chapter.published_at ?? null,
    }]
  })
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

  const [certifiedContent, publishedContent] = await Promise.all([
    loadCertifiedVersions(candidates),
    loadPublishedChapterAssets(candidates),
  ])

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
    certifiedContent,
    publishedContent,
    provenance: {
      schemeId: source?.schemeId ?? null,
      curriculumId: source?.id ?? null,
      subStrandId: source?.strandId ?? null,
      resourceIds: Array.from(new Set([
        ...certifiedContent.map(asset => asset.resourceId),
        ...publishedContent.map(asset => asset.resourceId),
      ])),
      resourceVersionIds: certifiedContent.map(asset => asset.resourceVersionId),
      publicationIds: publishedContent.map(asset => asset.publicationId),
      chapterIds: publishedContent.map(asset => asset.chapterId),
    },
  }
}
