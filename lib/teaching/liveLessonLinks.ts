/**
 * Navigation-only bridge between a teacher's saved Lesson Plan and Live Lesson.
 * This does not confer room access, start or complete an occurrence, publish
 * private plan content, or establish a canonical room-to-plan database link.
 * Supabase RLS and Live's authorized RPC remain the only access authorities.
 */
export interface LessonLiveContext {
  lessonPlanId: string
  classId: string
  subjectId?: string | null
  timetableSlotId?: string | null
  occurrenceId?: string | null
  occurrenceDate?: string | null
}

export function isLessonUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function validDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T12:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function query(context: LessonLiveContext): URLSearchParams {
  const params = new URLSearchParams({ lessonPlanId: context.lessonPlanId })
  if (isLessonUuid(context.subjectId)) params.set('subjectId', context.subjectId)
  if (isLessonUuid(context.timetableSlotId)) params.set('timetableSlotId', context.timetableSlotId)
  if (isLessonUuid(context.occurrenceId)) params.set('occurrenceId', context.occurrenceId)
  if (validDate(context.occurrenceDate)) params.set('date', context.occurrenceDate)
  return params
}

export function lessonToLiveHref(context: LessonLiveContext): string | null {
  if (!isLessonUuid(context.lessonPlanId) || !isLessonUuid(context.classId)) return null
  return '/teacher/classhub/' + encodeURIComponent(context.classId) + '/live?' + query(context).toString()
}

export function liveToLessonHref(context: LessonLiveContext): string | null {
  if (!isLessonUuid(context.lessonPlanId) || !isLessonUuid(context.classId)) return null
  const params = query(context)
  params.set('classId', context.classId)
  params.set('teach', '1')
  return '/teacher/lesson-notes?' + params.toString()
}
