export interface LessonTimingPlan {
  totalMinutes: number
  introductionMinutes: number
  teachingMinutes: number
  activityMinutes: number
  assessmentMinutes: number
  consolidationMinutes: number
  homeworkMinutes: number
}

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 40
  return Math.max(20, Math.min(180, Math.round(value)))
}

export function parseDurationMinutes(duration?: string | null): number {
  if (!duration) return 40
  const match = duration.match(/\d+/)
  return clampMinutes(match ? Number(match[0]) : 40)
}

/**
 * Deterministically allocates the exact timetable duration across a live lesson.
 * Percentages are stable and the final phase absorbs rounding so the total is
 * always exactly the occurrence duration. No model/provider is involved.
 */
export function planLessonTiming(duration?: string | null): LessonTimingPlan {
  const totalMinutes = parseDurationMinutes(duration)
  const introductionMinutes = Math.max(3, Math.round(totalMinutes * 0.12))
  const teachingMinutes = Math.max(6, Math.round(totalMinutes * 0.30))
  const activityMinutes = Math.max(5, Math.round(totalMinutes * 0.25))
  const assessmentMinutes = Math.max(4, Math.round(totalMinutes * 0.16))
  const consolidationMinutes = Math.max(3, Math.round(totalMinutes * 0.10))

  const allocated =
    introductionMinutes +
    teachingMinutes +
    activityMinutes +
    assessmentMinutes +
    consolidationMinutes

  const homeworkMinutes = Math.max(1, totalMinutes - allocated)
  const overflow = allocated + homeworkMinutes - totalMinutes

  return {
    totalMinutes,
    introductionMinutes,
    teachingMinutes,
    activityMinutes,
    assessmentMinutes,
    consolidationMinutes: Math.max(1, consolidationMinutes - overflow),
    homeworkMinutes,
  }
}
