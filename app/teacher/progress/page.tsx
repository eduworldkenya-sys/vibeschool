"use client";
export const dynamic = "force-dynamic";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  saveTeachingProgressRecord,
  TeachingProgressError,
} from "@/lib/teaching/progress";
import { nairobiDateStr } from "@/lib/time";

interface PlanOption {
  id: string;
  title: string;
  topic: string | null;
  class_id: string;
  subject_id: string;
  taught_date: string | null;
  class_name: string;
  subject_name: string;
}

interface ProgressRow {
  id: string;
  lesson_plan_id: string | null;
  teaching_occurrence_id: string | null;
  taught_date: string;
  what_was_taught: string;
  participation_score: number | null;
  challenges: string | null;
  homework_set: string | null;
  teacher_remarks: string | null;
  next_steps: string | null;
  class_id: string | null;
  subject_id: string | null;
  class_name: string;
  subject_name: string;
  plan_title: string | null;
}

interface FormState {
  lessonPlanId: string;
  taughtDate: string;
  whatWasTaught: string;
  participationScore: string;
  challenges: string;
  homeworkSet: string;
  teacherRemarks: string;
  nextSteps: string;
}

const initialForm: FormState = {
  lessonPlanId: "",
  taughtDate: nairobiDateStr(),
  whatWasTaught: "",
  participationScore: "",
  challenges: "",
  homeworkSet: "",
  teacherRemarks: "",
  nextSteps: "",
};

const C = {
  bg: "#f8fafc",
  card: "#ffffff",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  accent: "#10b981",
  blue: "#2563eb",
  danger: "#dc2626",
};

function clean(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function errorMessage(error: unknown) {
  if (error instanceof TeachingProgressError) {
    switch (error.code) {
      case "occurrence_not_completed":
        return "Complete the lesson before recording progress.";
      case "occurrence_not_owned":
        return "This teaching occurrence does not belong to your account.";
      case "lesson_plan_not_found":
        return "The exact lesson plan for this occurrence could not be found.";
      case "what_was_taught_required":
        return "Describe what was taught before saving.";
      case "invalid_participation_score":
        return "Participation must be between 1 and 5.";
      case "not_authenticated":
        return "Your session has expired. Sign in again.";
      default:
        return error.message || "The record could not be saved.";
    }
  }
  return error instanceof Error ? error.message : "The record could not be saved.";
}

export default function ProgressPage() {
  const router = useRouter();
  const search = useSearchParams();
  const occurrenceId = search.get("occurrenceId")?.trim() || null;
  const requestedPlanId = search.get("planId")?.trim() || null;
  const requestedClassId = search.get("classId")?.trim() || null;
  const requestedSubjectId = search.get("subjectId")?.trim() || null;
  const requestedDate = search.get("date")?.trim() || null;

  const [teacherId, setTeacherId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [records, setRecords] = useState<ProgressRow[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(Boolean(occurrenceId || requestedPlanId));

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === form.lessonPlanId) ?? null,
    [plans, form.lessonPlanId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        router.replace("/login");
        return;
      }

      const db = supabase as any;
      const [memberRes, profileRes] = await Promise.all([
        db.from("school_members").select("school_id").eq("profile_id", user.id).maybeSingle(),
        db.from("profiles").select("school_id").eq("id", user.id).single(),
      ]);
      if (memberRes.error) throw memberRes.error;
      if (profileRes.error) throw profileRes.error;

      const resolvedSchoolId = memberRes.data?.school_id ?? profileRes.data?.school_id;
      if (!resolvedSchoolId) throw new Error("School context is missing.");

      const [plansRes, recordsRes] = await Promise.all([
        db
          .from("lesson_plans")
          .select("id,title,topic,class_id,subject_id,taught_date,classes(name),subjects(name)")
          .eq("teacher_id", user.id)
          .order("taught_date", { ascending: false, nullsFirst: false })
          .limit(100),
        db
          .from("progress_records")
          .select("id,lesson_plan_id,teaching_occurrence_id,taught_date,what_was_taught,participation_score,challenges,homework_set,teacher_remarks,next_steps,class_id,subject_id,classes(name),subjects(name),lesson_plans(title)")
          .eq("teacher_id", user.id)
          .order("taught_date", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(100),
      ]);
      if (plansRes.error) throw plansRes.error;
      if (recordsRes.error) throw recordsRes.error;

      const mappedPlans: PlanOption[] = (plansRes.data ?? [])
        .filter((row: any) => row.class_id && row.subject_id)
        .map((row: any) => ({
          id: row.id,
          title: row.title,
          topic: row.topic,
          class_id: row.class_id,
          subject_id: row.subject_id,
          taught_date: row.taught_date,
          class_name: row.classes?.name ?? "Class",
          subject_name: row.subjects?.name ?? "Subject",
        }));

      const mappedRecords: ProgressRow[] = (recordsRes.data ?? []).map((row: any) => ({
        id: row.id,
        lesson_plan_id: row.lesson_plan_id,
        teaching_occurrence_id: row.teaching_occurrence_id,
        taught_date: row.taught_date,
        what_was_taught: row.what_was_taught,
        participation_score: row.participation_score,
        challenges: row.challenges,
        homework_set: row.homework_set,
        teacher_remarks: row.teacher_remarks,
        next_steps: row.next_steps,
        class_id: row.class_id,
        subject_id: row.subject_id,
        class_name: row.classes?.name ?? "Class",
        subject_name: row.subjects?.name ?? "Subject",
        plan_title: row.lesson_plans?.title ?? null,
      }));

      const preferredPlan = mappedPlans.find((plan) => plan.id === requestedPlanId)
        ?? mappedPlans.find((plan) =>
          (!requestedClassId || plan.class_id === requestedClassId)
          && (!requestedSubjectId || plan.subject_id === requestedSubjectId)
          && (!requestedDate || !plan.taught_date || plan.taught_date === requestedDate),
        )
        ?? null;

      setTeacherId(user.id);
      setSchoolId(resolvedSchoolId);
      setPlans(mappedPlans);
      setRecords(mappedRecords);
      setForm((current) => ({
        ...current,
        lessonPlanId: preferredPlan?.id ?? current.lessonPlanId,
        taughtDate: requestedDate ?? preferredPlan?.taught_date ?? current.taughtDate,
      }));
    } catch (caught) {
      console.error("Progress load failed", caught);
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [requestedClassId, requestedDate, requestedPlanId, requestedSubjectId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.whatWasTaught.trim()) {
      setError("Describe what was taught before saving.");
      return;
    }

    if (!selectedPlan) {
      setError("Select the lesson plan this record belongs to.");
      return;
    }

    const score = form.participationScore
      ? Number(form.participationScore)
      : null;
    if (score !== null && (!Number.isInteger(score) || score < 1 || score > 5)) {
      setError("Participation must be between 1 and 5.");
      return;
    }

    setSaving(true);
    try {
      if (occurrenceId) {
        await saveTeachingProgressRecord({
          occurrenceId,
          whatWasTaught: form.whatWasTaught.trim(),
          participationScore: score,
          challenges: clean(form.challenges),
          homeworkSet: clean(form.homeworkSet),
          teacherRemarks: clean(form.teacherRemarks),
          nextSteps: clean(form.nextSteps),
        });
      } else {
        const db = supabase as any;
        const { error: insertError } = await db.from("progress_records").insert({
          teacher_id: teacherId,
          school_id: schoolId,
          class_id: selectedPlan.class_id,
          subject_id: selectedPlan.subject_id,
          lesson_plan_id: selectedPlan.id,
          taught_date: form.taughtDate,
          what_was_taught: form.whatWasTaught.trim(),
          participation_score: score,
          challenges: clean(form.challenges),
          homework_set: clean(form.homeworkSet),
          teacher_remarks: clean(form.teacherRemarks),
          next_steps: clean(form.nextSteps),
        });
        if (insertError) throw insertError;
      }

      setSuccess(occurrenceId
        ? "The exact teaching occurrence record has been saved."
        : "The lesson note and record of progress have been saved.");
      setForm((current) => ({
        ...initialForm,
        lessonPlanId: current.lessonPlanId,
        taughtDate: current.taughtDate,
      }));
      await load();
      setShowForm(false);
    } catch (caught) {
      console.error("Progress save failed", caught);
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: C.bg, padding: "20px 16px 96px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ color: C.muted, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.7 }}>Teacher document</div>
          <h1 style={{ margin: "4px 0 0", color: C.text, fontSize: 23 }}>Lesson Notes & Record of Progress</h1>
          <p style={{ margin: "6px 0 0", color: C.muted, fontSize: 12, maxWidth: 620 }}>
            Record the exact lesson delivered, participation, challenges, homework, teacher remarks and the next teaching step.
          </p>
        </div>
        <button
          onClick={() => setShowForm((value) => !value)}
          style={{ border: 0, borderRadius: 11, padding: "9px 12px", background: C.text, color: "#fff", fontWeight: 900, whiteSpace: "nowrap" }}
        >
          {showForm ? "Close" : "Add record"}
        </button>
      </header>

      {occurrenceId && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 13, padding: 12, marginBottom: 12, color: "#1e40af", fontSize: 12 }}>
          This form is locked to the completed teaching occurrence opened from the Teaching Desk. Saving is idempotent and ownership-checked in Supabase.
        </div>
      )}

      {error && <div style={{ background: "#fef2f2", color: C.danger, border: "1px solid #fecaca", borderRadius: 12, padding: 11, marginBottom: 12, fontSize: 12 }}>{error}</div>}
      {success && <div style={{ background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", borderRadius: 12, padding: 11, marginBottom: 12, fontSize: 12 }}>{success}</div>}

      {showForm && (
        <form onSubmit={save} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 15, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.text, marginBottom: 12 }}>
            {occurrenceId ? "Complete the lesson record" : "Add a lesson record"}
          </div>

          <label style={{ display: "block", marginBottom: 11 }}>
            <span style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 5 }}>Lesson plan</span>
            <select
              required
              disabled={Boolean(occurrenceId || requestedPlanId)}
              value={form.lessonPlanId}
              onChange={(event) => {
                const plan = plans.find((item) => item.id === event.target.value);
                setForm((current) => ({
                  ...current,
                  lessonPlanId: event.target.value,
                  taughtDate: plan?.taught_date ?? current.taughtDate,
                }));
              }}
              style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, background: "#fff" }}
            >
              <option value="">Select lesson plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.subject_name} · {plan.class_name} · {plan.title}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 11 }}>
            <span style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 5 }}>Date taught</span>
            <input
              type="date"
              required
              disabled={Boolean(occurrenceId)}
              value={form.taughtDate}
              onChange={(event) => setForm((current) => ({ ...current, taughtDate: event.target.value }))}
              style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 10, padding: 10 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 11 }}>
            <span style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 5 }}>What was taught</span>
            <textarea
              required
              rows={4}
              value={form.whatWasTaught}
              onChange={(event) => setForm((current) => ({ ...current, whatWasTaught: event.target.value }))}
              placeholder="Content covered, examples used and learner activities completed."
              style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, resize: "vertical" }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <label>
              <span style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 5 }}>Participation</span>
              <select value={form.participationScore} onChange={(event) => setForm((current) => ({ ...current, participationScore: event.target.value }))} style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, background: "#fff" }}>
                <option value="">Not recorded</option>
                <option value="1">1 · Very low</option>
                <option value="2">2 · Low</option>
                <option value="3">3 · Average</option>
                <option value="4">4 · Good</option>
                <option value="5">5 · Excellent</option>
              </select>
            </label>
            <label>
              <span style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 5 }}>Homework / exercise</span>
              <input value={form.homeworkSet} onChange={(event) => setForm((current) => ({ ...current, homeworkSet: event.target.value }))} placeholder="Task issued or textbook exercise" style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 10, padding: 10 }} />
            </label>
          </div>

          <label style={{ display: "block", marginTop: 11 }}>
            <span style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 5 }}>Challenges / gaps</span>
            <textarea rows={3} value={form.challenges} onChange={(event) => setForm((current) => ({ ...current, challenges: event.target.value }))} placeholder="Misconceptions, absent learners, time constraints or resources needed." style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, resize: "vertical" }} />
          </label>

          <label style={{ display: "block", marginTop: 11 }}>
            <span style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 5 }}>Teacher remarks</span>
            <textarea rows={3} value={form.teacherRemarks} onChange={(event) => setForm((current) => ({ ...current, teacherRemarks: event.target.value }))} placeholder="Professional remarks on lesson delivery and learner response." style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, resize: "vertical" }} />
          </label>

          <label style={{ display: "block", marginTop: 11 }}>
            <span style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 5 }}>Next teaching step</span>
            <textarea rows={3} value={form.nextSteps} onChange={(event) => setForm((current) => ({ ...current, nextSteps: event.target.value }))} placeholder="Remediate, continue, revise, assess or prepare the next scheme item." style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, resize: "vertical" }} />
          </label>

          <button disabled={saving} type="submit" style={{ marginTop: 13, width: "100%", border: 0, borderRadius: 11, padding: 11, background: saving ? "#9ca3af" : C.accent, color: "#fff", fontWeight: 900 }}>
            {saving ? "Saving…" : "Save record of progress"}
          </button>
        </form>
      )}

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
          <h2 style={{ margin: 0, color: C.text, fontSize: 16 }}>Recorded lessons</h2>
          <span style={{ color: C.muted, fontSize: 11 }}>{records.length} records</span>
        </div>

        {loading ? (
          <div style={{ color: C.muted, fontSize: 13 }}>Loading records…</div>
        ) : records.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, color: C.muted, fontSize: 13 }}>
            No lesson notes or records of progress have been saved yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {records.map((record) => (
              <article key={record.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 14, fontWeight: 900 }}>{record.subject_name} · {record.class_name}</div>
                    <div style={{ color: C.muted, fontSize: 10, marginTop: 3 }}>{formatDate(record.taught_date)}{record.plan_title ? ` · ${record.plan_title}` : ""}</div>
                  </div>
                  {record.teaching_occurrence_id && <span style={{ alignSelf: "flex-start", background: "#ecfdf5", color: "#047857", borderRadius: 999, padding: "4px 7px", fontSize: 8, fontWeight: 900, textTransform: "uppercase" }}>Verified occurrence</span>}
                </div>
                <p style={{ color: C.text, fontSize: 12, lineHeight: 1.55, margin: "10px 0 0" }}>{record.what_was_taught}</p>
                {(record.teacher_remarks || record.next_steps || record.challenges || record.homework_set) && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 9, display: "grid", gap: 6 }}>
                    {record.teacher_remarks && <div style={{ color: C.muted, fontSize: 11 }}><strong style={{ color: C.text }}>Remarks:</strong> {record.teacher_remarks}</div>}
                    {record.next_steps && <div style={{ color: C.muted, fontSize: 11 }}><strong style={{ color: C.text }}>Next:</strong> {record.next_steps}</div>}
                    {record.challenges && <div style={{ color: C.muted, fontSize: 11 }}><strong style={{ color: C.text }}>Challenges:</strong> {record.challenges}</div>}
                    {record.homework_set && <div style={{ color: C.muted, fontSize: 11 }}><strong style={{ color: C.text }}>Homework:</strong> {record.homework_set}</div>}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
