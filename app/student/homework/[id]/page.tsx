"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStudent } from "@/lib/student-context";
import Skel from "@/components/student/Skel";
import type { Homework, HomeworkAnswer, HomeworkQuestion } from "@/lib/types";
import {
  saveStudentHomeworkDraft,
  submitStudentHomework,
} from "@/lib/homework/studentSubmission";

type SubmissionStatus = "draft" | "submitted" | "received" | "under_review" | "returned" | "marked";

interface SubmissionRow {
  id: string;
  status: SubmissionStatus;
  photo_url: string | null;
  mark: number | null;
  feedback: string | null;
  submitted_at: string | null;
  received_at: string | null;
  revision_number: number;
  returned_reason: string | null;
}

function daysUntil(d: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function dueBadge(d: string, status?: SubmissionStatus) {
  if (status === "marked") return { label: "Marked", bg: "#d1fae5", color: "#065f46" };
  if (status === "under_review") return { label: "Under review", bg: "#dbeafe", color: "#1e40af" };
  if (status === "received" || status === "submitted") return { label: "Received", bg: "#d1fae5", color: "#065f46" };
  if (status === "returned") return { label: "Correction needed", bg: "#fef3c7", color: "#92400e" };
  if (status === "draft") return { label: "Draft", bg: "#f3f4f6", color: "#4b5563" };
  const n = daysUntil(d);
  if (n < 0) return { label: "Overdue", bg: "#fee2e2", color: "#991b1b" };
  if (n === 0) return { label: "Due today", bg: "#fef3c7", color: "#92400e" };
  if (n === 1) return { label: "Due tomorrow", bg: "#fff7ed", color: "#c2410c" };
  return { label: `Due in ${n}d`, bg: "var(--vs-accent-soft)", color: "var(--vs-accent)" };
}

function formatReceipt(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HomeworkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { identity, loading: identityLoading } = useStudent();

  const [homework, setHomework] = useState<Homework | null>(null);
  const [teacher, setTeacher] = useState("Teacher");
  const [questions, setQuestions] = useState<HomeworkQuestion[]>([]);
  const [submission, setSubmission] = useState<SubmissionRow | null>(null);
  const [answers, setAnswers] = useState<HomeworkAnswer[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"idle" | "draft" | "submit" | "upload">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (identityLoading || !identity || !id) return;

    async function load() {
      setLoading(true);
      const { data: raw } = await supabase.from("homework").select("*").eq("id", id).maybeSingle();
      if (!raw) {
        setLoading(false);
        return;
      }

      const hw = raw as Homework;
      setHomework(hw);

      const [teacherRes, questionRes, submissionRes] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", hw.teacher_id).maybeSingle(),
        // Never fetch model_answer into the learner browser.
        supabase.from("homework_questions").select("id,homework_id,question,order_num").eq("homework_id", hw.id).order("order_num"),
        supabase.from("homework_submissions").select("id,status,photo_url,mark,feedback,submitted_at,received_at,revision_number,returned_reason").eq("homework_id", hw.id).eq("student_id", identity!.studentId).maybeSingle(),
      ]);

      setTeacher(teacherRes.data?.full_name ?? "Teacher");
      setQuestions((questionRes.data as HomeworkQuestion[]) ?? []);

      const sub = submissionRes.data as SubmissionRow | null;
      setSubmission(sub);
      if (sub?.photo_url) setPhotoPreview(sub.photo_url);

      if (sub) {
        const { data } = await supabase.from("homework_answers").select("id,submission_id,question_id,answer_text,created_at").eq("submission_id", sub.id);
        const loadedAnswers = (data as HomeworkAnswer[]) ?? [];
        setAnswers(loadedAnswers);
        setDraft(Object.fromEntries(loadedAnswers.map(answer => [answer.question_id, answer.answer_text ?? ""])));
      }

      setLoading(false);
    }

    void load();
  }, [id, identity, identityLoading]);

  const locked = submission?.status === "marked" || submission?.status === "under_review";
  const editable = !locked;
  const finalSubmitted = submission != null && ["submitted", "received", "under_review", "marked"].includes(submission.status);
  const badge = homework ? dueBadge(homework.due_date, submission?.status) : null;

  function answerPayload() {
    return questions.map(question => ({
      questionId: question.id,
      answerText: draft[question.id] ?? "",
    }));
  }

  function validateComplete(): boolean {
    if (questions.length > 0 && !questions.every(question => (draft[question.id] ?? "").trim())) {
      setError("Please answer every question before submitting.");
      return false;
    }
    if (questions.length === 0 && !photoFile && !photoPreview) {
      setError("Please add a clear photo of your completed work.");
      return false;
    }
    return true;
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile || !identity) return photoPreview;
    setSaving("upload");
    const extension = photoFile.name.split(".").pop() ?? "jpg";
    const path = `${identity.studentId}/${id}-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("homework-photos").upload(path, photoFile, { upsert: true });
    if (uploadError) throw new Error("Photo upload failed. Please try again.");
    const { data } = supabase.storage.from("homework-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function saveDraft() {
    if (!homework || locked) return;
    setSaving("draft");
    setError(null);
    setMessage(null);
    try {
      const photoUrl = await uploadPhoto();
      const result = await saveStudentHomeworkDraft({ homeworkId: homework.id, answers: answerPayload(), photoUrl });
      setSubmission(previous => ({
        id: result.submissionId,
        status: "draft",
        photo_url: photoUrl ?? previous?.photo_url ?? null,
        mark: previous?.mark ?? null,
        feedback: previous?.feedback ?? null,
        submitted_at: previous?.submitted_at ?? null,
        received_at: previous?.received_at ?? null,
        revision_number: result.revisionNumber,
        returned_reason: previous?.returned_reason ?? null,
      }));
      setPhotoPreview(photoUrl);
      setPhotoFile(null);
      setMessage("Draft saved. You can continue later.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save draft.");
    } finally {
      setSaving("idle");
    }
  }

  async function submit() {
    if (!homework || locked || !validateComplete()) return;
    setSaving("submit");
    setError(null);
    setMessage(null);
    try {
      const photoUrl = await uploadPhoto();
      const result = await submitStudentHomework({ homeworkId: homework.id, answers: answerPayload(), photoUrl });
      setSubmission(previous => ({
        id: result.submissionId,
        status: "received",
        photo_url: photoUrl ?? previous?.photo_url ?? null,
        mark: previous?.mark ?? null,
        feedback: previous?.feedback ?? null,
        submitted_at: result.submittedAt ?? null,
        received_at: result.receivedAt ?? null,
        revision_number: result.revisionNumber,
        returned_reason: null,
      }));
      setAnswers(answerPayload().map((answer, index) => ({
        id: `local-${index}`,
        submission_id: result.submissionId,
        question_id: answer.questionId,
        answer_text: answer.answerText,
        created_at: result.receivedAt ?? "",
      })));
      setPhotoPreview(photoUrl);
      setPhotoFile(null);
      setMessage("Submitted successfully. Vibeschool has received your work.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit homework.");
    } finally {
      setSaving("idle");
    }
  }

  if (identityLoading || loading) return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}><Skel h={28} radius={8} /><Skel h={120} radius={14} /><Skel h={180} radius={14} /></div>;
  if (!homework || !badge) return <div style={{ padding: 32, textAlign: "center", color: "var(--vs-muted)" }}>Homework not found</div>;

  return (
    <div style={{ paddingBottom: 90 }}>
      <button onClick={() => router.back()} style={{ border: 0, background: "none", color: "var(--vs-muted)", fontWeight: 700, marginBottom: 14 }}>← Back</button>

      <section style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)", color: "white", borderRadius: 16, padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 19 }}>{homework.title}</h1>
          <span style={{ background: badge.bg, color: badge.color, borderRadius: 20, padding: "5px 10px", fontSize: 11, fontWeight: 800 }}>{badge.label}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>{homework.subject} · {teacher} · Due {new Date(homework.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</div>
      </section>

      {homework.instructions && <section style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: 16, marginBottom: 14 }}><strong>Instructions</strong><p style={{ lineHeight: 1.6 }}>{homework.instructions}</p></section>}

      {submission && finalSubmitted && (
        <section style={{ background: submission.status === "marked" ? "var(--vs-accent-soft)" : "#d1fae5", borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <strong>{submission.status === "marked" ? "Marked" : submission.status === "under_review" ? "Teacher is reviewing" : "Received by Vibeschool"}</strong>
          <div style={{ fontSize: 12, marginTop: 6 }}>Submitted: {formatReceipt(submission.submitted_at)}</div>
          <div style={{ fontSize: 12, marginTop: 2 }}>Server receipt: {formatReceipt(submission.received_at)}</div>
          <div style={{ fontSize: 12, marginTop: 2 }}>Revision: {submission.revision_number}</div>
          {submission.mark != null && <div style={{ fontSize: 20, fontWeight: 900, marginTop: 10 }}>{submission.mark} marks</div>}
          {submission.feedback && <p style={{ marginBottom: 0 }}>{submission.feedback}</p>}
        </section>
      )}

      {submission?.status === "returned" && <section style={{ background: "#fef3c7", borderRadius: 14, padding: 16, marginBottom: 14 }}><strong>Returned for correction</strong><p>{submission.returned_reason || "Please review your work, make corrections and submit again."}</p></section>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        {questions.map((question, index) => (
          <section key={question.id} style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: 16 }}>
            <div style={{ color: "var(--vs-accent)", fontSize: 12, fontWeight: 800 }}>Question {index + 1}</div>
            <p>{question.question}</p>
            <textarea disabled={!editable} value={draft[question.id] ?? ""} onChange={event => setDraft(current => ({ ...current, [question.id]: event.target.value }))} rows={3} placeholder="Write your answer here..." style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--vs-border)", borderRadius: 10, padding: 12, background: editable ? "var(--vs-surface)" : "#f3f4f6", color: "var(--vs-text)", fontFamily: "inherit" }} />
          </section>
        ))}
      </div>

      {questions.length === 0 && editable && (
        <section style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={event => { const file = event.target.files?.[0]; if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); } }} style={{ display: "none" }} />
          {photoPreview && <img src={photoPreview} alt="Homework preview" style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />}
          <button onClick={() => fileInputRef.current?.click()} style={{ width: "100%", padding: 14, borderRadius: 10, border: "1px dashed var(--vs-border)", background: "var(--vs-surface)", fontWeight: 700 }}>{photoPreview ? "Replace photo" : "Take a photo of your work"}</button>
        </section>
      )}

      {message && <div style={{ background: "#d1fae5", color: "#065f46", borderRadius: 10, padding: 12, marginBottom: 10 }}>{message}</div>}
      {error && <div style={{ color: "#b91c1c", marginBottom: 10 }}>{error}</div>}

      {editable && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button onClick={saveDraft} disabled={saving !== "idle"} style={{ padding: 14, borderRadius: 12, border: "1px solid #0f766e", background: "white", color: "#0f766e", fontWeight: 800 }}>{saving === "draft" || saving === "upload" ? "Saving…" : "Save Draft"}</button>
          <button onClick={submit} disabled={saving !== "idle"} style={{ padding: 14, borderRadius: 12, border: 0, background: "#0f766e", color: "white", fontWeight: 800 }}>{saving === "submit" || saving === "upload" ? "Submitting…" : submission?.status === "returned" ? "Resubmit" : "Submit Work"}</button>
        </div>
      )}
    </div>
  );
}
