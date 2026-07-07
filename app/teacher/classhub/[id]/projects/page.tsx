"use client";
export const dynamic = "force-dynamic";
import { C } from "@/components/teacher/ui";
import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";

interface Project {
  id:            string;
  title:         string;
  description:   string | null;
  start_date:    string | null;
  due_date:      string | null;
  status:        string;
  created_at:    string;
  subject_id:    string | null;
  sub_count:     number;
  student_count: number;
}
interface SubjectOpt { id: string; name: string; }

function ProjectsInner() {
  const router  = useRouter();
  const params  = useParams();
  const classId = params.id as string;

  const [list,      setList]      = useState<Project[]>([]);
  const [subjects,  setSubjects]  = useState<SubjectOpt[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [classInfo, setClassInfo] = useState<{ name: string; stream: string; school_id: string | null } | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "", subject_id: "", description: "", start_date: "", due_date: "",
  });

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [projRes, clsRes, subjRes] = await Promise.all([
      supabase.from("projects").select("*, project_submissions(id)").eq("class_id", classId).order("created_at", { ascending: false }),
      supabase.from("classes").select("name, stream, school_id").eq("id", classId).single(),
      supabase.from("subjects").select("id, name").order("name"),
    ]);

    const { data: stuRows } = await supabase.from("students").select("id").eq("class_id", classId);
    const studentCount = (stuRows ?? []).length;

    const projList: Project[] = ((projRes.data ?? []) as (Omit<Project, "sub_count" | "student_count"> & { project_submissions: { id: string }[] })[]).map(p => ({
      ...p,
      sub_count:     (p.project_submissions ?? []).length,
      student_count: studentCount,
    }));

    setList(projList);
    setClassInfo(clsRes.data);
    setSubjects(subjRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [classId]);

  async function handleSubmit() {
    setError("");
    if (!form.title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: err } = await supabase.from("projects").insert({
      class_id:    classId,
      teacher_id:  user.id,
      school_id:   classInfo?.school_id ?? null,
      subject_id:  form.subject_id || null,
      title:       form.title.trim(),
      description: form.description.trim(),
      start_date:  form.start_date || null,
      due_date:    form.due_date || null,
      status:      "active",
    });
    setSaving(false);
    if (err) { setError(err.message); return; }

    setForm({ title: "", subject_id: "", description: "", start_date: "", due_date: "" });
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setDeleting(id);
    await supabase.from("project_submissions").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    setList(l => l.filter(p => p.id !== id));
    setDeleting(null);
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
  }

  function isOverdue(due: string | null) {
    if (!due) return false;
    const todayNairobi = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" })).toISOString().split("T")[0];
    return due.split("T")[0].slice(0, 10) < todayNairobi;
  }

  const inp: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, color: C.textPrimary, outline: "none", fontFamily: "inherit", background: "#f9fafb", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, display: "block" };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 80, background: C.surface, minHeight: "100%" }}>

      <div style={{ background: "linear-gradient(135deg, #92400e 0%, #d97706 100%)", padding: "20px 16px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, width: 36, height: 36, color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>Projects</h1>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", margin: "2px 0 0" }}>
                {classInfo ? `${classInfo.name}${classInfo.stream ? " · " + classInfo.stream : ""}` : ""}
              </p>
            </div>
          </div>
          <button onClick={() => setShowForm(v => !v)} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: showForm ? "rgba(255,255,255,0.2)" : "#fff", color: showForm ? "#fff" : "#92400e", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {showForm ? "Cancel" : "+ New"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Total",   value: list.length },
            { label: "Active",  value: list.filter(p => !isOverdue(p.due_date)).length },
            { label: "Overdue", value: list.filter(p => isOverdue(p.due_date)).length },
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
            <p style={{ fontSize: 12, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px" }}>New Project</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={lbl}>Title *</label><input style={inp} placeholder="e.g. Model a Kenyan ecosystem" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><label style={lbl}>Subject</label>
                <select style={inp} value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}>
                  <option value="">-- Select subject --</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Description</label><textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} placeholder="What should learners produce?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}><label style={lbl}>Start Date</label><input style={inp} type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                <div style={{ flex: 1 }}><label style={lbl}>Due Date</label><input style={inp} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              </div>
            </div>
            {error && <p style={{ color: C.error, fontSize: 12, marginTop: 10 }}>{error}</p>}
            <button onClick={handleSubmit} disabled={saving} style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: 12, border: "none", background: saving ? "#fde68a" : "#92400e", color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {saving ? "Saving…" : "Create Project"}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.textMuted }}>Loading…</div>
        ) : list.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 20, padding: "32px 20px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛠️</div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, margin: "0 0 8px" }}>No projects yet</h2>
            <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 20px", lineHeight: 1.5 }}>Create a multi-week project — parents and students will see it once active.</p>
            <button onClick={() => setShowForm(true)} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: "#92400e", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+ Create First Project</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {list.map(p => {
              const overdue = isOverdue(p.due_date);
              const pct     = p.student_count > 0 ? Math.round((p.sub_count / p.student_count) * 100) : 0;
              return (
                <div key={p.id} style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${overdue ? "#ef4444" : "#92400e"}`, overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, margin: 0 }}>{p.title}</p>
                        {p.description && <p style={{ fontSize: 12, color: C.textMuted, margin: "6px 0 0", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{p.description}</p>}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 20, background: overdue ? "#fee2e2" : "#fef3c7", color: overdue ? "#991b1b" : "#92400e" }}>
                          {overdue ? "Overdue" : p.status}
                        </span>
                        <p style={{ fontSize: 11, color: C.textMuted, margin: "4px 0 0", fontWeight: 600 }}>Due {formatDate(p.due_date)}</p>
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: C.textMuted }}>
                          {subjects.find(s => s.id === p.subject_id)?.name ?? "General"}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: p.sub_count > 0 ? "#92400e" : C.textMuted }}>
                          {p.sub_count}/{p.student_count} submitted
                        </span>
                      </div>
                      <div style={{ height: 4, borderRadius: 99, background: "#f3f4f6", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: overdue && pct < 100 ? "#ef4444" : "#92400e", borderRadius: 99, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", borderTop: "1px solid #f3f4f6" }}>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting === p.id}
                      style={{ flex: 1, padding: "9px", border: "none", background: "none", color: deleting === p.id ? C.textMuted : "#ef4444", fontWeight: 700, fontSize: 12, cursor: deleting === p.id ? "wait" : "pointer", fontFamily: "inherit" }}
                    >
                      {deleting === p.id ? "Deleting…" : "🗑 Delete"}
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

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, color: "#6b7280" }}>Loading…</div>}>
      <ProjectsInner />
    </Suspense>
  );
}
