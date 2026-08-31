export interface LessonPhaseTiming {
  totalMinutes: number
  introduction: number
  development: number
  assessment: number
  consolidation: number
}

function positiveInteger(value: number): number {
  if (!Number.isFinite(value)) return 40
  return Math.max(1, Math.round(value))
}

/**
 * Split an exact timetable duration into deterministic teaching phases.
 * The returned phases always add up to totalMinutes, including short periods.
 */
export function allocateLessonPhaseTiming(totalMinutesInput: number): LessonPhaseTiming {
  const totalMinutes = positiveInteger(totalMinutesInput)

  if (totalMinutes <= 3) {
    return {
      totalMinutes,
      introduction: 1,
      development: Math.max(0, totalMinutes - 2),
      assessment: totalMinutes >= 2 ? 1 : 0,
      consolidation: 0,
    }
  }

  const introduction = Math.max(1, Math.round(totalMinutes * 0.10))
  const assessment = Math.max(1, Math.round(totalMinutes * 0.15))
  const consolidation = Math.max(1, Math.round(totalMinutes * 0.15))
  const development = Math.max(
    1,
    totalMinutes - introduction - assessment - consolidation,
  )

  const allocated = introduction + development + assessment + consolidation
  const correction = totalMinutes - allocated

  return {
    totalMinutes,
    introduction,
    development: development + correction,
    assessment,
    consolidation,
  }
}

export function durationMinutesFromLabel(
  duration: string | null | undefined,
  fallback = 40,
): number {
  if (!duration) return positiveInteger(fallback)
  const match = duration.match(/-?\d+(?:\.\d+)?/)
  if (!match) return positiveInteger(fallback)
  return positiveInteger(Number(match[0]))
}

export function durationMinutesFromClock(
  start?: string | null,
  end?: string | null,
  fallback = 40,
): number {
  if (!start || !end) return positiveInteger(fallback)

  const startParts = start.split(':').map(Number)
  const endParts = end.split(':').map(Number)
  if (
    startParts.length < 2 ||
    endParts.length < 2 ||
    startParts.some(value => !Number.isFinite(value)) ||
    endParts.some(value => !Number.isFinite(value))
  ) {
    return positiveInteger(fallback)
  }

  const startMinutes = startParts[0] * 60 + startParts[1]
  const endMinutes = endParts[0] * 60 + endParts[1]
  const difference = endMinutes - startMinutes

  return difference > 0 ? positiveInteger(difference) : positiveInteger(fallback)
}

export function lessonPhaseLabel(
  phase: 'introduction' | 'development' | 'assessment' | 'consolidation',
  timing: LessonPhaseTiming,
): string {
  const names = {
    introduction: 'Introduction',
    development: 'Development',
    assessment: 'Assessment Check',
    consolidation: 'Consolidation',
  } as const

  return `${names[phase]} (${timing[phase]} min)`
}
