"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { nairobiDateStr } from "@/lib/time";

type Assignment = {
  assignmentId: string;
  schoolId: string;
  classId: string;
  subjectId: string;
  className: string;
  subjectName: string;
};

const input: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  borderRadius: 10,
  border: "1px solid #dbe3ec",
  padding: "10px 12px",
  font: "inherit",
  boxSizing: "border-box",
  background: "#fff",
};

export default function NewIndependentLessonPlanPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentId, setAssignmentId] = useState("");
  const [plannedDate, setPlannedDate] = useState(nairobiDateStr());
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [duration, setDuration] = useState(40);
  const [durationSource, setDurationSource] = useState("Adjust this to the real lesson length.");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => assignments.find(a => a.assignmentId === assignmentId) ?? null,
    [assignments, assignmentId],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/?role=teacher");
        return;
      }
      const { data, error: contextError } = await supabase.rpc("teacher_get_operating_context", {});
      const context = data as {
        school_id?: string | null;
        classes?: Array<{
          assignment_id: string;
          class_id: string;
          class_name: string;
          stream?: string | null;
          subject_id: string;
          subject_name: string;
        }>;
      } | null;
      if (contextError || !context?.school_id) {
        if (!cancelled) {
          setError("Choose or connect your active school before planning.");
          setLoading(false);
        }
        return;
      }
      const rows = (context.classes ?? []).map(row => ({
        assignmentId: row.assignment_id,
        schoolId: context.school_id!,
        classId: row.class_id,
        subjectId: row.subject_id,
        className: row.stream ? `${row.class_name} ${row.stream}` : row.class_name,
        subjectName: row.subject_name,
      }));
      if (!cancelled) {
        setAssignments(rows);
        setAssignmentId(rows[0]?.assignmentId ?? "");
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    async function loadPreference() {
      const { data } = await supabase
        .from("class_timetable_preferences")
        .select("lesson_minutes")
        .eq("school_id", selected.schoolId)
        .eq("class_id", selected.classId)
        .maybeSingle();
      if (cancelled) return;
      if (data?.lesson_minutes) {
        setDuration(Number(data.lesson_minutes));
        setDurationSource("Using this class's school timetable preference. You can still adjust it for this lesson.");
      } else {
        setDurationSource("No class-specific duration is configured. Adjust this to the real lesson length; VibeSchool will not invent a school rule.");
      }
    }
    void loadPreference();
    return () => { cancelled = true; };
  }, [selected?.schoolId, selected?.classId]);

  async function save() {
    if (!selected || !plannedDate || (!title.trim() && !body.trim()) || saving) {
      if (!selected) setError("Choose a class and subject.");
      else if (!plannedDate) setError("Choose the planned date.");
      else setError("Add a title or lesson notes.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data, error: saveError } = await supabase.rpc("create_independent_lesson_plan", {
        p_class_id: selected.classId,
        p_subject_id: selected.subjectId,
        p_planned_date: plannedDate,
        p_topic: topic.trim() || null,
        p_title: title.trim() || null,
        p_body: body.trim() || null,
        p_duration_minutes: duration,
        p_scheme_id: null,
      });
      if (saveError) throw saveError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.id) throw new Error("Lesson plan was not returned after save.");
      router.push(`/teacher/lessonplan?date=${encodeURIComponent(plannedDate)}`);
    } catch (e) {
      console.error("[LessonPlan] independent plan save failed", e);
      setError("Could not save the lesson plan. Your entries are still here.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "18px 14px 90px" }}>
      <button onClick={() => router.back()} style={{ border: 0, background: "none", padding: 0, color: "#4f46e5", fontWeight: 800 }}>
        ← Lesson plans
      </button>
      <header style={{ marginTop: 14, marginBottom: 18 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 800, color: "#6366f1" }}>Independent planning</div>
        <h1 style={{ margin: "4px 0 6px", fontSize: 24 }}>Plan first. Schedule later.</h1>
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>
          Create a private draft even when no timetable slot exists. When a matching timetable lesson is available, attach the draft from Lesson Plans.
        </p>
      </header>

      {error && <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#fef2f2", color: "#991b1b", marginBottom: 14 }}>{error}</div>}

      {loading ? <p>Loading your teaching assignments…</p> : assignments.length === 0 ? (
        <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          No class and subject assignment is available yet. Add one from My Classes, then return here.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <label>
            <span style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 5 }}>Class & subject</span>
            <select value={assignmentId} onChange={e => setAssignmentId(e.target.value)} style={input}>
              {assignments.map(a => <option key={a.assignmentId} value={a.assignmentId}>{a.className} — {a.subjectName}</option>)}
            </select>
          </label>

          <label>
            <span style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 5 }}>Planned date</span>
            <input type="date" value={plannedDate} onChange={e => setPlannedDate(e.target.value)} style={input} />
          </label>

          <label>
            <span style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 5 }}>Topic</span>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Linear equations" style={input} />
          </label>

          <label>
            <span style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 5 }}>Lesson title</span>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What are you preparing to teach?" style={input} />
          </label>

          <label>
            <span style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 5 }}>Lesson notes / intent</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={7} placeholder="Objectives, key ideas, examples, activities, assessment notes…" style={{ ...input, resize: "vertical" }} />
          </label>

          <label>
            <span style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 5 }}>Planned duration</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min={20} max={240} value={duration} onChange={e => setDuration(Math.max(20, Math.min(240, Number(e.target.value) || 20)))} style={{ ...input, maxWidth: 130 }} />
              <span style={{ fontSize: 13 }}>minutes</span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 5 }}>{durationSource}</div>
          </label>

          <button
            disabled={saving}
            onClick={() => void save()}
            style={{ minHeight: 46, border: 0, borderRadius: 12, background: "#4f46e5", color: "#fff", fontWeight: 800, fontSize: 14 }}
          >
            {saving ? "Saving draft…" : "Save independent lesson plan"}
          </button>
        </div>
      )}
    </main>
  );
}
