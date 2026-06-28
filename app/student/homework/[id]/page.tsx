"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStudent } from "@/lib/student-context";
import Skel from "@/components/student/Skel";
import { Homework, HomeworkQuestion, HomeworkSubmission, HomeworkAnswer } from "@/lib/types";

function daysUntil(d: string): number {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const due = new Date(d); due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - t.getTime()) / 86400000);
}

function dueBadge(d: string, status: string | undefined) {
  if (status === "marked")    return { label: "Marked",    bg: "#d1fae5", color: "#065f46" };
  if (status === "submitted") return { label: "Submitted", bg: "#d1fae5", color: "#065f46" };
  const n = daysUntil(d);
  if (n < 0)   return { label: "Overdue",   bg: "#fee2e2", color: "#991b1b" };
  if (n === 0) return { label: "Due Today", bg: "#fef3c7", color: "#92400e" };
  return { label: `Due in ${n}d`, bg: "var(--vs-accent-soft)", color: "var(--vs-accent)" };
}

function IconBack() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>;
}
function IconCalendar() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
}
function IconCheck() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}

export default function HomeworkDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const { identity, loading: idLoading } = useStudent();
  const fileRef   = useRef<HTMLInputElement>(null);

  const [hw,          setHw]          = useState<Homework | null>(null);
  const [teacher,     setTeacher]     = useState("Teacher");
  const [questions,   setQuestions]   = useState<HomeworkQuestion[]>([]);
  const [submission,  setSubmission]  = useState<HomeworkSubmission | null>(null);
  const [answers,     setAnswers]     = useState<HomeworkAnswer[]>([]);
  const [draft,       setDraft]       = useState<Record<string, string>>({});
  const [photoFile,   setPhotoFile]   = useState<File | null>(null);
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (idLoading || !identity || !id) return;

    async function load() {
      let hwQuery = supabase.from("homework").select("*").eq("id", id);
      if (identity!.schoolId) hwQuery = hwQuery.eq("school_id", identity!.schoolId);
      const { data: raw } = await hwQuery.maybeSingle();

      if (!raw) { setLoading(false); return; }
      const homework = raw as Homework;
      setHw(homework);

      const [teachRes, qRes, subRes] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", homework.teacher_id).maybeSingle(),
        homework.type === "smart"
          ? supabase.from("homework_questions").select("*").eq("homework_id", homework.id).order("order_num", { ascending: true })
          : Promise.resolve({ data: [] as HomeworkQuestion[] }),
        supabase.from("homework_submissions").select("*").eq("homework_id", homework.id).eq("student_id", identity!.studentId).maybeSingle(),
      ]);

      setTeacher(teachRes.data?.full_name ?? "Teacher");
      setQuestions((qRes.data as HomeworkQuestion[]) ?? []);

      const sub = subRes.data as HomeworkSubmission | null;
      setSubmission(sub ?? null);

      if (sub) {
        const { data: ans } = await supabase.from("homework_answers").select("*").eq("submission_id", sub.id);
        setAnswers((ans as HomeworkAnswer[]) ?? []);
      }

      setLoading(false);
    }
    load();
  }, [identity, idLoading, id]);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function submit() {
    if (!identity || !hw) return;

    if (hw.type === "smart") {
      if (!questions.every(q => (draft[q.id] ?? "").trim() !== "")) {
        setError("Please answer every question before submitting.");
        return;
      }
    }

    if (hw.type === "book" && !photoFile) {
      setError("Please take a photo of your work before submitting.");
      return;
    }

    setSaving(true); setError(null);

    let photoUrl: string | null = null;

    if (hw.type === "book" && photoFile) {
      const ext  = photoFile.name.split(".").pop() ?? "jpg";
      const path = `homework/${hw.id}/${identity.studentId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("homework-submissions").upload(path, photoFile);
      if (upErr) { setError("Photo upload failed. Please try again."); setSaving(false); return; }
      const { data: urlData } = supabase.storage.from("homework-submissions").getPublicUrl(path);
      photoUrl = urlData.publicUrl;
    }

    const { data: sub, error: subErr } = await supabase
      .from("homework_submissions")
      .insert({
        homework_id:  hw.id,
        student_id:   identity.studentId,
        status:       "submitted",
        submitted_at: new Date().toISOString(),
        photo_url:    photoUrl,
      })
      .select()
      .single();

    if (subErr || !sub) { setError("Could not submit. Please try again."); setSaving(false); return; }

    if (hw.type === "smart" && questions.length > 0) {
      const rows = questions.map(q => ({
        submission_id: sub.id,
        question_id:   q.id,
        answer_text:   draft[q.id].trim(),
      }));
      await supabase.from("homework_answers").insert(rows);
      setAnswers(rows.map((r, i) => ({ ...r, id: `tmp-${i}`, created_at: "" })));
    }

    setSubmission(sub as HomeworkSubmission);
    setSaving(false);
  }

  if (idLoading || loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
      <Skel h={24} radius={8} w="60%" /><Skel h={100} radius={12} /><Skel h={160} radius={12} />
    </div>
  );

  if (!hw) return (
    <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--vs-muted)", fontSize: 13 }}>Homework not found</div>
  );

  const badge       = dueBadge(hw.due_date, submission?.status);
  const isSubmitted = !!submission;
  const isMarked    = submission?.status === "marked";
  const answerFor   = (qid: string) => answers.find(a => a.question_id === qid)?.answer_text ?? "No answer given";

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>
      <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--vs-muted)", fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0, fontFamily: "inherit" }}>
        <IconBack /> Back
      </button>

      <div style={{ background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)", borderRadius: 16, padding: "16px", marginBottom: 14, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <h1 style={{ fontSize: 17, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1.3, color: "#fff" }}>{hw.title}</h1>
          <span style={{ padding: "4px 10px", borderRadius: 20, background: badge.bg, color: badge.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{badge.label}</span>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: 6 }}>
          <IconCalendar />
          {hw.subject} · {teacher} · Due {new Date(hw.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {[
            { label: "Type",      value: hw.type === "smart" ? "Smart" : "Book" },
            { label: "Questions", value: questions.length > 0 ? `${questions.length}` : "—" },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.65)", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {hw.instructions && (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--vs-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Instructions</div>
          <p style={{ fontSize: 13, color: "var(--vs-text)", lineHeight: 1.7, margin: 0 }}>{hw.instructions}</p>
        </div>
      )}

      {isMarked && (
        <div style={{ background: "var(--vs-accent-soft)", border: "1px solid var(--vs-accent)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--vs-accent)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Teacher Feedback</div>
          {submission?.mark !== null && submission?.mark !== undefined && (
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--vs-accent)" }}>{submission.mark} marks</div>
          )}
          {submission?.feedback && (
            <p style={{ fontSize: 13, color: "var(--vs-text)", marginTop: 8, lineHeight: 1.6, margin: 0 }}>{submission.feedback}</p>
          )}
        </div>
      )}

      {isSubmitted && !isMarked && (
        <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 14, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#065f46" }}><IconCheck /></span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#065f46" }}>Work submitted</div>
            <div style={{ fontSize: 11, color: "#047857", marginTop: 2 }}>Waiting for your teacher to mark it</div>
          </div>
        </div>
      )}

      {hw.type === "smart" && questions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
          {questions.map((q, i) => (
            <div key={q.id} style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--vs-accent)", marginBottom: 8 }}>Question {i + 1}</div>
              <p style={{ fontSize: 13, color: "var(--vs-text)", lineHeight: 1.6, marginBottom: isSubmitted ? 0 : 10 }}>{q.question}</p>
              {!isSubmitted ? (
                <textarea
                  value={draft[q.id] ?? ""}
                  onChange={e => setDraft(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Write your answer here..."
                  rows={3}
                  style={{ width: "100%", borderRadius: 10, border: "1px solid var(--vs-border)", background: "var(--vs-surface)", color: "var(--vs-text)", padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }}
                />
              ) : (
                <div style={{ fontSize: 13, color: "var(--vs-muted)", background: "var(--vs-surface)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.6, marginTop: 8 }}>
                  {answerFor(q.id)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hw.type === "book" && !isSubmitted && (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--vs-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Photo of your work</div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhotoChange} style={{ display: "none" }} />
          {previewUrl ? (
            <div>
              <img src={previewUrl} alt="Your work" style={{ width: "100%", borderRadius: 10, objectFit: "cover", maxHeight: 220, marginBottom: 10 }} />
              <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px dashed #d1d5db", background: "var(--vs-surface)", color: "var(--vs-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Retake Photo
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} style={{ width: "100%", border: "2px dashed #d1d5db", borderRadius: 12, background: "var(--vs-surface)", padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <span style={{ fontSize: 36 }}>📷</span>
              <p style={{ margin: 0, fontSize: 13, color: "var(--vs-muted)", fontWeight: 600 }}>Take a photo of your exercise book</p>
              <p style={{ margin: 0, fontSize: 11, color: "var(--vs-muted)" }}>Required before submitting</p>
            </button>
          )}
        </div>
      )}

      {hw.type === "book" && isSubmitted && (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          {submission?.photo_url ? (
            <img src={submission.photo_url} alt="Submitted work" style={{ width: "100%", borderRadius: 10, objectFit: "cover", maxHeight: 220 }} />
          ) : (
            <div style={{ fontSize: 13, color: "var(--vs-muted)" }}>Book assignment submitted.</div>
          )}
        </div>
      )}

      {!isSubmitted && (
        <>
          {error && <div style={{ fontSize: 12, color: "var(--vs-error)", marginBottom: 10 }}>{error}</div>}
          <button
            onClick={submit}
            disabled={saving}
            style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", background: "#0f766e", color: "#fff", fontSize: 14, fontWeight: 800, cursor: saving ? "wait" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1, transition: "all 0.2s" }}
          >
            {saving ? "Submitting..." : "Submit My Work"}
          </button>
        </>
      )}
    </div>
  );
}
