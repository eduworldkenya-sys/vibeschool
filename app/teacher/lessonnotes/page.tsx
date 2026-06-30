"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { nairobiDateStr } from "@/lib/time";
import { C } from "@/components/teacher/ui";

interface PlanOption {
  id:                  string;
  title:               string;
  topic:               string;
  class_id:            string | null;
  subject_id:          string | null;
  class_name:          string;
  subject_name:        string;
  week_start:          string;
}

interface NoteRow {
  id:                  string;
  lesson_plan_id:      string | null;
  taught_date:         string;
  what_was_taught:     string;
  participation_score: number | null;
  challenges:          string | null;
  homework_set:        string | null;
  class_id:            string | null;
  subject_id:          string | null;
  class_name:          string;
  subject_name:        string;
  plan_title:          string | null;
  plan_topic:          string | null;
  published:           boolean;
}

type ViewState = "list" | "new" | "view" | "edit" | "saved";

const PAR: Record<number, { label: string; color: string; bg: string; emoji: string }> = {
  1: { label: "Very Low",  color: "#7f1d1d", bg: "#fee2e2", emoji: "😞" },
  2: { label: "Low",       color: "#92400e", bg: "#fef3c7", emoji: "😐" },
  3: { label: "Average",   color: "#1e40af", bg: "#dbeafe", emoji: "🙂" },
  4: { label: "Good",      color: "#065f46", bg: "#d1fae5", emoji: "😊" },
  5: { label: "Excellent", color: "#4c1d95", bg: "#ede9fe", emoji: "🌟" },
};

function Skeleton({ h = 72, w = "100%" }: { h?: number; w?: string }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 12, flexShrink: 0,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
    }} />
  );
}

function formatDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-KE", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 800, color: "#6b7280",
      letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6,
    }}>{children}</div>
  );
}

function InputStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    width: "100%", boxSizing: "border-box", padding: "11px 14px",
    borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14,
    fontFamily: "inherit", background: "#fff", color: "#111827",
    outline: "none", ...extra,
  };
}

export default function LessonNotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tidRef = useRef<string | null>(null);
  const sidRef = useRef<string | null>(null);

  const [view,          setView]          = useState<ViewState>("list");
  const [justSaved,     setJustSaved]     = useState<{ classId: string | null; subjectId: string | null } | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [notes,         setNotes]         = useState<NoteRow[]>([]);
  const [activeNote,    setActiveNote]    = useState<NoteRow | null>(null);
  const [plans,         setPlans]         = useState<PlanOption[]>([]);
  const [plansLoading,  setPlansLoading]  = useState(false);
  const [selectedPlan,  setSelectedPlan]  = useState<string>("");
  const [taughtDate,    setTaughtDate]    = useState<string>(nairobiDateStr());
  const [whatTaught,    setWhatTaught]    = useState<string>("");
  const [participation, setParticipation] = useState<number>(3);
  const [challenges,    setChallenges]    = useState<string>("");
  const [homework,      setHomework]      = useState<string>("");
  const [publishing,    setPublishing]    = useState<string | null>(null);
  const [publishError,  setPublishError]  = useState<string | null>(null);

  const editingNoteId = useRef<string | null>(null);

  useEffect(() => { boot() }, []);

  async function boot() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) { router.push("/?role=teacher"); return; }

      const [memberRes, teacherRes, profileRes] = await Promise.all([
        supabase.from("school_members").select("school_id").eq("profile_id", user.id).maybeSingle(),
        supabase.from("teacher_profiles").select("school_id").eq("profile_id", user.id).maybeSingle(),
        supabase.from("profiles").select("school_id").eq("id", user.id).single(),
      ]);
      const sid = memberRes.data?.school_id
        ?? teacherRes.data?.school_id
        ?? profileRes.data?.school_id
        ?? null;

      tidRef.current = user.id;
      sidRef.current = sid;

      await loadNotes(user.id, sid);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  async function loadNotes(tid: string, sid: string | null) {
    let q = supabase
      .from("lesson_notes")
      .select("id, lesson_plan_id, taught_date, what_was_taught, participation_score, challenges, homework_set, class_id, subject_id")
      .eq("teacher_id", tid)
      .order("taught_date", { ascending: false })
      .limit(60);

    if (sid) q = q.eq("school_id", sid);

    const { data: rows, error: rowErr } = await q;
    if (rowErr) { setError(rowErr.message); return; }

    const noteList = rows ?? [];
    if (noteList.length === 0) { setNotes([]); return; }

    const classIds   = Array.from(new Set(noteList.map((n: any) => n.class_id).filter(Boolean)));
    const subjectIds = Array.from(new Set(noteList.map((n: any) => n.subject_id).filter(Boolean)));
    const planIds    = Array.from(new Set(noteList.filter((n: any) => n.lesson_plan_id).map((n: any) => n.lesson_plan_id as string)));

    const [clsRes, subjRes, planRes, contentRes] = await Promise.all([
      classIds.length   > 0 ? supabase.from("classes").select("id,name,stream").in("id", classIds)    : Promise.resolve({ data: [] }),
      subjectIds.length > 0 ? supabase.from("subjects").select("id,name").in("id", subjectIds)         : Promise.resolve({ data: [] }),
      planIds.length    > 0 ? supabase.from("lesson_plans").select("id,title,topic").in("id", planIds) : Promise.resolve({ data: [] }),
      // Publish status: a lesson_content row of type 'lesson_note' tied to this
      // note's lesson_plan_id means it's already live for parents/students —
      // this is the same table app/student/learn and app/parent/vibe-learn read.
      planIds.length    > 0 ? supabase.from("lesson_content").select("lesson_plan_id").in("lesson_plan_id", planIds).eq("content_type", "lesson_note") : Promise.resolve({ data: [] }),
    ]);

    const clsMap  = Object.fromEntries(((clsRes.data  ?? []) as any[]).map(c => [c.id, c.name + (c.stream ? " " + c.stream : "")]));
    const subjMap = Object.fromEntries(((subjRes.data ?? []) as any[]).map(s => [s.id, s.name]));
    const planMap = Object.fromEntries(((planRes.data ?? []) as any[]).map(p => [p.id, { title: p.title, topic: p.topic }]));
    const publishedPlanIds = new Set(((contentRes.data ?? []) as any[]).map(c => c.lesson_plan_id));

    setNotes(noteList.map((n: any) => ({
      id:                  n.id,
      lesson_plan_id:      n.lesson_plan_id,
      taught_date:         n.taught_date,
      what_was_taught:     n.what_was_taught,
      participation_score: n.participation_score,
      challenges:          n.challenges,
      homework_set:        n.homework_set,
      class_id:            n.class_id,
      subject_id:          n.subject_id,
      class_name:          n.class_id   ? (clsMap[n.class_id]   ?? "Unknown Class")   : "",
      subject_name:        n.subject_id ? (subjMap[n.subject_id] ?? "Unknown Subject") : "",
      plan_title:          n.lesson_plan_id ? (planMap[n.lesson_plan_id]?.title ?? null) : null,
      plan_topic:          n.lesson_plan_id ? (planMap[n.lesson_plan_id]?.topic ?? null) : null,
      published:           n.lesson_plan_id ? publishedPlanIds.has(n.lesson_plan_id) : false,
    })));
  }

  async function openNew() {
    editingNoteId.current = null;
    setSelectedPlan("");
    setTaughtDate(nairobiDateStr());
    setWhatTaught("");
    setParticipation(3);
    setChallenges("");
    setHomework("");
    setError(null);
    setView("new");

    const tid = tidRef.current;
    const sid = sidRef.current;
    if (!tid) return;
    setPlansLoading(true);

    let q = supabase
      .from("lesson_plans")
      .select("id, title, topic, week_start, class_id, subject_id")
      .eq("teacher_id", tid)
      .order("week_start", { ascending: false })
      .limit(40);

    if (sid) q = q.eq("school_id", sid);

    const { data: planRows } = await q;
    const rawPlans = planRows ?? [];
    const cids = Array.from(new Set(rawPlans.map((p: any) => p.class_id).filter(Boolean)));
    const sids = Array.from(new Set(rawPlans.map((p: any) => p.subject_id).filter(Boolean)));

    const [clsRes, subjRes] = await Promise.all([
      cids.length > 0 ? supabase.from("classes").select("id,name,stream").in("id", cids) : Promise.resolve({ data: [] }),
      sids.length > 0 ? supabase.from("subjects").select("id,name").in("id", sids)        : Promise.resolve({ data: [] }),
    ]);
    const clsMap  = Object.fromEntries(((clsRes.data  ?? []) as any[]).map(c => [c.id, c.name + (c.stream ? " " + c.stream : "")]));
    const subjMap = Object.fromEntries(((subjRes.data ?? []) as any[]).map(s => [s.id, s.name]));

    setPlans(rawPlans.map((p: any) => ({
      id:                  p.id,
      title:               p.title ?? "Untitled Plan",
      topic:               p.topic ?? "",
      class_id:            p.class_id,
      subject_id:          p.subject_id,
      class_name:          p.class_id   ? (clsMap[p.class_id]   ?? "") : "",
      subject_name:        p.subject_id ? (subjMap[p.subject_id] ?? "") : "",
      week_start:          p.week_start ?? "",
    })));
    setPlansLoading(false);

    // Pre-select plan from URL (arrived via "Mark as Taught" from Lesson Plans)
    const urlPlanId = searchParams.get("planId");
    if (urlPlanId && rawPlans.some((p: any) => p.id === urlPlanId)) {
      setSelectedPlan(urlPlanId);
    }
  }

  function openEdit(note: NoteRow) {
    editingNoteId.current = note.id;
    setSelectedPlan(note.lesson_plan_id ?? "");
    setTaughtDate(note.taught_date);
    setWhatTaught(note.what_was_taught);
    setParticipation(note.participation_score ?? 3);
    setChallenges(note.challenges ?? "");
    setHomework(note.homework_set ?? "");
    setError(null);
    setView("edit");
  }

  async function saveNote() {
    if (!whatTaught.trim()) { setError("Please describe what was taught."); return; }
    const tid = tidRef.current;
    const sid = sidRef.current;
    if (!tid) return;

    setSaving(true);
    setError(null);

    const linkedPlan = plans.find(p => p.id === selectedPlan) ?? null;
    const payload: Record<string, unknown> = {
      teacher_id:          tid,
      lesson_plan_id:      selectedPlan || null,
      class_id:            linkedPlan?.class_id   ?? null,
      subject_id:          linkedPlan?.subject_id ?? null,
      taught_date:         taughtDate,
      what_was_taught:     whatTaught.trim(),
      participation_score: participation,
      challenges:          challenges.trim() || null,
      homework_set:        homework.trim()   || null,
      updated_at:          new Date().toISOString(),
    };
    if (sid) payload.school_id = sid;

    try {
      const isEdit = editingNoteId.current !== null;
      if (isEdit) {
        const { error: upErr } = await supabase
          .from("lesson_notes")
          .update(payload)
          .eq("id", editingNoteId.current!)
          .eq("teacher_id", tid);
        if (upErr) throw upErr;
        editingNoteId.current = null;
        await loadNotes(tid, sid);
        setView("list");
      } else {
        payload.created_at = new Date().toISOString();
        const { error: insErr } = await supabase.from("lesson_notes").insert(payload);
        if (insErr) throw insErr;
        editingNoteId.current = null;
        await loadNotes(tid, sid);
        // Offer the natural next step — teacher chooses, no forced redirect (hybrid, not automatic)
        setJustSaved({
          classId:   (linkedPlan?.class_id   as string | null) ?? null,
          subjectId: (linkedPlan?.subject_id as string | null) ?? null,
        });
        setView("saved");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    const tid = tidRef.current;
    const sid = sidRef.current;
    if (!tid) return;
    setConfirmDelete(noteId);
  }

  async function confirmDeleteNote() {
    const noteId = confirmDelete;
    if (!noteId) return;
    const tid = tidRef.current;
    const sid = sidRef.current;
    if (!tid) return;
    setConfirmDelete(null);
    setDeleting(true);
    try {
      const { error: delErr } = await supabase
        .from("lesson_notes")
        .delete()
        .eq("id", noteId)
        .eq("teacher_id", tid);
      if (delErr) throw delErr;
      await loadNotes(tid, sid);
      setActiveNote(null);
      setView("list");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  async function publishNote(note: NoteRow) {
    if (!note.lesson_plan_id) {
      setPublishError("Link a lesson plan to this note (edit it) before publishing — that's how parents and students find it.");
      return;
    }
    const tid = tidRef.current;
    const sid = sidRef.current;
    if (!tid) return;

    setPublishing(note.id);
    setPublishError(null);

    try {
      const studentCopy = [
        "We covered: " + note.what_was_taught,
        note.homework_set ? "Homework: " + note.homework_set : "",
      ].filter(Boolean).join("\n\n");

      const teacherCopy = [
        "What was taught: " + note.what_was_taught,
        "Participation: " + (PAR[note.participation_score ?? 3]?.label ?? "—"),
        note.challenges   ? "Challenges: " + note.challenges   : "",
        note.homework_set ? "Homework: "   + note.homework_set : "",
      ].filter(Boolean).join("\n\n");

      // Re-publishing an already-live note updates the same row instead of
      // creating a duplicate, so later edits sync through automatically.
      const { data: existing } = await supabase
        .from("lesson_content")
        .select("id")
        .eq("lesson_plan_id", note.lesson_plan_id)
        .eq("content_type", "lesson_note")
        .maybeSingle();

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from("lesson_content")
          .update({ student_copy: studentCopy, teacher_copy: teacherCopy, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("lesson_content")
          .insert({
            school_id:      sid,
            teacher_id:     tid,
            lesson_plan_id: note.lesson_plan_id,
            content_type:   "lesson_note",
            teacher_copy:   teacherCopy,
            student_copy:   studentCopy,
            generated_by:   "teacher",
          });
        if (insErr) throw insErr;
      }

      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, published: true } : n));
      if (activeNote?.id === note.id) setActiveNote({ ...note, published: true });
    } catch (e: unknown) {
      setPublishError(e instanceof Error ? e.message : "Publish failed. Try again.");
    } finally {
      setPublishing(null);
    }
  }

  const linkedPlanForForm = plans.find(p => p.id === selectedPlan) ?? null;
  const avgParticipation  = notes.length
    ? (notes.reduce((s, n) => s + (n.participation_score ?? 0), 0) / notes.length).toFixed(1)
    : null;
  const thisWeekCount = notes.filter(n => {
    const d = new Date(n.taught_date + "T12:00:00");
    const ago7 = new Date(); ago7.setDate(ago7.getDate() - 7);
    return d >= ago7;
  }).length;

  function renderForm(isEdit: boolean) {
    return (
      <div style={{ paddingBottom: 120 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "16px 16px 12px", borderBottom: "1px solid #e5e7eb", background: "#fff",
        }}>
          <button
            onClick={() => { setView(isEdit ? "view" : "list"); setError(null); }}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "1px solid #e5e7eb",
              background: "#f9fafb", cursor: "pointer", fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "inherit", flexShrink: 0,
            }}
          >←</button>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#111827" }}>
            {isEdit ? "Edit Note" : "New Lesson Note"}
          </div>
        </div>
        <div style={{ padding: "16px" }}>
          {error && (
            <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "#fef2f2", color: "#991b1b", fontSize: 13 }}>
              {error}
            </div>
          )}
          {!isEdit && (
            <div style={{ marginBottom: 16 }}>
              <FieldLabel>Link to Lesson Plan <span style={{ fontWeight: 400 }}>(optional)</span></FieldLabel>
              {plansLoading ? <Skeleton h={44} /> : (
                <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)} style={InputStyle()}>
                  <option value="">— No linked plan —</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {[p.topic || p.title, p.subject_name, p.class_name, p.week_start].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
              )}
              {linkedPlanForForm && (
                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "#d1fae5", fontSize: 12, fontWeight: 600, color: "#065f46" }}>
                  📌 {linkedPlanForForm.subject_name} · {linkedPlanForForm.class_name}
                </div>
              )}
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Date Taught</FieldLabel>
            <input type="date" value={taughtDate} max={nairobiDateStr()} onChange={e => setTaughtDate(e.target.value)} style={InputStyle()} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>What Was Taught <span style={{ color: "#991b1b" }}>*</span></FieldLabel>
            <textarea value={whatTaught} onChange={e => setWhatTaught(e.target.value)} placeholder="Describe what was actually covered in the lesson…" rows={4} style={InputStyle({ resize: "vertical", lineHeight: "1.6" })} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Learner Participation</FieldLabel>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4, 5].map(score => {
                const meta = PAR[score]; const active = participation === score;
                return (
                  <button key={score} onClick={() => setParticipation(score)} style={{ flex: 1, padding: "10px 4px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, border: active ? "2px solid " + meta.color : "1.5px solid #e5e7eb", background: active ? meta.bg : "#f9fafb", color: active ? meta.color : "#6b7280", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "all 0.12s" }}>
                    <span style={{ fontSize: 18 }}>{meta.emoji}</span>
                    <span>{score}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, textAlign: "center", color: PAR[participation]?.color }}>{PAR[participation]?.label}</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Challenges Observed <span style={{ fontWeight: 400 }}>(optional)</span></FieldLabel>
            <textarea value={challenges} onChange={e => setChallenges(e.target.value)} placeholder="Difficulties learners faced, misconceptions noticed…" rows={3} style={InputStyle({ resize: "vertical", lineHeight: "1.6" })} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <FieldLabel>Homework Set <span style={{ fontWeight: 400 }}>(optional)</span></FieldLabel>
            <textarea value={homework} onChange={e => setHomework(e.target.value)} placeholder="What homework or follow-up was assigned…" rows={2} style={InputStyle({ resize: "vertical", lineHeight: "1.6" })} />
          </div>
        </div>
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px", paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))", background: "#fff", borderTop: "1px solid #e5e7eb", zIndex: 50 }}>
          <button onClick={saveNote} disabled={saving || !whatTaught.trim()} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: saving || !whatTaught.trim() ? "#9ca3af" : "linear-gradient(135deg,#065f46 0%,#10b981 100%)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: saving || !whatTaught.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {saving ? "Saving…" : isEdit ? "Update Note" : "Save Note"}
          </button>
        </div>
      </div>
    );
  }

  if (view === "list") {
    return (
      <div style={{ paddingBottom: 100 }}>
        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}} @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div style={{ background: "linear-gradient(135deg,#065f46 0%,#10b981 100%)", padding: "20px 16px 24px" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Lesson Notes</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>Record what was actually delivered in class</div>
          {!loading && notes.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {[{ label: "Total", value: notes.length }, { label: "This Week", value: thisWeekCount }, { label: "Avg Part.", value: avgParticipation ? avgParticipation + "/5" : "—" }].map(s => (
                <div key={s.label} style={{ flex: 1, background: "rgba(255,255,255,0.18)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {error && <div style={{ margin: "12px 16px", padding: "10px 14px", borderRadius: 10, background: "#fef2f2", color: "#991b1b", fontSize: 13 }}>{error}</div>}
        {loading && <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>{[1,2,3].map(i => <Skeleton key={i} h={90} />)}</div>}
        {!loading && notes.length === 0 && (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 6 }}>No lesson notes yet</div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, maxWidth: 280, margin: "0 auto 24px" }}>After each lesson, record what you taught, how it went, and what homework you set.</div>
            <button onClick={openNew} style={{ padding: "14px 32px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#065f46 0%,#10b981 100%)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>+ Add First Note</button>
          </div>
        )}
        {!loading && notes.length > 0 && (
          <div style={{ padding: "14px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
            {notes.map(note => {
              const parMeta = PAR[note.participation_score ?? 3] ?? PAR[3];
              const context = [note.subject_name, note.class_name].filter(Boolean).join(" · ");
              const headline = note.plan_topic || note.plan_title || note.what_was_taught.slice(0, 60);
              return (
                <div key={note.id} onClick={() => { setActiveNote(note); setView("view"); }} style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer", border: "1px solid #e5e7eb", animation: "fadeIn 0.2s ease" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", flex: 1, marginRight: 8 }}>{headline}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap", flexShrink: 0 }}>{formatDate(note.taught_date)}</div>
                  </div>
                  {context && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{context}</div>}
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 8 }}>{note.what_was_taught}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: parMeta.bg, color: parMeta.color }}>{parMeta.emoji} {parMeta.label}</span>
                    {note.homework_set && <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 600 }}>📚 HW set</span>}
                    {note.challenges  && <span style={{ fontSize: 11, color: "#92400e", fontWeight: 600 }}>⚠️ Challenges noted</span>}
                    {note.published   && <span style={{ fontSize: 11, color: "#065f46", fontWeight: 700 }}>📣 Published</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!loading && (
          <button onClick={openNew} style={{ position: "fixed", bottom: 90, right: 20, width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#065f46 0%,#10b981 100%)", color: "#fff", border: "none", fontSize: 26, cursor: "pointer", boxShadow: "0 4px 16px rgba(16,185,129,0.45)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", zIndex: 50 }}>+</button>
        )}
      </div>
    );
  }

  if (view === "new")  return renderForm(false);
  if (view === "edit") return renderForm(true);

  if (view === "saved") {
    return (
      <div style={{ paddingBottom: 100, padding: "16px" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "24px 20px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Note saved</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>Want to record an assessment for this lesson now?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {justSaved?.classId && justSaved?.subjectId && (
              <button
                onClick={() => router.push(`/teacher/assessment?classId=${justSaved.classId}&subjectId=${justSaved.subjectId}`)}
                style={{ padding: "12px", borderRadius: 12, border: "none", background: "#111827", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                📊 Record Assessment
              </button>
            )}
            <button
              onClick={() => { setJustSaved(null); setView("list"); }}
              style={{ padding: "12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "view" && activeNote) {
    const note = activeNote;
    const parMeta = PAR[note.participation_score ?? 3] ?? PAR[3];
    const context = [note.subject_name, note.class_name].filter(Boolean).join(" · ");
    return (
      <div style={{ paddingBottom: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 12px", borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
          <button onClick={() => { setView("list"); setActiveNote(null); }} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", flexShrink: 0 }}>←</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{note.plan_topic || note.plan_title || "Lesson Note"}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{[formatDate(note.taught_date), context].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fef2f2", color: "#991b1b", fontSize: 13 }}>{error}</div>}
          {(note.plan_title || note.plan_topic) && (
            <div style={{ background: "#ede9fe", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#6d28d9", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>Linked Plan</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#4c1d95" }}>{note.plan_topic ? note.plan_topic + (note.plan_title ? " — " + note.plan_title : "") : note.plan_title}</div>
            </div>
          )}
          <div style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#6b7280", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>What Was Taught</div>
            <div style={{ fontSize: 14, color: "#111827", lineHeight: 1.7 }}>{note.what_was_taught}</div>
          </div>
          <div style={{ background: parMeta.bg, borderRadius: 16, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Learner Participation</div>
            <div style={{ fontSize: 13, fontWeight: 800, padding: "5px 12px", borderRadius: 20, color: parMeta.color, background: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 5 }}>
              <span>{parMeta.emoji}</span><span>{note.participation_score}/5 — {parMeta.label}</span>
            </div>
          </div>
          {note.challenges && (
            <div style={{ background: "#fffbeb", borderRadius: 16, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: "4px solid #f59e0b" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#92400e", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>⚠️ Challenges Observed</div>
              <div style={{ fontSize: 14, color: "#78350f", lineHeight: 1.7 }}>{note.challenges}</div>
            </div>
          )}
          {note.homework_set && (
            <div style={{ background: "#eff6ff", borderRadius: 16, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: "4px solid #3b82f6" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#1d4ed8", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>📚 Homework Set</div>
              <div style={{ fontSize: 14, color: "#1e3a8a", lineHeight: 1.7 }}>{note.homework_set}</div>
            </div>
          )}
          {publishError && <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fef2f2", color: "#991b1b", fontSize: 13 }}>{publishError}</div>}
          {note.lesson_plan_id ? (
            note.published ? (
              <div style={{ background: "#d1fae5", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#065f46" }}>✓ Published — visible to parents &amp; students</div>
                <button onClick={() => publishNote(note)} disabled={publishing === note.id} style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #065f46", background: "#fff", color: "#065f46", fontSize: 12, fontWeight: 700, cursor: publishing === note.id ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  {publishing === note.id ? "…" : "🔄 Sync"}
                </button>
              </div>
            ) : (
              <button onClick={() => publishNote(note)} disabled={publishing === note.id} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: publishing === note.id ? "#9ca3af" : "linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%)", color: "#fff", fontSize: 14, fontWeight: 800, cursor: publishing === note.id ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {publishing === note.id ? "Publishing…" : "📣 Publish to Parents & Students"}
              </button>
            )
          ) : (
            <div style={{ background: "#f3f4f6", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#6b7280", textAlign: "center" }}>
              Link a lesson plan to this note (✏️ Edit) to enable publishing.
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={() => openEdit(note)} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #e5e7eb", background: "#fff", color: "#111827", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✏️ Edit</button>
            <button onClick={() => setConfirmDelete(note.id)} disabled={deleting} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: 14, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1, fontFamily: "inherit" }}>
              {deleting ? "Deleting…" : "🗑 Delete"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Delete Note?</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>This cannot be undone.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDeleteNote} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
