"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { buildLearnerTruthSummary } from "@/lib/learner-intelligence/truth";

type ClassContext = { class_id: string; class_name: string; stream: string | null; subject_id: string; subject_name: string };
type Context = { teacher_id: string; school_id: string | null; classes: ClassContext[] };
type Student = { id: string; name: string; admission_number: string | null; profile_id: string | null; deleted_at?: string | null };
type AttendanceRow = { date: string; status: string; is_late: boolean | null };
type HomeworkRow = { id: string; title: string; subject: string | null; due_date: string | null; type: string | null };
type SubmissionRow = { homework_id: string | null; status: string; mark: number | null; feedback: string | null; submitted_at: string | null };
type GradebookRow = { assessment_id: string; subject_id: string | null; score: number | null; max_score: number | null; percentage: number | null; assessment_type: string; assessment_title: string; released_at: string | null };
type CbcRow = { id: string; subject_id: string; strand_id: string | null; sub_strand: string | null; assessment_type: string; performance: string; notes: string | null; created_at: string };
type ExamRow = { id: string; exam_id: string; subject_id: string; marks: number; is_absent: boolean; created_at: string };
type SubjectRow = { id: string; name: string };
type Tab = "now" | "work" | "assessment" | "attendance";

const tabs: Tab[] = ["now", "work", "assessment", "attendance"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function parseContext(value: unknown): Context {
  if (!isRecord(value)) throw new Error("Teacher operating context is invalid.");
  const classes: ClassContext[] = [];
  if (Array.isArray(value.classes)) {
    for (const entry of value.classes) {
      if (!isRecord(entry)) continue;
      if (typeof entry.class_id !== "string" || typeof entry.class_name !== "string" || typeof entry.subject_id !== "string" || typeof entry.subject_name !== "string") continue;
      classes.push({ class_id: entry.class_id, class_name: entry.class_name, stream: stringOrNull(entry.stream), subject_id: entry.subject_id, subject_name: entry.subject_name });
    }
  }
  return { teacher_id: typeof value.teacher_id === "string" ? value.teacher_id : "", school_id: stringOrNull(value.school_id), classes };
}

function parseEnrolledLearner(value: unknown): Student | null {
  if (!isRecord(value)) return null;
  const nested = Array.isArray(value.students) ? value.students[0] : value.students;
  if (!isRecord(nested) || typeof nested.id !== "string" || typeof nested.name !== "string") return null;
  return { id: nested.id, name: nested.name, admission_number: stringOrNull(nested.admission_number), profile_id: stringOrNull(nested.profile_id), deleted_at: stringOrNull(nested.deleted_at) };
}

function formatDate(value: string) {
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00+03:00` : value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : value;
}

function Badge({ text, tone = "neutral" }: { text: string; tone?: "good" | "warn" | "bad" | "neutral" }) {
  const palette = { good: { background: "#ecfdf5", color: "#065f46" }, warn: { background: "#fffbeb", color: "#92400e" }, bad: { background: "#fef2f2", color: "#991b1b" }, neutral: { background: "#f3f4f6", color: "#4b5563" } }[tone];
  return <span style={{ ...palette, display: "inline-block", borderRadius: 99, padding: "4px 8px", fontSize: 10, fontWeight: 900 }}>{text}</span>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <section style={{ background: "#fff", borderRadius: 18, padding: 15, boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}>{children}</section>;
}

export default function TeacherStudentProgressPage() {
  const params = useParams<{ id: string; studentId: string }>();
  const router = useRouter();
  const classId = params.id;
  const studentId = params.studentId;
  const [context, setContext] = useState<Context | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [homework, setHomework] = useState<HomeworkRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [gradebook, setGradebook] = useState<GradebookRow[]>([]);
  const [cbc, setCbc] = useState<CbcRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [tab, setTab] = useState<Tab>("now");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) { router.replace("/login"); return; }

      const { data: contextData, error: contextError } = await supabase.rpc("teacher_get_operating_context");
      if (contextError) throw contextError;
      const ctx = parseContext(contextData);
      if (!ctx.school_id) throw new Error("School context is missing.");
      if (!ctx.classes.some((item) => item.class_id === classId)) throw new Error("This class is not assigned to you in the active school.");
      setContext(ctx);

      const enrollmentRes = await supabase.from("student_classes").select("student_id,students(id,name,admission_number,profile_id,deleted_at)").eq("school_id", ctx.school_id).eq("class_id", classId).eq("student_id", studentId).eq("is_current", true).maybeSingle();
      if (enrollmentRes.error) throw enrollmentRes.error;
      const learner = parseEnrolledLearner(enrollmentRes.data);
      if (!learner || learner.deleted_at) throw new Error("This learner is not currently enrolled in this class.");
      setStudent(learner);

      const subjectIds = Array.from(new Set(ctx.classes.filter((item) => item.class_id === classId).map((item) => item.subject_id)));
      const [attendanceRes, homeworkRes, gradebookRes, cbcRes, examRes, subjectRes] = await Promise.all([
        supabase.from("attendance").select("date,status,is_late").eq("school_id", ctx.school_id).eq("class_id", classId).eq("student_id", studentId).order("date", { ascending: false }).limit(120),
        supabase.from("homework").select("id,title,subject,due_date,type").eq("school_id", ctx.school_id).eq("class_id", classId).eq("teacher_id", auth.user.id).order("due_date", { ascending: false }).limit(80),
        subjectIds.length ? supabase.from("assessment_gradebook_entries").select("assessment_id,subject_id,score,max_score,percentage,assessment_type,assessment_title,released_at").eq("school_id", ctx.school_id).eq("class_id", classId).eq("student_id", studentId).eq("teacher_id", auth.user.id).in("subject_id", subjectIds).order("released_at", { ascending: false }).limit(80) : Promise.resolve({ data: [], error: null }),
        subjectIds.length ? supabase.from("cbc_assessments").select("id,subject_id,strand_id,sub_strand,assessment_type,performance,notes,created_at").eq("school_id", ctx.school_id).eq("class_id", classId).eq("student_id", studentId).eq("teacher_id", auth.user.id).in("subject_id", subjectIds).order("created_at", { ascending: false }).limit(80) : Promise.resolve({ data: [], error: null }),
        subjectIds.length ? supabase.from("exam_results").select("id,exam_id,subject_id,marks,is_absent,created_at").eq("school_id", ctx.school_id).eq("class_id", classId).eq("student_id", studentId).eq("teacher_id", auth.user.id).in("subject_id", subjectIds).order("created_at", { ascending: false }).limit(80) : Promise.resolve({ data: [], error: null }),
        subjectIds.length ? supabase.from("subjects").select("id,name").in("id", subjectIds) : Promise.resolve({ data: [], error: null }),
      ]);
      for (const result of [attendanceRes, homeworkRes, gradebookRes, cbcRes, examRes, subjectRes]) if (result.error) throw result.error;

      const homeworkRows: HomeworkRow[] = homeworkRes.data ?? [];
      const submissionRes = homeworkRows.length ? await supabase.from("homework_submissions").select("homework_id,status,mark,feedback,submitted_at").eq("student_id", studentId).in("homework_id", homeworkRows.map((item) => item.id)) : { data: [], error: null };
      if (submissionRes.error) throw submissionRes.error;

      setAttendance(attendanceRes.data ?? []);
      setHomework(homeworkRows);
      setSubmissions(submissionRes.data ?? []);
      setGradebook(gradebookRes.data ?? []);
      setCbc(cbcRes.data ?? []);
      setExams(examRes.data ?? []);
      setSubjects(subjectRes.data ?? []);
    } catch (loadError) {
      console.error("[LearnerWorkspace] load", loadError);
      setError(loadError instanceof Error ? loadError.message : "Learner workspace could not be loaded.");
    } finally { setLoading(false); }
  }, [classId, router, studentId]);

  useEffect(() => { void load(); }, [load]);

  const subjectNames = useMemo(() => new Map(subjects.map((item) => [item.id, item.name])), [subjects]);
  const submissionMap = useMemo(() => new Map(submissions.map((item) => [item.homework_id, item])), [submissions]);
  const truth = useMemo(() => buildLearnerTruthSummary({ attendance, homework, submissions, assessments: gradebook, cbc, examCount: exams.length }), [attendance, homework, submissions, gradebook, cbc, exams.length]);

  if (loading) return <div style={{ padding: 18 }} aria-label="Loading learner workspace"><div style={{ height: 180, borderRadius: 20, background: "#e5e7eb" }} /></div>;
  if (!student || error) return <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}><div role="alert" style={{ background: "#fef2f2", color: "#991b1b", borderRadius: 16, padding: 18 }}>{error ?? "Learner not found."}</div><button type="button" onClick={() => router.push(`/teacher/classhub/${classId}`)} style={{ marginTop: 12, minHeight: 44, border: 0, borderRadius: 12, background: "#111827", color: "#fff", padding: "0 16px", fontWeight: 900 }}>Back to class</button></div>;

  const classAssignment = context?.classes.find((item) => item.class_id === classId);
  const assessmentEvidence = truth.assessment.released + truth.assessment.cbc + truth.assessment.exams;

  return <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 14px 112px" }}>
    <section style={{ background: "linear-gradient(135deg,#1e1b4b,#4f46e5)", color: "#fff", borderRadius: 20, padding: 18, marginBottom: 12 }}>
      <button type="button" onClick={() => router.push(`/teacher/classhub/${classId}`)} style={{ minHeight: 38, border: 0, borderRadius: 10, background: "rgba(255,255,255,.14)", color: "#fff", padding: "0 11px", fontWeight: 800 }}>‹ Class</button>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 13 }}><div style={{ width: 54, height: 54, borderRadius: 99, background: "rgba(255,255,255,.18)", display: "grid", placeItems: "center", fontWeight: 900 }}>{student.name.charAt(0).toUpperCase()}</div><div><h1 style={{ margin: 0, fontSize: 22 }}>{student.name}</h1><div style={{ marginTop: 4, fontSize: 11, opacity: .75 }}>{classAssignment?.class_name ?? "Class"}{classAssignment?.stream ? ` ${classAssignment.stream}` : ""}{student.admission_number ? ` · Adm ${student.admission_number}` : ""}</div></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginTop: 14 }}>{[{ label: "Attendance", value: truth.attendance.rate == null ? "—" : `${truth.attendance.rate}%` }, { label: "Work", value: `${truth.work.submitted}/${truth.work.assigned}` }, { label: "Evidence", value: assessmentEvidence }, { label: "Released avg", value: truth.assessment.averageReleasedScore == null ? "—" : `${truth.assessment.averageReleasedScore}%` }].map((item) => <div key={item.label} style={{ background: "rgba(255,255,255,.12)", borderRadius: 11, padding: "8px 4px", textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 900 }}>{item.value}</div><div style={{ marginTop: 2, fontSize: 8, opacity: .65 }}>{item.label}</div></div>)}</div>
    </section>

    <section style={{ marginBottom: 12, borderRadius: 16, padding: 13, background: truth.evidenceState === "sufficient" ? "#ecfdf5" : "#fffbeb", color: truth.evidenceState === "sufficient" ? "#065f46" : "#92400e", border: `1px solid ${truth.evidenceState === "sufficient" ? "#a7f3d0" : "#fde68a"}` }}><div style={{ fontWeight: 900, fontSize: 12 }}>{truth.evidenceState === "sufficient" ? "Evidence available" : "Not enough evidence yet"}</div><div style={{ marginTop: 3, fontSize: 11 }}>{truth.evidenceMessage}</div></section>

    <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 12 }}>{tabs.map((item) => <button key={item} type="button" onClick={() => setTab(item)} style={{ minHeight: 40, border: tab === item ? "1px solid #312e81" : "1px solid #e5e7eb", borderRadius: 99, background: tab === item ? "#312e81" : "#fff", color: tab === item ? "#fff" : "#374151", padding: "0 14px", fontWeight: 900, textTransform: "capitalize" }}>{item}</button>)}</div>

    {tab === "now" && <div style={{ display: "grid", gap: 10 }}>
      <Card><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>WHAT NEEDS ATTENTION</div>{truth.signals.length === 0 ? <div style={{ color: "#6b7280", fontSize: 13 }}>{truth.evidenceState === "sufficient" ? "No current deterministic attention signal is supported by the recorded evidence." : "No learner risk label has been created because the evidence is insufficient."}</div> : <div style={{ display: "grid", gap: 8 }}>{truth.signals.map((signal) => <div key={signal.id} style={{ background: signal.id === "missing_work" ? "#fffbeb" : "#fef2f2", color: signal.id === "missing_work" ? "#92400e" : "#991b1b", borderRadius: 12, padding: 11, fontSize: 12 }}><strong>{signal.id === "missing_work" ? "Missing required work" : signal.id === "repeated_low_assessment" ? "Repeated low comparable assessment evidence" : "Repeated CBC support evidence"}</strong><div style={{ marginTop: 3 }}>{signal.reason}</div><div style={{ marginTop: 5, fontSize: 10 }}>{signal.evidenceCount} evidence record{signal.evidenceCount === 1 ? "" : "s"} · {signal.confidence} confidence</div></div>)}</div>}</Card>
      <Card><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>WHAT CHANGED</div>{!truth.trend ? <div style={{ color: "#6b7280", fontSize: 13 }}>A trend is shown only after at least four released assessments of the same subject and assessment type.</div> : <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>{subjectNames.get(truth.trend.subjectId) ?? "Subject"} · {truth.trend.assessmentType}</span><Badge text={`${truth.trend.delta > 0 ? "+" : ""}${truth.trend.delta} pts`} tone={truth.trend.delta >= 5 ? "good" : truth.trend.delta <= -5 ? "bad" : "neutral"} /></div>}</Card>
      <Card><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>TEACHER ACTIONS</div><div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}><button type="button" onClick={() => router.push(`/teacher/classhub/${classId}/homework`)} style={{ minHeight: 46, border: 0, borderRadius: 12, background: "#0f766e", color: "#fff", fontWeight: 900 }}>Assign / review work</button><button type="button" onClick={() => router.push(`/teacher/assessment?classId=${classId}`)} style={{ minHeight: 46, border: 0, borderRadius: 12, background: "#92400e", color: "#fff", fontWeight: 900 }}>Assess learner</button><button type="button" onClick={() => router.push(`/teacher/attendance?classId=${classId}`)} style={{ minHeight: 46, border: 0, borderRadius: 12, background: "#065f46", color: "#fff", fontWeight: 900 }}>Attendance</button><button type="button" onClick={() => setTab("assessment")} style={{ minHeight: 46, border: "1px solid #d1d5db", borderRadius: 12, background: "#fff", fontWeight: 900 }}>Inspect evidence</button></div></Card>
    </div>}

    {tab === "work" && <Card>{homework.length === 0 ? <div style={{ padding: 22, textAlign: "center", color: "#6b7280" }}>No homework assigned by you for this class yet.</div> : <div style={{ display: "grid", gap: 9 }}>{homework.map((item) => { const submission = submissionMap.get(item.id); const overdue = Boolean(item.due_date) && !submission && new Date(item.due_date ?? "").getTime() < Date.now(); return <button type="button" key={item.id} onClick={() => router.push(`/teacher/classhub/${classId}/homework/${item.id}`)} style={{ width: "100%", textAlign: "left", border: "1px solid #e5e7eb", borderRadius: 13, padding: 11, background: "#fff" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 13, fontWeight: 900 }}>{item.title}</div><div style={{ marginTop: 3, fontSize: 10, color: "#6b7280" }}>{item.subject || "Subject"} · {item.due_date ? `Due ${formatDate(item.due_date)}` : "No due date"}</div></div>{submission ? <Badge text={submission.status} tone={submission.status === "marked" ? "good" : "neutral"} /> : <Badge text={overdue ? "Missing" : "Not submitted"} tone={overdue ? "bad" : "warn"} />}</div>{submission?.mark != null && <div style={{ marginTop: 7, fontSize: 12, fontWeight: 900, color: "#065f46" }}>Mark: {submission.mark}</div>}{submission?.feedback && <div style={{ marginTop: 5, fontSize: 11, color: "#6b7280" }}>{submission.feedback}</div>}</button>; })}</div>}</Card>}

    {tab === "assessment" && <div style={{ display: "grid", gap: 10 }}>
      <Card><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>RELEASED ASSESSMENTS</div>{gradebook.length === 0 ? <div style={{ color: "#6b7280" }}>No released canonical assessment scores yet.</div> : gradebook.map((item, index) => { const percentage = item.percentage; return <div key={`${item.assessment_id}-${index}`} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", padding: "8px 0" }}><div><strong>{item.assessment_title}</strong><div style={{ fontSize: 10, color: "#6b7280" }}>{item.subject_id ? subjectNames.get(item.subject_id) ?? "Subject" : "Unscoped subject"} · {item.assessment_type}</div></div>{percentage === null ? <Badge text="No score" /> : <Badge text={`${Math.round(percentage)}%`} tone={percentage >= 70 ? "good" : percentage < 50 ? "bad" : "warn"} />}</div>; })}</Card>
      <Card><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>CBC COMPETENCY EVIDENCE</div>{cbc.length === 0 ? <div style={{ color: "#6b7280" }}>No CBC competency observations recorded yet.</div> : cbc.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", padding: "8px 0" }}><div><strong>{subjectNames.get(item.subject_id) ?? "Subject"}{item.sub_strand ? ` · ${item.sub_strand}` : ""}</strong><div style={{ fontSize: 10, color: "#6b7280" }}>{item.assessment_type} · {formatDate(item.created_at)}</div></div><Badge text={item.performance} tone={item.performance === "EE" || item.performance === "ME" ? "good" : item.performance === "BE" ? "bad" : "warn"} /></div>)}</Card>
      <Card><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>EXAM RESULTS</div>{exams.length === 0 ? <div style={{ color: "#6b7280" }}>No exam results recorded by you for this learner.</div> : exams.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", padding: "8px 0" }}><span>{subjectNames.get(item.subject_id) ?? "Subject"} · {formatDate(item.created_at)}</span><Badge text={item.is_absent ? "Absent" : `${item.marks}`} tone={item.is_absent ? "warn" : "neutral"} /></div>)}</Card>
    </div>}

    {tab === "attendance" && <Card><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 12 }}>{[{ label: "Records", value: truth.attendance.records }, { label: "Present", value: truth.attendance.present }, { label: "Absent", value: truth.attendance.absent }, { label: "Late", value: truth.attendance.late }].map((item) => <div key={item.label} style={{ background: "#f8fafc", borderRadius: 11, padding: 8, textAlign: "center" }}><strong>{item.value}</strong><div style={{ fontSize: 9, color: "#6b7280" }}>{item.label}</div></div>)}</div>{attendance.length === 0 ? <div style={{ padding: 22, textAlign: "center", color: "#6b7280" }}>No attendance evidence recorded yet.</div> : attendance.map((item, index) => <div key={`${item.date}-${index}`} style={{ minHeight: 44, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f3f4f6" }}><span>{formatDate(item.date)}</span><Badge text={item.is_late ? "Late" : item.status} tone={item.status === "present" && !item.is_late ? "good" : item.status === "absent" ? "bad" : "warn"} /></div>)}</Card>}
  </div>;
}
