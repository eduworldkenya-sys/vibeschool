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
    .filter(line => /^\d+\.\s+\S/.test(line))
    .map(line => line.replace(/^\d+\.\s+/, '').trim())
}

function bulletItems(value: string): string[] {
  return value
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => /^(?:•|-|\*)\s+\S/.test(line))
    .map(line => line.replace(/^(?:•|-|\*)\s+/, '').trim())
}

function sectionAfter(value: string, heading: RegExp): string {
  const match = heading.exec(value)
  if (!match?.index && match?.index !== 0) return ''
  return value.slice(match.index + match[0].length).trim()
}

function hasTimedSection(value: string): boolean {
  const match = value.match(/Timing:\s*[^\n]*\((\d+)\s*min\)/i)
  return Boolean(match && Number(match[1]) > 0)
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

  if (!hasTimedSection(sections.introduction)) {
    reasons.push('Introduction timing is missing or invalid.')
  }
  const inquiryMatch = sections.introduction.match(/key inquiry question:\s*([^\n]+)/i)
  if (!inquiryMatch || !meaningful(inquiryMatch[1], 10) || !/\?$/.test(inquiryMatch[1].trim())) {
    reasons.push('A meaningful key inquiry question is required.')
  }

  if (!hasTimedSection(sections.development)) {
    reasons.push('Lesson development timing is missing or invalid.')
  }

  const teachingNotes = sectionAfter(
    sections.development,
    /Teaching points \/ teacher notes:\s*/i,
  )
  if (numberedItems(teachingNotes).filter(item => meaningful(item, 15)).length < 2) {
    reasons.push('Teacher notes need at least two substantive teaching points.')
  }

  const learnerActivities = sectionAfter(
    sections.development,
    /Learner activities:\s*/i,
  )
  if (numberedItems(learnerActivities).filter(item => meaningful(item, 12)).length === 0) {
    reasons.push('At least one substantive learner activity is required.')
  }

  const questionBlock = sectionAfter(
    sections.development,
    /questions and expected answers:\s*/i,
  )
  const preparedQuestions = numberedItems(questionBlock).filter(item => meaningful(item, 8))
  if (preparedQuestions.length === 0 || !/Expected answer:\s*\S+/i.test(questionBlock)) {
    reasons.push('Prepared checks must include a real question and expected answer.')
  }

  const misconceptionBlock = sectionAfter(
    sections.development,
    /Misconceptions to watch:\s*/i,
  )
  const misconceptions = [
    ...bulletItems(misconceptionBlock),
    ...numberedItems(misconceptionBlock),
  ].filter(item => meaningful(item, 12))
  if (misconceptions.length === 0) {
    reasons.push('Misconception guidance must identify at least one concrete risk or correction.')
  }

  if (!hasTimedSection(sections.consolidation)) {
    reasons.push('Consolidation timing is missing or invalid.')
  }
  if (numberedItems(sections.consolidation).filter(item => meaningful(item, 10)).length < 2) {
    reasons.push('Consolidation must contain an actionable lesson close.')
  }

  if (!hasTimedSection(sections.assessmentHook)) {
    reasons.push('Assessment timing is missing or invalid.')
  }
  const totalMatch = sections.assessmentHook.match(/Total lesson time:\s*(\d+)\/(\d+)\s*min/i)
  if (
    !totalMatch ||
    Number(totalMatch[1]) <= 0 ||
    totalMatch[1] !== totalMatch[2]
  ) {
    reasons.push('Timetable timing is not fully allocated.')
  }

  const assessedObjectives = sectionAfter(
    sections.assessmentHook,
    /Objectives being assessed:\s*/i,
  )
  if (numberedItems(assessedObjectives).filter(item => meaningful(item, 12)).length === 0) {
    reasons.push('Assessment must be explicitly mapped to at least one objective.')
  }

  const hasPreparedAssessment = /Prepared checks:\s*[\s\S]*?\d+\.\s+\S+/i.test(sections.assessmentHook)
  const hasAssessmentMethod = /Scheme assessment method\(s\):\s*[\s\S]*?(?:•|-|\*)\s+\S+/i.test(sections.assessmentHook)
  if (!hasPreparedAssessment && !hasAssessmentMethod) {
    reasons.push('Assessment needs a concrete check or Scheme assessment method.')
  }

  const differentiationItems = numberedItems(sections.differentiation)
    .filter(item => meaningful(item, 12))
  const differentiationText = sections.differentiation.toLowerCase()
  if (
    differentiationItems.length < 2 ||
    !differentiationText.includes('support') ||
    !differentiationText.includes('stretch')
  ) {
    reasons.push('Differentiation must include actionable support and stretch strategies.')
  }

  if (!meaningful(sections.homework, 8) && sections.homework.trim() !== '') {
    reasons.push('Homework/follow-up must be actionable when present.')
  }

  return { ready: reasons.length === 0, reasons }
}

export function isLessonPlanReadyToTeach(body: string): boolean {
  return evaluateLessonReadiness(body).ready
}
