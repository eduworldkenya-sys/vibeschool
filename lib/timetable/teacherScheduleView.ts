import type { TeacherTeachingIdentity } from '@/lib/teacher/teachingIdentity'

/**
 * A read-only presentation selection over the existing canonical school
 * timetable and invitation-authorised VibeTutor sessions. NOT a new engine,
 * timetable authority, membership grant, or write path.
 */
export type TeacherScheduleView = 'school' | 'independent' | 'all'

export function defaultTeacherScheduleView(identity: TeacherTeachingIdentity): TeacherScheduleView {
  return identity.defaultScope.kind === 'school' ? 'school' : 'independent'
}

export function canUseTeacherScheduleView(
  identity: TeacherTeachingIdentity,
  view: TeacherScheduleView,
): boolean {
  return view === 'independent' || identity.availableScopes.some(scope => scope.kind === 'school')
}

export type SchoolScheduleEntry<T> = { kind: 'school'; start: string; slot: T }
export type IndependentScheduleEntry<T> = { kind: 'tuition'; start: string; lesson: T }

/**
 * Consolidate only records that were read through their own canonical,
 * authorised loaders. Nothing about this union authorises either source.
 */
export function projectTeacherDaySchedule<S, T>(
  view: TeacherScheduleView,
  schoolEntries: readonly SchoolScheduleEntry<S>[],
  privateEntries: readonly IndependentScheduleEntry<T>[],
): Array<SchoolScheduleEntry<S> | IndependentScheduleEntry<T>> {
  const entries: Array<SchoolScheduleEntry<S> | IndependentScheduleEntry<T>> = []
  if (view !== 'independent') entries.push(...schoolEntries)
  if (view !== 'school') entries.push(...privateEntries)
  return entries.sort((a, b) => a.start.localeCompare(b.start))
}

/** The school grid and school period edits must never be exposed in private mode. */
export function mayEditSchoolTimetable(
  view: TeacherScheduleView,
  activeSchoolId: string | null,
  visibleSchoolId: string | null,
): boolean {
  return view === 'school' && !!activeSchoolId && activeSchoolId === visibleSchoolId
}
