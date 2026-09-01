import type { Json } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { LessonPlanSections } from '@/lib/teaching/lessonPlanCodec'
import type { CertifiedLessonContentAsset } from '@/lib/teaching/lessonSourceBundle'
import { validateLessonPlanGrounding } from '@/lib/teaching/lessonPlanGrounding'
import {
  allocateLessonTiming,
  lessonTimingRanges,
  parseLessonDurationMinutes,
} from '@/lib/teaching/lessonTiming'
import {
  loadExactLessonPackage,
  storeSchemeLessonPackage,
} from '@/lib/teaching/lessonPackageCache'
import type { LessonPackageSourceIdentity } from '@/lib/teaching/lessonPackageCache'

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
      generationMode?: 'deterministic' | 'ai_assisted'
    }
  | {
      ok: false
      status: 'pending' | 'error'
      message: string
      resourceId?: string
      resourceVersionId?: string | null
      reviewStatus?: string | null
    }

const FIELD_KEYS = {
  teachingPoints: new Set(['body','content','explanation','explanations','summary','keyPoints','key_points','teacherNotes','teacher_notes','workedExamples','worked_examples','kenyanExamples','kenyan_examples','examples']),
  activities: new Set(['activities','learningActivities','learning_activities','learnerActivities','learner_activities']),
  questions: new Set(['questions','assessmentQuestions','assessment_questions','diagnostics','diagnosticQuestions','diagnostic_questions']),
  answers: new Set(['answers','expectedAnswers','expected_answers','markingGuide','marking_guide']),
  misconceptions: new Set(['misconceptions','commonMisconceptions','common_misconceptions']),
  differentiation: new Set(['differentiation','support','extension','challenge']),
  homework: new Set(['homework','homeworkTasks','homework_tasks','followUp','follow_up']),
}

interface GroundedPedagogy {
  teachingPoints: string[]
  examples: string[]
  vocabulary: Array<{ term: string; meaning: string }>
  learnerActivities: string[]
  questions: Array<{ question: string; expectedAnswer: string }>
  misconceptions: Array<{ misconception: string; correction: string }>
  differentiation: { support: string[]; stretch: string[] }
  assessment: Array<{ question: string; expectedAnswer: string }>
  homework: Array<{ question: string; expectedAnswer: string }>
}

function clean(value?: string | null): string {
  return value?.trim() ?? ''
}

function splitAuthorityList(value?: string | null): string[] {
  const normalized = clean(value)
  if (!normalized) return []
  return normalized.split(/\s*[|;]\s*|\n+/).map(clean).filter(Boolean)
}

function collectStrings(value: Json, keys: Set<string>, parentKey: string | null = null): string[] {
  if (typeof value === 'string') {
    return parentKey !== null && keys.has(parentKey) ? [value.trim()].filter(Boolean) : []
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return []
  if (Array.isArray(value)) return value.flatMap(item => collectStrings(item, keys, parentKey))

  return Object.entries(value).flatMap(([key, child]) => {
    if (child === undefined) return []
    if (keys.has(key)) return collectStrings(child, keys, key)
    return typeof child === 'object' && child !== null
      ? collectStrings(child, keys, parentKey)
      : []
  })
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter(value => {
    const normalized = clean(value).toLocaleLowerCase()
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function collectAssetField(assets: CertifiedLessonContentAsset[], keys: Set<string>): string[] {
  return unique(assets.flatMap(asset => collectStrings(asset.payload, keys)))
}

function numbered(values: string[], fallback: string): string {
  return values.length > 0
    ? values.map((value, index) => `${index + 1}. ${value}`).join('\n')
    : fallback
}

function bullets(values: string[], fallback: string): string {
  return values.length > 0 ? values.map(value => `• ${value}`).join('\n') : fallback
}

function joinNonEmpty(values: Array<string | null | undefined>, separator = '\n'): string {
  return values.map(clean).filter(Boolean).join(separator)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringArray(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return []
  return unique(value.flatMap(item => typeof item === 'string' && item.trim() ? [item.trim()] : [])).slice(0, limit)
}

function qaArray(value: unknown, limit = 12): Array<{ question: string; expectedAnswer: string }> {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    const record = asRecord(item)
    const question = typeof record?.question === 'string' ? record.question.trim() : ''
    const expectedAnswer = typeof record?.expectedAnswer === 'string' ? record.expectedAnswer.trim() : ''
    return question && expectedAnswer ? [{ question, expectedAnswer }] : []
  }).slice(0, limit)
}

function misconceptionArray(value: unknown): Array<{ misconception: string; correction: string }> {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    const record = asRecord(item)
    const misconception = typeof record?.misconception === 'string' ? record.misconception.trim() : ''
    const correction = typeof record?.correction === 'string' ? record.correction.trim() : ''
    return misconception && correction ? [{ misconception, correction }] : []
  }).slice(0, 10)
}

function vocabularyArray(value: unknown): Array<{ term: string; meaning: string }> {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    const record = asRecord(item)
    const term = typeof record?.term === 'string' ? record.term.trim() : ''
    const meaning = typeof record?.meaning === 'string' ? record.meaning.trim() : ''
    return term && meaning ? [{ term, meaning }] : []
  }).slice(0, 12)
}

function parsePedagogy(value: unknown): GroundedPedagogy | null {
  const record = asRecord(value)
  if (!record) return null
  const differentiation = asRecord(record.differentiation)
  const pedagogy: GroundedPedagogy = {
    teachingPoints: stringArray(record.teachingPoints, 10),
    examples: stringArray(record.examples, 10),
    vocabulary: vocabularyArray(record.vocabulary),
    learnerActivities: stringArray(record.learnerActivities, 10),
    questions: qaArray(record.questions),
    misconceptions: misconceptionArray(record.misconceptions),
    differentiation: {
      support: stringArray(differentiation?.support, 8),
      stretch: stringArray(differentiation?.stretch, 8),
    },
    assessment: qaArray(record.assessment),
    homework: qaArray(record.homework),
  }
  return pedagogy.teachingPoints.length >= 2 && pedagogy.questions.length >= 1
    ? pedagogy
    : null
}

function needsPedagogicalReasoning(input: {
  teachingPoints: string[]
  questions: string[]
  answers: string[]
  misconceptions: string[]
  differentiation: string[]
  homeworkTasks: string[]
}): boolean {
  return input.teachingPoints.length < 3 ||
    input.questions.length < 2 ||
    input.answers.length < input.questions.length ||
    input.misconceptions.length === 0 ||
    input.differentiation.length === 0 ||
    input.homeworkTasks.length === 0
}

async function requestGroundedPedagogy(
  accessToken: string,
  identity: CanonicalLessonIdentity,
  assets: CertifiedLessonContentAsset[],
): Promise<GroundedPedagogy | null> {
  if (!identity.schemeId || assets.length === 0) return null

  const { data, error } = await supabase.functions.invoke('generate-canonical-lesson-plan', {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      intent: 'grounded_prepare',
      schemeId: identity.schemeId,
      subjectName: identity.subjectName,
      grade: identity.grade,
      topicTitle: identity.topicTitle,
      sourceAssets: assets.map(asset => ({
        resourceId: asset.resourceId,
        resourceVersionId: asset.resourceVersionId,
        contentSha256: asset.contentSha256,
      })),
    },
  })

  if (error) throw error
  const payload = asRecord(data)
  if (payload?.status !== 'grounded_prepared') return null
  return parsePedagogy(payload.pedagogy)
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
    learningResources: identity.learningResources,
    learningExperiences: identity.learningExperiences,
    assessmentMethods: identity.assessmentMethods,
    reference: identity.reference,
  }
}

/**
 * Builds the reusable canonical teacher lesson from Scheme authority and exact
 * certified VibeSchool content. Cache hits are provider-free. On a cache miss,
 * weakly structured certified content may use the governed AI endpoint only to
 * derive pedagogy; curriculum identity, objectives, sources and timing remain
 * deterministic. AI failure degrades safely to the deterministic package.
 */
export async function generateCanonicalLessonPlan(
  accessToken: string,
  identity: CanonicalLessonIdentity,
): Promise<CanonicalLessonGenerationResult> {
  const assets = identity.certifiedContent ?? []
  const primary = assets[0]
  if (!primary) {
    return {
      ok: false,
      status: 'error',
      message: 'No certified VibeSchool content is available for this lesson. Use the Scheme-derived baseline.',
    }
  }

  const objectives = splitAuthorityList(identity.schemeObjectives)
  const experiences = splitAuthorityList(identity.learningExperiences)
  const assessmentMethods = splitAuthorityList(identity.assessmentMethods)
  const inquiry = clean(identity.keyInquiryQuestion)
  const curriculumPath = joinNonEmpty([identity.curriculumStrand, identity.curriculumSubStrand], ' → ')

  let teachingPoints = collectAssetField(assets, FIELD_KEYS.teachingPoints)
  let activities = collectAssetField(assets, FIELD_KEYS.activities)
  let questions = collectAssetField(assets, FIELD_KEYS.questions)
  let answers = collectAssetField(assets, FIELD_KEYS.answers)
  let misconceptions = collectAssetField(assets, FIELD_KEYS.misconceptions)
  let differentiation = collectAssetField(assets, FIELD_KEYS.differentiation)
  let homeworkTasks = collectAssetField(assets, FIELD_KEYS.homework)

  const timing = allocateLessonTiming(parseLessonDurationMinutes(identity.duration))
  const ranges = lessonTimingRanges(timing)
  const packageIdentity = cacheIdentity(identity, assets, timing.total)

  try {
    const cached = await loadExactLessonPackage(packageIdentity)
    if (cached) {
      const cachedValidation = validateLessonPlanGrounding({
        sections: cached.sections,
        schemeObjectives: identity.schemeObjectives,
      })
      if (cachedValidation.ok) {
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
    console.warn('[canonicalLessonGeneration] package cache read failed', cacheReadError)
  }

  let generationMode: 'deterministic' | 'ai_assisted' = 'deterministic'
  if (needsPedagogicalReasoning({
    teachingPoints,
    questions,
    answers,
    misconceptions,
    differentiation,
    homeworkTasks,
  })) {
    try {
      const pedagogy = await requestGroundedPedagogy(accessToken, identity, assets)
      if (pedagogy) {
        generationMode = 'ai_assisted'
        teachingPoints = pedagogy.teachingPoints
        activities = pedagogy.learnerActivities.length > 0 ? pedagogy.learnerActivities : activities
        questions = pedagogy.questions.map(item => item.question)
        answers = pedagogy.questions.map(item => item.expectedAnswer)
        misconceptions = pedagogy.misconceptions.map(item => `${item.misconception} → ${item.correction}`)
        differentiation = [
          ...pedagogy.differentiation.support.map(item => `Support: ${item}`),
          ...pedagogy.differentiation.stretch.map(item => `Stretch: ${item}`),
        ]
        homeworkTasks = pedagogy.homework.map(item => `${item.question}\n   Expected answer: ${item.expectedAnswer}`)

        const enrichment = [
          pedagogy.examples.length > 0 ? `Examples:\n${bullets(pedagogy.examples, '')}` : '',
          pedagogy.vocabulary.length > 0
            ? `Vocabulary:\n${bullets(pedagogy.vocabulary.map(item => `${item.term}: ${item.meaning}`), '')}`
            : '',
        ].filter(Boolean)
        if (enrichment.length > 0) teachingPoints = [...teachingPoints, ...enrichment]
      }
    } catch (aiError) {
      console.warn('[canonicalLessonGeneration] grounded AI enrichment unavailable; using deterministic package', aiError)
    }
  }

  const questionAnswerBlock = questions.length > 0
    ? questions.map((question, index) => `${index + 1}. ${question}${answers[index] ? `\n   Expected answer: ${answers[index]}` : ''}`).join('\n')
    : '1. Use the Scheme assessment method(s) below to check the stated objectives.'

  const sections: LessonPlanSections = {
    objectives: numbered(objectives, 'No authoritative Scheme objective is attached to this lesson yet.'),

    resources: joinNonEmpty([
      'VibeSchool approved learning resources:',
      numbered(assets.map(asset => asset.title), '1. No certified VibeSchool resource title is available.'),
      identity.learningResources
        ? `\nScheme resources:\n${bullets(splitAuthorityList(identity.learningResources), '• Use the linked Scheme resources.')}`
        : null,
      identity.reference ? `\nCurriculum reference:\n• ${identity.reference}` : null,
    ]),

    introduction: joinNonEmpty([
      `Timing: ${ranges.introduction} (${timing.introduction} min).`,
      `1. Introduce the lesson focus: ${identity.topicTitle}.`,
      inquiry ? `2. Ask the key inquiry question: ${inquiry}` : null,
      '3. Establish prior knowledge before moving into the main learning activity.',
    ]),

    development: joinNonEmpty([
      `Timing: ${ranges.development} (${timing.development} min).`,
      curriculumPath ? `Curriculum path: ${curriculumPath}.` : null,
      `\nTeaching points / teacher notes:\n${numbered(teachingPoints, '1. Use the approved VibeSchool resource above as the teaching authority for this lesson.')}`,
      `\nLearner activities:\n${numbered(activities.length > 0 ? activities : experiences, '1. Follow the approved Scheme learning experience for this lesson.')}`,
      `\nCheck-for-understanding questions and expected answers:\n${questionAnswerBlock}`,
      `\nMisconceptions to watch:\n${bullets(misconceptions, '• Check understanding against the stated objectives and correct unsupported learner claims.')}`,
    ], '\n\n'),

    consolidation: joinNonEmpty([
      `Timing: ${ranges.consolidation} (${timing.consolidation} min).`,
      `1. Return to the lesson focus: ${identity.topicTitle}.`,
      inquiry ? `2. Revisit the key inquiry question: ${inquiry}` : '2. Ask learners to explain the lesson objective in their own words.',
      '3. Ask learners to state one key idea learned and one point that still needs clarification.',
    ]),

    assessmentHook: joinNonEmpty([
      `Timing: ${ranges.assessment} (${timing.assessment} min). Total lesson time: ${timing.total}/${timing.total} min.`,
      `\nObjectives being assessed:\n${numbered(objectives, '1. No authoritative Scheme objective is attached yet.')}`,
      `\nPrepared checks:\n${questionAnswerBlock}`,
      assessmentMethods.length > 0 ? `\nScheme assessment method(s):\n${bullets(assessmentMethods, '')}` : null,
      '\nRecord each learner as Mastered, Developing or Needs support before closing the lesson.',
    ]),

    homework: homeworkTasks.length > 0
      ? joinNonEmpty([
          'Preloaded objective-aligned follow-up:',
          numbered(homeworkTasks, ''),
          'Teacher actions: View · Edit · Assign · Share.',
        ])
      : 'No certified homework task is attached to this lesson. The teacher may add a task or use optional AI enhancement.',

    differentiation: differentiation.length > 0
      ? joinNonEmpty(['Use the same authoritative objectives for every learner.', numbered(differentiation, '')])
      : joinNonEmpty([
          '1. Support: use additional prompts, paired work, visuals or partially completed examples.',
          '2. Core: complete the approved learner activity independently or collaboratively as designed.',
          '3. Stretch: require evidence, comparison, justification or application while keeping the same Scheme objective.',
        ]),
  }

  const validation = validateLessonPlanGrounding({ sections, schemeObjectives: identity.schemeObjectives })
  if (!validation.ok) return { ok: false, status: 'error', message: validation.message }

  try {
    await storeSchemeLessonPackage({ identity: packageIdentity, sections, generationMode })
  } catch (cacheWriteError) {
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
    generationMode,
  }
}
