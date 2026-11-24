/** Navigation-only context; ownership is enforced by Supabase and Live RPCs. */
export type LessonLiveContext = {
  lessonPlanId: string
  classId: string
  subjectId?: string | null
  timetableSlotId?: string | null
  occurrenceId?: string | null
  occurrenceDate?: string | null
}
export function validLessonId(id: string | null | undefined): id is string {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}
function validDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T12:00:00Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value
}
function query(context: LessonLiveContext): URLSearchParams {
  const params = new URLSearchParams({lessonPlanId: context.lessonPlanId})
  if (validLessonId(context.subjectId)) params.set('subjectId', context.subjectId)
  if (validLessonId(context.timetableSlotId)) params.set('timetableSlotId', context.timetableSlotId)
  if (validLessonId(context.occurrenceId)) params.set('occurrenceId', context.occurrenceId)
  if (validDate(context.occurrenceDate)) params.set('date', context.occurrenceDate)
  return params
}
export function lessonToLiveHref(context: LessonLiveContext): string | null {
  if (!validLessonId(context.lessonPlanId) || !validLessonId(context.classId)) return null
  return '/teacher/classhub/' + encodeURIComponent(context.classId) + '/live?' + query(context)
}
export function liveToLessonHref(context: LessonLiveContext): string | null {
  if (!validLessonId(context.lessonPlanId) || !validLessonId(context.classId)) return null
  const params = query(context)
  params.set('classId', context.classId)
  params.set('teach','1')
  return '/teacher/lesson-notes?' + params
}
