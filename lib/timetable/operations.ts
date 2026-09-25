import { supabase } from "@/lib/supabase";

export type TimetableReleaseStatus = "draft" | "review" | "approved" | "published" | "retired";
export type ResourceType = "classroom" | "laboratory" | "workshop" | "field" | "computer_lab" | "other";

export interface CalendarExceptionRow {
  id: string; school_id: string; exception_date: string;
  kind: "holiday" | "closure" | "exam" | "event";
  label: string; suppress_ordinary_teaching: boolean;
}
export interface TeacherAvailabilityRow {
  id: string; school_id: string; teacher_id: string; day_of_week: number;
  start_time: string; end_time: string; availability: "unavailable" | "preferred";
  reason: string | null; effective_from: string; effective_until: string | null;
}
export interface SubjectTimetableRuleRow {
  id: string; school_id: string; class_id: string; subject_id: string;
  max_units_per_day: number | null; min_teaching_days: number | null;
  consecutive_units: number | null; required_resource_type: ResourceType | null;
  preferred_day_part: "morning" | "afternoon" | null;
}

function assertNoError(error: { message?: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback);
}

export async function loadSchoolCalendarExceptions(schoolId: string, from: string, until: string) {
  const { data, error } = await supabase.from("school_calendar_exceptions")
    .select("id,school_id,exception_date,kind,label,suppress_ordinary_teaching")
    .eq("school_id", schoolId).gte("exception_date", from).lte("exception_date", until)
    .order("exception_date");
  assertNoError(error, "Could not load school calendar.");
  return (data ?? []) as CalendarExceptionRow[];
}

export async function loadTeacherAvailability(teacherId: string) {
  const { data, error } = await supabase.from("teacher_timetable_availability")
    .select("id,school_id,teacher_id,day_of_week,start_time,end_time,availability,reason,effective_from,effective_until")
    .eq("teacher_id", teacherId).order("day_of_week").order("start_time");
  assertNoError(error, "Could not load teacher availability.");
  return (data ?? []) as TeacherAvailabilityRow[];
}

export async function loadSubjectTimetableRules(schoolId: string) {
  const { data, error } = await supabase.from("subject_timetable_rules")
    .select("id,school_id,class_id,subject_id,max_units_per_day,min_teaching_days,consecutive_units,required_resource_type,preferred_day_part")
    .eq("school_id", schoolId);
  assertNoError(error, "Could not load timetable rules.");
  return (data ?? []) as SubjectTimetableRuleRow[];
}

export async function assignOccurrenceSubstitute(occurrenceId: string, substituteTeacherId: string, reason: string) {
  const { data, error } = await supabase.rpc("assign_occurrence_substitute", {
    p_occurrence_id: occurrenceId,
    p_substitute_teacher_id: substituteTeacherId,
    p_reason: reason,
  });
  assertNoError(error, "Could not assign substitute teacher.");
  return data;
}

export async function createTimetableRelease(input: { schoolId: string; label: string; effectiveFrom: string }) {
  const { data, error } = await supabase.from("timetable_releases").insert({
    school_id: input.schoolId, label: input.label, effective_from: input.effectiveFrom, status: "draft",
  }).select("id,school_id,status,effective_from,label,created_at").single();
  assertNoError(error, "Could not create timetable release.");
  return data;
}

export async function updateTimetableReleaseStatus(id: string, status: TimetableReleaseStatus) {
  const patch: Record<string, unknown> = { status };
  const now = new Date().toISOString();
  if (status === "review") patch.reviewed_at = now;
  if (status === "approved") patch.approved_at = now;
  if (status === "published") patch.published_at = now;
  const { data, error } = await supabase.from("timetable_releases").update(patch).eq("id", id)
    .select("id,school_id,status,effective_from,label,created_at,reviewed_at,approved_at,published_at").single();
  assertNoError(error, "Could not update timetable release.");
  return data;
}
