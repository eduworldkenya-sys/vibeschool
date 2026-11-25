import type { LessonPlanSections } from './lessonPlanCodec'

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

/** Same-day timetable slots use their persisted start/end clock times. */
export function scheduledLessonMinutes(start: string | null | undefined, end: string | null | undefined): number {
  const seconds = (value: string | null | undefined): number => {
    const match = value?.match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/)
    if (!match) return NaN
    const hours = Number(match[1])
    const minutes = Number(match[2])
    const secs = Number(match[3] ?? 0) + Number('0.' + (match[4] ?? '0'))
    if (hours > 23 || minutes > 59 || secs >= 60) return NaN
    return hours * 3600 + minutes * 60 + secs
  }
  const minutes = (seconds(end) - seconds(start)) / 60
  if (!Number.isFinite(minutes) || minutes < 1) {
    throw new Error('This timetable lesson has an invalid duration. Check its start and end times.')
  }
  return Math.round(minutes)
}

/** Refuse a stale generated plan rather than silently changing its source package. */
export function verifyScheduledLessonMinutes(expected: number | null | undefined, current: number): number {
  if (expected !== current) {
    throw new Error('The timetable duration changed during preparation. Generate the lesson again to use the current duration.')
  }
  return current
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

/** Apply the exact slot/draft duration to an original manuscript without changing its teaching content. */
export function timeOriginalLessonSections(
  sections: LessonPlanSections,
  durationMinutes: number,
): LessonPlanSections {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error('A positive lesson duration is required.')
  }
  const timing = allocateLessonTiming(durationMinutes)
  const ranges = lessonTimingRanges(timing)
  // Strip only complete machine-generated timing headers at the start.
  // Keep the teacher's prose, even when it contains its own timing guidance.
  const generatedHeader = /^Timing: \d+[–-]\d+ min \(\d+ min\)\.(?: Total lesson time: \d+\/\d+ min\.)?(?:\r?\n|$)/
  const mark = (content: string, range: string, minutes: number) => {
    let body = content
    while (generatedHeader.test(body)) body = body.replace(generatedHeader, '')
    return `Timing: ${range} (${minutes} min).\n${body}`
  }
  return {
    ...sections,
    introduction: mark(sections.introduction, ranges.introduction, timing.introduction),
    development: mark(sections.development, ranges.development, timing.development),
    consolidation: mark(sections.consolidation, ranges.consolidation, timing.consolidation),
    assessmentHook: mark(sections.assessmentHook, ranges.assessment, timing.assessment),
  }
}
