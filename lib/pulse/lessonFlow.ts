import { PulseSnapshot, Slot, WorkflowState } from "./fetcher";

export interface LessonFlowStep {
  id: string;
  label: string;
  state: WorkflowState;
  slot: Slot;
}

export function buildLessonFlow(snapshot: PulseSnapshot): LessonFlowStep[] {
  return snapshot.todaySlots.flatMap((slot) => [
    {
      id: `plan-${slot.id}`,
      label: "Plan Lesson",
      state: slot.lesson_plan_id ? "Done" : "Current",
      slot,
    },
    {
      id: `attendance-${slot.id}`,
      label: "Take Attendance",
      state: !slot.lesson_plan_id
        ? "Blocked"
        : slot.attendance_status === "completed"
          ? "Done"
          : "Current",
      slot,
    },
    {
      id: `teach-${slot.id}`,
      label: "Teach Lesson",
      state: slot.attendance_status === "completed" ? "Current" : "Blocked",
      slot,
    },
    {
      id: `evidence-${slot.id}`,
      label: "Collect Evidence",
      state: slot.evidence_count > 0 ? "Done" : "Not available yet",
      slot,
    },
    {
      id: `reflect-${slot.id}`,
      label: "Write Reflection",
      state: slot.reflection_status === "completed" ? "Done" : "Not available yet",
      slot,
    },
  ]);
}
