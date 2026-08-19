"use client";

export const dynamic = "force-dynamic";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { saveTeachingProgressRecord, TeachingProgressError } from "@/lib/teaching/progress";

type Context = {
  teacher_id: string;
  school_id: string | null;
  state: "ready" | "needs_school" | "needs_class";
  schools: Array<{ id: string; name: string; active: boolean }>;
};

type ProgressRow = {
  id: string;
  teaching_occurrence_id: string | null;
  lesson_plan_id: string | null;
  taught_date: string;
  what_was_taught: string;
  participation_score: number | null;
  challenges: string | null;
  homework_set: string | null;
  teacher_remarks: string | null;
  next_steps: string | null;
  class_id: string | null;
  subject_id: string | null;
  classes: { name: string; stream: string | null } | null;
  subjects: { name: string } | null;
};

type OccurrenceContext = {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  occurrence_date: string;
  lifecycle: string;
  classes: { name: string; stream: string | null } | null;
  subjects: { name: string } | null;
};

type FormState = {
  whatWasTaught: string;
  participationScore: string;
  challenges: string;
  homeworkSet: string;
  teacherRemarks: string;
  nextSteps: string;
};

const EMPTY_FORM: FormState = {
  whatWasTaught: "",
  participationScore: "",
  challenges: "",
  homeworkSet: "",
  teacherRemarks: "",
  nextSteps: "",
};

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function messageFor(error: unknown) {
  if (error instanceof TeachingProgressError) {
    if (error.code === "occurrence_not_completed") return "Complete the lesson before recording progress.";
    if (error.code === "occurrence_not_owned") return "This teaching occurrence is not assigned to you.";
    if (error.code === "lesson_plan_not_found") return "The exact lesson plan for this teaching occurrence could not be found.";
    if (error.code === "not_authenticated") return "Your session has expired. Sign in again.";
    return error.message;
  }
  return error instanceof Error ? error.message : "The progress record could not be saved.";
}

function ProgressInner() {
  const router = useRouter();
  const search = useSearchParams();
  const occurrenceId = search.get("occurrenceId")?.trim() || null;
  const [context, setContext] = useState<Context | null>(null);
  const [occurrence, setOccurrence] = useState<OccurrenceContext | null>(null);
  const [records, setRecords] = useState<ProgressRow[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadContext = useCallback(async (requestedSchoolId?: string | null) => {
    const { data, error: contextError } = await supabase.rpc("teacher_get_operating_context", {
      p_requested_school_id: requestedSchoolId ?? undefined,
    });
    if (contextError) throw contextError;
    return data as unknown as Context;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }
      const ctx = await loadContext();
      setContext(ctx);
      if (!ctx.school_id) {
        setRecords([]);
        return;
      }

      const db = supabase as any;
      const recordsRes = await db
        .from("progress_records")
        .select("id,teaching_occurrence_id,lesson_plan_id,taught_date,what_was_taught,participation_score,challenges,homework_set,teacher_remarks,next_steps,class_id,subject_id,classes(name,stream),subjects(name)")
        .eq("teacher_id", auth.user.id)
        .eq("school_id", ctx.school_id)
        .not("teaching_occurrence_id", "is", null)
        .order("taught_date", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(100);
      if (recordsRes.error) throw recordsRes.error;
      setRecords((recordsRes.data ?? []) as ProgressRow[]);

      if (occurrenceId) {
        const occurrenceRes = await db
          .from("teaching_occurrences")
          .select("id,school_id,class_id,subject_id,occurrence_date,lifecycle,classes(name,stream),subjects(name)")
          .eq("id", occurrenceId)
          .eq("teacher_id", auth.user.id)
          .eq("school_id", ctx.school_id)
          .maybeSingle();
        if (occurrenceRes.error) throw occurrenceRes.error;
        if (!occurrenceRes.data) throw new Error("Teaching occurrence not found in your active school.");
        const exact = occurrenceRes.data as OccurrenceContext;
        setOccurrence(exact);
        if (exact.lifecycle !== "completed") {
          setError("Complete the lesson before recording its progress note.");
        }
        const existing = (recordsRes.data ?? []).find((row: ProgressRow) => row.teaching_occurrence_id === occurrenceId);
        if (existing) {
          setForm({
            whatWasTaught: existing.what_was_taught ?? "",
            participationScore: existing.participation_score ? String(existing.participation_score) : "",
            challenges: existing.challenges ?? "",
            homeworkSet: existing.homework_set ?? "",
            teacherRemarks: existing.teacher_remarks ?? "",
            nextSteps: existing.next_steps ?? "",
          });
        }
      } else {
        setOccurrence(null);
      }
    } catch (loadError) {
      console.error("[TeacherProgress] load", loadError);
      setError(messageFor(loadError));
    } finally {
      setLoading(false);
    }
  }, [loadContext, occurrenceId, router]);

  useEffect(() => { void load(); }, [load]);

  async function changeSchool(schoolId: string) {
    if (!schoolId || schoolId === context?.school_id) return;
    setLoading(true);
    setError(null);
    try {
      const { error: setError } = await supabase.rpc("teacher_set_active_school", { p_school_id: schoolId });
      if (setError) throw setError;
      const ctx = await loadContext(schoolId);
      setContext(ctx);
      setOccurrence(null);
      router.replace("/teacher/progress");
    } catch (schoolError) {
      console.error("[TeacherProgress] school", schoolError);
      setError("That school could not be selected.");
    } finally {
      setLoading(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!occurrenceId || !occurrence || occurrence.lifecycle !== "completed" || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const score = form.participationScore ? Number(form.participationScore) : null;
      if (score !== null && (!Number.isInteger(score) || score < 1 || score > 5)) {
        throw new Error("Participation must be between 1 and 5.");
      }
      await saveTeachingProgressRecord({
        occurrenceId,
        whatWasTaught: form.whatWasTaught.trim(),
        participationScore: score,
        challenges: clean(form.challenges),
        homeworkSet: clean(form.homeworkSet),
        teacherRemarks: clean(form.teacherRemarks),
        nextSteps: clean(form.nextSteps),
      });
      setSuccess("Lesson progress saved against the completed teaching occurrence.");
      await load();
    } catch (saveError) {
      console.error("[TeacherProgress] save", saveError);
      setError(messageFor(saveError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 18 }} aria-label="Loading lesson progress"><div style={{ height: 150, borderRadius: 18, background: "#e5e7eb" }} /></div>;

  const activeSchool = context?.schools.find((school) => school.id === context.school_id)?.name ?? "No active school";

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 14px 112px" }}>
      <section style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)", color: "#fff", borderRadius: 20, padding: 18, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", opacity: .72, letterSpacing: 1 }}>Teaching evidence</div>
        <h1 style={{ margin: "4px 0", fontSize: 23 }}>Lesson progress & next steps</h1>
        <div style={{ fontSize: 12, opacity: .78 }}>Only completed teaching occurrences can create or update progress records.</div>
        {context && context.schools.length > 1 && (
          <select value={context.school_id ?? ""} onChange={(event) => void changeSchool(event.target.value)} style={{ marginTop: 12, width: "100%", minHeight: 44, border: 0, borderRadius: 12, padding: "0 12px", background: "#fff", color: "#111827", fontWeight: 800 }}>
            {context.schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
        )}
      </section>

      {error && <div role="alert" style={{ borderRadius: 14, background: "#fef2f2", color: "#991b1b", padding: 13, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {success && <div role="status" style={{ borderRadius: 14, background: "#ecfdf5", color: "#065f46", padding: 13, marginBottom: 12, fontSize: 13, fontWeight: 800 }}>{success}</div>}

      {context?.state === "needs_school" ? (
        <section style={{ background: "#fff", borderRadius: 18, padding: 28, textAlign: "center" }}><h2 style={{ margin: 0, fontSize: 17 }}>Connect a school first</h2><p style={{ color: "#6b7280", fontSize: 13 }}>Teaching evidence is always school-scoped.</p><button type="button" onClick={() => router.push("/teacher/onboarding/school")} style={{ minHeight: 44, border: 0, borderRadius: 12, background: "#111827", color: "#fff", padding: "0 16px", fontWeight: 900 }}>Connect school</button></section>
      ) : occurrence ? (
        <form onSubmit={save} style={{ background: "#fff", borderRadius: 18, padding: 15, marginBottom: 12, boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280" }}>COMPLETED LESSON</div>
          <h2 style={{ margin: "5px 0 3px", fontSize: 17, color: "#111827" }}>{occurrence.subjects?.name ?? "Subject"} · {occurrence.classes?.name ?? "Class"}{occurrence.classes?.stream ? ` ${occurrence.classes.stream}` : ""}</h2>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 13 }}>{occurrence.occurrence_date} · {activeSchool}</div>
          <div style={{ display: "grid", gap: 11 }}>
            <label><span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#6b7280", marginBottom: 5 }}>WHAT WAS TAUGHT *</span><textarea required rows={4} value={form.whatWasTaught} onChange={(event) => setForm((current) => ({ ...current, whatWasTaught: event.target.value }))} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 12, padding: 11, resize: "vertical" }} /></label>
            <label><span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#6b7280", marginBottom: 5 }}>LEARNER PARTICIPATION (1–5)</span><input type="number" min={1} max={5} value={form.participationScore} onChange={(event) => setForm((current) => ({ ...current, participationScore: event.target.value }))} style={{ width: "100%", minHeight: 44, boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 12, padding: "0 11px" }} /></label>
            <label><span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#6b7280", marginBottom: 5 }}>WHAT LEARNERS STRUGGLED WITH</span><textarea rows={3} value={form.challenges} onChange={(event) => setForm((current) => ({ ...current, challenges: event.target.value }))} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 12, padding: 11 }} /></label>
            <label><span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#6b7280", marginBottom: 5 }}>HOMEWORK / EXERCISE SET</span><textarea rows={2} value={form.homeworkSet} onChange={(event) => setForm((current) => ({ ...current, homeworkSet: event.target.value }))} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 12, padding: 11 }} /></label>
            <label><span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#6b7280", marginBottom: 5 }}>TEACHER REFLECTION</span><textarea rows={3} value={form.teacherRemarks} onChange={(event) => setForm((current) => ({ ...current, teacherRemarks: event.target.value }))} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 12, padding: 11 }} /></label>
            <label><span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#6b7280", marginBottom: 5 }}>NEXT ACTION / REMEDIATION / ENRICHMENT</span><textarea rows={3} value={form.nextSteps} onChange={(event) => setForm((current) => ({ ...current, nextSteps: event.target.value }))} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 12, padding: 11 }} /></label>
          </div>
          <button type="submit" disabled={saving || occurrence.lifecycle !== "completed"} style={{ width: "100%", minHeight: 49, marginTop: 13, border: 0, borderRadius: 12, background: saving ? "#9ca3af" : "#111827", color: "#fff", fontWeight: 900 }}>{saving ? "Saving…" : "Save lesson progress"}</button>
        </form>
      ) : (
        <section style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 16, padding: 14, marginBottom: 12, color: "#1e40af", fontSize: 13, lineHeight: 1.5 }}>
          To create a progress record, open a completed lesson from the Teaching Desk and choose <strong>Progress</strong>. This prevents disconnected or duplicate teacher records.
          <div><button type="button" onClick={() => router.push("/teacher/teach-today")} style={{ marginTop: 10, minHeight: 42, border: 0, borderRadius: 11, background: "#1d4ed8", color: "#fff", padding: "0 14px", fontWeight: 900 }}>Open Teaching Desk</button></div>
        </section>
      )}

      <section style={{ background: "#fff", borderRadius: 18, padding: 15, boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 11 }}><div><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280" }}>RECENT COMPLETED LESSON RECORDS</div><div style={{ marginTop: 3, fontSize: 11, color: "#9ca3af" }}>{activeSchool}</div></div><span style={{ fontSize: 12, fontWeight: 900, color: "#1d4ed8" }}>{records.length}</span></div>
        {records.length === 0 ? <div style={{ padding: "22px 4px", color: "#6b7280", fontSize: 13, textAlign: "center" }}>No completed lesson progress records yet.</div> : <div style={{ display: "grid", gap: 9 }}>{records.map((row) => <button key={row.id} type="button" onClick={() => row.teaching_occurrence_id && router.push(`/teacher/progress?occurrenceId=${encodeURIComponent(row.teaching_occurrence_id)}`)} style={{ width: "100%", textAlign: "left", border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff", padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>{row.subjects?.name ?? "Subject"} · {row.classes?.name ?? "Class"}{row.classes?.stream ? ` ${row.classes.stream}` : ""}</div><div style={{ marginTop: 3, fontSize: 11, color: "#6b7280" }}>{row.taught_date}</div></div>{row.participation_score && <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 900, color: "#1d4ed8" }}>{row.participation_score}/5</span>}</div><div style={{ marginTop: 8, fontSize: 12, color: "#374151", lineHeight: 1.45 }}>{row.what_was_taught}</div>{row.next_steps && <div style={{ marginTop: 7, fontSize: 11, color: "#92400e" }}>Next: {row.next_steps}</div>}</button>)}</div>}
      </section>
    </div>
  );
}

export default function ProgressPage() {
  return <Suspense fallback={<div style={{ padding: 18 }}>Loading lesson progress…</div>}><ProgressInner /></Suspense>;
}
