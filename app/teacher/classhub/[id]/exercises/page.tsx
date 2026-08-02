"use client";
export const dynamic = "force-dynamic";
import { C } from "@/components/teacher/ui";
import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
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
  const [error,     setError]     = useState("");
  const [classInfo, setClassInfo] = useState<{ name: string; stream: string; school_id: string | null } | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "", subject_id: "", instructions: "", duration_minutes: "",
  });

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [exRes, clsRes, subjRes] = await Promise.all([
      supabase.from("exercises").select("*, exercise_submissions(id)").eq("class_id", classId).order("created_at", { ascending: false }),
      supabase.from("classes").select("name, stream, school_id").eq("id", classId).single(),
      supabase.from("subjects").select("id, name").order("name"),
    ]);

    const { data: studentClassRows } = await supabase
      .from("student_classes")
      .select("student_id")
      .eq("class_id", classId)
      .eq("is_current", true);

    const studentCount = (studentClassRows ?? []).length;

    const exList: Exercise[] = (exRes.data ?? []).map(row => ({
      id: row.id,
      title: row.title ?? "Untitled exercise",
      instructions: row.instructions,
      duration_minutes: null,
      status: "active",
      created_at: row.created_at,
      subject_id: null,
      sub_count: (row.exercise_submissions ?? []).length,
      student_count: studentCount,
    }));

    setList(exList);

    setClassInfo(
      clsRes.data
        ? {
            name: clsRes.data.name,
            stream: clsRes.data.stream ?? "",
            school_id: clsRes.data.school_id,
          }
        : null
    );

    setSubjects(subjRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [classId]);

  async function handleSubmit() {
    setError("");
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }

    if (!classInfo?.school_id) {
      setError("This class has no school identity.");
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      setError("Your session has expired.");
      return;
    }

    const { error: err } = await supabase
      .from("exercises")
      .insert({
        class_id: classId,
        teacher_id: user.id,
        school_id: classInfo.school_id,
        title: form.title.trim(),
        instructions: form.instructions.trim() || null,
      });
    setSaving(false);
    if (err) { setError(err.message); return; }

    setForm({ title: "", subject_id: "", instructions: "", duration_minutes: "" });
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this exercise? This cannot be undone.")) return;
    setDeleting(id);
    await supabase.from("exercise_submissions").delete().eq("exercise_id", id);
    await supabase.from("exercises").delete().eq("id", id);
    setList(l => l.filter(e => e.id !== id));
    setDeleting(null);
  }

  const inp: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, color: C.textPrimary, outline: "none", fontFamily: "inherit", background: "#f9fafb", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, display: "block" };

  const active    = list.filter(e => e.status === "active").length;
  const completed = list.filter(e => e.status === "completed").length;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 80, background: C.surface, minHeight: "100%" }}>

      <div style={{ background: "linear-gradient(135deg, #075985 0%, #0369a1 100%)", padding: "20px 16px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, width: 36, height: 36, color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>Exercises</h1>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", margin: "2px 0 0" }}>
                {classInfo ? `${classInfo.name}${classInfo.stream ? " · " + classInfo.stream : ""}` : ""}
              </p>
            </div>
          </div>
          <button onClick={() => setShowForm(v => !v)} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: showForm ? "rgba(255,255,255,0.2)" : "#fff", color: showForm ? "#fff" : "#075985", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {showForm ? "Cancel" : "+ New"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Total",     value: list.length },
            { label: "Active",    value: active },
            { label: "Completed", value: completed },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {showForm && (
          <div style={{ background: "#fff", borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px" }}>New Exercise</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={lbl}>Title *</label><input style={inp} placeholder="e.g. Fraction word problems, Set A" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><label style={lbl}>Subject</label>
                <select style={inp} value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}>
                  <option value="">-- Select subject --</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Instructions</label><textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} placeholder="What should learners do in class?" value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} /></div>
              <div><label style={lbl}>Duration (minutes)</label><input style={inp} type="number" placeholder="e.g. 15" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} /></div>
            </div>
            {error && <p style={{ color: C.error, fontSize: 12, marginTop: 10 }}>{error}</p>}
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
                  <div onClick={() => router.push(`/teacher/classhub/${classId}/exercises/${e.id}`)} style={{ padding: "14px 16px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, margin: 0 }}>{e.title}</p>
                        {e.instructions && <p style={{ fontSize: 12, color: C.textMuted, margin: "6px 0 0", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{e.instructions}</p>}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 20, background: e.status === "completed" ? "#e0f2fe" : "#fef3c7", color: e.status === "completed" ? "#075985" : "#92400e" }}>
                          {e.status}
                        </span>
                        {e.duration_minutes && <p style={{ fontSize: 11, color: C.textMuted, margin: "4px 0 0", fontWeight: 600 }}>{e.duration_minutes} min</p>}
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: C.textMuted }}>
                          {subjects.find(s => s.id === e.subject_id)?.name ?? "General"}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: e.sub_count > 0 ? "#075985" : C.textMuted }}>
                          {e.sub_count}/{e.student_count} completed
                        </span>
                      </div>
                      <div style={{ height: 4, borderRadius: 99, background: "#f3f4f6", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "#0369a1", borderRadius: 99, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", borderTop: "1px solid #f3f4f6" }}>
                    <button
                      onClick={() => handleDelete(e.id)}
                      disabled={deleting === e.id}
                      style={{ flex: 1, padding: "9px", border: "none", background: "none", color: deleting === e.id ? C.textMuted : "#ef4444", fontWeight: 700, fontSize: 12, cursor: deleting === e.id ? "wait" : "pointer", fontFamily: "inherit" }}
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
    <Suspense fallback={<div style={{ padding: 20, color: "#6b7280" }}>Loading…</div>}>
      <ExercisesInner />
    </Suspense>
  );
}
