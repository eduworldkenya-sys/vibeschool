"use client";
export const dynamic = "force-dynamic";
import { C } from "@/components/teacher/ui";
import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";

interface Homework {
  id:              string;
  title:           string;
  subject:         string;
  instructions:    string;
  due_date:        string;
  type:            string;
  created_at:      string;
  target_group_id: string | null;
  sub_count:       number;
  student_count:   number;
}
interface Group { id: string; name: string; }

function HomeworkInner() {
  const router  = useRouter();
  const params  = useParams();
  const classId = params.id as string;

  const [list,      setList]      = useState<Homework[]>([]);
  const [groups,    setGroups]    = useState<Group[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [classInfo, setClassInfo] = useState<{ name: string; stream: string; subject: string } | null>(null);
  const [subjects,  setSubjects]  = useState<{ id: string; name: string }[]>([]);
  const [schoolId,  setSchoolId]  = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "", subject: "", instructions: "", due_date: "", type: "general", target_group_id: "",
  });
  const [addQuestions, setAddQuestions] = useState(false);
  const [questionDrafts, setQuestionDrafts] = useState<string[]>([""]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Homework | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; instructions: string; due_date: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: owned } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", user.id).eq("class_id", classId).maybeSingle();
    if (!owned) {
      const { data: direct } = await supabase.from("classes").select("id").eq("id", classId).eq("teacher_id", user.id).maybeSingle();
      if (!direct) { setLoading(false); router.replace("/teacher/classhub"); return; }
    }

    const [hwRes, clsRes, grpRes, subjRes, stuRes] = await Promise.all([
      supabase.from("homework").select("*, homework_submissions(id)").eq("class_id", classId).order("created_at", { ascending: false }),
      supabase.from("classes").select("name, stream, subject, school_id").eq("id", classId).single(),
      supabase.from("class_groups").select("id, name").eq("class_id", classId),
      supabase.from("subjects").select("id, name").order("name"),
      supabase.from("students").select("id").eq("class_id", classId),
    ]);

    const studentCount = (stuRes.data ?? []).length;
    const hwList: Homework[] = ((hwRes.data ?? []) as (Omit<Homework, "sub_count"|"student_count"> & { homework_submissions: { id: string }[] })[]).map(h => ({
      ...h,
      sub_count:     (h.homework_submissions ?? []).length,
      student_count: studentCount,
    }));

    setList(hwList);
    setClassInfo(clsRes.data);
    setSchoolId((clsRes.data as { school_id?: string | null } | null)?.school_id ?? null);
    setGroups(grpRes.data ?? []);
    setSubjects(subjRes.data ?? []);
    if (clsRes.data?.subject) setForm(f => ({ ...f, subject: clsRes.data!.subject }));
    setLoading(false);
  }

  useEffect(() => { load(); }, [classId]);

  async function handleSubmit() {
    setError("");
    if (!form.title.trim()) { setError("Title is required"); return; }
    if (!form.due_date)     { setError("Due date is required"); return; }
    if (!schoolId) {
      setError("Class information is still loading. Please wait a moment and try again.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("Your session has expired. Please sign in again.");
      return;
    }
    const { error: err } = await supabase.from("homework").insert({
      class_id: classId, teacher_id: user.id, school_id: schoolId,
      title: form.title.trim(), subject: form.subject.trim(),
      instructions: form.instructions.trim(), due_date: form.due_date,
      type: form.type, target_group_id: form.target_group_id || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }

    // G4+G5: notify students and parents
    try {
      const notifMsg = `New homework: "${form.title.trim()}" (${form.subject.trim()}) — due ${form.due_date}.`;
      const { data: stuRows } = await supabase
        .from("students")
        .select("id, profile_id")
        .eq("class_id", classId);
      if (stuRows && stuRows.length > 0) {
        const linkedStuRows = stuRows.filter(
          (st: { id: string; profile_id: string | null }): st is { id: string; profile_id: string } =>
            typeof st.profile_id === "string" && st.profile_id.length > 0
        );
        if (linkedStuRows.length > 0) {
          await supabase.from("notifications").insert(
            linkedStuRows.map((st) => ({
              user_id:   st.profile_id,
              school_id: schoolId,
              type:      "homework",
              title:     "New Homework",
              body:      notifMsg,
              is_read:   false,
            }))
          );
        }
        const { data: links } = await supabase
          .from("parent_student_links")
          .select("parent_id")
          .in("student_id", stuRows.map((st: { id: string }) => st.id))
          .eq("receives_alerts", true);
        if (links && links.length > 0) {
          const uniqueParents = Array.from(new Set(links.map((l: { parent_id: string }) => l.parent_id))) as string[];
          await supabase.from("notifications").insert(
            uniqueParents.map((pid: string) => ({
              user_id:   pid,
              school_id: schoolId,
              type:      "homework",
              title:     "New Homework",
              body:      notifMsg,
              is_read:   false,
            }))
          );
        }
      }
    } catch (_) {
      // notifications are best-effort
    }

    // Save questions if any
    if (addQuestions) {
      const validQs = questionDrafts.map((q, i) => q.trim()).filter(Boolean);
      if (validQs.length > 0) {
        // fetch the homework id we just created
        const { data: newHw } = await supabase
          .from("homework")
          .select("id")
          .eq("class_id", classId)
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (newHw) {
          await supabase.from("homework_questions").insert(
            validQs.map((q, i) => ({ homework_id: newHw.id, question: q, order_num: i + 1 }))
          );
        }
      }
    }
    setAddQuestions(false);
    setQuestionDrafts([""]);
    setForm(f => ({ ...f, title: "", instructions: "", due_date: "" }));
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this homework? This cannot be undone.")) return;
    setDeleting(id);
    await supabase.from("homework_questions").delete().eq("homework_id", id);
    await supabase.from("homework_submissions").delete().eq("homework_id", id);
    await supabase.from("homework").delete().eq("id", id);
    setList(l => l.filter(h => h.id !== id));
    setDeleting(null);
  }

  async function handleEditSave() {
    if (!editTarget || !editForm) return;
    setEditSaving(true);
    const { error } = await supabase.from("homework").update({
      title:        editForm.title.trim(),
      instructions: editForm.instructions.trim(),
      due_date:     editForm.due_date,
    }).eq("id", editTarget.id);
    if (!error) {
      setList(l => l.map(h => h.id === editTarget.id ? { ...h, ...editForm } : h));
      setEditTarget(null);
      setEditForm(null);
    }
    setEditSaving(false);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });
  }

  function isOverdue(due: string) {
    const todayNairobi = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" })).toISOString().split("T")[0];
    return due.split("T")[0].slice(0, 10) < todayNairobi;
  }

  const inp: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, color: C.textPrimary, outline: "none", fontFamily: "inherit", background: "#f9fafb", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, display: "block" };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 80, background: C.surface, minHeight: "100%" }}>

      <div style={{ background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)", padding: "20px 16px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, width: 36, height: 36, color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>Homework</h1>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", margin: "2px 0 0" }}>
                {classInfo ? `${classInfo.name}${classInfo.stream ? " · " + classInfo.stream : ""}` : ""}
              </p>
            </div>
          </div>
          <button onClick={() => setShowForm(v => !v)} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: showForm ? "rgba(255,255,255,0.2)" : "#fff", color: showForm ? "#fff" : "#0f766e", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {showForm ? "Cancel" : "+ New"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Total",   value: list.length },
            { label: "Active",  value: list.filter(h => !isOverdue(h.due_date)).length },
            { label: "Overdue", value: list.filter(h => isOverdue(h.due_date)).length },
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
          <div style={{ background: "#fff", borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", animation: "slideDown 0.2s ease" }}>
            <style>{`@keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }`}</style>
            <p style={{ fontSize: 12, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px" }}>New Assignment</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={lbl}>Title *</label><input style={inp} placeholder="e.g. Read pages 12–15 and summarise" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><label style={lbl}>Subject</label>
                <select style={inp} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                  <option value="">-- Select subject --</option>
                  {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Instructions</label><textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} placeholder="What should students do?" value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} /></div>
              <div><label style={lbl}>Due Date *</label><input style={inp} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              <div><label style={lbl}>Type</label>
                <select style={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="general">General</option>
                  <option value="reading">Reading</option>
                  <option value="writing">Writing</option>
                  <option value="project">Project</option>
                  <option value="revision">Revision</option>
                </select>
              </div>
              <div><label style={lbl}>Assign To</label>
                <select style={inp} value={form.target_group_id} onChange={e => setForm(f => ({ ...f, target_group_id: e.target.value }))}>
                  <option value="">Whole Class</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
            {/* Add Questions toggle */}
            <div style={{ marginTop: 4 }}>
              <button
                onClick={() => { setAddQuestions(v => !v); setQuestionDrafts([""]); }}
                style={{ display: "flex", alignItems: "center", gap: 8, background: addQuestions ? "#d1fae5" : "#f3f4f6", border: "none", borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", width: "100%" }}
              >
                <span style={{ fontSize: 16 }}>{addQuestions ? "✓" : "+"}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: addQuestions ? "#065f46" : "#374151" }}>
                  {addQuestions ? "Questions added" : "Add questions (optional)"}
                </span>
              </button>
              {addQuestions && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {questionDrafts.map((q, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        style={{ ...inp, flex: 1 }}
                        placeholder={`Question ${i + 1}`}
                        value={q}
                        onChange={e => setQuestionDrafts(d => d.map((x, j) => j === i ? e.target.value : x))}
                      />
                      {questionDrafts.length > 1 && (
                        <button onClick={() => setQuestionDrafts(d => d.filter((_, j) => j !== i))} style={{ background: "#fee2e2", border: "none", borderRadius: 8, width: 32, height: 32, color: "#991b1b", cursor: "pointer", fontWeight: 800, fontSize: 16 }}>×</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setQuestionDrafts(d => [...d, ""])} style={{ background: "none", border: "1px dashed #d1d5db", borderRadius: 10, padding: "8px", color: "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    + Add another question
                  </button>
                </div>
              )}
            </div>
            {error && <p style={{ color: C.error, fontSize: 12, marginTop: 10 }}>{error}</p>}
            <button onClick={handleSubmit} disabled={saving || !schoolId} style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: 12, border: "none", background: (saving || !schoolId) ? "#99f6e4" : "#0f766e", color: "#fff", fontWeight: 700, fontSize: 14, cursor: (saving || !schoolId) ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {saving ? "Saving…" : !schoolId ? "Loading class…" : "Post Homework"}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.textMuted }}>Loading…</div>
        ) : list.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 20, padding: "32px 20px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, margin: "0 0 8px" }}>No homework posted yet</h2>
            <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 20px", lineHeight: 1.5 }}>Post your first assignment — parents and students will see it instantly.</p>
            <button onClick={() => setShowForm(true)} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: "#0f766e", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+ Post First Assignment</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {list.map(h => {
              const overdue = isOverdue(h.due_date);
              const pct     = h.student_count > 0 ? Math.round((h.sub_count / h.student_count) * 100) : 0;
              return (
                <div
                  key={h.id}
                  style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${overdue ? "#ef4444" : "#0f766e"}`, overflow: "hidden" }}
                >
                  {/* Edit modal inline */}
                  {editTarget?.id === h.id && editForm && (
                    <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6", background: "#f8fffe" }}>
                      <p style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 10px" }}>Edit Homework</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <input style={inp} value={editForm.title} onChange={e => setEditForm(f => f ? { ...f, title: e.target.value } : f)} placeholder="Title" />
                        <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={editForm.instructions} onChange={e => setEditForm(f => f ? { ...f, instructions: e.target.value } : f)} placeholder="Instructions" />
                        <input style={inp} type="date" value={editForm.due_date} onChange={e => setEditForm(f => f ? { ...f, due_date: e.target.value } : f)} />
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button onClick={handleEditSave} disabled={editSaving} style={{ flex: 1, padding: "9px", borderRadius: 10, border: "none", background: "#0f766e", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                          {editSaving ? "Saving…" : "Save Changes"}
                        </button>
                        <button onClick={() => { setEditTarget(null); setEditForm(null); }} style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: "#f3f4f6", color: C.textMuted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Card body */}
                  <button
                    onClick={() => router.push(`/teacher/classhub/${classId}/homework/${h.id}`)}
                    style={{ width: "100%", textAlign: "left", background: "none", padding: "14px 16px", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, margin: 0 }}>{h.title}</p>
                        {h.subject && <p style={{ fontSize: 11, color: C.textMuted, margin: "3px 0 0" }}>{h.subject}</p>}
                        {h.instructions && <p style={{ fontSize: 12, color: C.textMuted, margin: "6px 0 0", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{h.instructions}</p>}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 20, background: overdue ? "#fee2e2" : "#d1fae5", color: overdue ? "#991b1b" : "#065f46" }}>
                          {overdue ? "Overdue" : "Active"}
                        </span>
                        <p style={{ fontSize: 11, color: C.textMuted, margin: "4px 0 0", fontWeight: 600 }}>Due {formatDate(h.due_date)}</p>
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: C.textMuted, textTransform: "capitalize" }}>{h.type}</span>
                          {h.target_group_id && groups.find(g => g.id === h.target_group_id) && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#ede9fe", color: "#6d28d9" }}>
                              {groups.find(g => g.id === h.target_group_id)?.name}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: h.sub_count > 0 ? "#0f766e" : C.textMuted }}>
                          {h.sub_count}/{h.student_count} submitted
                        </span>
                      </div>
                      <div style={{ height: 4, borderRadius: 99, background: "#f3f4f6", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: overdue && pct < 100 ? "#ef4444" : "#0f766e", borderRadius: 99, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  </button>

                  {/* Edit / Delete actions */}
                  <div style={{ display: "flex", borderTop: "1px solid #f3f4f6" }}>
                    <button
                      onClick={() => { setEditTarget(h); setEditForm({ title: h.title, instructions: h.instructions ?? "", due_date: h.due_date.slice(0,10) }); }}
                      style={{ flex: 1, padding: "9px", border: "none", background: "none", color: "#0f766e", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", borderRight: "1px solid #f3f4f6" }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(h.id)}
                      disabled={deleting === h.id}
                      style={{ flex: 1, padding: "9px", border: "none", background: "none", color: deleting === h.id ? C.textMuted : "#ef4444", fontWeight: 700, fontSize: 12, cursor: deleting === h.id ? "wait" : "pointer", fontFamily: "inherit" }}
                    >
                      {deleting === h.id ? "Deleting…" : "🗑 Delete"}
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

export default function HomeworkPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, color: "#6b7280" }}>Loading…</div>}>
      <HomeworkInner />
    </Suspense>
  );
}

