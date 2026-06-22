
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Homework,
  HomeworkQuestion,
  HomeworkSubmission,
  HomeworkAnswer,
} from "@/lib/types";

function subjectColor(subject: string): string {
  const map: Record<string, string> = {
    math:        "#6366f1",
    mathematics: "#6366f1",
    english:     "#0ea5e9",
    science:     "#10b981",
    social:      "#f59e0b",
    kiswahili:   "#ef4444",
    cre:         "#8b5cf6",
    art:         "#ec4899",
  };
  const key = subject.toLowerCase().split(" ")[0];
  return map[key] ?? "#1e1b4b";
}

function dueDateLabel(due: string): { text: string; color: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const diff = d.getTime() - today.getTime();
  if (diff < 0)   return { text: "Overdue",   color: "#ef4444" };
  if (diff === 0) return { text: "Due today", color: "#f59e0b" };
  return {
    text:  `Due ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
    color: "#6b7280",
  };
}

function Skeleton() {
  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="shimmer" style={{ height: 100, borderRadius: 14 }} />
      <div className="shimmer" style={{ height: 20, width: "60%", borderRadius: 6 }} />
      <div className="shimmer" style={{ height: 16, width: "80%", borderRadius: 6 }} />
      <div className="shimmer" style={{ height: 16, width: "70%", borderRadius: 6 }} />
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s infinite linear;
        }
      `}</style>
    </div>
  );
}

interface ChildOption {
  studentId: string;
  name:      string;
  classId:   string;
}

export default function HomeworkDetailPage() {
  const params  = useParams();
  const hwId    = params.id as string;
  const fileRef = useRef<HTMLInputElement>(null);

  const [userId,        setUserId]        = useState<string | null>(null);
  const [homework,      setHomework]      = useState<Homework | null>(null);
  const [teacherName,   setTeacherName]   = useState<string>("");
  const [questions,     setQuestions]     = useState<HomeworkQuestion[]>([]);
  const [children,      setChildren]      = useState<ChildOption[]>([]);
  const [activeChild,   setActiveChild]   = useState<ChildOption | null>(null);
  const [submission,    setSubmission]    = useState<HomeworkSubmission | null>(null);
  const [answers,       setAnswers]       = useState<HomeworkAnswer[]>([]);
  const [draftAnswers,  setDraftAnswers]  = useState<Record<string, string>>({});
  const [selectedFile,  setSelectedFile]  = useState<File | null>(null);
  const [previewUrl,    setPreviewUrl]    = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [submitting,    setSubmitting]    = useState(false);
  const [submitted,     setSubmitted]     = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [expanded,      setExpanded]      = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: import("@supabase/supabase-js").User | null } }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  const fetchSubmission = useCallback(async (hwid: string, studentId: string) => {
    const { data: sub } = await supabase
      .from("homework_submissions")
      .select("*")
      .eq("homework_id", hwid)
      .eq("student_id", studentId)
      .maybeSingle();
    setSubmission(sub ?? null);
    if (sub) {
      const { data: ans } = await supabase
        .from("homework_answers")
        .select("*")
        .eq("submission_id", sub.id);
      setAnswers((ans as HomeworkAnswer[]) ?? []);
    } else {
      setAnswers([]);
    }
  }, []);

  const fetchAll = useCallback(async (uid: string) => {
    setLoading(true);
    const { data: hw, error: hwErr } = await supabase
      .from("homework")
      .select("*")
      .eq("id", hwId)
      .maybeSingle();
    if (hwErr || !hw) { setError("Homework not found"); setLoading(false); return; }
    setHomework(hw as Homework);

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", hw.teacher_id)
      .maybeSingle();
    setTeacherName(prof?.full_name ?? "Teacher");

    if (hw.type === "smart") {
      const { data: qs } = await supabase
        .from("homework_questions")
        .select("*")
        .eq("homework_id", hwId)
        .order("order_num", { ascending: true });
      setQuestions((qs as HomeworkQuestion[]) ?? []);
    }

    const { data: links } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("parent_id", uid);
    if (!links || links.length === 0) {
      setError("This homework is not assigned to your child");
      setLoading(false);
      return;
    }

    const studentIds = links.map((l: { student_id: string }) => l.student_id);
    const { data: students } = await supabase
      .from("students")
      .select("id, name, class_id")
      .in("id", studentIds);

    const matched: ChildOption[] = ((students ?? []) as { id: string; name: string; class_id: string }[])
      .filter((s) => s.class_id === hw.class_id)
      .map((s) => ({ studentId: s.id, name: s.name, classId: s.class_id }));

    if (matched.length === 0) {
      setError("This homework is not assigned to your child");
      setLoading(false);
      return;
    }

    setChildren(matched);
    setActiveChild(matched[0]);
    await fetchSubmission(hwId, matched[0].studentId);
    setLoading(false);
  }, [hwId, fetchSubmission]);

  useEffect(() => {
    if (userId) fetchAll(userId);
  }, [userId, fetchAll]);

  const switchChild = useCallback(async (child: ChildOption) => {
    setActiveChild(child);
    setSubmission(null);
    setAnswers([]);
    setDraftAnswers({});
    setSelectedFile(null);
    setPreviewUrl(null);
    setSubmitted(false);
    await fetchSubmission(hwId, child.studentId);
  }, [hwId, fetchSubmission]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const submitSmart = useCallback(async () => {
    if (!activeChild || !homework) return;
    const allAnswered = questions.every((q) => (draftAnswers[q.id] ?? "").trim() !== "");
    if (!allAnswered) return;
    setSubmitting(true);
    const { data: sub, error: subErr } = await supabase
      .from("homework_submissions")
      .insert({
        homework_id:  homework.id,
        student_id:   activeChild.studentId,
        status:       "submitted",
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (subErr || !sub) { setSubmitting(false); return; }
    const ansRows = questions.map((q) => ({
      submission_id: sub.id,
      question_id:   q.id,
      answer_text:   draftAnswers[q.id].trim(),
    }));
    await supabase.from("homework_answers").insert(ansRows);
    setSubmission(sub as HomeworkSubmission);
    setAnswers(ansRows.map((a, i) => ({ ...a, id: `tmp-${i}`, created_at: "" })) as HomeworkAnswer[]);
    setSubmitted(true);
    setSubmitting(false);
  }, [activeChild, homework, questions, draftAnswers]);

  const submitBook = useCallback(async () => {
    if (!activeChild || !homework) return;
    setSubmitting(true);
    const { data: sub, error: subErr } = await supabase
      .from("homework_submissions")
      .insert({
        homework_id:  homework.id,
        student_id:   activeChild.studentId,
        status:       "submitted",
        submitted_at: new Date().toISOString(),
        photo_url:    null,
      })
      .select()
      .single();
    if (subErr || !sub) { setSubmitting(false); return; }
    setSubmission(sub as HomeworkSubmission);
    setSubmitted(true);
    setSubmitting(false);
  }, [activeChild, homework]);

  if (loading) return (
    <div style={{ background: "#f0f2f5" }}><Skeleton /></div>
  );

  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f0f2f5", gap: 16, padding: 32, textAlign: "center" }}>
      <span style={{ fontSize: 40 }}>📭</span>
      <p style={{ fontSize: 16, fontWeight: 600, color: "#111827", margin: 0 }}>{error}</p>
    </div>
  );

  if (!homework || !activeChild) return null;

  const due              = dueDateLabel(homework.due_date);
  const sColor           = subjectColor(homework.subject);
  const isMarked         = submission?.status === "marked";
  const isSubmitted      = submission?.status === "submitted";
  const allAnswered      = questions.every((q) => (draftAnswers[q.id] ?? "").trim() !== "");
  const instructions     = homework.instructions ?? "";
  const longInstructions = instructions.length > 120;

  return (
    <div id="parent-homework-detail" style={{ background: "#f0f2f5", paddingBottom: 48 }}>

      <div style={{ background: "#fff", padding: "20px 16px 16px", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ background: sColor, color: "#fff", borderRadius: 999, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
            {homework.subject}
          </span>
          <span style={{ background: homework.type === "smart" ? "#ede9fe" : "#fef3c7", color: homework.type === "smart" ? "#6d28d9" : "#92400e", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
            {homework.type === "smart" ? "Smart" : "Book"}
          </span>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>{homework.title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: due.color }}>{due.text}</span>
          <span style={{ fontSize: 13, color: "#6b7280" }}>Set by {teacherName}</span>
        </div>
        {instructions.length > 0 && (
          <div>
            <p style={{ fontSize: 14, color: "#374151", margin: "0 0 4px", lineHeight: 1.6 }}>
              {longInstructions && !expanded ? `${instructions.slice(0, 120)}...` : instructions}
            </p>
            {longInstructions && (
              <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", color: "#10b981", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}
      </div>

      {children.length > 1 && (
        <div style={{ padding: "12px 16px", display: "flex", gap: 8, overflowX: "auto" }}>
          {children.map((c) => (
            <button key={c.studentId} onClick={() => switchChild(c)} style={{ padding: "8px 16px", borderRadius: 999, border: "none", background: activeChild.studentId === c.studentId ? "#1e1b4b" : "#e5e7eb", color: activeChild.studentId === c.studentId ? "#fff" : "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
              {c.name.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: "10px 16px 0" }}>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          For <strong style={{ color: "#111827" }}>{activeChild.name.split(" ")[0]}</strong>
        </p>
      </div>

      {isMarked && (
        <div style={{ margin: "12px 16px 0", background: "#f0fdf4", border: "1px solid #10b981", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: "#065f46" }}>{submission?.mark ?? 0} pts</p>
          {submission?.feedback && <p style={{ margin: 0, fontSize: 14, color: "#374151" }}>{submission.feedback}</p>}
        </div>
      )}

      {(isSubmitted || submitted) && !isMarked && (
        <div style={{ margin: "12px 16px 0", background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>⏳</span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#92400e" }}>Awaiting teacher review</p>
        </div>
      )}

      <div style={{ padding: "16px" }}>
        {homework.type === "smart" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {questions.map((q, idx) => {
              const existingAnswer = answers.find((a) => a.question_id === q.id);
              const readOnly = isMarked || isSubmitted || submitted;
              return (
                <div key={q.id} style={{ background: "#fff", borderRadius: 12, padding: 16 }}>
                  <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "#111827" }}>{idx + 1}. {q.question}</p>
                  {readOnly ? (
                    <p style={{ margin: 0, fontSize: 14, color: "#374151", background: "#f9fafb", borderRadius: 8, padding: "10px 12px" }}>
                      {existingAnswer?.answer_text ?? draftAnswers[q.id] ?? "—"}
                    </p>
                  ) : (
                    <>
                      <textarea
                        value={draftAnswers[q.id] ?? ""}
                        onChange={(e) => setDraftAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        rows={3}
                        placeholder="Write your answer..."
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                      />
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af", textAlign: "right" }}>{(draftAnswers[q.id] ?? "").length} chars</p>
                    </>
                  )}
                </div>
              );
            })}
            {!isMarked && !isSubmitted && !submitted && (
              <button onClick={submitSmart} disabled={submitting || !allAnswered} style={{ padding: "14px", borderRadius: 12, border: "none", background: (submitting || !allAnswered) ? "#d1fae5" : "#10b981", color: "#fff", fontSize: 15, fontWeight: 700, cursor: (submitting || !allAnswered) ? "not-allowed" : "pointer" }}>
                {submitting ? "Submitting..." : "Submit Homework"}
              </button>
            )}
          </div>
        )}

        {homework.type === "book" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {isMarked && submission?.photo_url && (
              <img src={submission.photo_url} alt="Submitted work" style={{ width: "100%", borderRadius: 12, objectFit: "cover" }} />
            )}
            {(isSubmitted || submitted) && !isMarked && (
              <div style={{ background: "#fff", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                {previewUrl ? (
                  <img src={previewUrl} alt="Your work" style={{ width: "100%", borderRadius: 8, objectFit: "cover", maxHeight: 240 }} />
                ) : (
                  <span style={{ fontSize: 36 }}>📄</span>
                )}
                <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>Work submitted</p>
              </div>
            )}
            {!isMarked && !isSubmitted && !submitted && (
              <>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: "none" }} />
                <button onClick={() => fileRef.current?.click()} style={{ border: "2px dashed #d1d5db", borderRadius: 12, background: "#fff", padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer", width: "100%" }}>
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8 }} />
                  ) : (
                    <>
                      <span style={{ fontSize: 36 }}>📷</span>
                      <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>Tap to select photo of your work</p>
                    </>
                  )}
                </button>
                {selectedFile && (
                  <p style={{ margin: 0, fontSize: 12, color: "#6b7280", textAlign: "center" }}>{selectedFile.name}</p>
                )}
                <button onClick={submitBook} disabled={submitting || !selectedFile} style={{ padding: "14px", borderRadius: 12, border: "none", background: (submitting || !selectedFile) ? "#d1fae5" : "#10b981", color: "#fff", fontSize: 15, fontWeight: 700, cursor: (submitting || !selectedFile) ? "not-allowed" : "pointer" }}>
                  {submitting ? "Submitting..." : "Upload and Submit"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
