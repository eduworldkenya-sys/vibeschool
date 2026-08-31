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
  provenance: {
    schemeId: string | null
    curriculumId: string | null
    subStrandId: string | null
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

  return (payload.resources ?? []).flatMap(resource =>
    resource.resource_id
      ? [{
          id: resource.resource_id,
          title: resource.title ?? 'Certified learning resource',
          asset_kind: resource.asset_kind ?? null,
          purpose: resource.purpose ?? null,
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
    .select('id, title, asset_kind, purpose')
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

  return ((data ?? []) as ResourceCandidate[])
    .filter(resource => resource.asset_kind !== 'lesson_plan')
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
      assetKind: resource.asset_kind,
      purpose: resource.purpose,
      payload: version.payload,
      contentSha256: version.content_sha256,
      certificationPolicyVersion: version.certification_policy_version,
      certifiedAt: version.certified_at,
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

  const certifiedContent = await loadCertifiedVersions(candidates)

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
    provenance: {
      schemeId: source?.schemeId ?? null,
      curriculumId: source?.id ?? null,
      subStrandId: source?.strandId ?? null,
      resourceIds: certifiedContent.map(asset => asset.resourceId),
      resourceVersionIds: certifiedContent.map(asset => asset.resourceVersionId),
    },
  }
}
