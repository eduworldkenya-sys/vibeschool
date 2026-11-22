"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import SubjectLessonHandoff from "@/components/teacher/SubjectLessonHandoff";

type Assignment = {
  class_id: string;
  class_name: string;
  stream?: string | null;
  subject_id: string;
  subject_name: string;
};

type OperatingContext = {
  school_id?: string | null;
  classes?: Assignment[];
};

type RecentGuide = {
  href: string;
  title: string;
  schoolId: string;
  classId: string;
  subjectId: string;
};

function validRecent(value: unknown): value is RecentGuide {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<RecentGuide>;
  return typeof entry.href === "string"
    && entry.href.startsWith("/teacher/teacher-guide?")
    && !entry.href.includes("#")
    && typeof entry.title === "string"
    && typeof entry.schoolId === "string"
    && typeof entry.classId === "string"
    && typeof entry.subjectId === "string";
}

/**
 * A selection UI only. Canonical teacher authority and lesson eligibility
 * remain in teacher_get_operating_context / SubjectLessonHandoff.
 */
export default function TeacherGuideSelector({
  initialClassId = "",
  initialSubjectId = "",
}: {
  initialClassId?: string;
  initialSubjectId?: string;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classId, setClassId] = useState(initialClassId);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [recent, setRecent] = useState<RecentGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Sign in to open your teaching guide.");
        const { data, error: contextError } = await supabase.rpc("teacher_get_operating_context");
        if (contextError) throw contextError;
        const context = (data ?? {}) as OperatingContext;
        if (!context.school_id) throw new Error("Select your active school to see assigned lessons.");
        const unique = new Map<string, Assignment>();
        for (const item of context.classes ?? []) {
          if (!item.class_id || !item.subject_id || !item.class_name || !item.subject_name) continue;
          unique.set(`${item.class_id}:${item.subject_id}`, item);
        }
        const rows = [...unique.values()].sort((a, b) =>
          a.class_name.localeCompare(b.class_name, "en", { numeric: true })
          || a.subject_name.localeCompare(b.subject_name)
        );
        if (cancelled) return;
        setAssignments(rows);

        const classes = [...new Set(rows.map(item => item.class_id))];
        const nextClass = classes.includes(initialClassId) ? initialClassId
          : classes.length === 1 ? classes[0] : "";
        const subjects = rows.filter(item => item.class_id === nextClass);
        const nextSubject = subjects.some(item => item.subject_id === initialSubjectId) ? initialSubjectId
          : subjects.length === 1 ? subjects[0].subject_id : "";
        setClassId(nextClass);
        setSubjectId(nextSubject);

        // This is only a shortcut; SubjectLessonHandoff and the workspace
        // re-check authority before the linked guide can be displayed.
        let stored: unknown = null;
        try {
          stored = JSON.parse(window.localStorage.getItem(`vibeschool.teacher-guide.recent.${auth.user.id}`) ?? "null");
        } catch {
          stored = null;
        }
        setRecent(
          validRecent(stored)
            && stored.schoolId === context.school_id
            && rows.some(item => item.class_id === stored.classId && item.subject_id === stored.subjectId)
            ? stored : null
        );
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load assigned lessons.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [initialClassId, initialSubjectId, retry]);

  const classes = useMemo(() => {
    const unique = new Map<string, string>();
    for (const item of assignments) {
      if (!unique.has(item.class_id)) unique.set(item.class_id, [item.class_name, item.stream].filter(Boolean).join(" "));
    }
    return [...unique.entries()];
  }, [assignments]);
  const subjects = useMemo(() => assignments.filter(item => item.class_id === classId), [assignments, classId]);

  const field: React.CSSProperties = {
    width: "100%", minHeight: 46, padding: "10px 12px", borderRadius: 11,
    border: "1px solid var(--teacher-border, #cbd5e1)", background: "#fff",
    fontSize: 15, color: "var(--teacher-ink, #1c2923)", fontFamily: "inherit",
  };

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "12px 14px 100px", display: "grid", gap: 12 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, color: "var(--teacher-ink, #1c2923)" }}>Teacher Guide</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--teacher-muted, #627168)" }}>Choose your lesson.</p>
      </header>

      {loading ? <p role="status" style={{ color: "var(--teacher-muted, #627168)" }}>Loading your classes…</p>
        : error ? (
          <section role="alert" style={{ border: "1px solid #fecaca", background: "#fff", borderRadius: 14, padding: 14 }}>
            <p style={{ margin: "0 0 12px", color: "#991b1b" }}>{error}</p>
            <button type="button" onClick={() => setRetry(n => n + 1)} style={{ ...field, width: "auto", cursor: "pointer" }}>Retry</button>
            <Link href="/teacher/classhub" style={{ marginLeft: 12, color: "#087451" }}>My Classes</Link>
          </section>
        ) : assignments.length === 0 ? (
          <section style={{ background: "#fff", border: "1px solid #dbe3ea", borderRadius: 14, padding: 14 }}>
            <p style={{ margin: "0 0 10px" }}>No assigned class subjects found.</p>
            <Link href="/teacher/classhub" style={{ color: "#087451", fontWeight: 700 }}>Open My Classes</Link>
          </section>
        ) : (
          <>
            <section aria-label="Select teaching context" style={{ background: "#fff", border: "1px solid #dbe3ea", borderRadius: 14, padding: 12, display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>
                Class
                <select aria-label="Class" style={field} value={classId} onChange={event => {
                  const next = event.target.value;
                  setClassId(next);
                  const forClass = assignments.filter(item => item.class_id === next);
                  setSubjectId(forClass.length === 1 ? forClass[0].subject_id : "");
                }}>
                  <option value="">Choose class</option>
                  {classes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>
                Subject
                <select aria-label="Subject" style={field} value={subjectId} disabled={!classId} onChange={event => setSubjectId(event.target.value)}>
                  <option value="">Choose subject</option>
                  {subjects.map(item => <option key={item.subject_id} value={item.subject_id}>{item.subject_name}</option>)}
                </select>
              </label>
            </section>
            {classId && subjectId ? (
              <SubjectLessonHandoff key={`${classId}:${subjectId}`} classId={classId} subjectId={subjectId} purpose="guide" />
            ) : (
              <p style={{ fontSize: 13, color: "var(--teacher-muted, #627168)", margin: 0 }}>
                Choose a class and subject to see scheduled and prepared lessons.
              </p>
            )}
            {recent && (
              <section aria-label="Last opened guide" style={{ borderTop: "1px solid #dbe3ea", paddingTop: 12 }}>
                <div style={{ fontSize: 12, color: "var(--teacher-muted, #627168)", marginBottom: 7 }}>Last opened</div>
                <Link href={recent.href} style={{ display: "flex", minHeight: 44, alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", border: "1px solid #dbe3ea", borderRadius: 12, background: "#fff", color: "var(--teacher-ink, #1c2923)", textDecoration: "none", fontWeight: 700 }}>
                  <span>{recent.title}</span><span aria-hidden="true">→</span>
                </Link>
              </section>
            )}
          </>
        )}
    </main>
  );
}
