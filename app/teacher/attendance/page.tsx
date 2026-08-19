"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { nairobiDateAdd, nairobiDateStr } from "@/lib/time";
import { loadActiveTeacherTimetable, timetableSlotsForDay } from "@/lib/timetable/engine";
import { loadExactLessonAttendance } from "@/lib/teaching/lessonAttendance";
import { refreshPulse } from "@/lib/pulse/refresh";

type AttendanceStatus = "present" | "absent" | "late" | "excused";
type Mode = "class" | "lesson";

type OperatingContext = {
  teacher_id: string;
  school_id: string | null;
  school_count: number;
  state: "ready" | "needs_school" | "needs_class";
  schools: Array<{ id: string; name: string; assignment_count: number; active: boolean }>;
  classes: Array<{
    assignment_id: string;
    class_id: string;
    class_name: string;
    stream: string | null;
    subject_id: string;
    subject_name: string;
    is_class_teacher: boolean;
  }>;
};

type ClassOption = { id: string; label: string };
type StudentRow = { id: string; name: string; admissionNumber: string };
type LessonSlot = {
  id: string;
  classId: string;
  subjectId: string;
  subject: string;
  className: string;
  room: string;
  start: string;
  end: string;
  marked: boolean;
};

const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];

function draftKey(mode: Mode, date: string, classId: string | null, occurrenceId: string | null) {
  return `vibeschool:teacher:attendance:${mode}:${date}:${classId ?? "none"}:${occurrenceId ?? "general"}`;
}

function loadDraft(key: string): Record<string, AttendanceStatus> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { statuses?: Record<string, AttendanceStatus> };
    return parsed.statuses ?? null;
  } catch {
    return null;
  }
}

function saveDraft(key: string, statuses: Record<string, AttendanceStatus>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ statuses, savedAt: new Date().toISOString() }));
  } catch {
    // Storage failure must never block the register.
  }
}

function clearDraft(key: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(key); } catch {}
}

function formatTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function dayOfWeek(date: string) {
  const day = new Date(`${date}T12:00:00+03:00`).getDay();
  return day === 0 ? 7 : day;
}

function StatusButton({ value, active, onClick }: { value: AttendanceStatus; active: boolean; onClick: () => void }) {
  const labels: Record<AttendanceStatus, string> = { present: "Present", absent: "Absent", late: "Late", excused: "Excused" };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        minHeight: 38,
        border: active ? "1px solid #111827" : "1px solid #d1d5db",
        borderRadius: 10,
        padding: "0 10px",
        background: active ? "#111827" : "#fff",
        color: active ? "#fff" : "#374151",
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      {labels[value]}
    </button>
  );
}

function AttendancePageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const urlClassId = search.get("classId");
  const urlSlotId = search.get("timetableSlotId");
  const urlSubjectId = search.get("subjectId");
  const urlDate = search.get("date");
  const exactLessonRequested = search.get("mode") === "lesson" && Boolean(urlSlotId && urlDate);

  const [mode, setMode] = useState<Mode>(exactLessonRequested ? "lesson" : "class");
  const [selectedDate, setSelectedDate] = useState(urlDate ?? nairobiDateStr());
  const [context, setContext] = useState<OperatingContext | null>(null);
  const [activeClassId, setActiveClassId] = useState<string | null>(urlClassId);
  const [lessonSlots, setLessonSlots] = useState<LessonSlot[]>([]);
  const [activeSlot, setActiveSlot] = useState<LessonSlot | null>(null);
  const [occurrenceId, setOccurrenceId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const classOptions = useMemo<ClassOption[]>(() => {
    const map = new Map<string, ClassOption>();
    for (const assignment of context?.classes ?? []) {
      if (!map.has(assignment.class_id)) {
        map.set(assignment.class_id, {
          id: assignment.class_id,
          label: assignment.class_name + (assignment.stream ? ` ${assignment.stream}` : ""),
        });
      }
    }
    return Array.from(map.values());
  }, [context]);

  const activeRegisterClassId = mode === "lesson" ? activeSlot?.classId ?? null : activeClassId;
  const storageKey = draftKey(mode, selectedDate, activeRegisterClassId, occurrenceId);

  const loadContext = useCallback(async (requestedSchoolId?: string | null) => {
    const { data, error: contextError } = await supabase.rpc("teacher_get_operating_context", {
      p_requested_school_id: requestedSchoolId ?? undefined,
    });
    if (contextError) throw contextError;
    return data as unknown as OperatingContext;
  }, []);

  const loadScheduledLessons = useCallback(async (ctx: OperatingContext, date: string) => {
    if (!ctx.school_id) return [] as LessonSlot[];
    const timetable = await loadActiveTeacherTimetable({
      teacherId: ctx.teacher_id,
      schoolId: ctx.school_id,
      activeOn: date,
    });
    const raw = timetableSlotsForDay(timetable, dayOfWeek(date));
    if (raw.length === 0) return [] as LessonSlot[];

    const subjectIds = Array.from(new Set(raw.map((slot) => slot.subject_id)));
    const classIds = Array.from(new Set(raw.map((slot) => slot.class_id)));
    const [subjectsRes, classesRes, attendanceRes] = await Promise.all([
      supabase.from("subjects").select("id,name").in("id", subjectIds),
      supabase.from("classes").select("id,name,stream").in("id", classIds),
      supabase.from("attendance").select("timetable_slot_id").eq("date", date).in("timetable_slot_id", raw.map((slot) => slot.id)),
    ]);
    if (subjectsRes.error) throw subjectsRes.error;
    if (classesRes.error) throw classesRes.error;
    if (attendanceRes.error) throw attendanceRes.error;

    const subjectNames = new Map((subjectsRes.data ?? []).map((row) => [row.id, row.name]));
    const classNames = new Map((classesRes.data ?? []).map((row) => [row.id, `${row.name}${row.stream ? ` ${row.stream}` : ""}`]));
    const marked = new Set((attendanceRes.data ?? []).map((row) => row.timetable_slot_id).filter(Boolean));

    return raw.map((slot) => ({
      id: slot.id,
      classId: slot.class_id,
      subjectId: slot.subject_id,
      subject: subjectNames.get(slot.subject_id) ?? "Subject",
      className: classNames.get(slot.class_id) ?? "Class",
      room: slot.room ?? "",
      start: slot.start_time,
      end: slot.end_time,
      marked: marked.has(slot.id),
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setLoading(true);
      setError(null);
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) {
          router.replace("/login");
          return;
        }
        const ctx = await loadContext();
        if (cancelled) return;
        setContext(ctx);
        if (!ctx.school_id) {
          setError("Connect your teacher account to a school before taking attendance.");
          return;
        }
        const options = Array.from(new Set(ctx.classes.map((item) => item.class_id)));
        if (urlClassId && !options.includes(urlClassId)) {
          setError("That class is not assigned to you in the active school.");
          setActiveClassId(options[0] ?? null);
        } else if (!activeClassId) {
          setActiveClassId(options[0] ?? null);
        }

        if (exactLessonRequested && urlSlotId && urlDate) {
          const exact = await loadExactLessonAttendance({
            teacherId: ctx.teacher_id,
            schoolId: ctx.school_id,
            timetableSlotId: urlSlotId,
            occurrenceDate: urlDate,
            expectedClassId: urlClassId,
            expectedSubjectId: urlSubjectId,
          });
          if (!exact) throw new Error("lesson_occurrence_not_authorized");
          const slot: LessonSlot = {
            id: exact.id,
            classId: exact.classId,
            subjectId: urlSubjectId ?? "",
            subject: exact.subject,
            className: exact.className,
            room: exact.room,
            start: exact.start,
            end: exact.end,
            marked: exact.marked,
          };
          setLessonSlots([slot]);
          setActiveSlot(slot);
          setActiveClassId(slot.classId);
        } else {
          const slots = await loadScheduledLessons(ctx, selectedDate);
          if (!cancelled) {
            setLessonSlots(slots);
            if (mode === "lesson") setActiveSlot(slots.find((slot) => !slot.marked) ?? slots[0] ?? null);
          }
        }
      } catch (bootError) {
        console.error("[Attendance] boot", bootError);
        if (!cancelled) setError("Attendance could not be loaded. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void boot();
    return () => { cancelled = true; };
  }, [activeClassId, exactLessonRequested, loadContext, loadScheduledLessons, mode, router, selectedDate, urlClassId, urlDate, urlSlotId, urlSubjectId]);

  const loadRegister = useCallback(async () => {
    const classId = mode === "lesson" ? activeSlot?.classId : activeClassId;
    if (!classId || !context?.school_id) {
      setStudents([]);
      setStatuses({});
      return;
    }
    setRegisterLoading(true);
    setError(null);
    setSaved(false);
    try {
      let activeOccurrenceId: string | null = null;
      if (mode === "lesson") {
        if (!activeSlot) return;
        const { data: occurrence, error: occurrenceError } = await supabase
          .from("teaching_occurrences")
          .select("id")
          .eq("teacher_id", context.teacher_id)
          .eq("school_id", context.school_id)
          .eq("class_id", activeSlot.classId)
          .eq("timetable_slot_id", activeSlot.id)
          .eq("occurrence_date", selectedDate)
          .maybeSingle();
        if (occurrenceError) throw occurrenceError;
        if (!occurrence?.id) {
          setOccurrenceId(null);
          setStudents([]);
          setStatuses({});
          setError("Start this lesson before taking its lesson attendance.");
          return;
        }
        activeOccurrenceId = occurrence.id;
        setOccurrenceId(activeOccurrenceId);
      } else {
        setOccurrenceId(null);
      }

      const rosterPromise = supabase
        .from("student_classes")
        .select("student_id, students(id,name,admission_number,deleted_at)")
        .eq("school_id", context.school_id)
        .eq("class_id", classId)
        .eq("is_current", true);
      const attendancePromise = mode === "lesson" && activeOccurrenceId
        ? supabase.from("attendance").select("student_id,status,is_late").eq("teaching_occurrence_id", activeOccurrenceId)
        : supabase.from("attendance").select("student_id,status,is_late").eq("class_id", classId).eq("date", selectedDate).is("timetable_slot_id", null);
      const [rosterRes, attendanceRes] = await Promise.all([rosterPromise, attendancePromise]);
      if (rosterRes.error) throw rosterRes.error;
      if (attendanceRes.error) throw attendanceRes.error;

      const roster: StudentRow[] = (rosterRes.data ?? [])
        .map((row: any) => row.students)
        .filter((student: any) => student && !student.deleted_at)
        .map((student: any) => ({ id: student.id, name: student.name, admissionNumber: student.admission_number ?? "" }));
      const existing: Record<string, AttendanceStatus> = {};
      for (const row of attendanceRes.data ?? []) {
        existing[row.student_id] = row.is_late ? "late" : (row.status as AttendanceStatus);
      }
      const base: Record<string, AttendanceStatus> = {};
      for (const student of roster) base[student.id] = existing[student.id] ?? "present";
      const key = draftKey(mode, selectedDate, classId, activeOccurrenceId);
      const draft = loadDraft(key);
      setStudents(roster);
      setStatuses(draft ? { ...base, ...draft } : base);
    } catch (registerError) {
      console.error("[Attendance] register", registerError);
      setStudents([]);
      setStatuses({});
      setError("The register could not be loaded. Check your connection and retry.");
    } finally {
      setRegisterLoading(false);
    }
  }, [activeClassId, activeSlot, context, mode, selectedDate]);

  useEffect(() => { void loadRegister(); }, [loadRegister]);
  useEffect(() => {
    if (students.length > 0 && Object.keys(statuses).length > 0) saveDraft(storageKey, statuses);
  }, [statuses, storageKey, students.length]);

  async function changeSchool(schoolId: string) {
    if (saving || schoolId === context?.school_id) return;
    setError(null);
    try {
      const { error: setError } = await supabase.rpc("teacher_set_active_school", { p_school_id: schoolId });
      if (setError) throw setError;
      const next = await loadContext(schoolId);
      setContext(next);
      const firstClass = next.classes[0]?.class_id ?? null;
      setActiveClassId(firstClass);
      setActiveSlot(null);
      setLessonSlots(await loadScheduledLessons(next, selectedDate));
      refreshPulse("attendance");
    } catch (schoolError) {
      console.error("[Attendance] school", schoolError);
      setError("That school could not be selected. Your previous school remains active.");
    }
  }

  function updateStatus(studentId: string, value: AttendanceStatus) {
    setStatuses((current) => ({ ...current, [studentId]: value }));
    setSaved(false);
  }

  function markAll(value: AttendanceStatus) {
    setStatuses(Object.fromEntries(students.map((student) => [student.id, value])));
    setSaved(false);
  }

  async function saveRegister() {
    const classId = mode === "lesson" ? activeSlot?.classId : activeClassId;
    if (!context?.school_id || !classId || students.length === 0 || saving) return;
    if (mode === "lesson" && (!activeSlot || !occurrenceId)) {
      setError("Start this lesson before saving attendance.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const rows = students.map((student) => {
        const value = statuses[student.id] ?? "present";
        return {
          student_id: student.id,
          class_id: classId,
          school_id: context.school_id,
          teacher_id: context.teacher_id,
          date: selectedDate,
          status: value === "late" ? "present" : value,
          is_late: value === "late",
          ...(mode === "lesson" && activeSlot && occurrenceId
            ? { timetable_slot_id: activeSlot.id, teaching_occurrence_id: occurrenceId }
            : {}),
        };
      });
      const { error: saveError } = await supabase.rpc("upsert_attendance_batch", { p_rows: rows });
      if (saveError) throw saveError;
      clearDraft(storageKey);
      setSaved(true);
      refreshPulse("attendance");
      if (mode === "lesson" && activeSlot) {
        const subjectId = activeSlot.subjectId || urlSubjectId || "";
        router.push(`/teacher/lessonplan?timetableSlotId=${encodeURIComponent(activeSlot.id)}&date=${encodeURIComponent(selectedDate)}&subjectId=${encodeURIComponent(subjectId)}&classId=${encodeURIComponent(activeSlot.classId)}`);
      }
    } catch (saveError) {
      console.error("[Attendance] save", saveError);
      saveDraft(storageKey, statuses);
      setError("Attendance was not saved. Your choices are kept on this device; retry when the connection is stable.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 18 }} aria-label="Loading attendance"><div style={{ height: 120, borderRadius: 18, background: "#e5e7eb" }} /></div>;
  }

  const counts = STATUSES.reduce<Record<AttendanceStatus, number>>((acc, value) => {
    acc[value] = Object.values(statuses).filter((status) => status === value).length;
    return acc;
  }, { present: 0, absent: 0, late: 0, excused: 0 });

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 14px 112px" }}>
      <section style={{ background: "linear-gradient(135deg,#065f46,#10b981)", color: "#fff", borderRadius: 20, padding: 18, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", opacity: .72, letterSpacing: 1 }}>Attendance</div>
        <h1 style={{ margin: "4px 0", fontSize: 23 }}>Mark register</h1>
        <div style={{ fontSize: 12, opacity: .8 }}>{selectedDate}{context?.schools.find((school) => school.id === context.school_id)?.name ? ` · ${context.schools.find((school) => school.id === context.school_id)?.name}` : ""}</div>

        {context && context.schools.length > 1 && (
          <select aria-label="Active school" value={context.school_id ?? ""} onChange={(event) => void changeSchool(event.target.value)} style={{ marginTop: 12, width: "100%", minHeight: 44, border: 0, borderRadius: 12, padding: "0 12px", background: "#fff", color: "#111827", fontWeight: 800 }}>
            {context.schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => { setMode("class"); setActiveSlot(null); }} style={{ minHeight: 44, border: 0, borderRadius: 12, fontWeight: 900, background: mode === "class" ? "#fff" : "rgba(255,255,255,.16)", color: mode === "class" ? "#065f46" : "#fff" }}>Class register</button>
          <button type="button" onClick={() => { setMode("lesson"); setActiveSlot(lessonSlots.find((slot) => !slot.marked) ?? lessonSlots[0] ?? null); }} style={{ minHeight: 44, border: 0, borderRadius: 12, fontWeight: 900, background: mode === "lesson" ? "#fff" : "rgba(255,255,255,.16)", color: mode === "lesson" ? "#065f46" : "#fff" }}>Lesson register</button>
        </div>

        {!exactLessonRequested && (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 7, marginTop: 9 }}>
            <button type="button" aria-label="Previous day" onClick={() => setSelectedDate((date) => nairobiDateAdd(date, -1))} style={{ minWidth: 44, minHeight: 44, border: 0, borderRadius: 11, background: "rgba(255,255,255,.16)", color: "#fff", fontWeight: 900 }}>‹</button>
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} style={{ minHeight: 44, border: 0, borderRadius: 11, padding: "0 10px", fontWeight: 800 }} />
            <button type="button" aria-label="Next day" onClick={() => setSelectedDate((date) => nairobiDateAdd(date, 1))} style={{ minWidth: 44, minHeight: 44, border: 0, borderRadius: 11, background: "rgba(255,255,255,.16)", color: "#fff", fontWeight: 900 }}>›</button>
          </div>
        )}
      </section>

      {error && <div role="alert" style={{ borderRadius: 14, background: "#fef2f2", color: "#991b1b", padding: 13, marginBottom: 12, fontSize: 13, lineHeight: 1.45 }}>{error}</div>}
      {saved && <div role="status" style={{ borderRadius: 14, background: "#ecfdf5", color: "#065f46", padding: 13, marginBottom: 12, fontSize: 13, fontWeight: 800 }}>Attendance saved.</div>}

      {context?.state === "needs_school" ? (
        <section style={{ background: "#fff", borderRadius: 18, padding: 24, textAlign: "center" }}><strong>School connection needed</strong><p style={{ color: "#6b7280", fontSize: 13 }}>Connect your school before taking attendance.</p><button type="button" onClick={() => router.push("/teacher/onboarding/school")} style={{ minHeight: 44, border: 0, borderRadius: 12, background: "#111827", color: "#fff", padding: "0 16px", fontWeight: 900 }}>Connect school</button></section>
      ) : context?.state === "needs_class" ? (
        <section style={{ background: "#fff", borderRadius: 18, padding: 24, textAlign: "center" }}><strong>No class assignment yet</strong><p style={{ color: "#6b7280", fontSize: 13 }}>Add or request a class assignment to open a register.</p><button type="button" onClick={() => router.push("/teacher/onboarding/class")} style={{ minHeight: 44, border: 0, borderRadius: 12, background: "#111827", color: "#fff", padding: "0 16px", fontWeight: 900 }}>Set up class</button></section>
      ) : (
        <>
          <section style={{ background: "#fff", borderRadius: 18, padding: 14, marginBottom: 12, boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}>
            {mode === "class" ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 8 }}>CLASS</div>
                {classOptions.length === 0 ? <div style={{ color: "#6b7280", fontSize: 13 }}>No assigned classes in this school.</div> : (
                  <select value={activeClassId ?? ""} onChange={(event) => setActiveClassId(event.target.value)} style={{ width: "100%", minHeight: 46, border: "1px solid #d1d5db", borderRadius: 12, padding: "0 12px", background: "#fff", fontWeight: 800 }}>
                    {classOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 8 }}>LESSON</div>
                {lessonSlots.length === 0 ? <div style={{ color: "#6b7280", fontSize: 13 }}>No timetable lessons for this day. Use the class register or open your timetable.</div> : lessonSlots.map((slot) => (
                  <button key={slot.id} type="button" onClick={() => setActiveSlot(slot)} style={{ width: "100%", minHeight: 58, marginBottom: 7, border: activeSlot?.id === slot.id ? "2px solid #10b981" : "1px solid #e5e7eb", borderRadius: 13, background: activeSlot?.id === slot.id ? "#ecfdf5" : "#fff", textAlign: "left", padding: "9px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>{slot.subject} · {slot.className}</div>
                    <div style={{ marginTop: 3, fontSize: 11, color: "#6b7280" }}>{formatTime(slot.start)}–{formatTime(slot.end)}{slot.room ? ` · ${slot.room}` : ""}{slot.marked ? " · Attendance saved" : ""}</div>
                  </button>
                ))}
              </>
            )}
          </section>

          <section style={{ background: "#fff", borderRadius: 18, padding: 14, boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280" }}>REGISTER</div><div style={{ marginTop: 3, fontSize: 13, color: "#374151" }}>{students.length} learners</div></div>
              {students.length > 0 && <button type="button" onClick={() => markAll("present")} style={{ minHeight: 40, border: "1px solid #a7f3d0", borderRadius: 11, background: "#ecfdf5", color: "#065f46", padding: "0 12px", fontWeight: 900 }}>All present</button>}
            </div>

            {registerLoading ? <div style={{ height: 100, borderRadius: 14, background: "#e5e7eb" }} /> : students.length === 0 ? (
              <div style={{ padding: "24px 8px", textAlign: "center", color: "#6b7280", fontSize: 13 }}>{mode === "lesson" && !occurrenceId ? "Start the lesson first, then return here to take attendance." : "No current learners were found for this class."}</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 12 }}>
                  {STATUSES.map((value) => <div key={value} style={{ borderRadius: 10, background: "#f8fafc", padding: "7px 4px", textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 900 }}>{counts[value]}</div><div style={{ fontSize: 9, color: "#6b7280", textTransform: "capitalize" }}>{value}</div></div>)}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {students.map((student) => (
                    <div key={student.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 9 }}><div><div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>{student.name}</div>{student.admissionNumber && <div style={{ marginTop: 2, fontSize: 10, color: "#9ca3af" }}>{student.admissionNumber}</div>}</div><div style={{ fontSize: 10, fontWeight: 900, color: "#6b7280", textTransform: "capitalize" }}>{statuses[student.id] ?? "present"}</div></div>
                      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>{STATUSES.map((value) => <StatusButton key={value} value={value} active={(statuses[student.id] ?? "present") === value} onClick={() => updateStatus(student.id, value)} />)}</div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => void saveRegister()} disabled={saving} style={{ width: "100%", minHeight: 50, marginTop: 14, border: 0, borderRadius: 13, background: saving ? "#9ca3af" : "#111827", color: "#fff", fontWeight: 900, fontSize: 14 }}>{saving ? "Saving…" : "Save attendance"}</button>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return <Suspense fallback={<div style={{ padding: 18 }}>Loading attendance…</div>}><AttendancePageInner /></Suspense>;
}
