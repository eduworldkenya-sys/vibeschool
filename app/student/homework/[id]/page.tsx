"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStudent } from "@/lib/student-context";
import Skel from "@/components/student/Skel";

interface HWDetail {
  id: string; title: string; description: string; type: string;
  due_date: string; subject: string; teacher: string;
  questions: { id: string; question: string; marks: number }[];
  submission: { id: string; answer: string; mark: number | null; feedback: string | null } | null;
}

function daysUntil(d: string): number {
  const t = new Date(); t.setHours(0,0,0,0);
  const due = new Date(d); due.setHours(0,0,0,0);
  return Math.round((due.getTime() - t.getTime()) / 86400000);
}

function dueBadge(d: string, submitted: boolean) {
  if (submitted) return { label: "Submitted", bg: "#d1fae5", color: "#065f46" };
  const n = daysUntil(d);
  if (n < 0)  return { label: "Overdue",   bg: "#fee2e2", color: "#991b1b" };
  if (n === 0) return { label: "Due Today", bg: "#fef3c7", color: "#92400e" };
  return { label: `Due in ${n}d`, bg: "var(--vs-accent-soft)", color: "var(--vs-accent)" };
}

function IconBack() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}
function IconCalendar() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

export default function HomeworkDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const { identity, loading: idLoading } = useStudent();
  const [hw,      setHw]      = useState<HWDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [answer,  setAnswer]  = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (idLoading || !identity || !id) return;
    async function load() {
      const { data: raw } = await supabase
        .from("homework")
        .select("id, title, description, type, due_date, subject_id, teacher_id")
        .eq("id", id)
        .single();

      if (!raw) { setLoading(false); return; }

      const [subRes, teachRes, qRes, subRes2] = await Promise.all([
        supabase.from("subjects").select("name").eq("id", raw.subject_id).single(),
        supabase.from("profiles").select("full_name").eq("id", raw.teacher_id).single(),
        supabase.from("homework_questions").select("id, question, marks").eq("homework_id", id).order("created_at"),
        supabase.from("homework_submissions").select("id, answer, mark, feedback").eq("homework_id", id).eq("student_id", identity!.studentId).maybeSingle(),
      ]);

      setHw({
        id: raw.id, title: raw.title, description: raw.description ?? "",
        type: raw.type, due_date: raw.due_date,
        subject:  subRes.data?.name    ?? "Subject",
        teacher:  teachRes.data?.full_name ?? "Teacher",
        questions: qRes.data ?? [],
        submission: subRes2.data ?? null,
      });

      if (subRes2.data?.answer) setAnswer(subRes2.data.answer);
      setLoading(false);
    }
    load();
  }, [identity, idLoading, id]);

  async function submit() {
    if (!identity || !hw) return;
    setSaving(true); setError(null);
    const finalAnswer = hw.questions.length > 0
      ? JSON.stringify(answers)
      : answer;

    const { error: err } = await supabase.from("homework_submissions").upsert({
      homework_id: hw.id,
      student_id:  identity.studentId,
      answer:      finalAnswer,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "homework_id,student_id" });

    if (err) { setError("Could not submit. Please try again."); setSaving(false); return; }
    setSaved(true); setSaving(false);
    setHw(prev => prev ? { ...prev, submission: { id: "", answer: finalAnswer, mark: null, feedback: null } } : prev);
  }

  if (idLoading || loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
      <Skel h={24} radius={8} w="60%" /><Skel h={100} radius={12} /><Skel h={160} radius={12} />
    </div>
  );

  if (!hw) return (
    <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--vs-muted)", fontSize: 13 }}>
      Homework not found
    </div>
  );

  const badge      = dueBadge(hw.due_date, !!hw.submission);
  const submitted  = !!hw.submission;
  const hasMarking = hw.submission?.mark !== null && hw.submission?.mark !== undefined;

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>

      {/* Back */}
      <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--vs-muted)", fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0, fontFamily: "inherit" }}>
        <IconBack /> Back
      </button>

      {/* Header card */}
      <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: "16px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: "var(--vs-text)", fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1.3 }}>{hw.title}</h1>
          <span style={{ padding: "4px 10px", borderRadius: 20, background: badge.bg, color: badge.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{badge.label}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--vs-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <IconCalendar />
          {hw.subject} · {hw.teacher} · Due {new Date(hw.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
        </div>
        {hw.description && (
          <p style={{ fontSize: 13, color: "var(--vs-muted)", marginTop: 10, lineHeight: 1.6 }}>{hw.description}</p>
        )}
      </div>

      {/* Marking feedback */}
      {hasMarking && (
        <div style={{ background: "var(--vs-accent-soft)", border: "1px solid var(--vs-accent)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--vs-accent)", marginBottom: 6 }}>Teacher Feedback</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--vs-accent)" }}>{hw.submission?.mark} marks</div>
          {hw.submission?.feedback && <p style={{ fontSize: 13, color: "var(--vs-text)", marginTop: 6, lineHeight: 1.6 }}>{hw.submission.feedback}</p>}
        </div>
      )}

      {/* Questions */}
      {hw.questions.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
          {hw.questions.map((q, i) => (
            <div key={q.id} style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--vs-accent)", marginBottom: 6 }}>Q{i + 1} · {q.marks} mark{q.marks !== 1 ? "s" : ""}</div>
              <p style={{ fontSize: 13, color: "var(--vs-text)", lineHeight: 1.6, marginBottom: 10 }}>{q.question}</p>
              {!submitted ? (
                <textarea
                  value={answers[q.id] ?? ""}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Write your answer here..."
                  rows={3}
                  style={{
                    width: "100%", borderRadius: 10, border: "1px solid var(--vs-border)",
                    background: "var(--vs-surface)", color: "var(--vs-text)",
                    padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "vertical",
                    outline: "none",
                  }}
                />
              ) : (
                <div style={{ fontSize: 13, color: "var(--vs-muted)", background: "var(--vs-surface)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.6 }}>
                  {(() => { try { return JSON.parse(hw.submission?.answer ?? "{}")[q.id] || "No answer given"; } catch { return hw.submission?.answer || "No answer given"; } })()}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        !submitted && (
          <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--vs-accent)", marginBottom: 8 }}>Your Answer</div>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Write your answer here..."
              rows={5}
              style={{
                width: "100%", borderRadius: 10, border: "1px solid var(--vs-border)",
                background: "var(--vs-surface)", color: "var(--vs-text)",
                padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none",
              }}
            />
          </div>
        )
      )}

      {/* Submit */}
      {!submitted && (
        <>
          {error && <div style={{ fontSize: 12, color: "var(--vs-error)", marginBottom: 10 }}>{error}</div>}
          <button
            onClick={submit}
            disabled={saving || saved}
            style={{
              width: "100%", padding: "14px", borderRadius: 14, border: "none",
              background: saved ? "var(--vs-success)" : "var(--vs-accent)",
              color: "#fff", fontSize: 14, fontWeight: 800, cursor: saving ? "wait" : "pointer",
              fontFamily: "inherit", opacity: saving ? 0.7 : 1, transition: "all 0.2s",
            }}
          >
            {saving ? "Submitting..." : saved ? "Submitted!" : "Submit My Work"}
          </button>
        </>
      )}
    </div>
  );
}
