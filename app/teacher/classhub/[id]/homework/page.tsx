"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { nairobiDateStr } from "@/lib/time";

type Context = {
  teacher_id: string;
  school_id: string | null;
  classes: Array<{ class_id: string; class_name: string; stream: string | null; subject_id: string; subject_name: string }>;
};

type HomeworkRow = {
  id: string;
  title: string;
  subject: string | null;
  instructions: string | null;
  due_date: string;
  type: string | null;
  created_at: string;
  lesson_plan_id: string | null;
  teaching_occurrence_id: string | null;
  homework_submissions: Array<{ id: string }>;
};

type FormState = { title: string; subject: string; instructions: string; dueDate: string; type: string };
type LessonContext = { subject: string; occurrenceDate: string | null; startTime: string | null; endTime: string | null };

const EMPTY_FORM: FormState = { title: "", subject: "", instructions: "", dueDate: "", type: "homework" };
const INPUT_STYLE = {
  width: "100%",
  minHeight: 46,
  boxSizing: "border-box" as const,
  border: "1px solid #d1d5db",
  borderRadius: 11,
  padding: "10px 11px",
  fontSize: 16,
  lineHeight: 1.35,
  fontFamily: "inherit",
  color: "#111827",
  background: "#fff",
  caretColor: "#111827",
};

function draftKey(classId: string, schoolId: string | null, occurrenceId: string | null) {
  return `vibeschool:teacher:homework:${schoolId ?? "school"}:${classId}:${occurrenceId ?? "generic"}`;
}

function readDraft(key: string): FormState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as FormState : null;
  } catch { return null; }
}

function writeDraft(key: string, form: FormState) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(form)); } catch {}
}

function clearDraft(key: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(key); } catch {}
}

function HomeworkInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const classId = params.id;
  const sourceLessonPlanId = search.get("lessonPlanId")?.trim() || null;
  const sourceOccurrenceId = search.get("occurrenceId")?.trim() || null;
  const sourceSubjectId = search.get("subjectId")?.trim() || null;
  const sourceSubjectName = search.get("subject")?.trim() || "";
  const sourceTopic = search.get("topic")?.trim() || "";
  const lessonLinked = Boolean(sourceLessonPlanId || sourceOccurrenceId);

  const [context, setContext] = useState<Context | null>(null);
  const [lessonContext, setLessonContext] = useState<LessonContext | null>(null);
  const [list, setList] = useState<HomeworkRow[]>([]);
  const [rosterCount, setRosterCount] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(lessonLinked);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const submitInFlight = useRef(false);

  const assignment = useMemo(
    () => context?.classes.find((item) => item.class_id === classId && (!sourceSubjectId || item.subject_id === sourceSubjectId))
      ?? context?.classes.find((item) => item.class_id === classId)
      ?? null,
    [classId, context, sourceSubjectId],
  );
  const storageKey = useMemo(() => draftKey(classId, context?.school_id ?? null, sourceOccurrenceId), [classId, context?.school_id, sourceOccurrenceId]);
  const authoritativeSubject = lessonLinked ? (lessonContext?.subject || sourceSubjectName || assignment?.subject_name || "") : form.subject;
  const minimumDueDate = lessonContext?.occurrenceDate && lessonContext.occurrenceDate > nairobiDateStr() ? lessonContext.occurrenceDate : nairobiDateStr();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }
      const { data: contextData, error: contextError } = await supabase.rpc("teacher_get_operating_context");
      if (contextError) throw contextError;
      const ctx = contextData as unknown as Context;
      if (!ctx.school_id || !ctx.classes.some((item) => item.class_id === classId)) {
        router.replace("/teacher/classhub");
        return;
      }
      setContext(ctx);

      const [homeworkRes, rosterRes] = await Promise.all([
        supabase.from("homework").select("id,title,subject,instructions,due_date,type,created_at,lesson_plan_id,teaching_occurrence_id,homework_submissions(id)").eq("school_id", ctx.school_id).eq("class_id", classId).eq("teacher_id", auth.user.id).order("created_at", { ascending: false }),
        supabase.from("student_classes").select("student_id", { count: "exact", head: true }).eq("school_id", ctx.school_id).eq("class_id", classId).eq("is_current", true),
      ]);
      if (homeworkRes.error) throw homeworkRes.error;
      if (rosterRes.error) throw rosterRes.error;
      setList((homeworkRes.data ?? []) as HomeworkRow[]);
      setRosterCount(rosterRes.count ?? 0);

      let resolvedLesson: LessonContext | null = null;
      if (sourceOccurrenceId) {
        const { data: occurrence, error: occurrenceError } = await supabase
          .from("teaching_occurrences")
          .select("id,school_id,class_id,subject_id,teacher_id,occurrence_date,timetable_slots(start_time,end_time),subjects(name)")
          .eq("id", sourceOccurrenceId)
          .eq("teacher_id", auth.user.id)
          .eq("school_id", ctx.school_id)
          .eq("class_id", classId)
          .maybeSingle();
        if (occurrenceError) throw occurrenceError;
        if (!occurrence || (sourceSubjectId && occurrence.subject_id !== sourceSubjectId)) {
          throw new Error("The source teaching occurrence no longer matches this class and subject.");
        }
        const timetable = Array.isArray(occurrence.timetable_slots) ? occurrence.timetable_slots[0] : occurrence.timetable_slots;
        const subject = Array.isArray(occurrence.subjects) ? occurrence.subjects[0] : occurrence.subjects;
        resolvedLesson = {
          subject: subject?.name || sourceSubjectName || ctx.classes.find((item) => item.class_id === classId && item.subject_id === occurrence.subject_id)?.subject_name || "Subject",
          occurrenceDate: occurrence.occurrence_date,
          startTime: timetable?.start_time ?? null,
          endTime: timetable?.end_time ?? null,
        };
        setLessonContext(resolvedLesson);
      }

      const key = draftKey(classId, ctx.school_id, sourceOccurrenceId);
      const savedDraft = readDraft(key);
      const defaultSubject = resolvedLesson?.subject || sourceSubjectName || ctx.classes.find((item) => item.class_id === classId && (!sourceSubjectId || item.subject_id === sourceSubjectId))?.subject_name || "";
      if (savedDraft) {
        setForm({ ...savedDraft, subject: lessonLinked ? defaultSubject : savedDraft.subject });
      } else if (lessonLinked) {
        setForm({ ...EMPTY_FORM, subject: defaultSubject, title: sourceTopic ? `${sourceTopic} Homework` : "" });
      }
    } catch (loadError) {
      console.error("[ClassHomework] load", loadError);
      setError(loadError instanceof Error ? loadError.message : "Homework could not be loaded. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [classId, lessonLinked, router, sourceLessonPlanId, sourceOccurrenceId, sourceSubjectId, sourceSubjectName, sourceTopic]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (showForm && context?.school_id) writeDraft(storageKey, { ...form, subject: lessonLinked ? authoritativeSubject : form.subject }); }, [authoritativeSubject, context?.school_id, form, lessonLinked, showForm, storageKey]);

  async function createHomework() {
    if (submitInFlight.current || saving) return;
    setError(null);
    setSuccess(null);
    if (!context?.school_id || !assignment) {
      setError("Your active class assignment could not be verified.");
      return;
    }
    if (!form.title.trim() || !form.dueDate) {
      setError("Title and due date are required.");
      return;
    }
    if (form.dueDate < minimumDueDate) {
      setError(`Due date must be ${minimumDueDate} or later.`);
      return;
    }
    submitInFlight.current = true;
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError ?? new Error("not_authenticated");

      if (sourceOccurrenceId) {
        const { data: occurrence, error: occurrenceError } = await supabase.from("teaching_occurrences").select("id,school_id,class_id,subject_id,teacher_id").eq("id", sourceOccurrenceId).eq("teacher_id", auth.user.id).eq("school_id", context.school_id).eq("class_id", classId).maybeSingle();
        if (occurrenceError) throw occurrenceError;
        if (!occurrence || (sourceSubjectId && occurrence.subject_id !== sourceSubjectId)) throw new Error("The source teaching occurrence no longer matches this class and subject.");
      }

      const { data: created, error: createError } = await supabase.from("homework").insert({
        school_id: context.school_id,
        class_id: classId,
        teacher_id: auth.user.id,
        title: form.title.trim(),
        subject: lessonLinked ? authoritativeSubject : (form.subject.trim() || assignment.subject_name),
        instructions: form.instructions.trim(),
        due_date: form.dueDate,
        type: form.type,
        lesson_plan_id: sourceLessonPlanId,
        teaching_occurrence_id: sourceOccurrenceId,
      }).select("id").single();
      if (createError || !created?.id) throw createError ?? new Error("Homework insert returned no ID.");

      clearDraft(storageKey);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setSuccess("Homework assigned. Current enrolled learners can now access it.");
      await load();
    } catch (createError) {
      console.error("[ClassHomework] create", createError);
      writeDraft(storageKey, form);
      setError(createError instanceof Error ? createError.message : "Homework could not be created. Your draft is kept on this device.");
    } finally {
      submitInFlight.current = false;
      setSaving(false);
    }
  }

  async function deleteHomework(item: HomeworkRow) {
    if (deletingId) return;
    if (item.homework_submissions.length > 0) {
      setError("Homework with learner submissions cannot be deleted from the teacher app. Preserve the evidence and close it through the normal marking workflow.");
      return;
    }
    setDeletingId(item.id);
    setError(null);
    try {
      const { error: deleteError } = await supabase.from("homework").delete().eq("id", item.id);
      if (deleteError) throw deleteError;
      setList((current) => current.filter((row) => row.id !== item.id));
    } catch (deleteError) {
      console.error("[ClassHomework] delete", deleteError);
      setError("Homework could not be deleted.");
    } finally { setDeletingId(null); }
  }

  const classLabel = assignment ? `${assignment.class_name}${assignment.stream ? ` ${assignment.stream}` : ""}` : "Class";
  const lessonTime = lessonContext?.startTime && lessonContext?.endTime ? `${lessonContext.startTime.slice(0, 5)}–${lessonContext.endTime.slice(0, 5)}` : null;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 14px 112px", colorScheme: "light" }}>
      <section style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)", color: "#fff", borderRadius: 20, padding: 18, marginBottom: 12 }}>
        <button type="button" onClick={() => router.push(`/teacher/classhub/${classId}`)} style={{ minHeight: 38, border: 0, borderRadius: 10, background: "rgba(255,255,255,.15)", color: "#fff", padding: "0 11px", fontWeight: 900 }}>‹ Class</button>
        <h1 style={{ margin: "12px 0 3px", fontSize: 23 }}>Homework · {classLabel}</h1>
        <div style={{ fontSize: 12, opacity: .82 }}>{rosterCount} current learners · {list.length} assignments</div>
        <button type="button" onClick={() => setShowForm((value) => !value)} style={{ width: "100%", minHeight: 46, marginTop: 12, border: 0, borderRadius: 12, background: "#fff", color: "#0f766e", fontWeight: 900 }}>{showForm ? "Close form" : "Create homework / exercise"}</button>
      </section>

      {error && <div role="alert" style={{ background: "#fef2f2", color: "#991b1b", borderRadius: 14, padding: 13, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {success && <div role="status" style={{ background: "#ecfdf5", color: "#065f46", borderRadius: 14, padding: 13, marginBottom: 12, fontSize: 13 }}>{success}</div>}

      {showForm && <section style={{ background: "#fff", color: "#111827", borderRadius: 18, padding: 15, marginBottom: 12, boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}>
        {lessonLinked && <div style={{ background: "#eff6ff", color: "#1e40af", borderRadius: 12, padding: 11, marginBottom: 13, fontSize: 12, lineHeight: 1.45 }}>
          <strong style={{ display: "block", marginBottom: 2 }}>Linked lesson</strong>
          <span>{authoritativeSubject || "Subject"} · {classLabel}{lessonContext?.occurrenceDate ? ` · ${lessonContext.occurrenceDate}` : ""}{lessonTime ? ` · ${lessonTime}` : ""}</span>
          {sourceTopic && <span style={{ display: "block", marginTop: 2 }}>Topic: {sourceTopic}</span>}
        </div>}
        <div style={{ display: "grid", gap: 12 }}>
          <label><span style={{ display: "block", fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 6 }}>TITLE *</span><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} style={INPUT_STYLE} /></label>
          <label><span style={{ display: "block", fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 6 }}>SUBJECT</span><input value={lessonLinked ? authoritativeSubject : form.subject} onChange={(event) => !lessonLinked && setForm((current) => ({ ...current, subject: event.target.value }))} readOnly={lessonLinked} aria-readonly={lessonLinked} placeholder={assignment?.subject_name ?? "Subject"} style={{ ...INPUT_STYLE, background: lessonLinked ? "#f8fafc" : "#fff", color: lessonLinked ? "#475569" : "#111827" }} /></label>
          <label><span style={{ display: "block", fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 6 }}>INSTRUCTIONS</span><textarea rows={4} value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} style={{ ...INPUT_STYLE, minHeight: 110, resize: "vertical" }} /></label>
          <div className="homework-meta-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10 }}>
            <label style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 6 }}>DUE DATE *</span><input type="date" min={minimumDueDate} value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} style={INPUT_STYLE} /></label>
            <label style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 6 }}>TYPE</span><select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} style={{ ...INPUT_STYLE, appearance: "auto" }}><option value="homework">Homework</option><option value="exercise">Exercise</option><option value="quiz">Quiz</option><option value="assignment">Assignment</option><option value="project">Project</option></select></label>
          </div>
        </div>
        <button type="button" onClick={() => void createHomework()} disabled={saving} style={{ width: "100%", minHeight: 49, marginTop: 14, border: 0, borderRadius: 12, background: saving ? "#9ca3af" : "#111827", color: "#fff", fontWeight: 900 }}>{saving ? "Saving…" : "Assign learner work"}</button>
        <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280", lineHeight: 1.4 }}>Your unfinished form is retained for this exact {sourceOccurrenceId ? "lesson" : "class"} if the connection is interrupted.</div>
        <style jsx>{`@media (max-width: 430px) { .homework-meta-grid { grid-template-columns: 1fr !important; } }`}</style>
      </section>}

      {loading ? <div aria-label="Loading class homework" style={{ display: "grid", gap: 9 }}>{[1,2,3].map((item) => <div key={item} style={{ height: 96, borderRadius: 16, background: "#e5e7eb" }} />)}</div> : list.length === 0 ? (!showForm && <section style={{ background: "#fff", borderRadius: 18, padding: 28, textAlign: "center", color: "#6b7280", fontSize: 13 }}>No learner work assigned yet. Create one here or open this page from a lesson to preserve exact lesson lineage.</section>) : <div style={{ display: "grid", gap: 9 }}>{list.map((item) => {
        const submitted = item.homework_submissions.length;
        const percentage = rosterCount ? Math.round((submitted / rosterCount) * 100) : 0;
        return <section key={item.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 13, boxShadow: "0 1px 5px rgba(0,0,0,.04)" }}>
          <button type="button" onClick={() => router.push(`/teacher/classhub/${classId}/homework/${item.id}`)} style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", padding: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{item.title}</div><div style={{ marginTop: 3, fontSize: 10, color: "#6b7280" }}>{item.subject || assignment?.subject_name || "Subject"} · Due {item.due_date}</div></div><strong style={{ flexShrink: 0, fontSize: 11, color: "#0f766e" }}>{submitted}/{rosterCount}</strong></div>
            <div style={{ marginTop: 8, height: 5, borderRadius: 99, background: "#f3f4f6", overflow: "hidden" }}><div style={{ width: `${Math.min(100, percentage)}%`, height: "100%", background: "#0f766e" }} /></div>
            {item.teaching_occurrence_id && <div style={{ marginTop: 7, fontSize: 10, color: "#2563eb", fontWeight: 800 }}>Linked to taught lesson</div>}
          </button>
          <button type="button" onClick={() => void deleteHomework(item)} disabled={deletingId !== null} style={{ minHeight: 38, marginTop: 8, border: "1px solid #fecaca", borderRadius: 10, background: "#fff", color: "#991b1b", padding: "0 10px", fontSize: 10, fontWeight: 900 }}>{deletingId === item.id ? "Deleting…" : "Delete if no submissions"}</button>
        </section>;
      })}</div>}
    </div>
  );
}

export default function ClassHomeworkPage() {
  return <Suspense fallback={<div style={{ padding: 18 }}>Loading homework…</div>}><HomeworkInner /></Suspense>;
}
