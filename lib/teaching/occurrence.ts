import { supabase } from '@/lib/supabase'
import type { OccurrenceKey, Lifecycle, TeachingOccurrence } from '@/lib/teaching/types'

function deriveLifecycle(
  persisted: { lifecycle: Lifecycle } | null,
  lessonPlanId: string | null,
  slotEndTime: string,
  occurrenceDate: string,
): Lifecycle {
  // Persisted rows own in_progress / completed / cancelled / rescheduled outright —
  // the resolver never invents or overrides those.
  if (persisted && ['in_progress', 'completed', 'cancelled', 'rescheduled'].includes(persisted.lifecycle)) {
    return persisted.lifecycle
  }

  if (lessonPlanId) return 'ready'

  const slotEnd = new Date(`${occurrenceDate}T${slotEndTime}`)
  const gracePeriodMs = 3 * 60 * 60 * 1000 // 3h grace before treating an unplanned slot as missed
  if (Date.now() > slotEnd.getTime() + gracePeriodMs) return 'missed'

  return 'planned'
}

/**
 * Resolves the full teaching context for one timetable slot occurrence.
 * Batches every read via Promise.all per standing convention — never sequential awaits.
 *
 * Fix 18B: every query in both batches is checked for .error before any state
 * is derived. A failed read throws rather than silently degrading into an
 * empty/false state (e.g. a failed attendance query must never read as
 * "not_started" — it must surface as a failure to the caller).
 */
export async function resolveOccurrence(key: OccurrenceKey): Promise<TeachingOccurrence | null> {
  const { data: slot, error: slotErr } = await supabase
    .from('timetable_slots')
    .select('id, school_id, teacher_id, class_id, subject_id, day_of_week, start_time, end_time, effective_from, effective_until')
    .eq('id', key.timetableSlotId)
    .maybeSingle()

  if (slotErr) throw slotErr
  if (!slot) return null

  // occurrence date must fall within the slot's effective range
  if (slot.effective_from && key.occurrenceDate < slot.effective_from) return null
  if (slot.effective_until && key.occurrenceDate > slot.effective_until) return null

  const [
    lessonPlanRes,
    occurrenceRes,
    expectedCountRes,
  ] = await Promise.all([
    supabase.from('lesson_plans')
      .select('id')
      .eq('timetable_slot_id', key.timetableSlotId)
      .eq('taught_date', key.occurrenceDate)
      .maybeSingle(),
    supabase.from('teaching_occurrences')
      .select('lifecycle')
      .eq('timetable_slot_id', key.timetableSlotId)
      .eq('occurrence_date', key.occurrenceDate)
      .maybeSingle(),
    supabase.from('students')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', slot.class_id)
      .is('deleted_at', null),
  ])

  const firstReadError = lessonPlanRes.error ?? occurrenceRes.error ?? expectedCountRes.error
  if (firstReadError) throw firstReadError

  const lessonPlanId = lessonPlanRes.data?.id ?? null

  const [
    attendanceRes,
    evidenceRes,
    homeworkRes,
    reflectionRes,
  ] = await Promise.all([
    supabase.from('attendance')
      .select('student_id')
      .eq('timetable_slot_id', key.timetableSlotId)
      .eq('date', key.occurrenceDate),
    lessonPlanId
      ? supabase.from('lesson_evidence')
          .select('id, created_at')
          .eq('lesson_id', lessonPlanId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as { id: string; created_at: string }[], error: null }),
    lessonPlanId
      ? supabase.from('homework').select('id').eq('lesson_plan_id', lessonPlanId).maybeSingle()
      : Promise.resolve({ data: null as { id: string } | null, error: null }),
    lessonPlanId
      ? supabase.from('lesson_reflections')
          .select('id, what_worked, what_didnt, next_steps')
          .eq('lesson_plan_id', lessonPlanId)
          .maybeSingle()
      : Promise.resolve({ data: null as { id: string; what_worked: string | null; what_didnt: string | null; next_steps: string | null } | null, error: null }),
  ])

  const secondReadError = attendanceRes.error ?? evidenceRes.error ?? homeworkRes.error ?? reflectionRes.error
  if (secondReadError) throw secondReadError

  const markedCount   = attendanceRes.data?.length ?? 0
  const expectedCount = expectedCountRes.count ?? 0
  const attendanceState =
    markedCount === 0 ? 'not_started' :
    markedCount < expectedCount ? 'partial' : 'complete'

  const evidenceRows = evidenceRes.data ?? []

  const reflection = reflectionRes.data
  const reflectionCompleted = !!reflection && !!(reflection.what_worked || reflection.what_didnt || reflection.next_steps)

  const lifecycle = deriveLifecycle(
    occurrenceRes.data as { lifecycle: Lifecycle } | null,
    lessonPlanId,
    slot.end_time,
    key.occurrenceDate,
  )

  return {
    key,
    schoolId:  slot.school_id,
    teacherId: slot.teacher_id,
    classId:   slot.class_id,
    subjectId: slot.subject_id,
    dayOfWeek: slot.day_of_week,
    startTime: slot.start_time,
    endTime:   slot.end_time,

    lessonPlanId,

    attendance: {
      state: attendanceState,
      markedCount,
      expectedCount,
    },

    evidence: {
      count: evidenceRows.length,
      latestEvidenceId: evidenceRows[0]?.id ?? null,
    },

    homework: {
      homeworkId: homeworkRes.data?.id ?? null,
      issued: !!homeworkRes.data,
    },

    reflection: {
      reflectionId: reflection?.id ?? null,
      completed: reflectionCompleted,
    },

    lifecycle,
  }
}
