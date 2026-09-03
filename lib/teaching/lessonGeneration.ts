import type { LessonPlanSections } from '@/lib/teaching/lessonPlanCodec'
import { validateLessonPlanGrounding } from '@/lib/teaching/lessonPlanGrounding'
import {
  allocateLessonTiming,
  lessonTimingRanges,
  parseLessonDurationMinutes,
} from '@/lib/teaching/lessonTiming'

export interface GenerateLessonPlanInput {
  // Retained for call-site compatibility while the deterministic fallback is
  // provider-free. These identity/display fields are not curriculum authority.
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
  | { ok: true; sections: LessonPlanSections }
  | { ok: false; message: string }

function clean(value?: string | null): string {
  return value?.trim() ?? ''
}

function splitList(value?: string | null): string[] {
  const raw = value?.trim() ?? ''
  if (!raw) return []

  // Split before whitespace normalization so line-separated Scheme authority
  // remains distinct. Collapsing newlines first turns multiple objectives or
  // activities into one synthetic item and weakens downstream grounding.
  return raw
    .split(/\s*[|;]\s*|\n+/)
    .map(clean)
    .filter(Boolean)
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

/** Scheme-only deterministic baseline used when no certified content exists. */
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
  if (!resolvedTopic) return { ok: false, message: 'A lesson topic is required.' }

  const objectives = splitList(curriculumObjectives)
  const experiences = splitList(learningExperiences)
  const assessment = splitList(assessmentMethods)
  const resources = splitList(learningResources)
  const inquiry = clean(keyInquiryQuestion)
  const previousTopic = previousTopics.map(clean).filter(Boolean).at(-1) ?? ''
  const curriculumPath = joinNonEmpty([curriculumStrand, curriculumSubStrand], ' → ')
  const timing = allocateLessonTiming(parseLessonDurationMinutes(duration))
  const ranges = lessonTimingRanges(timing)

  const sections: LessonPlanSections = {
    objectives: numbered(objectives, 'No authoritative learning objective is attached to this lesson yet. Add or link the Scheme of Work objective before teaching.'),
    resources: joinNonEmpty([
      'Scheme-approved resources:',
      numbered(resources, '1. Use the learning resources attached to the Scheme source.'),
      reference ? `\nCurriculum reference:\n• ${reference}` : null,
    ]),
    introduction: joinNonEmpty([
      `Timing: ${ranges.introduction} (${timing.introduction} min).`,
      `1. Introduce the lesson focus: ${resolvedTopic}.`,
      previousTopic ? `2. Connect to the previous lesson: ${previousTopic}.` : null,
      inquiry ? `3. Ask the key inquiry question: ${inquiry}` : null,
      `Class: ${className}${studentCount > 0 ? ` (${studentCount} learners)` : ''}.`,
    ]),
    development: joinNonEmpty([
      `Timing: ${ranges.development} (${timing.development} min).`,
      curriculumPath ? `Curriculum path: ${curriculumPath}.` : null,
      `\nLearner activities from the Scheme:\n${numbered(experiences, '1. Follow the approved Scheme learning sequence. No additional curriculum content has been invented.')}`,
      focus ? `\nTeacher-requested adaptation:\n• ${focus}` : null,
      '\nTeacher note: this is a Scheme-only baseline. Attach certified VibeSchool content before marking the plan Ready to Teach when rich content is required.',
    ], '\n\n'),
    consolidation: joinNonEmpty([
      `Timing: ${ranges.consolidation} (${timing.consolidation} min).`,
      `1. Return to the lesson focus: ${resolvedTopic}.`,
      inquiry ? `2. Revisit the key inquiry question: ${inquiry}` : '2. Review each stated Scheme objective with learners.',
      '3. Ask learners to state one key learning point before closing.',
    ]),
    assessmentHook: joinNonEmpty([
      `Timing: ${ranges.assessment} (${timing.assessment} min). Total lesson time: ${timing.total}/${timing.total} min.`,
      `\nObjectives being assessed:\n${numbered(objectives, '1. No authoritative Scheme objective is attached yet.')}`,
      assessment.length > 0
        ? `\nScheme assessment method(s):\n${bullets(assessment, '')}`
        : '\nAssessment: use an objective-linked oral or written check and record Mastered, Developing or Needs support.',
    ]),
    homework: 'No certified homework task is attached. Do not invent one automatically; add a teacher task or attach approved VibeSchool content.',
    differentiation: joinNonEmpty([
      '1. Support: adjust prompts, grouping, pacing and resource support without changing the Scheme objective.',
      '2. Core: complete the Scheme learning experience as written.',
      '3. Stretch: ask for explanation, justification or application while keeping the same objective.',
    ]),
  }

  const validation = validateLessonPlanGrounding({ sections, schemeObjectives: curriculumObjectives })
  return validation.ok ? { ok: true, sections } : validation
}
