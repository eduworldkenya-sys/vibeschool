import type { TeachingToolSpec } from './teachingToolCatalog'

/**
 * Presentational tool selection keyed to the canonical released Time lesson
 * order, not guessed from subject keywords. This does not author new content.
 * The interactive clock/converter are exploratory only; no exam state is saved.
 */
const TIME_LESSON_TOOL_IDS = {
  1: [],
  2: ['clock'],
  3: ['clock'],
  4: ['unit-converter'],
  5: ['unit-converter'],
  6: ['clock'],
  7: ['clock'],
  8: ['unit-converter'],
  9: ['unit-converter'],
  10: ['clock'],
} as const

export function grade4TimeToolsForReleasedLesson(lessonOrder: number): TeachingToolSpec[] {
  const ids = TIME_LESSON_TOOL_IDS[lessonOrder as keyof typeof TIME_LESSON_TOOL_IDS] ?? []
  return ids.map(id => ({id}))
}
