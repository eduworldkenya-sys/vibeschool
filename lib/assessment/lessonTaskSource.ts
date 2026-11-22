import { parseLessonPlanBody } from '@/lib/teaching/lessonPlanCodec'

export type LessonTaskType = 'exercise' | 'quiz' | 'homework'

export type SavedLessonTask = {
  text: string
  section: 'consolidation' | 'assessmentHook' | 'homework'
}

/**
 * A lesson task must be quoted from the canonical saved plan.
 * An objective alone never authorizes made-up questions.
 */
export function savedLessonTask(body: string, type: LessonTaskType): SavedLessonTask | null {
  const sections = parseLessonPlanBody(body)
  if (!sections) return null
  const section = type === 'exercise' ? 'consolidation' : type === 'quiz' ? 'assessmentHook' : 'homework'
  const text = sections[section].trim()
  if (!text || /no certified homework task|do not invent/i.test(text)) return null
  return { text, section }
}
