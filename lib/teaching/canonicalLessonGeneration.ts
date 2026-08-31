import type { Json } from '@/lib/database.types'
import type { LessonPlanSections } from '@/lib/teaching/lessonPlanCodec'
import type { CertifiedLessonContentAsset } from '@/lib/teaching/lessonSourceBundle'
import { validateLessonPlanGrounding } from '@/lib/teaching/lessonPlanGrounding'
import {
  loadExactLessonPackage,
  storeSchemeLessonPackage,
} from '@/lib/teaching/lessonPackageCache'
import type {
  LessonPackageSourceIdentity,
} from '@/lib/teaching/lessonPackageCache'
import {
  allocateLessonPhaseTiming,
  durationMinutesFromLabel,
} from '@/lib/teaching/lessonTiming'

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
      creditsUsed: 0
      packageCache?: 'scheme' | 'global' | 'miss'
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
  'body', 'content', 'explanation', 'explanations', 'summary',
  'examples', 'kenyanExamples', 'kenyan_examples', 'activities',
  'misconceptions', 'workedExamples', 'worked_examples', 'questions',
  'answers', 'keyPoints', 'key_points', 'teacherNotes', 'teacher_notes',
  'sections', 'learnerActivities', 'learner_activities', 'expectedAnswers',
  'expected_answers',
])

const CATEGORY_KEYS = {
  teachingPoints: new Set([
    'body', 'content', 'explanation', 'explanations', 'summary',
    'keyPoints', 'key_points', 'teacherNotes', 'teacher_notes', 'sections',
    'workedExamples', 'worked_examples', 'examples', 'kenyanExamples',
    'kenyan_examples',
  ]),
  learnerActivities: new Set(['activities', 'learnerActivities', 'learner_activities']),
  expectedAnswers: new Set(['answers', 'expectedAnswers', 'expected_answers']),
  misconceptions: new Set(['misconceptions']),
  questions: new Set(['questions']),
} as const

function clean(value?: string | null): string {
  return value?.trim() ?? ''
}

function collectStrings(
  value: Json,
  allowedKeys: ReadonlySet<string> = CONTENT_KEYS,
  key: string | null = null,
): string[] {
  if (typeof value === 'string') {
    return key === null || allowedKeys.has(key)
      ? [value.trim()].filter(Boolean)
      : []
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap(item => collectStrings(item, allowedKeys, key))
  }

  return Object.entries(value).flatMap(([childKey, childValue]) => {
    if (childValue === undefined || !allowedKeys.has(childKey)) return []
    return collectStrings(childValue, allowedKeys, childKey)
  })
}

function contentForCategory(
  assets: CertifiedLessonContentAsset[],
  allowedKeys: ReadonlySet<string>,
): string {
  return assets
    .flatMap(asset => {
      const fragments = collectStrings(asset.payload, allowedKeys)
      if (fragments.length === 0) return []
      return [`${asset.title}\n${fragments.join('\n\n')}`]
    })
    .join('\n\n')
    .slice(0, 20000)
}

function joinNonEmpty(
  values: Array<string | null | undefined>,
  separator = '\n',
): string {
  return values.map(clean).filter(Boolean).join(separator)
}

function canonicalHomework({
  topic,
  objectives,
  inquiry,
  questions,
}: {
  topic: string
  objectives: string
  inquiry: string
  questions: string
}): string {
  if (questions) {
    return `Use the approved certified-content question(s) below as follow-up work:\n${questions}`
  }
  if (inquiry) {
    return [
      `Answer the key inquiry question in your own words: ${inquiry}`,
      `Give one relevant example connected to ${topic}.`,
      objectives ? `Check your work against the lesson objective(s):\n${objectives}` : null,
    ].filter(Boolean).join('\n')
  }
  return objectives
    ? `Review ${topic} and write a short response showing how you achieved the objective(s):\n${objectives}`
    : `Review ${topic} and write three accurate points from the lesson.`
}

function cacheIdentity(
  identity: CanonicalLessonIdentity,
  assets: CertifiedLessonContentAsset[],
  durationMinutes: number,
): LessonPackageSourceIdentity {
  return {
    curriculumId: identity.curriculumId,
    subjectId: identity.subjectId,
    grade: identity.grade,
    subStrandId: identity.subStrandId,
    topicTitle: identity.topicTitle,
    schemeId: identity.schemeId ?? null,
    durationMinutes,
    sourceResourceIds: assets.map(asset => asset.resourceId),
    sourceResourceVersionIds: assets.map(asset => asset.resourceVersionId),
    sourceHashes: assets.map(asset => asset.contentSha256),
    schemeObjectives: identity.schemeObjectives,
    keyInquiryQuestion: identity.keyInquiryQuestion,
  }
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

  const timing = allocateLessonPhaseTiming(
    durationMinutesFromLabel(identity.duration ?? '40 minutes'),
  )
  const packageIdentity = cacheIdentity(
    identity,
    assets,
    timing.totalMinutes,
  )

  try {
    const cached = await loadExactLessonPackage(packageIdentity)
    if (cached) {
      const validation = validateLessonPlanGrounding({
        sections: cached.sections,
        schemeObjectives: identity.schemeObjectives,
      })

      if (validation.ok) {
        return {
          ok: true,
          status: 'hit',
          sections: cached.sections,
          resourceId: primary.resourceId,
          resourceVersionId: primary.resourceVersionId,
          certificationRequired: false,
          creditsUsed: 0,
          packageCache: cached.reuseScope,
        }
      }
    }
  } catch (cacheReadError) {
    // Cache is an optimization, never a lesson-generation dependency.
    console.warn('[canonicalLessonGeneration] package cache read failed', cacheReadError)
  }

  const objectives = clean(identity.schemeObjectives)
  const inquiry = clean(identity.keyInquiryQuestion)
  const experiences = clean(identity.learningExperiences)
  const assessment = clean(identity.assessmentMethods)
  const teachingPoints = contentForCategory(assets, CATEGORY_KEYS.teachingPoints)
  const learnerActivities = contentForCategory(assets, CATEGORY_KEYS.learnerActivities)
  const expectedAnswers = contentForCategory(assets, CATEGORY_KEYS.expectedAnswers)
  const misconceptions = contentForCategory(assets, CATEGORY_KEYS.misconceptions)
  const questions = contentForCategory(assets, CATEGORY_KEYS.questions)
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
      `Timing: ${timing.introduction} minutes.`,
      `Lesson focus: ${identity.topicTitle}.`,
      inquiry ? `Key inquiry question: ${inquiry}` : null,
      `Total lesson duration: ${timing.totalMinutes} minutes.`,
    ]),

    development: joinNonEmpty([
      `Timing: ${timing.development} minutes.`,
      curriculumPath ? `CURRICULUM PATH\n${curriculumPath}` : null,
      `TEACHING POINTS / CANONICAL TEACHER NOTES\n${
        teachingPoints ||
        'Use the exact certified resources attached to this lesson and teach directly toward the Scheme objective.'
      }`,
      `LEARNER ACTIVITIES\n${
        learnerActivities ||
        experiences ||
        'Follow the authoritative Scheme learning experiences using the attached certified content.'
      }`,
      `EXPECTED ANSWERS / EVIDENCE\n${
        expectedAnswers ||
        (inquiry
          ? `Learner responses should accurately address: ${inquiry}`
          : 'Check learner responses against the exact certified source and stated Scheme objective.')
      }`,
      `MISCONCEPTIONS TO WATCH\n${
        misconceptions ||
        'Watch for answers that conflict with the certified source, worked examples or Scheme objective; correct them using the same approved authority.'
      }`,
    ], '\n\n'),

    consolidation: joinNonEmpty([
      `Timing: ${timing.consolidation} minutes.`,
      `Return to the lesson focus: ${identity.topicTitle}.`,
      inquiry
        ? `Revisit the key inquiry question: ${inquiry}`
        : 'Review the stated Scheme objective with learners.',
    ]),

    assessmentHook: joinNonEmpty([
      `Timing: ${timing.assessment} minutes.`,
      objectives
        ? `Objectives being assessed:\n${objectives}`
        : 'No authoritative Scheme objective is attached yet.',
      assessment
        ? `Scheme assessment method(s):\n${assessment}`
        : 'Use teacher observation, oral checks or another teacher-selected method without changing the stated objective.',
      expectedAnswers ? `Expected answer/evidence reference:\n${expectedAnswers}` : null,
    ], '\n\n'),

    homework: canonicalHomework({
      topic: identity.topicTitle,
      objectives,
      inquiry,
      questions,
    }),

    differentiation: joinNonEmpty([
      'Support: reduce task size, add prompts, pair strategically or reopen the attached certified resource.',
      'On track: complete the core Scheme/certified-content activity and explain the answer/evidence.',
      'Extension: justify, compare or apply the same objective in another relevant context without introducing a new curriculum objective.',
    ]),
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

  try {
    await storeSchemeLessonPackage({
      identity: packageIdentity,
      sections,
      generationMode: 'deterministic',
    })
  } catch (cacheWriteError) {
    // Never block a teacher because cache persistence failed.
    console.warn('[canonicalLessonGeneration] package cache write failed', cacheWriteError)
  }

  return {
    ok: true,
    status: 'hit',
    sections,
    resourceId: primary.resourceId,
    resourceVersionId: primary.resourceVersionId,
    certificationRequired: false,
    creditsUsed: 0,
    packageCache: 'miss',
  }
}
