import type { Json } from '@/lib/database.types'
import type { LessonPlanSections } from '@/lib/teaching/lessonPlanCodec'
import type {
  CertifiedLessonContentAsset,
  PublishedLessonContentAsset,
} from '@/lib/teaching/lessonSourceBundle'
import { validateLessonPlanGrounding } from '@/lib/teaching/lessonPlanGrounding'
import { planLessonTiming } from '@/lib/teaching/lessonTiming'

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
  lessonNumber?: number | null
  schemeObjectives?: string | null
  keyInquiryQuestion?: string | null
  learningResources?: string | null
  learningExperiences?: string | null
  assessmentMethods?: string | null
  reference?: string | null
  certifiedContent?: CertifiedLessonContentAsset[]
  publishedContent?: PublishedLessonContentAsset[]
}

export type CanonicalLessonGenerationResult =
  | {
      ok: true
      status: 'hit' | 'candidate'
      sections: LessonPlanSections
      resourceId: string
      resourceVersionId: string
      sourceAssurance: 'certified' | 'published_unverified'
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

interface ChapterBlock {
  id: string | null
  type: string
  content: string
  lessonNumber: number | null
  learningLayer: string | null
  kind: string | null
  assessment: boolean
  teacherDerivative: boolean
}

const CONTENT_KEYS = new Set([
  'body', 'content', 'explanation', 'explanations', 'summary', 'examples',
  'kenyanExamples', 'kenyan_examples', 'activities', 'misconceptions',
  'workedExamples', 'worked_examples', 'questions', 'answers', 'keyPoints',
  'key_points', 'teacherNotes', 'teacher_notes', 'sections',
])

function clean(value?: string | null): string {
  return value?.trim() ?? ''
}

function joinNonEmpty(
  values: Array<string | null | undefined>,
  separator = '\n',
): string {
  return values.map(clean).filter(Boolean).join(separator)
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
  return Object.entries(value).flatMap(([childKey, childValue]) => {
    if (childValue === undefined || !CONTENT_KEYS.has(childKey)) return []
    return collectStrings(childValue, childKey)
  })
}

function asRecord(value: Json): Record<string, Json | undefined> | null {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    return null
  }
  return value as Record<string, Json | undefined>
}

function toChapterBlock(value: Json): ChapterBlock | null {
  const row = asRecord(value)
  if (!row || typeof row.content !== 'string') return null
  const meta = row.meta ? asRecord(row.meta) : null
  const rawLessonNumber = meta?.lesson_number

  return {
    id: typeof row.id === 'string' ? row.id : null,
    type: typeof row.type === 'string' ? row.type : 'paragraph',
    content: row.content.trim(),
    lessonNumber:
      typeof rawLessonNumber === 'number'
        ? rawLessonNumber
        : typeof rawLessonNumber === 'string' && /^\d+$/.test(rawLessonNumber)
          ? Number(rawLessonNumber)
          : null,
    learningLayer:
      typeof meta?.learning_layer === 'string' ? meta.learning_layer : null,
    kind: typeof meta?.kind === 'string' ? meta.kind : null,
    assessment: meta?.assessment === true,
    teacherDerivative: meta?.teacher_derivative === true,
  }
}

function chapterBlocks(asset: PublishedLessonContentAsset): ChapterBlock[] {
  if (!Array.isArray(asset.payload)) return []
  return asset.payload.flatMap(value => {
    const block = toChapterBlock(value)
    return block ? [block] : []
  })
}

function exactLessonBlocks(
  assets: PublishedLessonContentAsset[],
  lessonNumber?: number | null,
): ChapterBlock[] {
  const all = assets.flatMap(chapterBlocks)
  if (!lessonNumber) return all.filter(block => block.lessonNumber === null)
  return all.filter(block => block.lessonNumber === lessonNumber)
}

function safeSharedBlocks(assets: PublishedLessonContentAsset[]): ChapterBlock[] {
  return assets
    .flatMap(chapterBlocks)
    .filter(block =>
      block.lessonNumber === null &&
      (
        block.learningLayer === 'orient' ||
        block.kind === 'misconception' ||
        block.kind === 'differentiation' ||
        block.teacherDerivative
      ),
    )
}

function blockText(blocks: ChapterBlock[], types?: string[]): string {
  return blocks
    .filter(block => !types || types.includes(block.type))
    .map(block => block.content)
    .filter(Boolean)
    .join('\n\n')
}

function extractQuestions(blocks: ChapterBlock[]): string[] {
  const questions: string[] = []
  for (const block of blocks) {
    const matches = block.content.match(/[^.!?\n]*\?/g) ?? []
    for (const match of matches) {
      const question = clean(match)
      if (question && !questions.includes(question)) questions.push(question)
    }
  }
  return questions.slice(0, 4)
}

function certifiedContentText(assets: CertifiedLessonContentAsset[]): string {
  return assets
    .flatMap(asset => {
      const fragments = collectStrings(asset.payload)
      if (fragments.length === 0) return []
      return [`Certified content: ${asset.title}\n${fragments.join('\n\n')}`]
    })
    .join('\n\n')
    .slice(0, 20000)
}

/**
 * Deterministically transforms exact Scheme authority plus reusable VibeSchool
 * content into a live-teaching lesson plan. No Edge Function, web search or
 * model provider is called. Published-but-unverified content remains explicitly
 * unverified; this function never promotes its assurance state.
 */
export async function generateCanonicalLessonPlan(
  accessToken: string,
  identity: CanonicalLessonIdentity,
): Promise<CanonicalLessonGenerationResult> {
  void accessToken

  const certified = identity.certifiedContent ?? []
  const published = identity.publishedContent ?? []
  const primaryCertified = certified[0]
  const primaryPublished = published[0]

  if (!primaryCertified && !primaryPublished) {
    return {
      ok: false,
      status: 'error',
      message:
        'No reusable VibeSchool content is available for this lesson. Use the Scheme-derived baseline.',
    }
  }

  const objectives = clean(identity.schemeObjectives)
  const inquiry = clean(identity.keyInquiryQuestion)
  const experiences = clean(identity.learningExperiences)
  const assessment = clean(identity.assessmentMethods)
  const curriculumPath = joinNonEmpty(
    [identity.curriculumStrand, identity.curriculumSubStrand],
    ' → ',
  )
  const timing = planLessonTiming(identity.duration)

  const exactBlocks = exactLessonBlocks(published, identity.lessonNumber)
  const sharedBlocks = safeSharedBlocks(published)
  const exactTeachingText = blockText(
    exactBlocks,
    ['paragraph', 'callout', 'activity'],
  )
  const misconceptions = blockText(
    sharedBlocks.filter(block => block.kind === 'misconception'),
  )
  const differentiation = blockText(
    sharedBlocks.filter(block => block.kind === 'differentiation'),
  )
  const teacherBridge = blockText(
    sharedBlocks.filter(block => block.teacherDerivative),
  )
  const orientingText = blockText(
    sharedBlocks.filter(block => block.learningLayer === 'orient'),
  )
  const teacherQuestions = extractQuestions([
    ...exactBlocks,
    ...sharedBlocks.filter(block => block.learningLayer === 'orient'),
  ])
  const certifiedText = certifiedContentText(certified)
  const sourceTitles = [
    ...certified.map(asset => asset.title),
    ...published.map(asset => asset.title),
  ].filter((title, index, all) => all.indexOf(title) === index)

  const authoritativeTeachingText = exactTeachingText || certifiedText || experiences

  const sections: LessonPlanSections = {
    objectives:
      objectives ||
      'No authoritative Scheme objective is attached to this lesson yet.',

    resources: joinNonEmpty([
      identity.learningResources,
      sourceTitles.length > 0 ? `VibeSchool source: ${sourceTitles.join('; ')}` : null,
      identity.reference ? `Reference: ${identity.reference}` : null,
    ]),

    introduction: joinNonEmpty([
      `0–${timing.introductionMinutes} min · Introduce`,
      `Lesson focus: ${identity.topicTitle}.`,
      inquiry ? `Key inquiry question: ${inquiry}` : null,
      orientingText ? `Teaching context:\n${orientingText}` : null,
      teacherQuestions[0] ? `Ask: ${teacherQuestions[0]}` : null,
    ], '\n\n'),

    development: joinNonEmpty([
      `${timing.introductionMinutes}–${timing.introductionMinutes + timing.teachingMinutes} min · Teach`,
      curriculumPath ? `Curriculum path: ${curriculumPath}.` : null,
      authoritativeTeachingText
        ? `Teaching points and learner task:\n${authoritativeTeachingText}`
        : 'Follow the exact approved Scheme learning experience for this lesson.',
      teacherQuestions.length > 1
        ? `Teacher prompts:\n${teacherQuestions.slice(1).map(q => `• ${q}`).join('\n')}`
        : null,
      misconceptions ? `Watch for misconception:\n${misconceptions}` : null,
      experiences && experiences !== authoritativeTeachingText
        ? `Scheme learning experience:\n${experiences}`
        : null,
    ], '\n\n'),

    consolidation: joinNonEmpty([
      `${timing.totalMinutes - timing.homeworkMinutes - timing.consolidationMinutes}–${timing.totalMinutes - timing.homeworkMinutes} min · Consolidate`,
      `Return to the lesson focus: ${identity.topicTitle}.`,
      inquiry
        ? `Revisit the key inquiry question: ${inquiry}`
        : 'Review the stated Scheme objective with learners.',
      authoritativeTeachingText
        ? 'Expected evidence: learners can demonstrate the action or understanding described in the exact lesson source above.'
        : null,
    ]),

    assessmentHook: joinNonEmpty([
      `${timing.introductionMinutes + timing.teachingMinutes + timing.activityMinutes}–${timing.totalMinutes - timing.consolidationMinutes - timing.homeworkMinutes} min · Check learning`,
      objectives
        ? `Objectives being assessed:\n${objectives}`
        : 'No authoritative Scheme objective is attached yet.',
      assessment
        ? `Scheme assessment method(s):\n${assessment}`
        : 'Use observation or oral checking against the stated objective.',
      teacherBridge ? `Teacher assessment guidance:\n${teacherBridge}` : null,
      teacherQuestions.length > 0
        ? `Ready oral checks:\n${teacherQuestions.map(q => `• ${q}`).join('\n')}`
        : null,
    ], '\n\n'),

    homework: joinNonEmpty([
      `${timing.totalMinutes - timing.homeworkMinutes}–${timing.totalMinutes} min · Homework / close`,
      exactTeachingText
        ? `Recommended follow-up: revisit the exact lesson task from ${primaryPublished?.title ?? primaryCertified?.title ?? 'the approved source'} and complete or explain it independently.`
        : 'No homework is preloaded because the authoritative source does not contain an exact lesson task.',
      'Teacher may assign, edit or skip this recommendation.',
    ], '\n\n'),

    differentiation: joinNonEmpty([
      differentiation ||
        'Adjust pacing, grouping, prompts and resource support without changing the Scheme objective.',
      'Keep the curriculum objective and authoritative content common; only delivery support should vary by learner/class context.',
    ], '\n\n'),
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

  if (primaryCertified) {
    return {
      ok: true,
      status: 'hit',
      sections,
      resourceId: primaryCertified.resourceId,
      resourceVersionId: primaryCertified.resourceVersionId,
      sourceAssurance: 'certified',
      certificationRequired: false,
      creditsUsed: 0,
    }
  }

  return {
    ok: true,
    status: 'candidate',
    sections,
    resourceId: primaryPublished!.resourceId,
    resourceVersionId: primaryPublished!.resourceVersionId,
    sourceAssurance: 'published_unverified',
    certificationRequired: true,
    creditsUsed: 0,
  }
}
