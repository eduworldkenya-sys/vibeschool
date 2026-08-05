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
  if (n < 0)   return { label: "Overdue",      bg: "#fee2e2", color: "#991b1b" };
  if (n === 0) return { label: "Due Today",    bg: "#fef3c7", color: "#92400e" };
  if (n === 1) return { label: "Due Tomorrow", bg: "#fff7ed", color: "#c2410c" };
  return { label: `Due in ${n}d`, bg: "var(--vs-accent-soft)", color: "var(--vs-accent)" };
}

function autoBandLabel(mark: number): string {
  if (mark >= 80) return "Excellent";
  if (mark >= 60) return "Good";
  if (mark >= 40) return "Fair";
  return "Needs Improvement";
}

function IconBack() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
}
function IconCalendar() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function IconCheck() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function IconCamera() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
}

export default function HomeworkDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { identity, loading: idLoading } = useStudent();

  const [hw,          setHw]          = useState<Homework | null>(null);
  const [teacher,     setTeacher]     = useState("Teacher");
  const [questions,   setQuestions]   = useState<HomeworkQuestion[]>([]);
  const [submission,  setSubmission]  = useState<HomeworkSubmission | null>(null);
  const [answers,     setAnswers]     = useState<HomeworkAnswer[]>([]);
  const [draft,       setDraft]       = useState<Record<string, string>>({});
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Photo upload state
  const [photoFile,    setPhotoFile]    = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (idLoading || !identity || !id) return;

    async function load() {
      const { data: raw } = await supabase.from("homework").select("*").eq("id", id).maybeSingle();
      if (!raw) { setLoading(false); return; }
      const homework = raw as Homework;
      setHw(homework);

      const [teachRes, qRes, subRes] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", homework.teacher_id).maybeSingle(),
        supabase.from("homework_questions").select("*").eq("homework_id", homework.id).order("order_num", { ascending: true }),
        supabase.from("homework_submissions").select("*").eq("homework_id", homework.id).eq("student_id", identity!.studentId).maybeSingle(),
      ]);

      setTeacher(teachRes.data?.full_name ?? "Teacher");
      setQuestions((qRes.data as HomeworkQuestion[]) ?? []);
      const sub = subRes.data as HomeworkSubmission | null;
      setSubmission(sub ?? null);

      if (sub) {
        const { data: ans } = await supabase.from("homework_answers").select("*").eq("submission_id", sub.id);
        setAnswers((ans as HomeworkAnswer[]) ?? []);
        if (sub.photo_url) setPhotoPreview(sub.photo_url);
      }
      setLoading(false);
    }
    load();
  }, [identity, idLoading, id]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function uploadPhoto(file: File, studentId: string): Promise<string | null> {
    const ext  = file.name.split(".").pop() ?? "jpg";
    const path = `${studentId}/${id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("homework-photos").upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("homework-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function submit() {
    if (!identity || !hw) return;

    if (questions.length > 0 && !questions.every(q => (draft[q.id] ?? "").trim() !== "")) {
      setError("Please answer every question before submitting.");
      return;
    }
    if (questions.length === 0 && !photoFile && !photoPreview) {
      setError("Please take a photo of your completed work.");
      return;
    }

    setSaving(true); setUploading(true); setError(null);

    let photoUrl: string | null = null;
    if (photoFile) {
      photoUrl = await uploadPhoto(photoFile, identity.studentId);
      if (!photoUrl) {
        setError("Photo upload failed. Please try again.");
        setSaving(false); setUploading(false); return;
      }
    }
    setUploading(false);

    // G8: duplicate guard
    const { data: existing } = await supabase
      .from("homework_submissions")
      .select("id")
      .eq("homework_id", hw.id)
      .eq("student_id", identity.studentId)
      .maybeSingle();

    if (existing) {
      setError("You have already submitted this homework.");
      setSaving(false);
      return;
    }

    // G7: include school_id
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

    if (questions.length > 0) {
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

  if (!hw) return <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--vs-muted)", fontSize: 13 }}>Homework not found</div>;

  const badge       = dueBadge(hw.due_date, submission?.status);
  const isSubmitted = !!submission;
  const isMarked    = submission?.status === "marked";
  const answerFor   = (qid: string) => answers.find(a => a.question_id === qid)?.answer_text ?? "No answer given";

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>

      <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--vs-muted)", fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0, fontFamily: "inherit" }}>
        <IconBack /> Back
      </button>

      {/* Header */}
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
            { label: "Type",      value: hw.type.charAt(0).toUpperCase() + hw.type.slice(1) },
            { label: "Questions", value: questions.length > 0 ? `${questions.length}` : "—" },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.65)", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      {hw.instructions && (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--vs-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Instructions</div>
          <p style={{ fontSize: 13, color: "var(--vs-text)", lineHeight: 1.7, margin: 0 }}>{hw.instructions}</p>
        </div>
      )}

      {/* Marked feedback */}
      {isMarked && (
        <div style={{ background: "var(--vs-accent-soft)", border: "1px solid var(--vs-accent)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--vs-accent)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Teacher Feedback</div>
          {submission?.mark !== null && submission?.mark !== undefined && (
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--vs-accent)" }}>
              {submission.mark} marks · <span style={{ fontSize: 14 }}>{autoBandLabel(submission.mark)}</span>
            </div>
          )}
          {submission?.feedback && (
            <p style={{ fontSize: 13, color: "var(--vs-text)", marginTop: 8, lineHeight: 1.6, margin: "8px 0 0" }}>{submission.feedback}</p>
          )}
        </div>
      )}

      {/* Submitted banner */}
      {isSubmitted && !isMarked && (
        <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 14, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#065f46" }}><IconCheck /></span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#065f46" }}>Work submitted</div>
            <div style={{ fontSize: 11, color: "#047857", marginTop: 2 }}>Waiting for your teacher to mark it</div>
          </div>
        </div>
      )}

      {/* Submitted photo preview */}
      {isSubmitted && submission?.photo_url && (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--vs-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Your Work</div>
          <img src={submission.photo_url} alt="Submitted work" style={{ width: "100%", borderRadius: 10, objectFit: "cover", maxHeight: 320 }} />
        </div>
      )}

      {/* Questions the teacher attached to this homework */}
      {questions.length > 0 && (
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

      {/* No questions attached: photo-of-work upload */}
      {questions.length === 0 && !isSubmitted && (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: "16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--vs-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Your Work</div>
          <p style={{ fontSize: 13, color: "var(--vs-muted)", lineHeight: 1.6, marginBottom: 14 }}>
            Complete in your exercise book, then take a clear photo of your work.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            style={{ display: "none" }}
          />

          {photoPreview ? (
            <div>
              <img src={photoPreview} alt="Work preview" style={{ width: "100%", borderRadius: 10, objectFit: "cover", maxHeight: 280, marginBottom: 10 }} />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px dashed var(--vs-border)", background: "var(--vs-surface)", color: "var(--vs-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Retake photo
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ width: "100%", padding: "24px 16px", borderRadius: 12, border: "2px dashed var(--vs-border)", background: "var(--vs-surface)", color: "var(--vs-accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
            >
              <IconCamera />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Take a photo of your work</span>
              <span style={{ fontSize: 11, color: "var(--vs-muted)" }}>Tap to open camera</span>
            </button>
          )}
        </div>
      )}

      {/* Submit */}
      {!isSubmitted && (
        <>
          {error && <div style={{ fontSize: 12, color: "var(--vs-error, #ef4444)", marginBottom: 10 }}>{error}</div>}
          <button
            onClick={submit}
            disabled={saving}
            style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", background: "#0f766e", color: "#fff", fontSize: 14, fontWeight: 800, cursor: saving ? "wait" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1, transition: "all 0.2s" }}
          >
            {uploading ? "Uploading photo…" : saving ? "Submitting…" : "Submit My Work"}
          </button>
        </>
      )}
    </div>
  );
}

