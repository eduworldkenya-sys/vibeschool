import type {
  LessonPlanSections,
} from '@/lib/teaching/lessonPlanCodec'
import {
  validateLessonPlanGrounding,
} from '@/lib/teaching/lessonPlanGrounding'

export interface GenerateLessonPlanInput {
  accessToken: string
  teacherName: string
  schoolName: string
  subject: string
  className: string
  studentCount: number
  duration: string
  topic: string
  focus?: string
  previousTopics: string[]
  curriculumStrand?: string
  curriculumSubStrand?: string
  curriculumObjectives?: string | null
  keyInquiryQuestion?: string | null
  learningResources?: string | null
  learningExperiences?: string | null
  assessmentMethods?: string | null
  reference?: string | null
}

export type GenerateLessonPlanResult =
  | {
      ok: true
      sections: LessonPlanSections
    }
  | {
      ok: false
      message: string
    }

function clean(value?: string | null): string {
  return value?.trim() ?? ''
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

function sourceLabel(
  curriculumStrand?: string,
  curriculumSubStrand?: string,
): string {
  return joinNonEmpty(
    [curriculumStrand, curriculumSubStrand],
    ' → ',
  )
}

/**
 * Builds the reliable baseline lesson plan without calling any model provider.
 * Scheme/curriculum fields are copied or reorganised, never replaced.
 */
export async function generateLessonPlan({
  className,
  studentCount,
  duration,
  topic,
  focus,
  previousTopics,
  curriculumStrand,
  curriculumSubStrand,
  curriculumObjectives,
  keyInquiryQuestion,
  learningResources,
  learningExperiences,
  assessmentMethods,
  reference,
}: GenerateLessonPlanInput): Promise<GenerateLessonPlanResult> {
  const resolvedTopic = clean(topic)

  if (!resolvedTopic) {
    return {
      ok: false,
      message: 'A lesson topic is required.',
    }
  }

  const objectives = clean(curriculumObjectives)
  const inquiry = clean(keyInquiryQuestion)
  const resources = clean(learningResources)
  const experiences = clean(learningExperiences)
  const assessment = clean(assessmentMethods)
  const curriculumPath = sourceLabel(
    curriculumStrand,
    curriculumSubStrand,
  )
  const teacherFocus = clean(focus)
  const previousTopicsClean = previousTopics
    .map(clean)
    .filter(Boolean)
  const previousTopic =
    previousTopicsClean[previousTopicsClean.length - 1] ?? ''

  const assessmentObjectiveText = objectives
    ? `Objectives being assessed:\n${objectives}`
    : 'No authoritative Scheme objective is attached yet.'

  const sections: LessonPlanSections = {
    objectives:
      objectives ||
      'No authoritative learning objective is attached to this lesson yet. Add or link the Scheme of Work objective before teaching.',

    resources:
      joinNonEmpty([
        resources || 'Use the learning resources attached to the Scheme/content source.',
        reference ? `Reference: ${clean(reference)}` : null,
      ]),

    introduction:
      joinNonEmpty([
        `Lesson focus: ${resolvedTopic}.`,
        previousTopic
          ? `Connect briefly to the previous lesson: ${previousTopic}.`
          : null,
        inquiry
          ? `Key inquiry question: ${inquiry}`
          : null,
        `Class: ${className}${studentCount > 0 ? ` (${studentCount} learners)` : ''}. Planned duration: ${duration}.`,
      ]),

    development:
      joinNonEmpty([
        curriculumPath
          ? `Curriculum path: ${curriculumPath}.`
          : null,
        experiences
          ? `Scheme learning experiences:\n${experiences}`
          : 'Follow the approved Scheme learning sequence for this lesson. No additional curriculum content has been invented.',
        teacherFocus
          ? `Teacher focus for delivery: ${teacherFocus}`
          : null,
      ], '\n\n'),

    consolidation:
      joinNonEmpty([
        `Return to the lesson focus: ${resolvedTopic}.`,
        inquiry
          ? `Use the key inquiry question to consolidate learning: ${inquiry}`
          : 'Review the stated Scheme objective with learners before closing the lesson.',
      ]),

    assessmentHook:
      joinNonEmpty([
        assessmentObjectiveText,
        assessment
          ? `Scheme assessment method(s):\n${assessment}`
          : 'Use teacher observation, oral checks or another teacher-selected method without changing the stated objective.',
      ], '\n\n'),

    homework:
      'No homework has been invented automatically. Add homework only when it is supported by the lesson objective, approved content, or teacher instruction.',

    differentiation:
      joinNonEmpty([
        `Deliver the same authoritative objective to all learners in ${className}.`,
        teacherFocus
          ? `Teacher-requested adaptation: ${teacherFocus}`
          : 'Adjust pacing, grouping, prompts and resource support to learner needs without changing the Scheme objective.',
      ]),
  }

  const validation = validateLessonPlanGrounding({
    sections,
    schemeObjectives: curriculumObjectives,
  })

  if (!validation.ok) {
    return validation
  }

  return {
    ok: true,
    sections,
  }
}
