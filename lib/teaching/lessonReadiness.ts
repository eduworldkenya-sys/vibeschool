import { parseLessonPlanBody } from '@/lib/teaching/lessonPlanCodec'

export interface LessonReadinessResult {
  ready: boolean
  reasons: string[]
}

export function evaluateLessonReadiness(body: string): LessonReadinessResult {
  const sections = parseLessonPlanBody(body)
  if (!sections) return { ready: false, reasons: ['Lesson sections are incomplete.'] }

  const reasons: string[] = []
  const totalMatch = sections.assessmentHook.match(/Total lesson time:\s*(\d+)\/(\d+)\s*min/i)
  if (!totalMatch || totalMatch[1] !== totalMatch[2]) reasons.push('Timetable timing is not fully allocated.')
  if (!/Teaching points \/ teacher notes:/i.test(sections.development)) reasons.push('Teacher notes are missing.')
  if (!/Learner activities:/i.test(sections.development)) reasons.push('Learner activities are missing.')
  if (!/questions and expected answers:/i.test(sections.development)) reasons.push('Prepared questions and expected answers are missing.')
  if (!/Misconceptions to watch:/i.test(sections.development)) reasons.push('Misconception guidance is missing.')
  if (!/Objectives being assessed:/i.test(sections.assessmentHook)) reasons.push('Assessment is not mapped to objectives.')
  if (!sections.resources.trim()) reasons.push('Teaching resources are missing.')
  if (!/^1\./m.test(sections.objectives)) reasons.push('Learning objectives are not structured.')
  if (!/^1\./m.test(sections.differentiation)) reasons.push('Differentiation is not actionable.')

  return { ready: reasons.length === 0, reasons }
}

export function isLessonPlanReadyToTeach(body: string): boolean {
  return evaluateLessonReadiness(body).ready
}
