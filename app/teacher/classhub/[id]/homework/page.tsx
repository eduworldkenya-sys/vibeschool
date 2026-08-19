"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
const EMPTY_FORM: FormState = { title: "", subject: "", instructions: "", dueDate: "", type: "general" };

function draftKey(classId: string) { return `vibeschool:teacher:homework:${classId}`; }

function readDraft(classId: string): FormState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(classId));
    return raw ? JSON.parse(raw) as FormState : null;
  } catch { return null; }
}

function writeDraft(classId: string, form: FormState) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(draftKey(classId), JSON.stringify(form)); } catch {}
}

function clearDraft(classId: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(draftKey(classId)); } catch {}
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

  const [context, setContext] = useState<Context | null>(null);
  const [list, setList] = useState<HomeworkRow[]>([]);
  const [rosterCount, setRosterCount] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(Boolean(sourceLessonPlanId || sourceOccurrenceId));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const submitInFlight = useRef(false);

  const assignment = useMemo(() => context?.classes.find((item) => item.class_id === classId && (!sourceSubjectId || item.subject_id === sourceSubjectId)) ?? context?.classes.find((item) => item.class_id === classId) ?? null, [classId, context, sourceSubjectId]);

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

      const savedDraft = readDraft(classId);
      if (savedDraft) setForm(savedDraft);
      else if (sourceLessonPlanId || sourceOccurrenceId) {
        const defaultSubject = sourceSubjectName || ctx.classes.find((item) => item.class_id === classId && (!sourceSubjectId || item.subject_id === sourceSubjectId))?.subject_name || "";
        setForm({ ...EMPTY_FORM, subject: defaultSubject, title: sourceTopic ? `${sourceTopic} Homework` : "" });
      }
    } catch (loadError) {
      console.error("[ClassHomework] load", loadError);
      setError("Homework could not be loaded. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [classId, router, sourceLessonPlanId, sourceOccurrenceId, sourceSubjectId, sourceSubjectName, sourceTopic]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (showForm) writeDraft(classId, form); }, [classId, form, showForm]);

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
    submitInFlight.current = true;
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError ?? new Error("not_authenticated");

      if (sourceOccurrenceId) {
        const { data: occurrence, error: occurrenceError } = await supabase
          .from("teaching_occurrences")
          .select("id,school_id,class_id,subject_id,teacher_id")
          .eq("id", sourceOccurrenceId)
          .eq("teacher_id", auth.user.id)
          .eq("school_id", context.school_id)
          .eq("class_id", classId)
          .maybeSingle();
        if (occurrenceError) throw occurrenceError;
        if (!occurrence || (sourceSubjectId && occurrence.subject_id !== sourceSubjectId)) {
          throw new Error("The source teaching occurrence no longer matches this class and subject.");
        }
      }

      const { data: created, error: createError } = await supabase
        .from("homework")
        .insert({
          school_id: context.school_id,
          class_id: classId,
          teacher_id: auth.user.id,
          title: form.title.trim(),
          subject: form.subject.trim() || assignment.subject_name,
          instructions: form.instructions.trim(),
          due_date: form.dueDate,
          type: form.type,
          lesson_plan_id: sourceLessonPlanId,
          teaching_occurrence_id: sourceOccurrenceId,
        })
        .select("id")
        .single();
      if (createError || !created?.id) throw createError ?? new Error("Homework insert returned no ID.");

      clearDraft(classId);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setSuccess("Homework assigned. Current enrolled learners will see it through the homework access policy.");
      await load();
    } catch (createError) {
      console.error("[ClassHomework] create", createError);
      writeDraft(classId, form);
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
    } finally {
      setDeletingId(null);
    }
  }

  const classLabel = assignment ? `${assignment.class_name}${assignment.stream ? ` ${assignment.stream}` : ""}` : "Class";

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 14px 112px" }}>
      <section style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)", color: "#fff", borderRadius: 20, padding: 18, marginBottom: 12 }}>
        <button type="button" onClick={() => router.push(`/teacher/classhub/${classId}`)} style={{ minHeight: 38, border: 0, borderRadius: 10, background: "rgba(255,255,255,.15)", color: "#fff", padding: "0 11px", fontWeight: 900 }}>‹ Class</button>
        <h1 style={{ margin: "12px 0 3px", fontSize: 23 }}>Homework · {classLabel}</h1>
        <div style={{ fontSize: 12, opacity: .78 }}>{rosterCount} current learners · {list.length} assignments</div>
        <button type="button" onClick={() => setShowForm((value) => !value)} style={{ width: "100%", minHeight: 46, marginTop: 12, border: 0, borderRadius: 12, background: "#fff", color: "#0f766e", fontWeight: 900 }}>{showForm ? "Close form" : "Create homework / exercise"}</button>
      </section>

      {error && <div role="alert" style={{ background: "#fef2f2", color: "#991b1b", borderRadius: 14, padding: 13, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {success && <div role="status" style={{ background: "#ecfdf5", color: "#065f46", borderRadius: 14, padding: 13, marginBottom: 12, fontSize: 13 }}>{success}</div>}

      {showForm && <section style={{ background: "#fff", borderRadius: 18, padding: 15, marginBottom: 12, boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}>
        {(sourceLessonPlanId || sourceOccurrenceId) && <div style={{ background: "#eff6ff", color: "#1e40af", borderRadius: 12, padding: 10, marginBottom: 11, fontSize: 11 }}>Linked to the lesson you opened. Class, school and teaching occurrence are verified before save.</div>}
        <div style={{ display: "grid", gap: 10 }}>
          <label><span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#6b7280", marginBottom: 5 }}>TITLE *</span><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} style={{ width: "100%", minHeight: 45, boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 11, padding: "0 11px" }} /></label>
          <label><span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#6b7280", marginBottom: 5 }}>SUBJECT</span><input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder={assignment?.subject_name ?? "Subject"} style={{ width: "100%", minHeight: 45, boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 11, padding: "0 11px" }} /></label>
          <label><span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#6b7280", marginBottom: 5 }}>INSTRUCTIONS</span><textarea rows={4} value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 11, padding: 11, resize: "vertical" }} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><label><span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#6b7280", marginBottom: 5 }}>DUE DATE *</span><input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} style={{ width: "100%", minHeight: 45, boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 11, padding: "0 9px" }} /></label><label><span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#6b7280", marginBottom: 5 }}>TYPE</span><select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} style={{ width: "100%", minHeight: 45, border: "1px solid #d1d5db", borderRadius: 11, padding: "0 9px", background: "#fff" }}><option value="general">General</option><option value="exercise">Exercise</option><option value="assignment">Assignment</option><option value="project">Project</option></select></label></div>
        </div>
        <button type="button" onClick={() => void createHomework()} disabled={saving} style={{ width: "100%", minHeight: 49, marginTop: 13, border: 0, borderRadius: 12, background: saving ? "#9ca3af" : "#111827", color: "#fff", fontWeight: 900 }}>{saving ? "Saving…" : "Assign homework"}</button>
        <div style={{ marginTop: 7, fontSize: 10, color: "#6b7280" }}>Your unfinished form is retained locally if the connection is interrupted.</div>
      </section>}

      {loading ? <div aria-label="Loading class homework" style={{ display: "grid", gap: 9 }}>{[1,2,3].map((item) => <div key={item} style={{ height: 96, borderRadius: 16, background: "#e5e7eb" }} />)}</div> : list.length === 0 ? <section style={{ background: "#fff", borderRadius: 18, padding: 28, textAlign: "center", color: "#6b7280", fontSize: 13 }}>No homework assigned yet. Create one here or open Homework from a lesson to preserve lesson lineage.</section> : <div style={{ display: "grid", gap: 9 }}>{list.map((item) => { const submitted = item.homework_submissions.length; const percentage = rosterCount ? Math.round((submitted / rosterCount) * 100) : 0; return <section key={item.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 13, boxShadow: "0 1px 5px rgba(0,0,0,.04)" }}><button type="button" onClick={() => router.push(`/teacher/classhub/${classId}/homework/${item.id}`)} style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", padding: 0 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{item.title}</div><div style={{ marginTop: 3, fontSize: 10, color: "#6b7280" }}>{item.subject || assignment?.subject_name || "Subject"} · Due {item.due_date}</div></div><strong style={{ flexShrink: 0, fontSize: 11, color: "#0f766e" }}>{submitted}/{rosterCount}</strong></div><div style={{ marginTop: 8, height: 5, borderRadius: 99, background: "#f3f4f6", overflow: "hidden" }}><div style={{ width: `${Math.min(100, percentage)}%`, height: "100%", background: "#0f766e" }} /></div>{item.teaching_occurrence_id && <div style={{ marginTop: 7, fontSize: 10, color: "#2563eb", fontWeight: 800 }}>Linked to taught lesson</div>}</button><button type="button" onClick={() => void deleteHomework(item)} disabled={deletingId !== null} style={{ minHeight: 38, marginTop: 8, border: "1px solid #fecaca", borderRadius: 10, background: "#fff", color: "#991b1b", padding: "0 10px", fontSize: 10, fontWeight: 900 }}>{deletingId === item.id ? "Deleting…" : "Delete if no submissions"}</button></section>})}</div>}
    </div>
  );
}

export default function ClassHomeworkPage() {
  return <Suspense fallback={<div style={{ padding: 18 }}>Loading homework…</div>}><HomeworkInner /></Suspense>;
}
