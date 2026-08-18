import { SUPABASE_URL } from '@/lib/supabase'
import type { LessonPlanSections } from '@/lib/teaching/lessonPlanCodec'

export interface CanonicalLessonIdentity {
  curriculumId: string
  subjectId: string
  grade: string
  subStrandId: string
  subjectName: string
  topicTitle: string
  curriculumStrand?: string
  curriculumSubStrand?: string
  duration?: string
  languageCode?: string
}

export type CanonicalLessonGenerationResult =
  | {
      ok: true
      status: 'hit' | 'candidate'
      sections: LessonPlanSections
      resourceId: string
      resourceVersionId: string | null
      certificationRequired: boolean
      creditsUsed: number
    }
  | {
      ok: false
      status: 'pending' | 'error'
      message: string
      resourceId?: string
      resourceVersionId?: string | null
      reviewStatus?: string | null
    }

const REQUIRED_SECTIONS: Array<keyof LessonPlanSections> = [
  'objectives',
  'resources',
  'introduction',
  'development',
  'consolidation',
  'assessmentHook',
  'homework',
  'differentiation',
]

function asSections(value: unknown): LessonPlanSections | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const key of REQUIRED_SECTIONS) {
    if (typeof record[key] !== 'string' || !String(record[key]).trim()) {
      return null
    }
  }
  return record as unknown as LessonPlanSections
}

export async function generateCanonicalLessonPlan(
  accessToken: string,
  identity: CanonicalLessonIdentity,
): Promise<CanonicalLessonGenerationResult> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/generate-canonical-lesson-plan`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(identity),
    },
  )

  const payload = await response.json()

  if (response.status === 202 || payload.status === 'pending') {
    return {
      ok: false,
      status: 'pending',
      message:
        payload.reviewStatus === 'generating'
          ? 'This curriculum asset is already being generated. Try again shortly.'
          : 'This curriculum asset is already under review and will be reusable after certification.',
      resourceId: payload.resourceId,
      resourceVersionId: payload.resourceVersionId ?? null,
      reviewStatus: payload.reviewStatus ?? null,
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 'error',
      message:
        payload.message ??
        payload.error ??
        'Canonical lesson generation failed.',
    }
  }

  const sections = asSections(payload.plan)
  if (!sections || !payload.resourceId) {
    return {
      ok: false,
      status: 'error',
      message: 'The canonical lesson response was incomplete.',
    }
  }

  return {
    ok: true,
    status: payload.status === 'hit' ? 'hit' : 'candidate',
    sections,
    resourceId: payload.resourceId,
    resourceVersionId: payload.resourceVersionId ?? null,
    certificationRequired: payload.status !== 'hit',
    creditsUsed: Number(payload.credits?.used ?? 0),
  }
}
