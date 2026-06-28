"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStudent } from "@/lib/student-context";
import Skel from "@/components/student/Skel";

interface Lesson {
  id: string; title: string; subject: string; content_type: string;
  student_copy: string; objectives: string; day: number; teacher: string;
}

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function IconBack() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}
function IconBook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  )
}
function IconTarget() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  )
}

export default function LessonPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const { identity, loading: idLoading } = useStudent();
  const [lesson,  setLesson]  = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (idLoading || !id) return;
    async function load() {
      const { data: raw } = await supabase
        .from("lesson_plans")
        .select("id, title, content_type, student_copy, objectives, day_of_week, subject_id, teacher_id")
        .eq("id", id)
        .single();

      if (!raw) { setLoading(false); return; }

      const [subRes, teachRes] = await Promise.all([
        supabase.from("subjects").select("name").eq("id", raw.subject_id).single(),
        supabase.from("profiles").select("full_name").eq("id", raw.teacher_id).single(),
      ]);

      setLesson({
        id:           raw.id,
        title:        raw.title,
        content_type: raw.content_type ?? "notes",
        student_copy: raw.student_copy ?? "",
        objectives:   raw.objectives   ?? "",
        day:          raw.day_of_week  ?? 0,
        subject:      subRes.data?.name      ?? "Subject",
        teacher:      teachRes.data?.full_name ?? "Teacher",
      });
      setLoading(false);
    }
    load();
  }, [idLoading, id]);

  if (idLoading || loading) return (
    <div className="space-y-3 pt-2">
      <Skel h={24} radius={8} w="60%" /><Skel h={60} radius={12} /><Skel h={200} radius={12} />
    </div>
  );

  if (!lesson) return (
    <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--vs-muted)", fontSize: 13 }}>
      Lesson not found
    </div>
  );

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>

      {/* Back */}
      <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--vs-muted)", fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0, fontFamily: "inherit" }}>
        <IconBack /> Back
      </button>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1C1A2E 0%, #2D2060 100%)", borderRadius: 16, padding: "16px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600, marginBottom: 4 }}>
          {lesson.subject} · {DAY_NAMES[lesson.day] || ""}
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1.3 }}>{lesson.title}</h1>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>by {lesson.teacher}</div>
      </div>

      {/* Objectives */}
      {lesson.objectives && (
        <div style={{ background: "var(--vs-accent-soft)", border: "1px solid var(--vs-accent)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--vs-accent)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <IconTarget /> Learning Objectives
          </div>
          <p style={{ fontSize: 13, color: "var(--vs-text)", lineHeight: 1.7 }}>{lesson.objectives}</p>
        </div>
      )}

      {/* Content */}
      <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: "16px" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--vs-text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--vs-accent)" }}><IconBook /></span>
          Lesson Notes
        </div>
        {lesson.student_copy ? (
          <div style={{ fontSize: 14, color: "var(--vs-text)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
            {lesson.student_copy}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--vs-muted)", textAlign: "center", padding: "20px 0" }}>
            No notes available yet
          </div>
        )}
      </div>
    </div>
  );
}
