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
  if (status === "marked") return { label: "Marked", bg: "#d1fae5", color: "#065f46" };
  if (status === "under_review") return { label: "Under review", bg: "#dbeafe", color: "#1e40af" };
  if (status === "returned") return { label: "Returned", bg: "#fef3c7", color: "#92400e" };
  if (status === "received") return { label: "Received", bg: "#d1fae5", color: "#065f46" };
  if (status === "submitted") return { label: "Submitted", bg: "#fef3c7", color: "#92400e" };
  if (status === "draft") return { label: "Draft", bg: "#f3f4f6", color: "#6b7280" };
  return { label: "Pending", bg: "#f3f4f6", color: "#6b7280" };
}

function GradingInner() {
  const router = useRouter();
  const params = useParams();
  const classId = params.id as string;
  const hwId = params.hwId as string;

  const [hw, setHw] = useState<HWInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subMap, setSubMap] = useState<Map<string, Submission>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [active, setActive] = useState<Student | null>(null);
  const [mark, setMark] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
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

    const [hwRes, stuRes, qRes, subRes] = await Promise.all([
      sid
        ? supabase.from("homework").select("title,subject,instructions,due_date,type").eq("id", hwId).eq("school_id", sid).single()
        : supabase.from("homework").select("title,subject,instructions,due_date,type").eq("id", hwId).single(),
      supabase.from("students").select("id,name,admission_number,profile_id").eq("class_id", classId).order("name"),
      supabase.from("homework_questions").select("id,question,order_num").eq("homework_id", hwId).order("order_num"),
      supabase.from("homework_submissions").select("id,student_id,status,mark,feedback,submitted_at,received_at,photo_url,returned_reason").eq("homework_id", hwId),
    ]);

    if (hwRes.error) { setLoadError("Could not load homework"); setLoading(false); return; }
    if (stuRes.error || qRes.error || subRes.error) { setLoadError("Could not load homework submissions"); setLoading(false); return; }

    const subs = (subRes.data ?? []) as Omit<Submission, "answers">[];
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

  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => { void loadRef.current(); }, [hwId, classId]);

  function openGrade(student: Student) {
    const sub = subMap.get(student.id);
    setActive(student);
    setMark(sub?.mark != null ? String(sub.mark) : "");
    setFeedback(sub?.feedback ?? "");
    setSaveOk(false);
    setSaveError(null);
    setView("grade");
  }

  async function saveGrade() {
    if (!active) return;
    const sub = subMap.get(active.id);
    const markValue = mark === "" ? null : Number(mark);
    if (markValue !== null && (!Number.isFinite(markValue) || markValue < 0)) {
      setSaveError("Enter a valid non-negative mark.");
      return;
    }
    setSaving(true);
    setSaveOk(false);
    setSaveError(null);

    if (!sub) {
      const { data, error } = await supabase.from("homework_submissions").insert({
        homework_id: hwId,
        student_id: active.id,
        status: "marked",
        submitted_at: new Date().toISOString(),
        mark: markValue,
        feedback: feedback.trim() || null,
      }).select("id,student_id,status,mark,feedback,submitted_at,received_at,photo_url,returned_reason").single();
      if (error || !data) {
        setSaveError(error?.message || "Could not save grade.");
      } else {
        const updated = new Map(subMap);
        updated.set(active.id, { ...(data as Omit<Submission, "answers">), answers: [] });
        setSubMap(updated);
        setSaveOk(true);
      }
      setSaving(false);
      return;
    }

    const { data, error } = await supabase.from("homework_submissions")
      .update({ mark: markValue, feedback: feedback.trim() || null, status: "marked", reviewed_at: new Date().toISOString() })
      .eq("id", sub.id)
      .select("id,student_id,status,mark,feedback,submitted_at,received_at,photo_url,returned_reason")
      .single();
    if (error || !data) {
      setSaveError(error?.message || "Could not save grade.");
    } else {
      const updated = new Map(subMap);
      updated.set(active.id, { ...(data as Omit<Submission, "answers">), answers: sub.answers });
      setSubMap(updated);
      setSaveOk(true);
    }
    setSaving(false);
  }

  const submitted = students.filter(student => {
    const sub = subMap.get(student.id);
    return sub ? handedInStatuses.has(sub.status) : false;
  });
  const notYet = students.filter(student => {
    const sub = subMap.get(student.id);
    return !sub || !handedInStatuses.has(sub.status);
  });
  const marked = submitted.filter(student => subMap.get(student.id)?.status === "marked");
  const markedMarks = Array.from(subMap.values()).filter(sub => sub.status === "marked" && sub.mark !== null).map(sub => sub.mark as number);
  const avg = markedMarks.length ? Math.round(markedMarks.reduce((a, b) => a + b, 0) / markedMarks.length) : null;
  const markNumber = mark === "" ? null : Number(mark);
  const liveBand = markNumber !== null && Number.isFinite(markNumber) ? autoBand(markNumber) : null;

  async function remindNonSubmitters() {
    if (!notYet.length) { setBulkMsg("Everyone has submitted."); return; }
    setBulkBusy(true);
    setBulkMsg(null);
    const linked = notYet.filter((student): student is Student & { profile_id: string } => Boolean(student.profile_id));
    const dueLabel = hw?.due_date ? new Date(hw.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "soon";
    const { error } = linked.length ? await supabase.from("notifications").insert(linked.map(student => ({
      user_id: student.profile_id,
      school_id: schoolIdRef.current,
      type: "homework",
      title: "Homework Reminder",
      body: `Reminder: "${hw?.title ?? "Homework"}" is due ${dueLabel}. Please submit.`,
      is_read: false,
    }))) : { error: null };
    setBulkMsg(error ? "Could not send reminders." : `Reminder sent to ${linked.length} linked student(s).`);
    setBulkBusy(false);
  }

  if (loading) return <div style={{ padding: 20, color: C.textMuted }}>Loading…</div>;
  if (loadError) return <div style={{ padding: 20, color: "#ef4444" }}>{loadError}</div>;

  if (view === "grade" && active) {
    const sub = subMap.get(active.id);
    return (
      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", paddingBottom: 100, background: C.surface, minHeight: "100vh" }}>
        <div style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)", padding: "20px 16px 24px" }}>
          <button onClick={() => setView("list")} style={{ background: "rgba(255,255,255,.15)", border: 0, borderRadius: 10, width: 36, height: 36, color: "#fff" }}>←</button>
          <div style={{ marginTop: 10, fontSize: 18, fontWeight: 900, color: "#fff" }}>{active.name}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>{active.admission_number} · {hw?.title}</div>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {sub && <div style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
            <strong>{statusBadge(sub.status, sub.mark).label}</strong>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 5 }}>
              Received {sub.received_at ? new Date(sub.received_at).toLocaleString("en-KE") : sub.submitted_at ? new Date(sub.submitted_at).toLocaleString("en-KE") : "—"}
            </div>
            {sub.returned_reason && <div style={{ marginTop: 8, fontSize: 12 }}>{sub.returned_reason}</div>}
          </div>}
          {sub && questions.map((question, index) => {
            const answer = sub.answers.find(item => item.question_id === question.id);
            return <div key={question.id} style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>Q{index + 1}</div>
              <div style={{ margin: "6px 0 10px", fontSize: 13, fontWeight: 600 }}>{question.question}</div>
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: 10, fontSize: 13 }}>{answer?.answer_text || <em>No answer given</em>}</div>
            </div>;
          })}
          {sub?.photo_url && <img src={sub.photo_url} alt="Student submitted work" style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 14 }} />}
          <div style={{ background: "#fff", borderRadius: 16, padding: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700 }}>MARK</label>
            <input type="number" min="0" value={mark} onChange={event => setMark(event.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
            {liveBand && <div style={{ marginTop: 8, color: liveBand.color, fontWeight: 800 }}>{liveBand.label}</div>}
            <label style={{ display: "block", marginTop: 14, fontSize: 11, fontWeight: 700 }}>REMARKS / FEEDBACK</label>
            <textarea value={feedback} onChange={event => setFeedback(event.target.value)} rows={3} style={{ ...inputStyle, marginTop: 6, resize: "vertical" }} />
            {saveError && <div style={{ marginTop: 10, color: "#b91c1c", fontSize: 12 }}>{saveError}</div>}
            {saveOk && <div style={{ marginTop: 10, color: "#065f46", fontSize: 12 }}>✓ Marks and remarks saved. The student can now see them.</div>}
            <button onClick={saveGrade} disabled={saving} style={{ width: "100%", marginTop: 12, padding: 13, borderRadius: 12, border: 0, background: "#0f766e", color: "#fff", fontWeight: 800 }}>
              {saving ? "Saving…" : saveOk ? "Update Grade" : "Save Grade"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", paddingBottom: 100, background: C.surface, minHeight: "100vh" }}>
      <div style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)", padding: "20px 16px 28px", color: "#fff" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,.15)", border: 0, borderRadius: 10, width: 36, height: 36, color: "#fff" }}>←</button>
        <div style={{ marginTop: 10, fontSize: 18, fontWeight: 900 }}>{hw?.title}</div>
        <div style={{ fontSize: 12, opacity: .7 }}>{hw?.subject}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {[{ label: "Students", value: students.length }, { label: "Submitted", value: submitted.length }, { label: "Marked", value: marked.length }, { label: "Avg", value: avg === null ? "—" : `${avg}pts` }].map(item =>
            <div key={item.label} style={{ flex: 1, background: "rgba(255,255,255,.15)", borderRadius: 10, padding: 8, textAlign: "center" }}>
              <div style={{ fontWeight: 800 }}>{item.value}</div><div style={{ fontSize: 9, opacity: .7 }}>{item.label}</div>
            </div>)}
        </div>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {notYet.length > 0 && <button onClick={remindNonSubmitters} disabled={bulkBusy} style={{ padding: 10, borderRadius: 12, border: 0, background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>
          {bulkBusy ? "Working…" : "Remind Non-Submitters"}
        </button>}
        {bulkMsg && <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center" }}>{bulkMsg}</div>}
        {submitted.length > 0 && <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted }}>SUBMITTED</div>}
        {submitted.map(student => {
          const sub = subMap.get(student.id)!;
          const badge = statusBadge(sub.status, sub.mark);
          return <button key={student.id} onClick={() => openGrade(student)} style={{ background: "#fff", borderRadius: 14, padding: 14, border: 0, borderLeft: `4px solid ${sub.status === "marked" ? "#10b981" : "#f59e0b"}`, textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><strong>{student.name}</strong><div style={{ fontSize: 11, color: C.textMuted }}>{student.admission_number}</div></div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: badge.bg, color: badge.color }}>{badge.label}</span>
            </div>
          </button>;
        })}
        {notYet.length > 0 && <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: C.textMuted }}>NOT SUBMITTED</div>}
        {notYet.map(student => <button key={student.id} onClick={() => openGrade(student)} style={{ background: "#fff", borderRadius: 14, padding: 14, border: 0, borderLeft: "4px solid #e5e7eb", textAlign: "left" }}>
          <strong style={{ color: C.textMuted }}>{student.name}</strong><div style={{ fontSize: 11, color: C.textMuted }}>{student.admission_number}</div>
        </button>)}
      </div>
    </div>
  );
}

export default function GradingPage() {
  return <Suspense fallback={<div style={{ padding: 20 }}>Loading…</div>}><GradingInner /></Suspense>;
}
