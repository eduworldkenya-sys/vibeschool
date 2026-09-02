import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { LessonContext } from '@/lib/teaching/lessonContext'
import type { LessonSourceSuggestion } from '@/lib/teaching/lessonSource'

export type LessonResourceAuthority =
  | 'curriculum_only'
  | 'resource_candidate'
  | 'resource_verified'
  | 'resource_certified'
  | 'resource_unavailable'

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
    previousLesson: {
      lessonPlanId: string
      topic: string
      occurrenceDate: string
    } | null
  }
  scheme: LessonSourceSuggestion | null
  resourceAuthority: LessonResourceAuthority
  certifiedContent: CertifiedLessonContentAsset[]
  provenance: {
    schemeId: string | null
    curriculumId: string | null
    subStrandId: string | null
    candidateResourceIds: string[]
    resourceIds: string[]
    resourceVersionIds: string[]
  }
}

interface ResourceCandidate {
  id: string
  title: string
  asset_kind: string | null
  purpose: string | null
}

interface ResourceVersionRow {
  id: string
  resource_id: string
  lifecycle_status: string
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
    resource.asset_kind !== 'lesson_plan' &&
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
      title?: string
      asset_kind?: string | null
      purpose?: string | null
    }>
  } | null

  if (!payload?.ok) return []

  return (payload.resources ?? [])
    .flatMap(resource =>
      resource.resource_id
        ? [{
            id: resource.resource_id,
            title: resource.title ?? 'VibeSchool learning resource',
            asset_kind: resource.asset_kind ?? null,
            purpose: resource.purpose ?? null,
          }]
        : [],
    )
    .filter(isTeachingContentCandidate)
}

async function loadCurriculumResourceCandidates(
  source: LessonSourceSuggestion,
): Promise<ResourceCandidate[]> {
  if (!source.id && !source.strandId) return []

  // `asset_kind` and `purpose` exist in the canonical-resource migrations and
  // production schema, while the generated Database type may lag that additive
  // migration. Read the whole row and narrow those optional fields structurally
  // at runtime rather than bypassing TypeScript with an escape-hatch cast.
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
    .map(resource => {
      const assetKind =
        'asset_kind' in resource &&
        typeof resource.asset_kind === 'string'
          ? resource.asset_kind
          : null

      const purpose =
        'purpose' in resource &&
        typeof resource.purpose === 'string'
          ? resource.purpose
          : null

      return {
        id: resource.id,
        title: resource.title,
        asset_kind: assetKind,
        purpose,
      }
    })
    .filter(isTeachingContentCandidate)
}

function authorityRank(status: string): number {
  switch (status) {
    case 'certified': return 3
    case 'verified': return 2
    case 'candidate': return 1
    default: return 0
  }
}

async function loadResourceAuthority(
  candidates: ResourceCandidate[],
): Promise<{
  authority: LessonResourceAuthority
  certifiedContent: CertifiedLessonContentAsset[]
}> {
  if (candidates.length === 0) {
    return { authority: 'curriculum_only', certifiedContent: [] }
  }

  const candidateById = new Map(
    candidates.map(candidate => [candidate.id, candidate]),
  )

  const { data, error } = await supabase
    .from('learning_resource_versions')
    .select(
      'id, resource_id, lifecycle_status, payload, content_sha256, certification_policy_version, certified_at',
    )
    .in('resource_id', candidates.map(candidate => candidate.id))

  if (error) throw error

  const versions = (data ?? []) as ResourceVersionRow[]
  let highestRank = 0
  for (const version of versions) {
    highestRank = Math.max(highestRank, authorityRank(version.lifecycle_status))
  }

  const certifiedContent = versions.flatMap(version => {
    if (version.lifecycle_status !== 'certified') return []
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
      assetKind: resource.asset_kind,
      purpose: resource.purpose,
      payload: version.payload,
      contentSha256: version.content_sha256,
      certificationPolicyVersion: version.certification_policy_version,
      certifiedAt: version.certified_at,
    }]
  })

  if (certifiedContent.length > 0) {
    return { authority: 'resource_certified', certifiedContent }
  }
  if (highestRank >= 2) {
    return { authority: 'resource_verified', certifiedContent: [] }
  }
  if (highestRank >= 1) {
    return { authority: 'resource_candidate', certifiedContent: [] }
  }

  return { authority: 'resource_unavailable', certifiedContent: [] }
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

  const {
    authority: resourceAuthority,
    certifiedContent,
  } = await loadResourceAuthority(candidates)

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
      previousLesson: context.previousLesson ?? null,
    },
    scheme: source,
    resourceAuthority,
    certifiedContent,
    provenance: {
      schemeId: source?.schemeId ?? null,
      curriculumId: source?.id ?? null,
      subStrandId: source?.strandId ?? null,
      candidateResourceIds: candidates.map(candidate => candidate.id),
      resourceIds: certifiedContent.map(asset => asset.resourceId),
      resourceVersionIds: certifiedContent.map(asset => asset.resourceVersionId),
    },
  }
}
