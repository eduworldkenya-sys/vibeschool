"use client";

import { useState } from "react";
import type { PulseSnapshot, Slot, WorkflowState } from "@/lib/types";
import type { TeachingWorkspaceStage, WorkspaceStageState } from "@/lib/teaching/workspace";
import EvidenceCaptureSheet from "./EvidenceCaptureSheet";
import ReflectionSheet from "./ReflectionSheet";
import { nairobiDateStr } from "@/lib/time";

interface LessonFlowCardProps {
  slots: Slot[];
  snap?: PulseSnapshot;
  teacherId?: string;
  onNavigate: (href: string) => void;
  onSaved?: () => void;
}

type StepName =
  | "Plan Lesson"
  | "Take Attendance"
  | "Teach Lesson"
  | "Collect Evidence"
  | "Assign Task"
  | "Mark Learner Work"
  | "Record Assessment"
  | "Write Reflection"
  | "Complete Lesson"
  | "Record Progress"
  | "Prepare Next Lesson";

const steps: StepName[] = [
  "Plan Lesson",
  "Take Attendance",
  "Teach Lesson",
  "Collect Evidence",
  "Assign Task",
  "Mark Learner Work",
  "Record Assessment",
  "Write Reflection",
  "Complete Lesson",
  "Record Progress",
  "Prepare Next Lesson",
];

function toWorkflowState(state: WorkspaceStageState): WorkflowState {
  switch (state) {
    case "done": return "Done";
    case "current": return "Current";
    case "available": return "Next";
    case "blocked": return "Blocked";
    case "unavailable": return "Not available yet";
  }
}

function workspaceStageState(slot: Slot, stage: TeachingWorkspaceStage): WorkflowState {
  const stageView = slot.teaching_workspace?.stages.find((item) => item.stage === stage);
  return stageView ? toWorkflowState(stageView.state) : "Not available yet";
}

function markingState(slot: Slot): WorkflowState {
  if (slot.marking_status === "completed") return "Done";
  if (slot.task_status === "none") return "Not available yet";
  if (slot.submission_count > 0 && slot.marking_status === "pending") return "Current";
  return "Not available yet";
}

function cardStepState(step: StepName, slot: Slot): WorkflowState {
  switch (step) {
    case "Plan Lesson": return workspaceStageState(slot, "plan");
    case "Take Attendance": return workspaceStageState(slot, "attendance");
    case "Teach Lesson": return workspaceStageState(slot, "teach");
    case "Collect Evidence": return workspaceStageState(slot, "evidence");
    case "Assign Task": return workspaceStageState(slot, "homework");
    case "Mark Learner Work": return markingState(slot);
    case "Record Assessment": return workspaceStageState(slot, "assessment");
    case "Write Reflection": return workspaceStageState(slot, "reflection");
    case "Complete Lesson": return workspaceStageState(slot, "complete");
    case "Record Progress": return workspaceStageState(slot, "progress");
    case "Prepare Next Lesson":
      return workspaceStageState(slot, "progress") === "Done"
        ? (slot.next_lesson_status === "completed" ? "Done" : "Current")
        : "Not available yet";
  }
}

function stateStyle(state: WorkflowState) {
  if (state === "Done") return { color: "#047857", bg: "#ecfdf5", label: "Done" };
  if (state === "Current") return { color: "#1d4ed8", bg: "#eff6ff", label: "Do now" };
  if (state === "Blocked") return { color: "#b91c1c", bg: "#fef2f2", label: "Blocked" };
  if (state === "Next") return { color: "#6d28d9", bg: "#f5f3ff", label: "Available" };
  return { color: "#6b7280", bg: "#f3f4f6", label: "Later" };
}

function stepHelp(step: StepName) {
  const help: Record<StepName, string> = {
    "Plan Lesson": "Prepare from the curriculum, scheme and linked resources.",
    "Take Attendance": "Record learners for this exact lesson occurrence.",
    "Teach Lesson": "Start or continue the authoritative teaching occurrence.",
    "Collect Evidence": "Capture learner work or proof of teaching.",
    "Assign Task": "Create homework, an exercise, quiz or project linked to this lesson.",
    "Mark Learner Work": "Open submitted learner work and record marks without re-entering the class.",
    "Record Assessment": "Record formative or summative evidence.",
    "Write Reflection": "Record what worked, difficulties and the next response.",
    "Complete Lesson": "Close the teaching occurrence after delivery.",
    "Record Progress": "Save lesson notes, teacher remarks and the next teaching step.",
    "Prepare Next Lesson": "Use today’s evidence and progress record to plan next.",
  };
  return help[step];
}

function icon(step: StepName) {
  const p = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (step) {
    case "Plan Lesson": return <svg {...p}><path d="M9 3h6v4H9z"/><rect x="4" y="5" width="16" height="16" rx="2"/></svg>;
    case "Take Attendance": return <svg {...p}><path d="M20 6L9 17l-5-5"/></svg>;
    case "Teach Lesson": return <svg {...p}><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/></svg>;
    case "Collect Evidence": return <svg {...p}><path d="M4 7h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="13" r="3"/></svg>;
    case "Assign Task": return <svg {...p}><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8"/></svg>;
    case "Mark Learner Work": return <svg {...p}><path d="M5 4h14v16H5z"/><path d="M8 12l2 2 5-5"/></svg>;
    case "Record Assessment": return <svg {...p}><path d="M4 19V5h16v14z"/><path d="M8 15l3-3 2 2 3-4"/></svg>;
    case "Write Reflection": return <svg {...p}><path d="M4 19V5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M14 3v6h6"/></svg>;
    case "Complete Lesson": return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>;
    case "Record Progress": return <svg {...p}><path d="M3 20h18M6 20V10M12 20V4M18 20v-7"/></svg>;
    case "Prepare Next Lesson": return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
  }
}

function EmptyWorkflow({ snap, onNavigate }: { snap?: PulseSnapshot; onNavigate: (href: string) => void }) {
  const tomorrow = snap?.tomorrowSlots[0];
  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>No lesson scheduled today.</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Prepare the next occurrence or review your teaching documents.</div>
      <button
        onClick={() => onNavigate(tomorrow ? `/teacher/lessonplan?classId=${tomorrow.class_id}&subjectId=${tomorrow.subject_id}` : "/teacher/timetable")}
        style={{ marginTop: 12, border: 0, borderRadius: 10, padding: "9px 13px", background: "#111827", color: "#fff", fontWeight: 800 }}
      >
        {tomorrow ? "Prepare tomorrow" : "Open timetable"}
      </button>
    </div>
  );
}

export default function LessonFlowCard({ slots, snap, teacherId, onNavigate, onSaved }: LessonFlowCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);

  if (slots.length === 0) return <EmptyWorkflow snap={snap} onNavigate={onNavigate} />;

  const activeSlot = slots[Math.min(activeIndex, slots.length - 1)];
  const workspace = activeSlot.teaching_workspace;
  const occurrenceDate = workspace?.key.occurrenceDate ?? nairobiDateStr();
  const lessonPlanId = workspace?.lessonPlanId ?? activeSlot.lesson_plan_id;
  const occurrenceId = workspace?.occurrenceId ?? null;

  const exactLessonUrl = `/teacher/lessonplan?timetableSlotId=${encodeURIComponent(activeSlot.id)}&date=${encodeURIComponent(occurrenceDate)}&subjectId=${encodeURIComponent(activeSlot.subject_id)}&classId=${encodeURIComponent(activeSlot.class_id)}`;
  const lessonNotesUrl = lessonPlanId
    ? `/teacher/lesson-notes?lessonPlanId=${encodeURIComponent(lessonPlanId)}`
    : exactLessonUrl;
  const lineage = `lessonPlanId=${encodeURIComponent(lessonPlanId ?? "")}&occurrenceId=${encodeURIComponent(occurrenceId ?? "")}&subjectId=${encodeURIComponent(activeSlot.subject_id)}&subject=${encodeURIComponent(activeSlot.subject)}&topic=${encodeURIComponent(activeSlot.subject)}`;

  const routes: Partial<Record<StepName, string>> = {
    "Plan Lesson": exactLessonUrl,
    "Take Attendance": `/teacher/attendance?mode=lesson&classId=${encodeURIComponent(activeSlot.class_id)}&timetableSlotId=${encodeURIComponent(activeSlot.id)}&date=${encodeURIComponent(occurrenceDate)}&subjectId=${encodeURIComponent(activeSlot.subject_id)}`,
    "Teach Lesson": exactLessonUrl,
    "Assign Task": `/teacher/classhub/${encodeURIComponent(activeSlot.class_id)}/homework?${lineage}`,
    "Mark Learner Work": `/teacher/classhub/${encodeURIComponent(activeSlot.class_id)}/homework`,
    "Record Assessment": `/teacher/assessment/new?classId=${encodeURIComponent(activeSlot.class_id)}&subjectId=${encodeURIComponent(activeSlot.subject_id)}&lessonPlanId=${encodeURIComponent(lessonPlanId ?? "")}&teachingOccurrenceId=${encodeURIComponent(occurrenceId ?? "")}`,
    "Complete Lesson": exactLessonUrl,
    "Record Progress": `/teacher/progress?planId=${encodeURIComponent(lessonPlanId ?? "")}&occurrenceId=${encodeURIComponent(occurrenceId ?? "")}&classId=${encodeURIComponent(activeSlot.class_id)}&subjectId=${encodeURIComponent(activeSlot.subject_id)}&date=${encodeURIComponent(occurrenceDate)}`,
    "Prepare Next Lesson": `/teacher/lessonplan?classId=${encodeURIComponent(activeSlot.class_id)}&subjectId=${encodeURIComponent(activeSlot.subject_id)}`,
  };

  const modals: Partial<Record<StepName, () => void>> = {
    "Collect Evidence": () => setEvidenceOpen(true),
    "Write Reflection": () => setReflectionOpen(true),
  };

  const states = steps.map((step) => ({ step, state: cardStepState(step, activeSlot) }));
  const firstAction = states.findIndex((item) => item.state === "Current" || item.state === "Next");

  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, borderBottom: "1px solid #f3f4f6" }}>
        {slots.map((slot, index) => (
          <button key={slot.id} onClick={() => setActiveIndex(index)} style={{ border: 0, borderRadius: 12, padding: "7px 11px", whiteSpace: "nowrap", background: index === activeIndex ? "#111827" : "#f3f4f6", color: index === activeIndex ? "#fff" : "#374151", fontWeight: 800 }}>
            {slot.subject} · {slot.class_name}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>{activeSlot.subject}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{activeSlot.class_name} · {activeSlot.start_time}–{activeSlot.end_time}</div>
        </div>
        <div style={{ minWidth: 54, textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>{workspace?.completionPercent ?? 0}%</div>
          <div style={{ fontSize: 9, color: "#6b7280" }}>complete</div>
        </div>
      </div>

      <div style={{ height: 6, borderRadius: 99, background: "#e5e7eb", overflow: "hidden", margin: "12px 0 12px" }}>
        <div style={{ height: "100%", width: `${workspace?.completionPercent ?? 0}%`, background: "#10b981" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => onNavigate(exactLessonUrl)}
          style={{ border: "1px solid #d1d5db", background: "#fff", color: "#111827", borderRadius: 12, padding: "11px 10px", fontSize: 12, fontWeight: 900 }}
        >
          Lesson plan
        </button>
        <button
          type="button"
          onClick={() => onNavigate(lessonNotesUrl)}
          style={{ border: 0, background: lessonPlanId ? "#047857" : "#111827", color: "#fff", borderRadius: 12, padding: "11px 10px", fontSize: 12, fontWeight: 900 }}
        >
          {lessonPlanId ? "Open lesson notes" : "Prepare lesson notes"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {states.map(({ step, state }, index) => {
          const show = state === "Done" || index === firstAction || index === firstAction + 1;
          if (!show) return null;
          const route = routes[step];
          const modal = modals[step];
          const enabled = (Boolean(route) || Boolean(modal)) && state !== "Blocked" && state !== "Not available yet";
          const badge = stateStyle(state);
          return (
            <button
              key={step}
              disabled={!enabled}
              onClick={() => {
                if (modal) modal();
                else if (route) onNavigate(route);
              }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, textAlign: "left", padding: 12, borderRadius: 14, border: state === "Current" ? "1px solid #bfdbfe" : "1px solid #f3f4f6", background: state === "Current" ? "#f8fafc" : "#fff", opacity: enabled || state === "Done" ? 1 : 0.55 }}
            >
              <div style={{ display: "flex", gap: 9 }}>
                <div style={{ color: "#6b7280", marginTop: 2 }}>{icon(step)}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>{step}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{stepHelp(step)}</div>
                </div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", color: badge.color, background: badge.bg, borderRadius: 999, padding: "5px 8px" }}>{badge.label}</span>
            </button>
          );
        })}
      </div>

      {evidenceOpen && lessonPlanId && occurrenceId && (
        <EvidenceCaptureSheet
          lessonId={lessonPlanId}
          occurrenceId={occurrenceId}
          classId={activeSlot.class_id}
          teacherId={teacherId ?? ""}
          defaultTitle={activeSlot.subject}
          onClose={() => setEvidenceOpen(false)}
          onSaved={() => onSaved?.()}
        />
      )}

      {reflectionOpen && (
        <ReflectionSheet
          lessonId={lessonPlanId}
          occurrenceId={occurrenceId}
          classId={activeSlot.class_id}
          subjectId={activeSlot.subject_id}
          teacherId={teacherId ?? ""}
          onClose={() => setReflectionOpen(false)}
          onSaved={() => onSaved?.()}
        />
      )}
    </div>
  );
}
