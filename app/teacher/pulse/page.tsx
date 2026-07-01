"use client";

import { useState } from "react";
import { PulseSnapshot, Slot, WorkflowState } from "@/lib/pulse/fetcher";

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
  if (state === "Done") return { color: "#10b981", bg: "#ecfdf5" };
  if (state === "Current") return { color: "#2563eb", bg: "#eff6ff" };
  if (state === "Blocked") return { color: "#ef4444", bg: "#fef2f2" };
  if (state === "Next") return { color: "#7c3aed", bg: "#f5f3ff" };
  return { color: "#9ca3af", bg: "#f3f4f6" };
}

export default function LessonFlowCard({ slots, onNavigate }: LessonFlowCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (slots.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: 20, padding: 20, textAlign: "center", color: "#6b7280" }}>
        No lessons scheduled for today.
      </div>
    );
  }

  const activeSlot = slots[activeIndex];

  const routes: Partial<Record<StepName, string>> = {
    "Plan Lesson": `/teacher/lessonplan?subjectId=${activeSlot.subject_id}&classId=${activeSlot.class_id}`,
    "Take Attendance": `/teacher/attendance?classId=${activeSlot.class_id}`,
    "Teach Lesson": `/teacher/teach?classId=${activeSlot.class_id}&subjectId=${activeSlot.subject_id}`,
    "Assign Task": `/teacher/homework?classId=${activeSlot.class_id}&subjectId=${activeSlot.subject_id}`,
    "Mark Work": `/teacher/assessment?classId=${activeSlot.class_id}&subjectId=${activeSlot.subject_id}`,
  };

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
        {steps.map((step) => {
          const state = getStepState(step, activeSlot);
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
                padding: "12px",
                borderRadius: 14,
                border: state === "Current" ? "1px solid #bfdbfe" : "1px solid #f3f4f6",
                background: state === "Current" ? "#f8fafc" : "#fff",
                cursor: enabled ? "pointer" : "default",
                opacity: state === "Blocked" || state === "Not available yet" ? 0.55 : 1,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b" }}>{step}</div>
                {!route && (
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                    Will unlock when this workflow page is built.
                  </div>
                )}
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
                {state}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
