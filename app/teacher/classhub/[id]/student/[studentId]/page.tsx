"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { buildLearnerTruthSummary } from "@/lib/learner-intelligence/truth";
import { listInterventionQueue, type InterventionQueueItem } from "@/lib/assessment/interventions";

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
type Tab = "now" | "work" | "assessment" | "attendance" | "timeline";

const tabs: Tab[] = ["now", "work", "assessment", "attendance", "timeline"];

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
  const [interventions, setInterventions] = useState<InterventionQueueItem[]>([]);
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

      const enrollmentRes = await supabase.from("student_classes").select("student_id").eq("school_id", ctx.school_id).eq("class_id", classId).eq("student_id", studentId).eq("is_current", true).maybeSingle();
      if (enrollmentRes.error) throw enrollmentRes.error;
      if (!enrollmentRes.data) throw new Error("This learner is not currently enrolled in this class.");

      const learnerRes = await supabase.from("students").select("id,name,admission_number,profile_id,deleted_at").eq("id", studentId).is("deleted_at", null).maybeSingle();
      if (learnerRes.error) throw learnerRes.error;
      const learner = learnerRes.data as Student | null;
      if (!learner) throw new Error("This learner identity could not be loaded. Retry instead of treating the enrolment as missing.");
      setStudent(learner);

      const subjectIds = Array.from(new Set(ctx.classes.filter((item) => item.class_id === classId).map((item) => item.subject_id)));
      const [attendanceRes, homeworkRes, gradebookRes, cbcRes, examRes, subjectRes, interventionRows] = await Promise.all([
        supabase.from("attendance").select("date,status,is_late").eq("school_id", ctx.school_id).eq("class_id", classId).eq("student_id", studentId).order("date", { ascending: false }).limit(120),
        supabase.from("homework").select("id,title,subject,due_date,type").eq("school_id", ctx.school_id).eq("class_id", classId).eq("teacher_id", auth.user.id).order("due_date", { ascending: false }).limit(80),
        subjectIds.length ? supabase.from("assessment_gradebook_entries").select("assessment_id,subject_id,score,max_score,percentage,assessment_type,assessment_title,released_at").eq("school_id", ctx.school_id).eq("class_id", classId).eq("student_id", studentId).eq("teacher_id", auth.user.id).in("subject_id", subjectIds).order("released_at", { ascending: false }).limit(80) : Promise.resolve({ data: [], error: null }),
        subjectIds.length ? supabase.from("cbc_assessments").select("id,subject_id,strand_id,sub_strand,assessment_type,performance,notes,created_at").eq("school_id", ctx.school_id).eq("class_id", classId).eq("student_id", studentId).eq("teacher_id", auth.user.id).in("subject_id", subjectIds).order("created_at", { ascending: false }).limit(80) : Promise.resolve({ data: [], error: null }),
        subjectIds.length ? supabase.from("exam_results").select("id,exam_id,subject_id,marks,is_absent,created_at").eq("school_id", ctx.school_id).eq("class_id", classId).eq("student_id", studentId).eq("teacher_id", auth.user.id).in("subject_id", subjectIds).order("created_at", { ascending: false }).limit(80) : Promise.resolve({ data: [], error: null }),
        subjectIds.length ? supabase.from("subjects").select("id,name").in("id", subjectIds) : Promise.resolve({ data: [], error: null }),
        listInterventionQueue(classId),
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
      setInterventions(interventionRows.filter((item) => item.studentId === studentId));
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
  const activeIntervention = interventions.find((item) => item.status !== "completed" && item.status !== "dismissed") ?? interventions[0] ?? null;
  const strengths = [
    truth.attendance.rate != null && truth.attendance.rate >= 90 ? `Attendance is strong at ${truth.attendance.rate}%.` : null,
    truth.work.assigned >= 2 && truth.work.submitted / Math.max(truth.work.assigned, 1) >= .8 ? `${truth.work.submitted} of ${truth.work.assigned} assigned items have a submission record.` : null,
    truth.assessment.averageReleasedScore != null && truth.assessment.averageReleasedScore >= 70 ? `Released assessment average is ${truth.assessment.averageReleasedScore}%.` : null,
    activeIntervention?.priority === "extension" ? `${activeIntervention.subjectName} evidence supports extension work.` : null,
  ].filter((item): item is string => Boolean(item));

  const todayInsights = [
    truth.work.missing > 0 ? `${truth.work.missing} overdue ${truth.work.missing === 1 ? "task needs" : "tasks need"} follow-up.` : null,
    activeIntervention ? `${activeIntervention.subjectName}: ${activeIntervention.masteryScore < 40 ? "needs focused support" : activeIntervention.priority === "extension" ? "ready for a challenge" : "needs more practice"} (${Math.round(activeIntervention.masteryScore)}% mastery).` : null,
    truth.trend ? `${subjectNames.get(truth.trend.subjectId) ?? "A subject"} changed ${truth.trend.delta > 0 ? "+" : ""}${truth.trend.delta} points across comparable assessments.` : null,
    truth.attendance.rate != null ? `Attendance is ${truth.attendance.rate}% across ${truth.attendance.records} recorded sessions.` : null,
  ].filter((item): item is string => Boolean(item));

  const nextAction = activeIntervention
    ? activeIntervention.remedialAssessmentId
      ? { title: "Check whether support worked", detail: `A follow-up assessment exists for ${activeIntervention.subjectName}. Review the released evidence when it is available.`, kind: "assessment" as const }
      : { title: activeIntervention.priority === "extension" ? "Give the learner a stretch task" : "Close the support loop", detail: activeIntervention.recommendation, kind: "intervention" as const }
    : truth.work.missing > 0
      ? { title: "Follow up missing work", detail: `${truth.work.missing} overdue item${truth.work.missing === 1 ? "" : "s"} currently have no submission record.`, kind: "work" as const }
      : { title: "Keep building the learning picture", detail: "Record assessment, work and attendance evidence so VibeSchool can surface reliable changes and next steps.", kind: "assessment" as const };

  const timeline = [
    ...attendance.map((item, index) => ({ id: `attendance-${item.date}-${index}`, at: item.date, type: "Attendance", title: item.is_late ? "Arrived late" : item.status, detail: "Attendance record" })),
    ...homework.flatMap((item) => {
      const submission = submissionMap.get(item.id);
      return submission?.submitted_at ? [{ id: `work-${item.id}`, at: submission.submitted_at, type: "Work", title: item.title, detail: submission.status === "marked" && submission.mark != null ? `Marked · ${submission.mark}` : submission.status.replaceAll("_", " ") }] : [];
    }),
    ...gradebook.filter((item) => item.released_at).map((item, index) => ({ id: `assessment-${item.assessment_id}-${index}`, at: item.released_at as string, type: "Assessment", title: item.assessment_title, detail: item.percentage == null ? item.assessment_type : `${Math.round(item.percentage)}% · ${item.assessment_type}` })),
    ...cbc.map((item) => ({ id: `cbc-${item.id}`, at: item.created_at, type: "Learning evidence", title: `${subjectNames.get(item.subject_id) ?? "Subject"}${item.sub_strand ? ` · ${item.sub_strand}` : ""}`, detail: `${item.assessment_type} · ${item.performance}` })),
    ...interventions.filter((item) => item.updatedAt).map((item) => ({ id: `support-${item.interventionId}`, at: item.updatedAt, type: "Support", title: `${item.subjectName} · ${item.priority === "extension" ? "Challenge" : "Learning support"}`, detail: item.status.replaceAll("_", " ") })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 40);


  return <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 14px 112px" }}>
    <section style={{ background: "linear-gradient(135deg,#1e1b4b,#4f46e5)", color: "#fff", borderRadius: 20, padding: 18, marginBottom: 12 }}>
      <button type="button" onClick={() => router.push(`/teacher/classhub/${classId}`)} style={{ minHeight: 38, border: 0, borderRadius: 10, background: "rgba(255,255,255,.14)", color: "#fff", padding: "0 11px", fontWeight: 800 }}>‹ Class</button>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 13 }}><div style={{ width: 54, height: 54, borderRadius: 99, background: "rgba(255,255,255,.18)", display: "grid", placeItems: "center", fontWeight: 900 }}>{student.name.charAt(0).toUpperCase()}</div><div><h1 style={{ margin: 0, fontSize: 22 }}>{student.name}</h1><div style={{ marginTop: 4, fontSize: 11, opacity: .75 }}>{classAssignment?.class_name ?? "Class"}{classAssignment?.stream ? ` ${classAssignment.stream}` : ""}{student.admission_number ? ` · Adm ${student.admission_number}` : ""}</div></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginTop: 14 }}>{[{ label: "Attendance", value: truth.attendance.rate == null ? "—" : `${truth.attendance.rate}%` }, { label: "Work", value: `${truth.work.submitted}/${truth.work.assigned}` }, { label: "Evidence", value: assessmentEvidence }, { label: "Released avg", value: truth.assessment.averageReleasedScore == null ? "—" : `${truth.assessment.averageReleasedScore}%` }].map((item) => <div key={item.label} style={{ background: "rgba(255,255,255,.12)", borderRadius: 11, padding: "8px 4px", textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 900 }}>{item.value}</div><div style={{ marginTop: 2, fontSize: 8, opacity: .65 }}>{item.label}</div></div>)}</div>
    </section>

    <section style={{ marginBottom: 12, borderRadius: 16, padding: 13, background: truth.evidenceState === "sufficient" ? "#ecfdf5" : "#fffbeb", color: truth.evidenceState === "sufficient" ? "#065f46" : "#92400e", border: `1px solid ${truth.evidenceState === "sufficient" ? "#a7f3d0" : "#fde68a"}` }}><div style={{ fontWeight: 900, fontSize: 12 }}>{truth.evidenceState === "sufficient" ? "Learning picture available" : "Still building this learner picture"}</div><div style={{ marginTop: 3, fontSize: 11 }}>{truth.evidenceState === "sufficient" ? "There is enough recorded evidence to explore patterns, concerns and next actions." : "Keep recording real learning evidence. VibeSchool will not invent a mastery or trend conclusion before the evidence is strong enough."}</div></section>

    <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 12 }}>{tabs.map((item) => <button key={item} type="button" onClick={() => setTab(item)} style={{ minHeight: 40, border: tab === item ? "1px solid #312e81" : "1px solid #e5e7eb", borderRadius: 99, background: tab === item ? "#312e81" : "#fff", color: tab === item ? "#fff" : "#374151", padding: "0 14px", fontWeight: 900, textTransform: "capitalize" }}>{item}</button>)}</div>

    {tab === "now" && <div style={{ display: "grid", gap: 10 }}>
      <Card>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 8 }}>WHAT YOU SHOULD KNOW TODAY</div>
        <div style={{ fontSize: 18, lineHeight: 1.25, fontWeight: 900, marginBottom: 10 }}>{todayInsights.length ? `${student.name.split(" ")[0]}'s learning picture` : "Start building this learner's story"}</div>
        {todayInsights.length ? <div style={{ display: "grid", gap: 7 }}>{todayInsights.map((item) => <div key={item} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, lineHeight: 1.45 }}><span aria-hidden style={{ color: "#4f46e5", fontWeight: 900 }}>•</span><span>{item}</span></div>)}</div> : <div style={{ color: "#6b7280", fontSize: 12 }}>Attendance, work and assessment evidence will appear here as a simple teacher-readable story.</div>}
      </Card>

      <Card>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 8 }}>RECOMMENDED NEXT STEP</div>
        <div style={{ fontSize: 16, fontWeight: 900 }}>{nextAction.title}</div>
        <div style={{ marginTop: 5, color: "#4b5563", fontSize: 12, lineHeight: 1.5 }}>{nextAction.detail}</div>
        <button type="button" onClick={() => nextAction.kind === "intervention" ? router.push(`/teacher/assessment/interventions?classId=${classId}`) : nextAction.kind === "work" ? setTab("work") : setTab("assessment")} style={{ marginTop: 11, minHeight: 42, border: 0, borderRadius: 12, background: "#312e81", color: "#fff", padding: "0 14px", fontWeight: 900 }}>{nextAction.kind === "intervention" ? "Open support" : nextAction.kind === "work" ? "Review work" : "Inspect evidence"}</button>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
        <Card><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 8 }}>DOING WELL</div>{strengths.length ? <div style={{ display: "grid", gap: 7 }}>{strengths.slice(0,3).map((item) => <div key={item} style={{ fontSize: 11, lineHeight: 1.4, color: "#065f46" }}>{item}</div>)}</div> : <div style={{ color: "#6b7280", fontSize: 11 }}>No strong pattern is proven yet. Keep collecting evidence.</div>}</Card>
        <Card><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 8 }}>NEEDS ATTENTION</div><div style={{ fontSize: 24, fontWeight: 900 }}>{truth.signals.length + (activeIntervention ? 1 : 0)}</div><div style={{ marginTop: 3, color: "#6b7280", fontSize: 10 }}>evidence-backed signal{truth.signals.length + (activeIntervention ? 1 : 0) === 1 ? "" : "s"}</div></Card>
      </div>

      <Card><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>WHAT NEEDS ATTENTION</div>{truth.signals.length === 0 ? <div style={{ color: "#6b7280", fontSize: 12 }}>{truth.evidenceState === "sufficient" ? "No current concern is supported by the recorded evidence." : "VibeSchool will wait for more evidence before labelling a learner concern."}</div> : <div style={{ display: "grid", gap: 8 }}>{truth.signals.map((signal) => <div key={signal.id} style={{ background: signal.id === "missing_work" ? "#fffbeb" : "#fef2f2", color: signal.id === "missing_work" ? "#92400e" : "#991b1b", borderRadius: 12, padding: 11, fontSize: 12 }}><strong>{signal.id === "missing_work" ? "Missing required work" : signal.id === "repeated_low_assessment" ? "Repeated low assessment results" : "Repeated support-level CBC evidence"}</strong><div style={{ marginTop: 3 }}>{signal.reason}</div><div style={{ marginTop: 6, fontSize: 10, opacity: .75 }}>{signal.evidenceCount} evidence record{signal.evidenceCount === 1 ? "" : "s"} · {signal.confidence} confidence</div></div>)}</div>}</Card>

      <Card><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>WHAT CHANGED</div>{!truth.trend ? <div style={{ color: "#6b7280", fontSize: 12 }}><strong style={{ color: "#374151" }}>No reliable trend yet.</strong><div style={{ marginTop: 4 }}>VibeSchool waits for at least 4 comparable released assessments before saying performance is improving or declining.</div></div> : <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}><div><strong>{subjectNames.get(truth.trend.subjectId) ?? "Subject"}</strong><div style={{ marginTop: 3, fontSize: 10, color: "#6b7280" }}>{truth.trend.assessmentType} · {truth.trend.evidenceCount} comparable assessments</div></div><Badge text={`${truth.trend.delta > 0 ? "+" : ""}${truth.trend.delta} pts`} tone={truth.trend.delta >= 5 ? "good" : truth.trend.delta <= -5 ? "bad" : "neutral"} /></div>}</Card>

      <Card>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>LEARNING SUPPORT</div>
        {interventions.length === 0 ? <div style={{ color: "#6b7280", fontSize: 12 }}>{truth.evidenceState === "sufficient" ? "No active outcome support is currently required." : "Outcome-level support will appear only when the evidence supports it."}</div> : <div style={{ display: "grid", gap: 10 }}>{interventions.map((item) => <div key={item.interventionId} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}><div><div style={{ fontSize: 10, color: "#6b7280", fontWeight: 800 }}>{item.subjectName}</div><strong style={{ display: "block", marginTop: 2 }}>{item.priority === "extension" ? "Ready for a challenge" : item.masteryScore < 40 ? "Needs focused support" : "Needs more practice"}</strong></div><Badge text={item.status.replaceAll("_", " ")} tone={item.status === "completed" ? "good" : item.status === "escalated" ? "bad" : "warn"} /></div><div style={{ marginTop: 7, fontSize: 12, lineHeight: 1.45 }}>{item.recommendation}</div><div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}><Badge text={`${Math.round(item.masteryScore)}% mastery`} tone={item.masteryScore >= 70 ? "good" : item.masteryScore < 40 ? "bad" : "warn"} /><Badge text={`${item.evidenceCount} evidence`} /><Badge text={`${Math.round(item.confidenceScore)}% confidence`} /></div>{item.evaluatedAt ? <div style={{ marginTop: 8, fontSize: 11 }}><strong>After support:</strong> {item.masteryChange != null && item.masteryChange > 0 ? "+" : ""}{item.masteryChange ?? 0} mastery points</div> : item.remedialAssessmentId ? <div style={{ marginTop: 8, fontSize: 11, color: "#4b5563" }}>Follow-up assessment created. Review the result when released.</div> : <div style={{ marginTop: 8, fontSize: 11, color: "#92400e" }}>Next step: give a short reassessment so you can see whether the support worked.</div>}<details style={{ marginTop: 8 }}><summary style={{ cursor: "pointer", fontSize: 10, color: "#6b7280" }}>Technical evidence details</summary><div style={{ marginTop: 5, fontSize: 10, color: "#6b7280" }}>{item.outcomeCode ?? "Outcome"} · {item.outcomeText || "Outcome evidence"} · {item.priority} priority</div></details></div>)}</div>}
        <button type="button" onClick={() => router.push(`/teacher/assessment/interventions?classId=${classId}`)} style={{ marginTop: 12, minHeight: 44, border: "1px solid #d1d5db", borderRadius: 12, background: "#fff", fontWeight: 900, padding: "0 14px" }}>Open support workspace</button>
      </Card>

      <Card><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>MORE ACTIONS</div><div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}><button type="button" onClick={() => router.push(`/teacher/classhub/${classId}/homework`)} style={{ minHeight: 46, border: 0, borderRadius: 12, background: "#0f766e", color: "#fff", fontWeight: 900 }}>Assign / review work</button><button type="button" onClick={() => router.push(`/teacher/assessment?classId=${classId}`)} style={{ minHeight: 46, border: 0, borderRadius: 12, background: "#92400e", color: "#fff", fontWeight: 900 }}>Assess learner</button><button type="button" onClick={() => router.push(`/teacher/attendance?classId=${classId}`)} style={{ minHeight: 46, border: 0, borderRadius: 12, background: "#065f46", color: "#fff", fontWeight: 900 }}>Attendance</button><button type="button" onClick={() => setTab("assessment")} style={{ minHeight: 46, border: "1px solid #d1d5db", borderRadius: 12, background: "#fff", fontWeight: 900 }}>Inspect evidence</button></div></Card>
    </div>}

    {tab === "work" && <Card>{homework.length === 0 ? <div style={{ padding: 22, textAlign: "center", color: "#6b7280" }}>No homework assigned by you for this class yet.</div> : <div style={{ display: "grid", gap: 9 }}>{homework.map((item) => { const submission = submissionMap.get(item.id); const overdue = Boolean(item.due_date) && !submission && new Date(item.due_date ?? "").getTime() < Date.now(); return <button type="button" key={item.id} onClick={() => router.push(`/teacher/classhub/${classId}/homework/${item.id}`)} style={{ width: "100%", textAlign: "left", border: "1px solid #e5e7eb", borderRadius: 13, padding: 11, background: "#fff" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 13, fontWeight: 900 }}>{item.title}</div><div style={{ marginTop: 3, fontSize: 10, color: "#6b7280" }}>{item.subject || "Subject"} · {item.due_date ? `Due ${formatDate(item.due_date)}` : "No due date"}</div></div>{submission ? <Badge text={submission.status} tone={submission.status === "marked" ? "good" : "neutral"} /> : <Badge text={overdue ? "Missing" : "Not submitted"} tone={overdue ? "bad" : "warn"} />}</div>{submission?.mark != null && <div style={{ marginTop: 7, fontSize: 12, fontWeight: 900, color: "#065f46" }}>Mark: {submission.mark}</div>}{submission?.feedback && <div style={{ marginTop: 5, fontSize: 11, color: "#6b7280" }}>{submission.feedback}</div>}</button>; })}</div>}</Card>}

    {tab === "assessment" && <div style={{ display: "grid", gap: 10 }}>
      <Card><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>RELEASED ASSESSMENTS</div>{gradebook.length === 0 ? <div style={{ color: "#6b7280" }}>No released canonical assessment scores yet.</div> : gradebook.map((item, index) => { const percentage = item.percentage; return <div key={`${item.assessment_id}-${index}`} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", padding: "8px 0" }}><div><strong>{item.assessment_title}</strong><div style={{ fontSize: 10, color: "#6b7280" }}>{item.subject_id ? subjectNames.get(item.subject_id) ?? "Subject" : "Unscoped subject"} · {item.assessment_type}</div></div>{percentage === null ? <Badge text="No score" /> : <Badge text={`${Math.round(percentage)}%`} tone={percentage >= 70 ? "good" : percentage < 50 ? "bad" : "warn"} />}</div>; })}</Card>
      <Card><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>CBC COMPETENCY EVIDENCE</div>{cbc.length === 0 ? <div style={{ color: "#6b7280" }}>No CBC competency observations recorded yet.</div> : cbc.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", padding: "8px 0" }}><div><strong>{subjectNames.get(item.subject_id) ?? "Subject"}{item.sub_strand ? ` · ${item.sub_strand}` : ""}</strong><div style={{ fontSize: 10, color: "#6b7280" }}>{item.assessment_type} · {formatDate(item.created_at)}</div></div><Badge text={item.performance} tone={item.performance === "EE" || item.performance === "ME" ? "good" : item.performance === "BE" ? "bad" : "warn"} /></div>)}</Card>
      <Card><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>EXAM RESULTS</div>{exams.length === 0 ? <div style={{ color: "#6b7280" }}>No exam results recorded by you for this learner.</div> : exams.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", padding: "8px 0" }}><span>{subjectNames.get(item.subject_id) ?? "Subject"} · {formatDate(item.created_at)}</span><Badge text={item.is_absent ? "Absent" : `${item.marks}`} tone={item.is_absent ? "warn" : "neutral"} /></div>)}</Card>
    </div>}

    {tab === "attendance" && <Card><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 12 }}>{[{ label: "Records", value: truth.attendance.records }, { label: "Present", value: truth.attendance.present }, { label: "Absent", value: truth.attendance.absent }, { label: "Late", value: truth.attendance.late }].map((item) => <div key={item.label} style={{ background: "#f8fafc", borderRadius: 11, padding: 8, textAlign: "center" }}><strong>{item.value}</strong><div style={{ fontSize: 9, color: "#6b7280" }}>{item.label}</div></div>)}</div>{attendance.length === 0 ? <div style={{ padding: 22, textAlign: "center", color: "#6b7280" }}>No attendance evidence recorded yet.</div> : attendance.map((item, index) => <div key={`${item.date}-${index}`} style={{ minHeight: 44, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f3f4f6" }}><span>{formatDate(item.date)}</span><Badge text={item.is_late ? "Late" : item.status} tone={item.status === "present" && !item.is_late ? "good" : item.status === "absent" ? "bad" : "warn"} /></div>)}</Card>}


    {tab === "timeline" && <Card>
      <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 4 }}>STUDENT STORY</div>
      <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.45, marginBottom: 14 }}>One timeline of attendance, work, assessments and support. Use it to see what happened before and after you acted.</div>
      {timeline.length === 0 ? <div style={{ padding: 22, textAlign: "center", color: "#6b7280" }}>No dated learner events are recorded yet.</div> : <div style={{ display: "grid" }}>{timeline.map((item, index) => <div key={item.id} style={{ display: "grid", gridTemplateColumns: "76px 12px 1fr", gap: 8, minHeight: 64 }}><div style={{ fontSize: 9, color: "#6b7280", paddingTop: 2 }}>{formatDate(item.at)}</div><div style={{ position: "relative" }}><div style={{ width: 9, height: 9, borderRadius: 99, background: "#4f46e5", marginTop: 2 }} />{index < timeline.length - 1 && <div style={{ position: "absolute", left: 4, top: 12, bottom: -2, width: 1, background: "#e5e7eb" }} />}</div><div style={{ paddingBottom: 14 }}><div style={{ fontSize: 9, fontWeight: 900, color: "#6366f1", textTransform: "uppercase", letterSpacing: .4 }}>{item.type}</div><div style={{ marginTop: 2, fontSize: 12, fontWeight: 900 }}>{item.title}</div><div style={{ marginTop: 2, fontSize: 10, color: "#6b7280" }}>{item.detail}</div></div></div>)}</div>}
    </Card>}

 </div>;
}
