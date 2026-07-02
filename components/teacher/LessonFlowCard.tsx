"use client";

import { useState } from "react";
import type { PulseSnapshot, Slot, WorkflowState } from "@/lib/types";

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
  | "Review Submissions"
  | "Mark Work"
  | "Record Progress"
  | "Write Reflection"
  | "Prepare Next Lesson";

const steps: StepName[] = [
  "Plan Lesson",
  "Take Attendance",
  "Teach Lesson",
  "Collect Evidence",
  "Assign Task",
  "Review Submissions",
  "Mark Work",
  "Record Progress",
  "Write Reflection",
  "Prepare Next Lesson",
];

function getStepState(step: StepName, slot: Slot): WorkflowState {
  switch (step) {
    case "Plan Lesson":
      return slot.lesson_plan_id ? "Done" : "Current";
    case "Take Attendance":
      if (!slot.lesson_plan_id) return "Blocked";
      return slot.attendance_status === "completed" ? "Done" : "Current";
    case "Teach Lesson":
      if (slot.attendance_status !== "completed") return "Blocked";
      return slot.evidence_count > 0 || slot.task_status !== "none" ? "Done" : "Current";
    case "Collect Evidence":
      if (slot.attendance_status !== "completed") return "Blocked";
      return slot.evidence_count > 0 ? "Done" : "Not available yet";
    case "Assign Task":
      if (slot.attendance_status !== "completed") return "Blocked";
      return slot.task_status !== "none" ? "Done" : "Not available yet";
    case "Review Submissions":
      if (slot.task_status === "none") return "Not available yet";
      return slot.submission_count > 0 ? "Done" : "Current";
    case "Mark Work":
      if (slot.submission_count === 0) return "Blocked";
      return slot.marking_status === "completed" ? "Done" : "Current";
    case "Record Progress":
      if (slot.marking_status !== "completed") return "Blocked";
      return slot.progress_record_status === "completed" ? "Done" : "Not available yet";
    case "Write Reflection":
      if (slot.marking_status !== "completed") return "Blocked";
      return slot.reflection_status === "completed" ? "Done" : "Not available yet";
    case "Prepare Next Lesson":
      if (slot.reflection_status !== "completed") return "Not available yet";
      return slot.next_lesson_status === "completed" ? "Done" : "Current";
  }
}

function stateStyle(state: WorkflowState) {
  if (state === "Done") return { color: "#10b981", bg: "#ecfdf5", label: "Done" };
  if (state === "Current") return { color: "#2563eb", bg: "#eff6ff", label: "Do now" };
  if (state === "Blocked") return { color: "#ef4444", bg: "#fef2f2", label: "Blocked" };
  if (state === "Next") return { color: "#7c3aed", bg: "#f5f3ff", label: "Next" };
  return { color: "#9ca3af", bg: "#f3f4f6", label: "Later" };
}

function stepHelp(step: StepName): string {
  const help: Record<StepName, string> = {
    "Plan Lesson": "Prepare what you will teach.",
    "Take Attendance": "Mark learners before teaching.",
    "Teach Lesson": "Start the class activity.",
    "Collect Evidence": "Save proof of learning when this page is ready.",
    "Assign Task": "Give learners work linked to the lesson.",
    "Review Submissions": "Check learner responses.",
    "Mark Work": "Record marks or achievement.",
    "Record Progress": "Update learner progress when this page is ready.",
    "Write Reflection": "Note what worked and what to improve.",
    "Prepare Next Lesson": "Use today’s progress to plan next.",
  };

  return help[step];
}

function EmptyWorkflow({
  snap,
  onNavigate,
}: {
  snap?: PulseSnapshot;
  onNavigate: (href: string) => void;
}) {
  const weakest = snap?.currStats.length
    ? [...snap.currStats].sort((a, b) => {
        const ap = a.total > 0 ? a.covered / a.total : 1;
        const bp = b.total > 0 ? b.covered / b.total : 1;
        return ap - bp;
      })[0]
    : null;

  const firstUngraded = snap?.homeworkUngraded[0] ?? null;
  const tomorrow = snap?.tomorrowSlots[0] ?? null;

  const actions = [
    ...(weakest
      ? [{
          label: "Continue scheme",
          detail: `${weakest.subject} needs the next teaching step.`,
          href: `/teacher/lessonplan?subjectId=${weakest.subjectId}&classId=${weakest.classId}`,
        }]
      : [{ label: "Continue scheme", detail: "Check the next strand or lesson sequence.", href: "/teacher/scheme" }]),

    ...(tomorrow
      ? [{
          label: "Prepare tomorrow",
          detail: `${tomorrow.subject} for ${tomorrow.class_name}.`,
          href: `/teacher/lessonplan?subjectId=${tomorrow.subject_id}&classId=${tomorrow.class_id}`,
        }]
      : [{ label: "Create lesson plan", detail: "Prepare the next lesson before class time.", href: "/teacher/lessonplan" }]),

    { label: "Review homework", detail: "Check assigned work and learner responses.", href: "/teacher/homework" },

    ...(firstUngraded
      ? [{
          label: "Mark work",
          detail: `${firstUngraded.count} homework submission${firstUngraded.count === 1 ? "" : "s"} waiting.`,
          href: `/teacher/assessment?classId=${firstUngraded.class_id}`,
        }]
      : [{ label: "Mark work", detail: "Open assessment and update learner results.", href: "/teacher/assessment" }]),
  ];

  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 900, color: "#1e1b4b", marginBottom: 4 }}>
        No lesson scheduled now.
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
        Continue your teaching workflow.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {actions.map((action) => (
          <div
            key={action.href}
            onClick={() => onNavigate(action.href)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: 12,
              borderRadius: 14,
              border: "1px solid #f3f4f6",
              cursor: "pointer",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b" }}>{action.label}</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{action.detail}</div>
            </div>
            <div style={{ fontSize: 18, color: "#10b981" }}>→</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LessonFlowCard({ slots, snap, onNavigate }: LessonFlowCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (slots.length === 0) {
    return <EmptyWorkflow snap={snap} onNavigate={onNavigate} />;
  }

  const activeSlot = slots[Math.min(activeIndex, slots.length - 1)];

  const routes: Partial<Record<StepName, string>> = {
    "Plan Lesson": `/teacher/lessonplan?subjectId=${activeSlot.subject_id}&classId=${activeSlot.class_id}`,
    "Take Attendance": `/teacher/attendance?classId=${activeSlot.class_id}`,
    "Teach Lesson": `/teacher/teach?classId=${activeSlot.class_id}&subjectId=${activeSlot.subject_id}`,
    "Assign Task": `/teacher/homework?classId=${activeSlot.class_id}&subjectId=${activeSlot.subject_id}`,
    "Mark Work": `/teacher/assessment?classId=${activeSlot.class_id}&subjectId=${activeSlot.subject_id}`,
  };

  const states = steps.map((step) => ({ step, state: getStepState(step, activeSlot) }));
  const firstCurrentIndex = states.findIndex((item) => item.state === "Current");
  const firstFutureIndex = states.findIndex((item, index) => index > firstCurrentIndex && item.state !== "Done");

  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 14, borderBottom: "1px solid #f3f4f6" }}>
        {slots.map((slot, index) => (
          <button
            key={slot.id}
            onClick={() => setActiveIndex(index)}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: "nowrap",
              cursor: "pointer",
              background: index === activeIndex ? "#1e1b4b" : "#f3f4f6",
              color: index === activeIndex ? "#fff" : "#4b5563",
            }}
          >
            {slot.subject} · {slot.class_name}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 14, fontWeight: 900, color: "#1e1b4b", marginBottom: 4 }}>
        {activeSlot.subject}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
        {activeSlot.class_name} · {activeSlot.start_time} - {activeSlot.end_time}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {states.map(({ step, state }, index) => {
          const show =
            state === "Done" ||
            index === firstCurrentIndex ||
            index === firstFutureIndex;

          if (!show) return null;

          const route = routes[step];
          const enabled = Boolean(route) && state !== "Blocked" && state !== "Not available yet";
          const badge = stateStyle(state);

          return (
            <div
              key={step}
              onClick={() => {
                if (enabled && route) onNavigate(route);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: 12,
                borderRadius: 14,
                border: state === "Current" ? "1px solid #bfdbfe" : "1px solid #f3f4f6",
                background: state === "Current" ? "#f8fafc" : "#fff",
                cursor: enabled ? "pointer" : "default",
                opacity: state === "Blocked" || state === "Not available yet" ? 0.55 : 1,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b" }}>{step}</div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                  {stepHelp(step)}
                </div>
              </div>

              <div style={{
                fontSize: 10,
                fontWeight: 900,
                textTransform: "uppercase",
                color: badge.color,
                background: badge.bg,
                borderRadius: 999,
                padding: "5px 8px",
                whiteSpace: "nowrap",
              }}>
                {badge.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
