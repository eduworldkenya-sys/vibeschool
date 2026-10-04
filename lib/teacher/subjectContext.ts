import { supabase } from "@/lib/supabase";
import { nairobiDateAdd, nairobiDateStr } from "@/lib/time";
import { loadTeacherTimetableForRange, type CanonicalTimetableSlot } from "@/lib/timetable/engine";

export type SubjectAuthority = {
  teacherId: string;
  schoolId: string;
  classId: string;
  className: string;
  stream: string | null;
  subjectId: string;
  subjectName: string;
};

export type SubjectLessonCandidate = {
  timetableSlotId: string;
  occurrenceId: string | null;
  occurrenceDate: string;
  lifecycle: string | null;
  startTime: string;
  endTime: string;
  room: string | null;
  lessonPlanId: string | null;
  lessonPlanStatus: string | null;
  lessonTitle: string | null;
  relation: "today" | "upcoming" | "recent";
};

type OperatingContext = {
  teacher_id?: string | null;
  school_id?: string | null;
  classes?: Array<{
    class_id: string;
    class_name: string;
    stream?: string | null;
    subject_id: string;
    subject_name: string;
  }>;
};

function weekStartForDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (parsed.getUTCDay() + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - mondayOffset);
  return parsed.toISOString().slice(0, 10);
}

function isoDayOfWeek(date: string): number {
  const day = new Date(`${date}T12:00:00+03:00`).getDay();
  return day === 0 ? 7 : day;
}

function dateRange(start: string, end: string): string[] {
  const values: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    values.push(cursor);
    cursor = nairobiDateAdd(cursor, 1);
  }
  return values;
}

function slotActiveOn(slot: CanonicalTimetableSlot, date: string): boolean {
  return slot.effective_from <= date && (!slot.effective_until || slot.effective_until >= date);
}

export async function resolveSubjectAuthority(
  classId: string,
  subjectId: string,
): Promise<SubjectAuthority> {
  if (!classId || !subjectId) {
    throw new Error("Choose a class and subject first.");
  }

  const [{ data: auth, error: authError }, contextRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("teacher_get_operating_context"),
  ]);

  if (authError || !auth.user) throw new Error("Sign in again to continue.");
  if (contextRes.error) throw contextRes.error;

  const context = (contextRes.data ?? {}) as OperatingContext;
  if (!context.school_id) throw new Error("Choose or connect your school first.");

  const assignment = (context.classes ?? []).find(
    (item) => item.class_id === classId && item.subject_id === subjectId,
  );
  if (!assignment) {
    throw new Error("That class and subject are not assigned to you in the active school.");
  }

  return {
    teacherId: auth.user.id,
    schoolId: context.school_id,
    classId,
    className: assignment.class_name,
    stream: assignment.stream ?? null,
    subjectId,
    subjectName: assignment.subject_name,
  };
}

export async function loadSubjectLessonCandidates(
  authority: SubjectAuthority,
): Promise<SubjectLessonCandidate[]> {
  const today = nairobiDateStr();
  const rangeStart = nairobiDateAdd(today, -7);
  const rangeEnd = nairobiDateAdd(today, 14);

  const [slots, occurrenceRes, planRes] = await Promise.all([
    loadTeacherTimetableForRange({
      teacherId: authority.teacherId,
      schoolId: authority.schoolId,
      rangeStart,
      rangeEnd,
    }),
    supabase
      .from("teaching_occurrences")
      .select("id,timetable_slot_id,occurrence_date,lifecycle")
      .eq("teacher_id", authority.teacherId)
      .eq("school_id", authority.schoolId)
      .eq("class_id", authority.classId)
      .eq("subject_id", authority.subjectId)
      .gte("occurrence_date", rangeStart)
      .lte("occurrence_date", rangeEnd),
    supabase
      .from("lesson_plans")
      .select("id,timetable_slot_id,week_start,taught_date,status,title,topic")
      .eq("teacher_id", authority.teacherId)
      .eq("school_id", authority.schoolId)
      .eq("class_id", authority.classId)
      .eq("subject_id", authority.subjectId)
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  if (occurrenceRes.error) throw occurrenceRes.error;
  if (planRes.error) throw planRes.error;

  const relevantSlots = slots.filter(
    (slot) => slot.class_id === authority.classId && slot.subject_id === authority.subjectId,
  );
  const occurrenceByKey = new Map(
    (occurrenceRes.data ?? []).map((row) => [
      `${row.timetable_slot_id}:${row.occurrence_date}`,
      row,
    ]),
  );

  const plans = planRes.data ?? [];
  const candidates: SubjectLessonCandidate[] = [];

  for (const date of dateRange(rangeStart, rangeEnd)) {
    const dow = isoDayOfWeek(date);
    for (const slot of relevantSlots) {
      if (Number(slot.day_of_week) !== dow || !slotActiveOn(slot, date)) continue;
      const occurrence = occurrenceByKey.get(`${slot.id}:${date}`) ?? null;
      const weekStart = weekStartForDate(date);
      const plan = plans.find(
        (item) =>
          item.timetable_slot_id === slot.id &&
          (item.taught_date === date || item.week_start === weekStart),
      ) ?? null;

      candidates.push({
        timetableSlotId: slot.id,
        occurrenceId: occurrence?.id ?? null,
        occurrenceDate: date,
        lifecycle: occurrence?.lifecycle ?? null,
        startTime: slot.start_time,
        endTime: slot.end_time,
        room: slot.room ?? null,
        lessonPlanId: plan?.id ?? null,
        lessonPlanStatus: plan?.status ?? null,
        lessonTitle: plan?.title ?? plan?.topic ?? null,
        relation: date === today ? "today" : date > today ? "upcoming" : "recent",
      });
    }
  }

  return candidates
    .filter((candidate) => candidate.lifecycle !== "cancelled")
    .sort((a, b) => {
      const rank = (value: SubjectLessonCandidate) =>
        value.relation === "today" ? 0 : value.relation === "upcoming" ? 1 : 2;
      const rankDiff = rank(a) - rank(b);
      if (rankDiff !== 0) return rankDiff;
      if (a.relation === "recent" && b.relation === "recent") {
        return b.occurrenceDate.localeCompare(a.occurrenceDate) || a.startTime.localeCompare(b.startTime);
      }
      return a.occurrenceDate.localeCompare(b.occurrenceDate) || a.startTime.localeCompare(b.startTime);
    });
}

export function buildTeacherGuideHref(
  authority: Pick<SubjectAuthority, "classId" | "subjectId" | "subjectName">,
  candidate: SubjectLessonCandidate,
): string {
  const q = new URLSearchParams({
    classId: authority.classId,
    subjectId: authority.subjectId,
    subjectName: authority.subjectName,
    timetableSlotId: candidate.timetableSlotId,
    date: candidate.occurrenceDate,
  });
  return `/teacher/teacher-guide?${q.toString()}`;
}

export function buildLessonNotesHref(
  authority: Pick<SubjectAuthority, "classId" | "subjectId">,
  candidate: SubjectLessonCandidate,
): string | null {
  if (!candidate.lessonPlanId) return null;
  const q = new URLSearchParams({
    lessonPlanId: candidate.lessonPlanId,
    classId: authority.classId,
    subjectId: authority.subjectId,
    timetableSlotId: candidate.timetableSlotId,
    date: candidate.occurrenceDate,
  });
  if (candidate.occurrenceId) q.set("occurrenceId", candidate.occurrenceId);
  return `/teacher/lesson-notes?${q.toString()}`;
}
