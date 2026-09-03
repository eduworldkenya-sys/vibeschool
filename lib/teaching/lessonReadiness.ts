import { parseLessonPlanBody } from '@/lib/teaching/lessonPlanCodec'

export interface LessonReadinessResult {
  ready: boolean
  reasons: string[]
}

const PLACEHOLDER_PATTERNS = [
  /no authoritative .* attached/i,
  /no certified .* attached/i,
  /follow the approved scheme/i,
  /use the learning resources attached to the scheme source/i,
  /add or link .* before teaching/i,
  /lorem ipsum/i,
  /\b(?:tbd|todo|n\/a)\b/i,
]

const ACTION_VERBS = /\b(?:identify|describe|explain|state|list|compare|contrast|classify|calculate|construct|demonstrate|determine|differentiate|discuss|draw|evaluate|examine|interpret|investigate|justify|locate|measure|name|observe|outline|predict|prepare|record|relate|represent|solve|summarise|summarize|use|verify|write|analyse|analyze|apply|create)\b/i

function meaningful(value: string, minLength = 12): boolean {
  const text = value.trim()
  return text.length >= minLength && !PLACEHOLDER_PATTERNS.some(pattern => pattern.test(text))
}

function numberedItems(value: string): string[] {
  return value
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => /^\d+[.)]\s+\S/.test(line))
    .map(line => line.replace(/^\d+[.)]\s+/, '').trim())
}

function bulletItems(value: string): string[] {
  return value
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => /^(?:•|-|\*)\s+\S/.test(line))
    .map(line => line.replace(/^(?:•|-|\*)\s+/, '').trim())
}

/**
 * Returns only the subsection between its heading and the first following
 * heading. Readiness checks must never allow content from a later subsection
 * to make an earlier subsection appear complete.
 */
function subsection(
  value: string,
  startHeading: RegExp,
  endHeadings: RegExp[],
): string {
  const startMatch = startHeading.exec(value)
  if (!startMatch || startMatch.index === undefined) return ''

  const start = startMatch.index + startMatch[0].length
  const rest = value.slice(start)
  let end = rest.length

  for (const heading of endHeadings) {
    const match = heading.exec(rest)
    if (match && match.index !== undefined) {
      end = Math.min(end, match.index)
    }
  }

  return rest.slice(0, end).trim()
}

function timingMinutes(value: string): number | null {
  const match = value.match(/Timing:\s*[^\n]*\((\d+)\s*min\)/i)
  if (!match) return null
  const minutes = Number(match[1])
  return Number.isInteger(minutes) && minutes > 0 ? minutes : null
}

function preparedQuestionCount(value: string): number {
  return value
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => /^\d+[.)]\s+.+\?\s*$/i.test(line))
    .length
}

export function evaluateLessonReadiness(body: string): LessonReadinessResult {
  const sections = parseLessonPlanBody(body)
  if (!sections) {
    return {
      ready: false,
      reasons: ['Lesson plan is not in the complete canonical section format.'],
    }
  }

  const reasons: string[] = []

  const objectives = numberedItems(sections.objectives)
  if (
    objectives.length === 0 ||
    objectives.some(objective => !meaningful(objective, 15) || !ACTION_VERBS.test(objective))
  ) {
    reasons.push('Learning objectives must be specific, measurable and action-oriented.')
  }

  const resourceItems = [
    ...numberedItems(sections.resources),
    ...bulletItems(sections.resources),
  ].filter(item => meaningful(item, 4))
  if (resourceItems.length === 0) {
    reasons.push('At least one usable teaching or learning resource is required.')
  }

  const introductionMinutes = timingMinutes(sections.introduction)
  if (introductionMinutes === null) {
    reasons.push('Introduction timing is missing or invalid.')
  }

  const inquiryMatch = sections.introduction.match(/key inquiry question:\s*([^\n]+)/i)
  if (!inquiryMatch || !meaningful(inquiryMatch[1], 10) || !/\?$/.test(inquiryMatch[1].trim())) {
    reasons.push('A meaningful key inquiry question is required.')
  }

  const developmentMinutes = timingMinutes(sections.development)
  if (developmentMinutes === null) {
    reasons.push('Lesson development timing is missing or invalid.')
  }

  const teachingNotes = subsection(
    sections.development,
    /Teaching points \/ teacher notes:\s*/i,
    [
      /Learner activities:\s*/i,
      /(?:Check-for-understanding )?questions and expected answers:\s*/i,
      /Misconceptions to watch:\s*/i,
    ],
  )
  if (numberedItems(teachingNotes).filter(item => meaningful(item, 15)).length < 2) {
    reasons.push('Teacher notes need at least two substantive teaching points.')
  }

  const learnerActivities = subsection(
    sections.development,
    /Learner activities:\s*/i,
    [
      /(?:Check-for-understanding )?questions and expected answers:\s*/i,
      /Misconceptions to watch:\s*/i,
    ],
  )
  if (numberedItems(learnerActivities).filter(item => meaningful(item, 12)).length === 0) {
    reasons.push('At least one substantive learner activity is required.')
  }

  const questionBlock = subsection(
    sections.development,
    /(?:Check-for-understanding )?questions and expected answers:\s*/i,
    [/Misconceptions to watch:\s*/i],
  )
  if (
    preparedQuestionCount(questionBlock) === 0 ||
    !/Expected answer:\s*\S+/i.test(questionBlock)
  ) {
    reasons.push('Prepared checks must include a real question and expected answer.')
  }

  const misconceptionBlock = subsection(
    sections.development,
    /Misconceptions to watch:\s*/i,
    [],
  )
  const misconceptions = [
    ...bulletItems(misconceptionBlock),
    ...numberedItems(misconceptionBlock),
  ].filter(item => meaningful(item, 12))
  if (misconceptions.length === 0) {
    reasons.push('Misconception guidance must identify at least one concrete risk or correction.')
  }

  const consolidationMinutes = timingMinutes(sections.consolidation)
  if (consolidationMinutes === null) {
    reasons.push('Consolidation timing is missing or invalid.')
  }
  if (numberedItems(sections.consolidation).filter(item => meaningful(item, 10)).length < 2) {
    reasons.push('Consolidation must contain an actionable lesson close.')
  }

  const assessmentMinutes = timingMinutes(sections.assessmentHook)
  if (assessmentMinutes === null) {
    reasons.push('Assessment timing is missing or invalid.')
  }

  const totalMatch = sections.assessmentHook.match(/Total lesson time:\s*(\d+)\/(\d+)\s*min/i)
  const allocatedMinutes = [
    introductionMinutes,
    developmentMinutes,
    consolidationMinutes,
    assessmentMinutes,
  ].reduce<number>((sum, minutes) => sum + (minutes ?? 0), 0)

  if (
    !totalMatch ||
    Number(totalMatch[1]) <= 0 ||
    Number(totalMatch[2]) <= 0 ||
    totalMatch[1] !== totalMatch[2] ||
    allocatedMinutes !== Number(totalMatch[1])
  ) {
    reasons.push('Timetable timing is not fully and consistently allocated.')
  }

  const assessedObjectives = subsection(
    sections.assessmentHook,
    /Objectives being assessed:\s*/i,
    [
      /Prepared checks:\s*/i,
      /Scheme assessment method\(s\):\s*/i,
      /Total lesson time:\s*/i,
    ],
  )
  if (numberedItems(assessedObjectives).filter(item => meaningful(item, 12)).length === 0) {
    reasons.push('Assessment must be explicitly mapped to at least one objective.')
  }

  const preparedAssessment = subsection(
    sections.assessmentHook,
    /Prepared checks:\s*/i,
    [
      /Scheme assessment method\(s\):\s*/i,
      /Total lesson time:\s*/i,
    ],
  )
  const assessmentMethods = subsection(
    sections.assessmentHook,
    /Scheme assessment method\(s\):\s*/i,
    [/Total lesson time:\s*/i],
  )
  const hasPreparedAssessment =
    preparedQuestionCount(preparedAssessment) > 0 ||
    numberedItems(preparedAssessment).some(item => meaningful(item, 10))
  const hasAssessmentMethod = [
    ...bulletItems(assessmentMethods),
    ...numberedItems(assessmentMethods),
  ].some(item => meaningful(item, 8))

  if (!hasPreparedAssessment && !hasAssessmentMethod) {
    reasons.push('Assessment needs a concrete check or Scheme assessment method.')
  }

  const differentiationItems = numberedItems(sections.differentiation)
    .filter(item => meaningful(item, 12))
  const differentiationText = sections.differentiation.toLowerCase()
  if (
    differentiationItems.length < 2 ||
    !/\bsupport\b/.test(differentiationText) ||
    !/\bstretch\b/.test(differentiationText)
  ) {
    reasons.push('Differentiation must include actionable support and stretch strategies.')
  }

  if (sections.homework.trim() !== '' && !meaningful(sections.homework, 8)) {
    reasons.push('Homework/follow-up must be actionable when present.')
  }

  return { ready: reasons.length === 0, reasons }
}

export function isLessonPlanReadyToTeach(body: string): boolean {
  return evaluateLessonReadiness(body).ready
}
