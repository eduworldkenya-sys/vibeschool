export interface LessonTiming {
  total: number
  introduction: number
  development: number
  consolidation: number
  assessment: number
}

export function parseLessonDurationMinutes(value?: string | null): number {
  const match = value?.trim().match(/(\d+)/)
  const minutes = match ? Number(match[1]) : 40
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 40
}

export function allocateLessonTiming(totalMinutes: number): LessonTiming {
  const total = Math.max(1, Math.round(totalMinutes))

  if (total <= 4) {
    const introduction = 1
    const assessment = total >= 2 ? 1 : 0
    const consolidation = total >= 3 ? 1 : 0
    const development = Math.max(0, total - introduction - assessment - consolidation)
    return { total, introduction, development, consolidation, assessment }
  }

  const introduction = Math.max(1, Math.round(total * 0.13))
  const consolidation = Math.max(1, Math.round(total * 0.13))
  const assessment = Math.max(1, Math.round(total * 0.14))
  const development = total - introduction - consolidation - assessment

  return { total, introduction, development, consolidation, assessment }
}

export function lessonTimingRanges(timing: LessonTiming): {
  introduction: string
  development: string
  consolidation: string
  assessment: string
} {
  const introEnd = timing.introduction
  const developmentEnd = introEnd + timing.development
  const consolidationEnd = developmentEnd + timing.consolidation

  return {
    introduction: `0–${introEnd} min`,
    development: `${introEnd}–${developmentEnd} min`,
    consolidation: `${developmentEnd}–${consolidationEnd} min`,
    assessment: `${consolidationEnd}–${timing.total} min`,
  }
}
