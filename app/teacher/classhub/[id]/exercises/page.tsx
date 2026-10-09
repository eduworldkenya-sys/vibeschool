"use client";
export const dynamic = "force-dynamic";
import { C } from "@/components/teacher/ui";
import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { loadProgressAuthority, loadProgressRoster } from "@/lib/learner-intelligence/progress-data";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

interface Exercise {
  id:               string;
  title:            string;
  instructions:     string | null;
  duration_minutes: number | null;
  status:           string;
  created_at:       string;
  subject_id:       string | null;
  sub_count:        number;
  student_count:    number;
}
interface SubjectOpt { id: string; name: string; }

function ExercisesInner() {
  const router  = useRouter();
  const params  = useParams();
  const classId = params.id as string;

  const [list,      setList]      = useState<Exercise[]>([]);
  const [subjects,  setSubjects]  = useState<SubjectOpt[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error,     setError]     = useState("");
  const [classInfo, setClassInfo] = useState<{ name: string; stream: string; school_id: string | null } | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "", subject_id: "", instructions: "", duration_minutes: "",
  });

  async function load() {
    setLoading(true); setLoadError("");
    try {
      const authority = await loadProgressAuthority(classId);
      const [exRes, roster] = await Promise.all([
        supabase.from("exercises").select("*, exercise_submissions(id,student_id,status)").eq("class_id", classId).eq("school_id", authority.schoolId).order("created_at", { ascending: false }),
        loadProgressRoster(authority, false),
      ]);
      if (exRes.error) throw exRes.error;
      const currentIds = new Set(roster.map(learner => learner.id));
      setList((exRes.data ?? []).map(row => {
        const markedCount = new Set((row.exercise_submissions ?? []).filter(sub => sub.status === "marked" && typeof sub.student_id === "string" && currentIds.has(sub.student_id)).map(sub => sub.student_id)).size;
        return { id: row.id, title: row.title ?? "Untitled exercise", instructions: row.instructions,
          duration_minutes: null, subject_id: null, created_at: row.created_at, sub_count: markedCount,
          student_count: roster.length, status: roster.length > 0 && markedCount === roster.length ? "completed" : "active" };
      }));
      setClassInfo({ name: authority.className, stream: "", school_id: authority.schoolId });
      setSubjects(authority.subjects);
    } catch (failure) {
      setLoadError(failure instanceof Error ? failure.message : "Exercises could not be loaded. Try again.");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [classId]);

  async function handleSubmit() {
    setError("");
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }

    const duration = form.duration_minutes.trim() ? Number(form.duration_minutes) : null;
    if (duration !== null && (!Number.isInteger(duration) || duration <= 0)) { setError("Enter a positive whole number of minutes."); return; }
    setSaving(true);
    try {
      const authority = await loadProgressAuthority(classId);
      const subject = authority.subjects.find(item => item.id === form.subject_id);
      if (form.subject_id && !subject) throw new Error("Select a subject assigned to you in this class.");
      const instructions = [subject ? `Subject: ${subject.name}` : null, duration !== null ? `Planned duration: ${duration} minutes` : null, form.instructions.trim() || null].filter(Boolean).join("\n\n");
      const response = await supabase.from("exercises").insert({
        class_id: classId, teacher_id: authority.teacherId, school_id: authority.schoolId,
        title: form.title.trim(), instructions: instructions || null,
      }).select("id").single();
      if (response.error) throw response.error;
      if (!response.data) throw new Error("The saved exercise could not be confirmed. Your input is kept; try again.");
      setForm({ title: "", subject_id: "", instructions: "", duration_minutes: "" });
      setShowForm(false); await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The exercise could not be saved. Your input is kept; try again.");
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this exercise? This cannot be undone.")) return;
    setDeleting(id); setError("");
    try {
      const authority = await loadProgressAuthority(classId);
      const submissions = await supabase.from("exercise_submissions").delete().eq("exercise_id", id);
      if (submissions.error) throw submissions.error;
      const response = await supabase.from("exercises").delete().eq("id", id).eq("class_id", classId).eq("school_id", authority.schoolId).select("id").single();
      if (response.error) throw response.error;
      if (!response.data) throw new Error("Exercise deletion could not be confirmed.");
      setList(previous => previous.filter(item => item.id !== id));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The exercise could not be deleted. Try again.");
    } finally { setDeleting(null); }
  }

  const inp: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, color: C.textPrimary, outline: "none", fontFamily: "inherit", background: "#f9fafb", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, display: "block" };

  const active    = list.filter(e => e.status === "active").length;
  const completed = list.filter(e => e.status === "completed").length;

  if (loadError) return <div role="alert" style={{padding:24}}><h1>Exercises unavailable</h1><p>{loadError}</p><button type="button" onClick={() => void load()} style={{minHeight:44}}>Try again</button></div>;

  return (
    <div style={{ fontFamily: "inherit", fontSize: 13, color: C.textMuted, paddingBottom: 80, background: C.surface, minHeight: "100%" }}>

      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 16px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button aria-label="Back to class" onClick={() => router.back()} style={{ background: C.surface, border: "none", borderRadius: 10, width: 44, height: 44, color: C.textPrimary, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 750, color: C.textPrimary, margin: 0 }}>Exercises</h1>
              <p style={{ fontSize: 12, color: C.textMuted, margin: "2px 0 0" }}>
                {classInfo ? `${classInfo.name}${classInfo.stream ? " · " + classInfo.stream : ""}` : ""}
              </p>
            </div>
          </div>
          <button onClick={() => setShowForm(v => !v)} style={{ minHeight: 44, padding: "8px 16px", borderRadius: 10, border: "none", background: C.surface, color: C.textPrimary, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {showForm ? "Cancel" : "+ New"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Total",     value: list.length },
            { label: "In progress",    value: active },
            { label: "All marked", value: completed },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: C.surface, borderRadius: 10, padding: "8px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary }}>{s.value}</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {!showForm && error && <p role="alert" style={{color:C.error}}>{error}</p>}
        {showForm && (
          <div style={{ background: "#fff", borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px" }}>New Exercise</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={lbl}>Title *</label><input aria-label="Exercise title" style={inp} placeholder="e.g. Fraction word problems, Set A" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <p style={{margin:0,lineHeight:1.5}}>Subject and planned duration are saved with the instructions.</p>
              <div><label style={lbl}>Subject</label>
                <select aria-label="Subject" style={inp} value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}>
                  <option value="">-- Select subject --</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Instructions</label><textarea aria-label="Instructions" style={{ ...inp, minHeight: 80, resize: "vertical" }} placeholder="What should learners do in class?" value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} /></div>
              <div><label style={lbl}>Duration (minutes)</label><input aria-label="Duration in minutes" min="1" step="1" style={inp} type="number" placeholder="e.g. 15" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} /></div>
            </div>
            {error && <p role="alert" style={{ color: C.error, fontSize: 12, marginTop: 10 }}>{error}</p>}
            <button onClick={handleSubmit} disabled={saving} style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: 12, border: "none", background: saving ? "#bae6fd" : "#075985", color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {saving ? "Saving…" : "Create Exercise"}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.textMuted }}>Loading…</div>
        ) : list.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 20, padding: "32px 20px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📐</div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, margin: "0 0 8px" }}>No exercises yet</h2>
            <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 20px", lineHeight: 1.5 }}>Create in-class practice — track who finished, right after the lesson.</p>
            <button onClick={() => setShowForm(true)} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: "#075985", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+ Create First Exercise</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {list.map(e => {
              const pct = e.student_count > 0 ? Math.round((e.sub_count / e.student_count) * 100) : 0;
              return (
                <div key={e.id} style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${e.status === "completed" ? "#0369a1" : "#f59e0b"}`, overflow: "hidden" }}>
                  <Link href={`/teacher/classhub/${classId}/exercises/${e.id}`} style={{ display: "block", textDecoration: "none", color: "inherit", padding: "14px 16px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, margin: 0 }}>{e.title}</p>
                        {e.instructions && <p style={{ fontSize: 12, color: C.textMuted, margin: "6px 0 0", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{e.instructions}</p>}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 20, background: e.status === "completed" ? "#e0f2fe" : "#fef3c7", color: e.status === "completed" ? "#075985" : "#92400e" }}>
                          {e.status === "completed" ? "All learners marked" : "In progress"}
                        </span>
                        {e.duration_minutes && <p style={{ fontSize: 11, color: C.textMuted, margin: "4px 0 0", fontWeight: 600 }}>{e.duration_minutes} min</p>}
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: C.textMuted }}>
                          {subjects.find(s => s.id === e.subject_id)?.name ?? "Class exercise"}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: e.sub_count > 0 ? "#075985" : C.textMuted }}>
                          {e.sub_count}/{e.student_count} marked done
                        </span>
                      </div>
                      <div style={{ height: 4, borderRadius: 99, background: "#f3f4f6", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "#0369a1", borderRadius: 99, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  </Link>
                  <div style={{ display: "flex", borderTop: "1px solid #f3f4f6" }}>
                    <button
                      onClick={() => handleDelete(e.id)}
                      disabled={deleting === e.id}
                      style={{ flex: 1, minHeight: 44, padding: "9px", border: "none", background: "none", color: deleting === e.id ? C.textMuted : C.error, fontWeight: 700, fontSize: 12, cursor: deleting === e.id ? "wait" : "pointer", fontFamily: "inherit" }}
                    >
                      {deleting === e.id ? "Deleting…" : "🗑 Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExercisesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, color: "var(--teacher-muted, #627168)" }}>Loading…</div>}>
      <ExercisesInner />
    </Suspense>
  );
}
