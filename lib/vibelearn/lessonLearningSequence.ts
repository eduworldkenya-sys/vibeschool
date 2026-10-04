import { supabase } from '@/lib/supabase'

export type VibeLearnLessonStage =
  | 'introduce'
  | 'explain'
  | 'demonstrate'
  | 'check'
  | 'practice'
  | 'support'
  | 'extend'
  | 'homework'

export interface VibeLearnLessonRecommendation {
  stage: VibeLearnLessonStage
  stageOrder: number
  usageRole: string
  resourceId: string
  title: string
  description: string | null
  assetKind: string | null
  representation: string
  publicationId: string | null
  chapterId: string | null
  contentId: string | null
  certified: boolean
  graphMatch: boolean
  misconceptionMatch: boolean
  alreadyAttached: boolean
  score: number
  reason: string
}

export interface VibeLearnLessonAuthority {
  classId: string
  subjectId: string
  curriculumId: string | null
  subStrandId: string | null
  outcomeCount: number
  verifiedConceptCount: number
  verifiedGraphMisconceptionCount: number
  graphIsEnrichmentNotInvention: boolean
}

export interface VibeLearnDifferentiation {
  classSize: number
  needsSupport: number
  needsPractice: number
  readyToExtend: number
  noEvidence: number
  learnersWithObservedMisconceptions: number
  teacherControlsAssignment: boolean
  missingEvidenceIsNotWeakness: boolean
}

export interface VibeLearnLessonSequence {
  authority: VibeLearnLessonAuthority
  differentiation: VibeLearnDifferentiation
  recommendations: VibeLearnLessonRecommendation[]
}

type RpcRecommendation = {
  stage?: string
  stage_order?: number
  usage_role?: string
  resource_id?: string
  title?: string
  description?: string | null
  asset_kind?: string | null
  representation?: string | null
  publication_id?: string | null
  chapter_id?: string | null
  content_id?: string | null
  certified?: boolean
  graph_match?: boolean
  misconception_match?: boolean
  already_attached?: boolean
  score?: number
  reason?: string
}

const STAGES = new Set<VibeLearnLessonStage>([
  'introduce',
  'explain',
  'demonstrate',
  'check',
  'practice',
  'support',
  'extend',
  'homework',
])

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export async function loadVibeLearnLessonSequence(
  lessonPlanId: string,
): Promise<VibeLearnLessonSequence> {
  const { data, error } = await supabase.rpc(
    'teacher_get_vibelearn_lesson_recommendations',
    {
      p_lesson_plan_id: lessonPlanId,
      p_limit_per_stage: 3,
    },
  )

  if (error) throw new Error(error.message)

  const payload = data as {
    ok?: boolean
    error?: string
    authority?: Record<string, unknown>
    differentiation?: Record<string, unknown>
    recommendations?: RpcRecommendation[]
  } | null

  if (!payload?.ok) {
    throw new Error(payload?.error ?? 'vibelearn_lesson_recommendations_failed')
  }

  const authority = payload.authority ?? {}
  const differentiation = payload.differentiation ?? {}

  const recommendations = (payload.recommendations ?? []).flatMap(item => {
    const stage = item.stage
    const resourceId = item.resource_id
    if (
      typeof stage !== 'string' ||
      !STAGES.has(stage as VibeLearnLessonStage) ||
      typeof resourceId !== 'string'
    ) return []

    return [{
      stage: stage as VibeLearnLessonStage,
      stageOrder: numberValue(item.stage_order),
      usageRole: textValue(item.usage_role) ?? 'reference',
      resourceId,
      title: textValue(item.title) ?? 'Learning resource',
      description: textValue(item.description),
      assetKind: textValue(item.asset_kind),
      representation: textValue(item.representation) ?? 'content',
      publicationId: textValue(item.publication_id),
      chapterId: textValue(item.chapter_id),
      contentId: textValue(item.content_id),
      certified: item.certified === true,
      graphMatch: item.graph_match === true,
      misconceptionMatch: item.misconception_match === true,
      alreadyAttached: item.already_attached === true,
      score: numberValue(item.score),
      reason: textValue(item.reason) ?? 'Matches this lesson context.',
    }]
  })

  const classId = textValue(authority.class_id)
  const subjectId = textValue(authority.subject_id)
  if (!classId || !subjectId) {
    throw new Error('vibelearn_lesson_authority_incomplete')
  }

  return {
    authority: {
      classId,
      subjectId,
      curriculumId: textValue(authority.curriculum_id),
      subStrandId: textValue(authority.sub_strand_id),
      outcomeCount: numberValue(authority.outcome_count),
      verifiedConceptCount: numberValue(authority.verified_concept_count),
      verifiedGraphMisconceptionCount: numberValue(authority.verified_graph_misconception_count),
      graphIsEnrichmentNotInvention: authority.graph_is_enrichment_not_invention === true,
    },
    differentiation: {
      classSize: numberValue(differentiation.class_size),
      needsSupport: numberValue(differentiation.needs_support),
      needsPractice: numberValue(differentiation.needs_practice),
      readyToExtend: numberValue(differentiation.ready_to_extend),
      noEvidence: numberValue(differentiation.no_evidence),
      learnersWithObservedMisconceptions: numberValue(differentiation.learners_with_observed_misconceptions),
      teacherControlsAssignment: differentiation.teacher_controls_assignment === true,
      missingEvidenceIsNotWeakness: differentiation.missing_evidence_is_not_weakness === true,
    },
    recommendations,
  }
}

export async function attachVibeLearnLessonRecommendation(input: {
  lessonPlanId: string
  recommendation: VibeLearnLessonRecommendation
}): Promise<void> {
  const { data, error } = await supabase.rpc('link_learning_resource', {
    p_resource_id: input.recommendation.resourceId,
    p_target_type: 'lesson_plan',
    p_target_id: input.lessonPlanId,
    p_usage_role: input.recommendation.usageRole,
    p_sequence: Math.max(1, input.recommendation.stageOrder * 10),
    p_page_start: null,
    p_page_end: null,
    p_section_refs: [],
    p_exercise_refs: [],
  })

  if (error) throw new Error(error.message)

  const payload = data as { ok?: boolean; error?: string } | null
  if (!payload?.ok) {
    throw new Error(payload?.error ?? 'vibelearn_resource_attach_failed')
  }
}
