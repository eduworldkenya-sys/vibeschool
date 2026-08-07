"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";

type SubmissionStatus =
  | "draft"
  | "pending"
  | "submitted"
  | "received"
  | "under_review"
  | "returned"
  | "marked";

type HomeworkReviewAction = "marked" | "returned" | "feedback_released";
type HomeworkReviewRpcClient = {
  rpc(
    fn: "review_homework_submission",
    args: {
      p_submission_id: string;
      p_action: HomeworkReviewAction;
      p_mark?: number;
      p_feedback?: string;
      p_reason?: string;
      p_release_model_answers: boolean;
    },
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

interface Student {
  id: string;
  name: string;
  admission_number: string;
  profile_id: string | null;
}
interface Question { id: string; question: string; order_num: number; }
interface Answer { question_id: string; answer_text: string | null; }
interface Submission {
  id: string;
  student_id: string;
  status: SubmissionStatus;
  mark: number | null;
  feedback: string | null;
  submitted_at: string | null;
  received_at: string | null;
  photo_url: string | null;
  returned_reason: string | null;
  answers: Answer[];
}
interface HWInfo {
  title: string;
  subject: string;
  instructions: string | null;
  due_date: string;
  type: string;
}

type View = "list" | "grade";

const handedInStatuses = new Set<SubmissionStatus>([
  "submitted",
  "received",
  "under_review",
  "returned",
  "marked",
]);

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  fontSize: 14,
  color: C.textPrimary,
  outline: "none",
  fontFamily: "inherit",
  background: "#f9fafb",
  boxSizing: "border-box",
};

function autoBand(mark: number) {
  if (mark >= 80) return { label: "Excellent", bg: "#d1fae5", color: "#065f46" };
  if (mark >= 60) return { label: "Good", bg: "#dbeafe", color: "#1e40af" };
  if (mark >= 40) return { label: "Fair", bg: "#fef3c7", color: "#92400e" };
  return { label: "Needs Improvement", bg: "#fee2e2", color: "#991b1b" };
}

function statusBadge(status: SubmissionStatus, mark: number | null) {
  if (status === "marked" && mark !== null) {
    const band = autoBand(mark);
    return { label: `${mark}pts · ${band.label}`, bg: band.bg, color: band.color };
  }
  if (status === "returned") return { label: "Returned", bg: "#fff7ed", color: "#c2410c" };
  if (status === "under_review") return { label: "Under review", bg: "#eff6ff", color: "#1d4ed8" };
  if (status === "received") return { label: "Received", bg: "#ecfdf5", color: "#047857" };
  if (status === "submitted") return { label: "Submitted", bg: "#ecfdf5", color: "#047857" };
  if (status === "draft") return { label: "Draft", bg: "#f8fafc", color: "#64748b" };
  return { label: "Pending", bg: "#f3f4f6", color: "#6b7280" };
}

function HomeworkGradePageInner() {
  const router = useRouter();
  const params = useParams<{ id: string; hwId: string }>();
  const classId = params.id;
  const hwId = params.hwId;

  const [hw, setHw] = useState<HWInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subMap, setSubMap] = useState<Map<string, Submission>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [markInput, setMarkInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [returnReasonInput, setReturnReasonInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const schoolIdRef = useRef<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadError("Not authenticated"); setLoading(false); return; }

    if (!schoolIdRef.current) {
      const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user.id).single();
      let sid = profile?.school_id ?? null;
      if (!sid) {
        const { data: cls } = await supabase.from("classes").select("school_id").eq("id", classId).single();
        sid = cls?.school_id ?? null;
      }
      schoolIdRef.current = sid;
    }
    const sid = schoolIdRef.current;

    type LiveHomeworkSubmissionRow = Omit<Submission, "answers">;
    type LiveHomeworkSubmissionQuery = {
      data: LiveHomeworkSubmissionRow[] | null;
      error: { message?: string } | null;
    };
    const submissionQuery = (supabase.from("homework_submissions") as unknown as {
      select: (columns: string) => {
        eq: (column: string, value: string) => PromiseLike<LiveHomeworkSubmissionQuery>;
      };
    })
      .select("id,student_id,status,mark,feedback,submitted_at,received_at,photo_url,returned_reason")
      .eq("homework_id", hwId);

    const [hwRes, stuRes, qRes, subRes] = await Promise.all([
      sid
        ? supabase.from("homework").select("title,subject,instructions,due_date,type").eq("id", hwId).eq("school_id", sid).single()
        : supabase.from("homework").select("title,subject,instructions,due_date,type").eq("id", hwId).single(),
      supabase.from("students").select("id,name,admission_number,profile_id").eq("class_id", classId).order("name"),
      supabase.from("homework_questions").select("id,question,order_num").eq("homework_id", hwId).order("order_num"),
      submissionQuery,
    ]);

    if (hwRes.error) { setLoadError("Could not load homework"); setLoading(false); return; }
    if (stuRes.error || qRes.error || subRes.error) { setLoadError("Could not load homework submissions"); setLoading(false); return; }

    const subs = subRes.data ?? [];
    const subIds = subs.map(sub => sub.id);
    let answers: (Answer & { submission_id: string })[] = [];
    if (subIds.length > 0) {
      const { data, error } = await supabase.from("homework_answers").select("submission_id,question_id,answer_text").in("submission_id", subIds);
      if (error) { setLoadError("Could not load submitted answers"); setLoading(false); return; }
      answers = (data ?? []) as (Answer & { submission_id: string })[];
    }

    const map = new Map<string, Submission>();
    for (const sub of subs) {
      map.set(sub.student_id, { ...sub, answers: answers.filter(answer => answer.submission_id === sub.id) });
    }
    setHw(hwRes.data as HWInfo);
    setStudents((stuRes.data ?? []) as Student[]);
    setQuestions((qRes.data ?? []) as Question[]);
    setSubMap(map);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [classId, hwId]);

  function openGrade(student: Student, sub: Submission) {
    setSelectedStudent(student);
    setSelectedSub(sub);
    setMarkInput(sub.mark === null ? "" : String(sub.mark));
    setFeedbackInput(sub.feedback ?? "");
    setReturnReasonInput(sub.returned_reason ?? "");
    setSaveError(null);
    setView("grade");
  }

  async function reviewSubmission(action: HomeworkReviewAction, input?: { mark?: number | null; feedback?: string | null; reason?: string | null }) {
    if (!selectedSub) return { error: { message: "Submission is missing" } };
    const rpcClient = supabase as unknown as HomeworkReviewRpcClient;
    return rpcClient.rpc("review_homework_submission", {
      p_submission_id: selectedSub.id,
      p_action: action,
      ...(input?.mark != null ? { p_mark: input.mark } : {}),
      ...(input?.feedback != null ? { p_feedback: input.feedback } : {}),
      ...(input?.reason != null ? { p_reason: input.reason } : {}),
      p_release_model_answers: false,
    });
  }

  async function markSubmission() {
    if (!selectedSub || !schoolIdRef.current) return;
    const parsed = Number(markInput);
    if (!Number.isFinite(parsed) || parsed < 0) { setSaveError("Enter a valid mark"); return; }
    setSaving(true); setSaveError(null);
    const { error } = await reviewSubmission("marked", {
      mark: parsed,
      feedback: feedbackInput.trim() || null,
    });
    if (error) { setSaveError(error.message || "Could not save mark"); setSaving(false); return; }
    setSaving(false); setView("list"); await load();
  }

  async function returnSubmission() {
    if (!selectedSub || !schoolIdRef.current) return;
    const reason = returnReasonInput.trim();
    if (reason.length < 5) { setSaveError("Add a clear reason for revision"); return; }
    setSaving(true); setSaveError(null);
    const { error } = await reviewSubmission("returned", { reason });
    if (error) { setSaveError(error.message || "Could not return homework"); setSaving(false); return; }
    setSaving(false); setView("list"); await load();
  }

  async function releaseFeedback() {
    if (!selectedSub) return;
    setSaving(true); setSaveError(null);
    const { error } = await reviewSubmission("feedback_released", {
      feedback: feedbackInput.trim() || null,
    });
    if (error) { setSaveError(error.message || "Could not release feedback"); setSaving(false); return; }
    setSaving(false); setView("list"); await load();
  }

  const handedIn = students.filter(student => {
    const sub = subMap.get(student.id);
    return Boolean(sub && handedInStatuses.has(sub.status));
  });
  const pending = students.filter(student => {
    const sub = subMap.get(student.id);
    return !sub || !handedInStatuses.has(sub.status);
  });

  if (loading) return <div style={{ padding: 24 }}>Loading homework…</div>;
  if (loadError) return <div style={{ padding: 24, color: "#b91c1c" }}>{loadError}</div>;
  if (!hw) return <div style={{ padding: 24 }}>Homework not found.</div>;

  if (view === "grade" && selectedStudent && selectedSub) {
    const badge = statusBadge(selectedSub.status, selectedSub.mark);
    return <div style={{ padding: 18, maxWidth: 760, margin: "0 auto" }}>
      <button type="button" onClick={() => setView("list")} style={{ border: "none", background: "transparent", color: C.textSecondary, cursor: "pointer", marginBottom: 14 }}>← Back to submissions</button>
      <div style={{ background: "#fff", borderRadius: 16, padding: 18, border: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div><div style={{ fontSize: 12, color: C.textSecondary }}>{selectedStudent.admission_number}</div><h1 style={{ margin: "4px 0 6px", fontSize: 21 }}>{selectedStudent.name}</h1><div style={{ fontSize: 12, color: C.textSecondary }}>{hw.title} · {hw.subject}</div></div>
          <span style={{ borderRadius: 999, padding: "5px 9px", background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 800 }}>{badge.label}</span>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {questions.map((question, index) => {
            const answer = selectedSub.answers.find(item => item.question_id === question.id)?.answer_text;
            return <div key={question.id} style={{ padding: 12, borderRadius: 12, background: "#f8fafc" }}><strong style={{ fontSize: 12 }}>Q{index + 1}. {question.question}</strong><div style={{ marginTop: 7, fontSize: 12, whiteSpace: "pre-wrap" }}>{answer || "No answer"}</div></div>;
          })}
          {selectedSub.photo_url && <a href={selectedSub.photo_url} target="_blank" rel="noreferrer" style={{ color: C.accent, fontWeight: 700, fontSize: 12 }}>Open uploaded work ↗</a>}
        </div>

        {selectedSub.status === "returned" && selectedSub.returned_reason && <div style={{ marginTop: 14, padding: 11, borderRadius: 10, background: "#fff7ed", color: "#9a3412", fontSize: 12 }}><strong>Returned for revision:</strong> {selectedSub.returned_reason}</div>}

        <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Mark<input value={markInput} onChange={e => setMarkInput(e.target.value)} inputMode="decimal" style={{ ...inputStyle, marginTop: 5 }} /></label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Feedback<textarea value={feedbackInput} onChange={e => setFeedbackInput(e.target.value)} rows={3} style={{ ...inputStyle, marginTop: 5, resize: "vertical" }} /></label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Revision reason<textarea value={returnReasonInput} onChange={e => setReturnReasonInput(e.target.value)} rows={2} style={{ ...inputStyle, marginTop: 5, resize: "vertical" }} /></label>
          {saveError && <div style={{ color: "#b91c1c", fontSize: 12 }}>{saveError}</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" disabled={saving} onClick={() => void markSubmission()} style={{ border: "none", borderRadius: 9, padding: "9px 12px", background: C.accent, color: "#fff", fontWeight: 800, cursor: "pointer" }}>{saving ? "Saving…" : "Save mark"}</button>
            <button type="button" disabled={saving} onClick={() => void returnSubmission()} style={{ border: "1px solid #fdba74", borderRadius: 9, padding: "9px 12px", background: "#fff7ed", color: "#c2410c", fontWeight: 800, cursor: "pointer" }}>Return for revision</button>
            {selectedSub.status === "marked" && <button type="button" disabled={saving} onClick={() => void releaseFeedback()} style={{ border: "1px solid #86efac", borderRadius: 9, padding: "9px 12px", background: "#f0fdf4", color: "#166534", fontWeight: 800, cursor: "pointer" }}>Release feedback</button>}
          </div>
        </div>
      </div>
    </div>;
  }

  return <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
    <button type="button" onClick={() => router.push(`/teacher/classhub/${classId}/homework`)} style={{ border: "none", background: "transparent", color: C.textSecondary, cursor: "pointer", marginBottom: 12 }}>← Homework</button>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h1 style={{ margin: 0, fontSize: 22 }}>{hw.title}</h1><div style={{ marginTop: 4, color: C.textSecondary, fontSize: 12 }}>{hw.subject} · Due {new Date(hw.due_date).toLocaleDateString()}</div></div><div style={{ display: "flex", gap: 8 }}><span style={{ padding: "7px 10px", borderRadius: 999, background: "#ecfdf5", color: "#047857", fontSize: 11, fontWeight: 800 }}>{handedIn.length} handed in</span><span style={{ padding: "7px 10px", borderRadius: 999, background: "#f3f4f6", color: "#6b7280", fontSize: 11, fontWeight: 800 }}>{pending.length} pending</span></div></div>
    {bulkMsg && <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "#eff6ff", color: "#1d4ed8", fontSize: 12 }}>{bulkMsg}</div>}
    <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
      {handedIn.length === 0 ? <div style={{ padding: 20, borderRadius: 12, background: "#f8fafc", color: C.textSecondary, fontSize: 13 }}>No learner submissions yet.</div> : handedIn.map(student => {
        const sub = subMap.get(student.id)!;
        const badge = statusBadge(sub.status, sub.mark);
        return <button type="button" key={student.id} onClick={() => openGrade(student, sub)} style={{ padding: 13, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", textAlign: "left", cursor: "pointer" }}><div><strong>{student.name}</strong><div style={{ color: C.textSecondary, fontSize: 11, marginTop: 3 }}>{student.admission_number}</div></div><span style={{ borderRadius: 999, padding: "5px 9px", background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 800 }}>{badge.label}</span></button>;
      })}
    </div>
    <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/student/homework/${hwId}`); setBulkMsg("Learner homework link copied"); }} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 9, padding: "8px 11px", cursor: "pointer", fontWeight: 700 }}>Copy learner link</button>
    </div>
  </div>;
}

export default function HomeworkGradePage() {
  return <Suspense fallback={<div style={{ padding: 24 }}>Loading homework…</div>}><HomeworkGradePageInner /></Suspense>;
}
