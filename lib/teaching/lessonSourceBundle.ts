import { supabase } from '@/lib/supabase'
import { buildCertifiedTeacherToolContexts } from '@/lib/learn/teachingToolContentBridge.mjs'
import { includeGradeOneJumpingAsset } from '@/lib/teaching/jumpingContentSelection'
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
  /** Read-only per-version tool inputs derived from the same certified assets. */
  toolContexts: ReturnType<typeof buildCertifiedTeacherToolContexts>
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
      sequence?: number | null
    }>
  } | null

  if (!payload?.ok) return []

  return (payload.resources ?? [])
    .flatMap((resource, index) =>
      resource.resource_id
        ? [{
            id: resource.resource_id,
            title: resource.title ?? 'Certified learning resource',
            asset_kind: resource.asset_kind ?? null,
            purpose: resource.purpose ?? null,
            sequence: resource.sequence ?? index + 1,
          }]
        : [],
    )
    .filter(isTeachingContentCandidate)
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
    .map(({ sequence: _sequence, ...resource }) => resource)
}

/**
 * Generic Scheme -> canonical resource links are the source authority for
 * VibeSchool-original materials. The old publication-specific links remain
 * a compatibility path, but they cannot carry these original lesson units.
 */
async function loadGenericSchemeResources(
  schemeId: string,
  lessonNumber: number | null,
): Promise<ResourceCandidate[]> {
  const {data, error} = await supabase.rpc('list_teaching_resources', {
    p_target_type: 'scheme_lesson', p_target_id: schemeId,
  })
  if (error) throw error
  const payload = data as {ok?:boolean;resources?:Array<{
    resource_id?:string;sequence?:number
  }>} | null
  if (!payload?.ok) return []
  const links = (payload.resources ?? []).filter(item => Boolean(item.resource_id))
  const ids = Array.from(new Set(links.map(item => item.resource_id).filter((id): id is string => typeof id==='string')))
  if (ids.length === 0) return []

  const {data: roots,error: rootsError} = await supabase.from('learning_resources')
    .select('*')
    .in('id',ids).eq('status','active')
  if (rootsError) throw rootsError

  const rootsById = new Map((roots ?? []).map(root => [root.id,root]))
  return links.flatMap(link => {
    const root = link.resource_id ? rootsById.get(link.resource_id) : null
    if (!root) return []
    if (!includeGradeOneJumpingAsset(root.canonical_key,lessonNumber)) return []
    const candidate: ResourceCandidate = {
      id:root.id,title:root.title,
      asset_kind:'asset_kind' in root && typeof root.asset_kind==='string' ? root.asset_kind : null,
      purpose:'purpose' in root && typeof root.purpose==='string' ? root.purpose : null,
    }
    return isTeachingContentCandidate(candidate) ? [{
      ...candidate,sequence:link.sequence ?? 0,
    }] : []
  }).sort((a,b)=>a.sequence-b.sequence || a.id.localeCompare(b.id))
    .map(({sequence:_sequence,...resource})=>resource)
}

async function queryCurriculumCandidates(
  column: 'curriculum_id' | 'sub_strand_id',
  id: string,
  lessonNumber: number | null,
): Promise<ResourceCandidate[]> {
  const { data, error } = await supabase
    .from('learning_resources')
    .select('*')
    .eq('status', 'active')
    .eq(column, id)
    .order('id', { ascending: true })
    .limit(100)

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
    .filter(resource => {
      const original = (data ?? []).find(row => row.id === resource.id)
      if (original?.canonical_key?.startsWith('vs:g4:mathematics:time:learner:lesson:')) return false
      return includeGradeOneJumpingAsset(
        typeof original?.canonical_key==='string' ? original.canonical_key : null,
        lessonNumber,
      )
    })
    .slice(0,25)
}

/**
 * Resolves curriculum-linked resource candidates without broad OR matching.
 * Exact sub-strand authority wins; curriculum-level resources are a fallback
 * only when no sub-strand resource exists. This prevents an adjacent resource
 * from becoming the canonical source merely because it shares one identifier.
 */
async function loadCurriculumResourceCandidates(
  source: Pick<LessonSourceSuggestion, 'id' | 'strandId' | 'lessonNumber'>,
): Promise<ResourceCandidate[]> {
  if (source.strandId) {
    const subStrandResources = await queryCurriculumCandidates(
      'sub_strand_id',
      source.strandId,
      source.lessonNumber,
    )
    if (subStrandResources.length > 0) return subStrandResources
  }

  if (source.id) {
    return queryCurriculumCandidates('curriculum_id', source.id, source.lessonNumber)
  }

  return []
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
    .order('certified_at', { ascending: false })
    .order('id', { ascending: true })

  if (error) throw error

  // Defensive convergence: if historic data ever contains more than one
  // certified version for a resource, choose one deterministically rather than
  // letting database return order alter the generated lesson package.
  const newestCertifiedByResource = new Map<string, CertifiedVersionRow>()
  for (const version of (data ?? []) as CertifiedVersionRow[]) {
    if (!newestCertifiedByResource.has(version.resource_id)) {
      newestCertifiedByResource.set(version.resource_id, version)
    }
  }

  return candidates.flatMap(resource => {
    const version = newestCertifiedByResource.get(resource.id)
    if (
      !version ||
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

/**
 * Shared, certification-only content access for both scheduled teaching and
 * independent preparation. Source identities come from the teacher's Scheme;
 * database RLS controls what the current session can read. Candidate editorial
 * drafts are deliberately never returned by this production retrieval path.
 *
 * Lesson-specific resources require an explicit Scheme lesson number. Never
 * choose a different unit using the instructional week or sequence number.
 */
export async function loadCertifiedContentForSource(
  source: Pick<LessonSourceSuggestion, 'schemeId' | 'lessonNumber' | 'id' | 'strandId'> | null,
): Promise<CertifiedLessonContentAsset[]> {
  if (!source) return []

  const [genericSchemeResources, explicitResources, curriculumResources] = await Promise.all([
    source.schemeId ? loadGenericSchemeResources(source.schemeId, source.lessonNumber) : Promise.resolve([]),
    source.schemeId ? loadExplicitSchemeResources(source.schemeId) : Promise.resolve([]),
    loadCurriculumResourceCandidates(source),
  ])

  const candidates = uniqueById([
    ...genericSchemeResources,
    ...explicitResources,
    ...curriculumResources,
  ])
  return loadCertifiedVersions(candidates)
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
  const certifiedContent = await loadCertifiedContentForSource(source)

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
    toolContexts: context.grade ? buildCertifiedTeacherToolContexts({
      subject: subjectName,
      grade: context.grade,
      schemeLessonId: source?.schemeId ?? null,
      assets: certifiedContent,
    }) : [],
    provenance: {
      schemeId: source?.schemeId ?? null,
      curriculumId: source?.id ?? null,
      subStrandId: source?.strandId ?? null,
      resourceIds: certifiedContent.map(asset => asset.resourceId),
      resourceVersionIds: certifiedContent.map(asset => asset.resourceVersionId),
    },
  }
}
