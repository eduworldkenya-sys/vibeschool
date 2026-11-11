// Shared timetable presentation rules for private tuition.
// A past scheduled lesson is "Ended", not "Completed": attendance is not inferred.
export type TuitionLesson = { status: string; starts_at: string; ends_at: string };

export type TuitionLessonState = 'cancelled' | 'completed' | 'ended' | 'upcoming' | 'joinable' | 'unavailable';

export function tuitionLessonState(lesson: TuitionLesson, now = Date.now()): TuitionLessonState {
  if (lesson.status === 'cancelled') return 'cancelled';
  if (lesson.status === 'completed') return 'completed';
  if (lesson.status !== 'scheduled') return 'unavailable';
  const start = Date.parse(lesson.starts_at);
  const end = Date.parse(lesson.ends_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'unavailable';
  if (now >= end) return 'ended';
  return now >= start - 15 * 60_000 ? 'joinable' : 'upcoming';
}

export function tuitionLessonCanCancel(lesson: TuitionLesson, now = Date.now()): boolean {
  return lesson.status === 'scheduled' && Number.isFinite(Date.parse(lesson.starts_at)) && Date.parse(lesson.starts_at) > now;
}
