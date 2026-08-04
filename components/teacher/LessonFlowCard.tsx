"use client";

import { useState } from "react";
import type { PulseSnapshot, Slot, WorkflowState } from "@/lib/types";
import type {
  TeachingWorkspaceStage,
  WorkspaceStageState,
} from "@/lib/teaching/workspace";
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

function toWorkflowState(
  state: WorkspaceStageState,
): WorkflowState {
  switch (state) {
    case "done":
      return "Done";

    case "current":
      return "Current";

    case "available":
      return "Next";

    case "blocked":
      return "Blocked";

    case "unavailable":
      return "Not available yet";
  }
}

function workspaceStageState(
  slot: Slot,
  stage: TeachingWorkspaceStage,
): WorkflowState {
  const workspace = slot.teaching_workspace;

  if (!workspace) {
    return "Not available yet";
  }

  const stageView = workspace.stages.find(
    (item) => item.stage === stage,
  );

  return stageView
    ? toWorkflowState(stageView.state)
    : "Not available yet";
}

/**
 * Core lesson stages come only from the shared TeachingWorkspace.
 *
 * Submission review, marking, formal progress recording and preparation of
 * the next lesson remain post-teaching workflows until those domains gain
 * their own shared contracts.
 */
function cardStepState(
  step: StepName,
  slot: Slot,
): WorkflowState {
  switch (step) {
    case "Plan Lesson":
      return workspaceStageState(slot, "plan");

    case "Take Attendance":
      return workspaceStageState(slot, "attendance");

    case "Teach Lesson":
      return workspaceStageState(slot, "teach");

    case "Collect Evidence":
      return workspaceStageState(slot, "evidence");

    case "Assign Task":
      return workspaceStageState(slot, "homework");

    case "Write Reflection":
      return workspaceStageState(slot, "reflection");

    case "Review Submissions":
      if (slot.task_status === "none") {
        return "Not available yet";
      }

      return slot.submission_count > 0
        ? "Done"
        : "Current";

    case "Mark Work":
      if (slot.submission_count === 0) {
        return "Blocked";
      }

      return slot.marking_status === "completed"
        ? "Done"
        : "Current";

    case "Record Progress":
      if (slot.marking_status !== "completed") {
        return "Blocked";
      }

      return slot.progress_record_status === "completed"
        ? "Done"
        : "Not available yet";

    case "Prepare Next Lesson":
      if (
        workspaceStageState(slot, "reflection") !== "Done"
      ) {
        return "Not available yet";
      }

      return slot.next_lesson_status === "completed"
        ? "Done"
        : "Current";
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

function stepIcon(step: StepName) {
  const p = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (step) {
    case "Plan Lesson":
      return <svg {...p}><path d="M9 3h6v4H9z" /><rect x="4" y="5" width="16" height="16" rx="2" /></svg>;
    case "Take Attendance":
      return <svg {...p}><path d="M20 6L9 17l-5-5" /></svg>;
    case "Teach Lesson":
      return <svg {...p}><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8" /></svg>;
    case "Collect Evidence":
      return <svg {...p}><path d="M4 7h3l2-2h6l2 2h3v12H4z" /><circle cx="12" cy="13" r="3" /></svg>;
    case "Assign Task":
      return <svg {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>;
    case "Review Submissions":
      return <svg {...p}><path d="M4 4h16v12H8l-4 4z" /></svg>;
    case "Mark Work":
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 5-5" /></svg>;
    case "Record Progress":
      return <svg {...p}><path d="M3 20h18M6 20V10M12 20V4M18 20v-7" /></svg>;
    case "Write Reflection":
      return <svg {...p}><path d="M4 19V5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M14 3v6h6" /></svg>;
    case "Prepare Next Lesson":
      return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  }
}

const journeyStages: { label: string; step: StepName; icon: () => JSX.Element }[] = [
  { label: "Plan", step: "Plan Lesson", icon: () => stepIcon("Plan Lesson")! },
  { label: "Teach", step: "Teach Lesson", icon: () => stepIcon("Teach Lesson")! },
  { label: "Notes", step: "Collect Evidence", icon: () => stepIcon("Collect Evidence")! },
  { label: "Homework", step: "Assign Task", icon: () => stepIcon("Assign Task")! },
  { label: "Assess", step: "Mark Work", icon: () => stepIcon("Mark Work")! },
  { label: "Next Lesson", step: "Prepare Next Lesson", icon: () => stepIcon("Prepare Next Lesson")! },
];

function journeyStatus(state: WorkflowState): { label: string; color: string; bg: string } {
  if (state === "Done") return { label: "Done", color: "#10b981", bg: "#10b981" };
  if (state === "Current") return { label: "Ready", color: "#2563eb", bg: "#2563eb" };
  return { label: "Pending", color: "#9ca3af", bg: "#e5e7eb" };
}

function TeachJourney({ slot }: { slot: Slot }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #f3f4f6" }}>
      {journeyStages.map((stage) => {
        const state = cardStepState(stage.step, slot);
        const status = journeyStatus(state);
        const isDone = state === "Done";

        return (
          <div key={stage.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isDone ? status.bg : "#fff",
              border: `2px solid ${status.bg}`,
              color: isDone ? "#fff" : status.color,
            }}>
              {isDone ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> : stage.icon()}
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#1e1b4b", textAlign: "center" }}>{stage.label}</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: status.color, textAlign: "center" }}>{status.label}</div>
          </div>
        );
      })}
    </div>
  );
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

export default function LessonFlowCard({ slots, snap, teacherId, onNavigate, onSaved }: LessonFlowCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [evidenceSheetOpen, setEvidenceSheetOpen] = useState(false);
  const [reflectionSheetOpen, setReflectionSheetOpen] = useState(false);

  if (slots.length === 0) {
    return <EmptyWorkflow snap={snap} onNavigate={onNavigate} />;
  }

  const activeSlot = slots[Math.min(activeIndex, slots.length - 1)];

  const occurrenceDate =
    activeSlot.teaching_workspace?.key.occurrenceDate ??
    nairobiDateStr();

  const exactLessonUrl =
    `/teacher/lessonplan?` +
    `timetableSlotId=${encodeURIComponent(activeSlot.id)}` +
    `&date=${encodeURIComponent(occurrenceDate)}` +
    `&subjectId=${encodeURIComponent(activeSlot.subject_id)}` +
    `&classId=${encodeURIComponent(activeSlot.class_id)}`;

  const routes: Partial<Record<StepName, string>> = {
    "Plan Lesson": exactLessonUrl,

    "Take Attendance":
      `/teacher/attendance?mode=lesson` +
      `&classId=${encodeURIComponent(activeSlot.class_id)}` +
      `&timetableSlotId=${encodeURIComponent(activeSlot.id)}` +
      `&date=${encodeURIComponent(occurrenceDate)}` +
      `&subjectId=${encodeURIComponent(activeSlot.subject_id)}`,

    // Teaching lifecycle mutations and completion remain inside the exact
    // lesson workspace rather than navigating to an unrelated generic page.
    "Teach Lesson": exactLessonUrl,

    "Assign Task":
      `/teacher/homework?classId=${activeSlot.class_id}` +
      `&subjectId=${activeSlot.subject_id}`,

    "Review Submissions":
      `/teacher/homework?classId=${activeSlot.class_id}` +
      `&subjectId=${activeSlot.subject_id}`,

    "Mark Work":
      `/teacher/assessment?classId=${activeSlot.class_id}` +
      `&subjectId=${activeSlot.subject_id}`,

    "Record Progress":
      `/teacher/progress?classId=${activeSlot.class_id}` +
      `&subjectId=${activeSlot.subject_id}`,

    "Prepare Next Lesson": exactLessonUrl,
  };

  // These two steps open an in-page sheet instead of navigating away —
  // capturing evidence or writing a reflection is a quick, focused action,
  // not a page-level task like planning or marking.
  const modalSteps: Partial<Record<StepName, () => void>> = {
    "Collect Evidence": () => setEvidenceSheetOpen(true),
    "Write Reflection": () => setReflectionSheetOpen(true),
  };

  const states = steps.map((step) => ({
    step,
    state: cardStepState(step, activeSlot),
  }));
  const firstCurrentIndex = states.findIndex((item) => item.state === "Current");
  const firstFutureIndex = states.findIndex((item, index) => index > firstCurrentIndex && item.state !== "Done");

  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 12 }}>
      <TeachJourney slot={activeSlot} />

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
          const openModal = modalSteps[step];
          const enabled = Boolean(route || openModal) && state !== "Blocked" && state !== "Not available yet";
          const badge = stateStyle(state);

          return (
            <div
              key={step}
              onClick={() => {
                if (!enabled) return;
                if (openModal) { openModal(); return; }
                if (route) onNavigate(route);
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
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ marginTop: 2, color: "#9ca3af", flexShrink: 0 }}>{stepIcon(step)}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b" }}>{step}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                    {stepHelp(step)}
                  </div>
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

      {evidenceSheetOpen && (
        <EvidenceCaptureSheet
          lessonId={
            activeSlot.teaching_workspace?.lessonPlanId ??
            activeSlot.lesson_plan_id
          }
          classId={activeSlot.class_id}
          teacherId={teacherId ?? ""}
          defaultTitle={activeSlot.subject}
          onClose={() => setEvidenceSheetOpen(false)}
          onSaved={() => onSaved?.()}
        />
      )}

      {reflectionSheetOpen && (
        <ReflectionSheet
          lessonId={
            activeSlot.teaching_workspace?.lessonPlanId ??
            activeSlot.lesson_plan_id
          }
          classId={activeSlot.class_id}
          subjectId={activeSlot.subject_id}
          teacherId={teacherId ?? ""}
          onClose={() => setReflectionSheetOpen(false)}
          onSaved={() => onSaved?.()}
        />
      )}
    </div>
  );
}
