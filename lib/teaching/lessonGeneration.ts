import type {
  LessonPlanSections,
} from '@/lib/teaching/lessonPlanCodec'
import {
  validateLessonPlanGrounding,
} from '@/lib/teaching/lessonPlanGrounding'
import {
  allocateLessonPhaseTiming,
  durationMinutesFromLabel,
} from '@/lib/teaching/lessonTiming'

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
      creditsUsed: 0
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

function deterministicHomework({
  topic,
  objectives,
  inquiry,
}: {
  topic: string
  objectives: string
  inquiry: string
}): string {
  if (inquiry) {
    return [
      `Answer the lesson inquiry question in your own words: ${inquiry}`,
      `Give one example connected to ${topic} from your home, community or Kenya where appropriate.`,
      objectives
        ? `Use the lesson objective(s) as your checklist:\n${objectives}`
        : null,
    ].filter(Boolean).join('\n')
  }

  if (objectives) {
    return [
      `Review today's topic: ${topic}.`,
      `Write a short response showing how you achieved the stated objective(s):\n${objectives}`,
    ].join('\n')
  }

  return `Review ${topic} and write three accurate points from today's lesson.`
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
  const timing = allocateLessonPhaseTiming(
    durationMinutesFromLabel(duration),
  )

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
        `Timing: ${timing.introduction} minutes.`,
        `Lesson focus: ${resolvedTopic}.`,
        previousTopic
          ? `Connect briefly to the previous lesson: ${previousTopic}.`
          : null,
        inquiry
          ? `Key inquiry question: ${inquiry}`
          : null,
        `Class: ${className}${studentCount > 0 ? ` (${studentCount} learners)` : ''}. Total lesson duration: ${timing.totalMinutes} minutes.`,
      ]),

    development:
      joinNonEmpty([
        `Timing: ${timing.development} minutes.`,
        curriculumPath
          ? `CURRICULUM PATH\n${curriculumPath}`
          : null,
        `TEACHING POINTS / TEACHER NOTES\n${
          objectives
            ? `Teach directly toward these authoritative objective(s):\n${objectives}`
            : `Teach only the approved content for ${resolvedTopic}; do not introduce unrelated curriculum.`
        }`,
        experiences
          ? `LEARNER ACTIVITIES\n${experiences}`
          : 'LEARNER ACTIVITIES\nFollow the approved Scheme learning sequence for this lesson. No additional curriculum content has been invented.',
        inquiry
          ? `EXPECTED ANSWERS / EVIDENCE\nLearners should give answers or evidence that directly address: ${inquiry}`
          : objectives
            ? `EXPECTED ANSWERS / EVIDENCE\nAccept responses that correctly demonstrate the stated Scheme objective(s).`
            : 'EXPECTED ANSWERS / EVIDENCE\nCheck responses against the approved source used during the lesson.',
        `MISCONCEPTIONS TO WATCH\nDo not pre-invent subject facts. Watch for responses that contradict the Scheme objective, approved source or worked examples used in class, and correct them against that authority.`,
        teacherFocus
          ? `DELIVERY ADAPTATION\n${teacherFocus}`
          : null,
      ], '\n\n'),

    consolidation:
      joinNonEmpty([
        `Timing: ${timing.consolidation} minutes.`,
        `Return to the lesson focus: ${resolvedTopic}.`,
        inquiry
          ? `Use the key inquiry question to consolidate learning: ${inquiry}`
          : 'Review the stated Scheme objective with learners before closing the lesson.',
      ]),

    assessmentHook:
      joinNonEmpty([
        `Timing: ${timing.assessment} minutes.`,
        assessmentObjectiveText,
        assessment
          ? `Scheme assessment method(s):\n${assessment}`
          : 'Use teacher observation, oral checks or another teacher-selected method without changing the stated objective.',
        inquiry
          ? `Expected evidence: learner responses should address the key inquiry question: ${inquiry}`
          : null,
      ], '\n\n'),

    homework: deterministicHomework({
      topic: resolvedTopic,
      objectives,
      inquiry,
    }),

    differentiation:
      joinNonEmpty([
        `Deliver the same authoritative objective to all learners in ${className}.`,
        'Support: reduce task size, add prompts, pair strategically or provide the approved resource again.',
        'On track: complete the core Scheme activity and explain the answer/evidence.',
        'Extension: ask learners to justify, compare or apply the same objective in another relevant context without adding a new curriculum objective.',
        teacherFocus
          ? `Teacher-requested adaptation: ${teacherFocus}`
          : null,
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
    creditsUsed: 0,
  }
}
