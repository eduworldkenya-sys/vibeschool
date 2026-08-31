import type { Json } from '@/lib/database.types'
import type { LessonPlanSections } from '@/lib/teaching/lessonPlanCodec'
import type { CertifiedLessonContentAsset } from '@/lib/teaching/lessonSourceBundle'
import { validateLessonPlanGrounding } from '@/lib/teaching/lessonPlanGrounding'

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
  schemeId?: string | null
  schemeObjectives?: string | null
  keyInquiryQuestion?: string | null
  learningResources?: string | null
  learningExperiences?: string | null
  assessmentMethods?: string | null
  reference?: string | null
  certifiedContent?: CertifiedLessonContentAsset[]
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

const CONTENT_KEYS = new Set([
  'body',
  'content',
  'explanation',
  'explanations',
  'summary',
  'examples',
  'kenyanExamples',
  'kenyan_examples',
  'activities',
  'misconceptions',
  'workedExamples',
  'worked_examples',
  'questions',
  'answers',
  'keyPoints',
  'key_points',
  'teacherNotes',
  'teacher_notes',
  'sections',
])

function clean(value?: string | null): string {
  return value?.trim() ?? ''
}

function collectStrings(value: Json, key: string | null = null): string[] {
  if (typeof value === 'string') {
    return key === null || CONTENT_KEYS.has(key)
      ? [value.trim()].filter(Boolean)
      : []
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap(item => collectStrings(item, key))
  }

  return Object.entries(value).flatMap(([childKey, childValue]) =>
    CONTENT_KEYS.has(childKey)
      ? collectStrings(childValue, childKey)
      : [],
  )
}

function certifiedContentText(assets: CertifiedLessonContentAsset[]): string {
  return assets
    .flatMap(asset => {
      const fragments = collectStrings(asset.payload)
      if (fragments.length === 0) return []

      return [
        `Certified content: ${asset.title}\n${fragments.join('\n\n')}`,
      ]
    })
    .join('\n\n')
    .slice(0, 20000)
}

function joinNonEmpty(
  values: Array<string | null | undefined>,
  separator = '\n',
): string {
  return values
    .map(clean)
    .filter(Boolean)
    .join(separator)
}

/**
 * Deterministically transforms exact certified VibeSchool content plus Scheme
 * authority into a lesson plan. No Edge Function or model provider is called.
 */
export async function generateCanonicalLessonPlan(
  accessToken: string,
  identity: CanonicalLessonIdentity,
): Promise<CanonicalLessonGenerationResult> {
  void accessToken

  const assets = identity.certifiedContent ?? []
  const primary = assets[0]

  if (!primary) {
    return {
      ok: false,
      status: 'error',
      message:
        'No certified VibeSchool content is available for this lesson. Use the Scheme-derived baseline.',
    }
  }

  const objectives = clean(identity.schemeObjectives)
  const inquiry = clean(identity.keyInquiryQuestion)
  const experiences = clean(identity.learningExperiences)
  const assessment = clean(identity.assessmentMethods)
  const content = certifiedContentText(assets)
  const resourceTitles = assets.map(asset => asset.title).join('; ')
  const curriculumPath = joinNonEmpty(
    [identity.curriculumStrand, identity.curriculumSubStrand],
    ' → ',
  )

  const sections: LessonPlanSections = {
    objectives:
      objectives ||
      'No authoritative Scheme objective is attached to this lesson yet.',

    resources: joinNonEmpty([
      identity.learningResources,
      resourceTitles
        ? `Certified VibeSchool content: ${resourceTitles}`
        : null,
      identity.reference
        ? `Reference: ${identity.reference}`
        : null,
    ]),

    introduction: joinNonEmpty([
      `Lesson focus: ${identity.topicTitle}.`,
      inquiry ? `Key inquiry question: ${inquiry}` : null,
      `Planned duration: ${identity.duration ?? '40 minutes'}.`,
    ]),

    development: joinNonEmpty([
      curriculumPath ? `Curriculum path: ${curriculumPath}.` : null,
      experiences ? `Scheme learning experiences:\n${experiences}` : null,
      content ||
        'The certified resource contains no recognised teaching-content fields. Follow the Scheme learning sequence.',
    ], '\n\n'),

    consolidation: joinNonEmpty([
      `Return to the lesson focus: ${identity.topicTitle}.`,
      inquiry
        ? `Revisit the key inquiry question: ${inquiry}`
        : 'Review the stated Scheme objective with learners.',
    ]),

    assessmentHook: joinNonEmpty([
      objectives
        ? `Objectives being assessed:\n${objectives}`
        : 'No authoritative Scheme objective is attached yet.',
      assessment
        ? `Scheme assessment method(s):\n${assessment}`
        : 'Use teacher observation, oral checks or another teacher-selected method without changing the stated objective.',
    ], '\n\n'),

    homework:
      'No homework has been invented automatically. Add homework only when supported by the Scheme objective or the attached certified content.',

    differentiation:
      'Adjust pacing, grouping, prompts and resource support to learner needs without changing the Scheme objective or certified content authority.',
  }

  const validation = validateLessonPlanGrounding({
    sections,
    schemeObjectives: identity.schemeObjectives,
  })

  if (!validation.ok) {
    return {
      ok: false,
      status: 'error',
      message: validation.message,
    }
  }

  return {
    ok: true,
    status: 'hit',
    sections,
    resourceId: primary.resourceId,
    resourceVersionId: primary.resourceVersionId,
    certificationRequired: false,
    creditsUsed: 0,
  }
}
