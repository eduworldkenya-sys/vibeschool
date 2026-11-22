"use client";
export const dynamic = "force-dynamic";
import { C } from "@/components/teacher/ui";
import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { loadProgressAuthority, loadProgressRoster } from "@/lib/learner-intelligence/progress-data";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { parseLessonPlanBody } from "@/lib/teaching/lessonPlanCodec";
import { ensureLessonExerciseDraft } from "@/lib/teaching/lessonExerciseDraft";

interface Exercise {
  id:               string;
  title:            string;
  instructions:     string | null;
  duration_minutes: number | null;
  status:           string;
  created_at:       string;
  subject_id:       string | null;
  lesson_plan_id:   string | null;
  sub_count:        number;
  student_count:    number;
}
interface SubjectOpt { id: string; name: string; }
interface LessonOption { id: string; title: string | null; topic: string | null; body: string | null; subject_id: string | null; }

function ExercisesInner() {
  const router  = useRouter();
  const params  = useParams();
  const classId = params.id as string;

  const [list,      setList]      = useState<Exercise[]>([]);
  const [subjects,  setSubjects]  = useState<SubjectOpt[]>([]);
  const [lessonOptions, setLessonOptions] = useState<LessonOption[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error,     setError]     = useState("");
  const [classInfo, setClassInfo] = useState<{ name: string; stream: string; school_id: string | null } | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);


  async function load() {
    setLoading(true); setLoadError("");
    try {
      const authority = await loadProgressAuthority(classId);
      const [exRes, roster, lessonRes] = await Promise.all([
        supabase.from("exercises").select("*, exercise_submissions(id,student_id,status)").eq("class_id", classId).eq("school_id", authority.schoolId).order("created_at", { ascending: false }),
        loadProgressRoster(authority, false),
        supabase.from("lesson_plans").select("id,title,topic,body,subject_id").eq("class_id", classId).eq("school_id", authority.schoolId).eq("teacher_id", authority.teacherId).order("updated_at", { ascending: false }).limit(100),
      ]);
      if (exRes.error) throw exRes.error;
      if (lessonRes.error) throw lessonRes.error;
      const assignedSubjectIds = new Set(authority.subjects.map(subject => subject.id));
      setLessonOptions((lessonRes.data ?? []).filter(lesson => Boolean(lesson.subject_id && assignedSubjectIds.has(lesson.subject_id))));
      const currentIds = new Set(roster.map(learner => learner.id));
      setList((exRes.data ?? []).map(row => {
        const markedCount = new Set((row.exercise_submissions ?? []).filter(sub => sub.status === "marked" && typeof sub.student_id === "string" && currentIds.has(sub.student_id)).map(sub => sub.student_id)).size;
        return { id: row.id, title: row.title ?? "Untitled exercise", instructions: row.instructions,
          duration_minutes: null, subject_id: null, lesson_plan_id: row.lesson_plan_id ?? null, created_at: row.created_at, sub_count: markedCount,
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
    const chosen = lessonOptions.find(lesson => lesson.id === selectedLessonId);
    if (!chosen) { setError("Select a saved lesson."); return; }
    setSaving(true);
    try {
      // Refresh authorization and the saved task at the point of creation.
      const authority = await loadProgressAuthority(classId);
      const { data: fresh, error: lessonError } = await supabase.from("lesson_plans")
        .select("id,title,topic,body,subject_id")
        .eq("id", chosen.id)
        .eq("class_id", classId)
        .eq("school_id", authority.schoolId)
        .eq("teacher_id", authority.teacherId)
        .maybeSingle();
      if (lessonError) throw lessonError;
      if (!fresh) throw new Error("This saved lesson is not accessible.");
      if (!authority.subjects.some(subject => subject.id === fresh.subject_id)) {
        throw new Error("You are no longer assigned to this lesson's subject.");
      }
      const sections = parseLessonPlanBody(fresh.body ?? "");
      if (!sections?.consolidation.trim()) {
        throw new Error("Add an exercise under Check understanding in the saved lesson first.");
      }
      const result = await ensureLessonExerciseDraft({
        lessonPlanId: fresh.id,
        classId,
        schoolId: authority.schoolId,
        teacherId: authority.teacherId,
        title: (fresh.topic || fresh.title || "Lesson") + " — In-Class Exercise",
        instructions: sections.consolidation.trim(),
      });
      // Existing teacher edits, submissions and marking always win over regeneration.
      setShowForm(false);
      setSelectedLessonId("");
      router.push(`/teacher/classhub/${encodeURIComponent(classId)}/exercises/${encodeURIComponent(result.exerciseId)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Exercise could not be created from this lesson.");
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

  const selectedLesson = lessonOptions.find(lesson => lesson.id === selectedLessonId);
  const selectedSections = selectedLesson ? parseLessonPlanBody(selectedLesson.body ?? "") : null;
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
            {showForm ? "Cancel" : "+ From lesson"}
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
          <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: 16, color: C.textPrimary, margin: "0 0 14px" }}>Exercise from lesson</h2>
            {lessonOptions.length === 0 ? (
              <p>No saved lessons available for your assigned subjects. <Link href="/teacher/lessonplan">Open Lesson Plans</Link></p>
            ) : (
              <>
                <label style={lbl} htmlFor="exercise-source-lesson">Saved lesson</label>
                <select id="exercise-source-lesson" style={inp} value={selectedLessonId} onChange={event => { setSelectedLessonId(event.target.value); setError(""); }}>
                  <option value="">Choose a lesson</option>
                  {lessonOptions.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.topic || lesson.title || "Untitled lesson"} · {subjects.find(subject => subject.id === lesson.subject_id)?.name || "Subject"}</option>)}
                </select>
                {selectedLesson && (
                  <div style={{ marginTop: 12, padding: 12, background: C.surface, borderRadius: 10 }}>
                    <strong style={{ color: C.textPrimary }}>Check understanding</strong>
                    <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {selectedSections?.consolidation.trim() || "No exercise saved. Add one in this lesson before creating."}
                    </p>
                    <Link href={`/teacher/lesson-notes?lessonPlanId=${encodeURIComponent(selectedLesson.id)}`}>Open source lesson</Link>
                  </div>
                )}
                {error && <p role="alert" style={{ color: C.error }}>{error}</p>}
                <button type="button" onClick={() => void handleSubmit()} disabled={saving || !selectedLessonId || !selectedSections?.consolidation.trim()} style={{ marginTop: 12, minHeight: 44, padding: "10px 16px", border: "none", borderRadius: 10, background: "#075985", color: "#fff", fontWeight: 700, opacity: saving || !selectedSections?.consolidation.trim() ? 0.6 : 1 }}>
                  {saving ? "Opening…" : "Create from lesson"}
                </button>
              </>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.textMuted }}>Loading…</div>
        ) : list.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 20, padding: "32px 20px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📐</div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, margin: "0 0 8px" }}>No exercises yet</h2>
            <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 20px", lineHeight: 1.5 }}>Choose a saved lesson to use its own Check understanding exercise.</p>
            <button onClick={() => setShowForm(true)} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: "#075985", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Create from lesson</button>
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
                        <p style={{ fontSize: 11, color: C.textMuted, margin: "6px 0 0" }}>{e.lesson_plan_id ? "From saved lesson" : "Legacy exercise"}</p>
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
