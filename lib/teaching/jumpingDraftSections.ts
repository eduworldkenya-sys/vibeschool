import type { LessonPlanSections } from '@/lib/teaching/lessonPlanCodec'

type ContentRecord = Record<string, unknown>

export interface JumpingContentSelection {
  schemeId: string
  lessonNumber: number
  title: string
  content: ContentRecord
}

function record(value: unknown): ContentRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ContentRecord
    : {}
}

function value(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function lines(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map(item => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean).join('\n')
}

/**
 * Converts a selected, Scheme-linked ORIGINAL manuscript into the existing
 * eight-section lesson-plan codec. No new lesson engine or model call.
 * The result is teacher-review-only until the underlying version is certified.
 */
export function buildJumpingDraftSections(
  selection: JumpingContentSelection,
  scheme: {
    objectives?: string | null
    keyInquiryQuestion?: string | null
    learningResources?: string | null
    assessmentMethods?: string | null
  },
): LessonPlanSections {
  const content = record(selection.content)
  const teacher = record(content.teacher)
  const learner = record(content.learner)
  const assessment = record(content.assessment)
  const observation = record(content.observation)
  if (!value(teacher.body) || !value(learner.body)) {
    throw new Error('The selected Jumping lesson is missing its teaching or learner content.')
  }

  const join = (...values: string[]) => values.filter(Boolean).join('\n\n')
  const question = value(scheme.keyInquiryQuestion)
  return {
    objectives: value(scheme.objectives),
    resources: join(
      value(scheme.learningResources),
      'VibeSchool Jumping · Lesson ' + selection.lessonNumber + ' · ' + selection.title,
    ),
    introduction: join(question ? 'Discuss: ' + question : '', lines(teacher.questions)),
    development: join(
      value(teacher.body),
      lines(teacher.activities),
      'Learner activities:\n' + join(value(learner.body), lines(learner.learnerActivities)),
    ),
    consolidation: join(lines(learner.questions), value(assessment.body)),
    assessmentHook: join(
      value(teacher.assessment_guidance),
      value(scheme.assessmentMethods),
      value(observation.body),
    ),
    homework: lines(teacher.homeworkTasks),
    differentiation: lines(teacher.differentiation),
  }
}
