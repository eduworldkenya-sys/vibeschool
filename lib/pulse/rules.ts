import { PulseSnapshot, Slot } from "./fetcher";

export type TaskSeverity = "critical" | "urgent" | "calm";

export interface PriorityTask {
  id: string;
  label: string;
  detail: string;
  severity: TaskSeverity;
  href: string;
}

export interface RuleResult {
  message: string;
  priority: TaskSeverity;
  upcomingWarning: string | null;
  confidence: number;
  signals: string[];
  tasks: PriorityTask[];
}

function byStartTime(a: Slot, b: Slot): number {
  return a.start_time.localeCompare(b.start_time);
}

function firstCurrentSlot(slots: Slot[]): Slot | null {
  const sorted = [...slots].sort(byStartTime);
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  return (
    sorted.find((slot) => {
      const [startHour, startMin] = slot.start_time.split(":").map(Number);
      const [endHour, endMin] = slot.end_time.split(":").map(Number);
      const start = startHour * 60 + startMin;
      const end = endHour * 60 + endMin;

      return currentMins >= start && currentMins <= end;
    }) ??
    sorted.find((slot) => {
      const [startHour, startMin] = slot.start_time.split(":").map(Number);
      return startHour * 60 + startMin >= currentMins;
    }) ??
    sorted[0] ??
    null
  );
}

function nextTaskForSlot(slot: Slot): PriorityTask | null {
  if (!slot.lesson_plan_id) {
    return {
      id: `plan-${slot.id}`,
      label: "Plan lesson",
      detail: `${slot.subject} for ${slot.class_name} needs a lesson plan.`,
      severity: "urgent",
      href: `/teacher/lessonplan?subjectId=${slot.subject_id}&classId=${slot.class_id}`,
    };
  }

  if (slot.attendance_status !== "completed") {
    return {
      id: `attendance-${slot.id}`,
      label: "Take attendance before teaching",
      detail: `${slot.class_name} is not marked yet.`,
      severity: "critical",
      href: `/teacher/attendance?classId=${slot.class_id}`,
    };
  }

  if (slot.task_status === "none") {
    return {
      id: `task-${slot.id}`,
      label: "Assign learner work",
      detail: `Give ${slot.class_name} a task connected to this lesson.`,
      severity: "calm",
      href: `/teacher/homework?classId=${slot.class_id}&subjectId=${slot.subject_id}`,
    };
  }

  if (slot.submission_count > 0 && slot.marking_status === "pending") {
    return {
      id: `mark-${slot.id}`,
      label: `Mark ${slot.submission_count} submission${slot.submission_count === 1 ? "" : "s"}`,
      detail: `${slot.class_name} has learner work waiting for marking.`,
      severity: "critical",
      href: `/teacher/assessment?classId=${slot.class_id}&subjectId=${slot.subject_id}`,
    };
  }

  if (slot.marking_status === "completed" && slot.progress_record_status !== "completed") {
    return {
      id: `progress-${slot.id}`,
      label: "Record progress",
      detail: `Update progress records for ${slot.class_name}.`,
      severity: "calm",
      href: `/teacher/progress?classId=${slot.class_id}&subjectId=${slot.subject_id}`,
    };
  }

  return null;
}

export function runRules(snap: PulseSnapshot): RuleResult {
  const signals: string[] = [];
  const tasks: PriorityTask[] = [];

  const activeSlot = firstCurrentSlot(snap.todaySlots);

  if (!activeSlot) {
    return {
      message: "No lesson is scheduled now. Prepare the next teaching block.",
      priority: "calm",
      upcomingWarning: null,
      confidence: 100,
      signals: ["no_current_lesson"],
      tasks: [],
    };
  }

  const activeTask = nextTaskForSlot(activeSlot);
  if (activeTask) {
    tasks.push(activeTask);
    signals.push(activeTask.id.split("-")[0]);
  }

  for (const slot of [...snap.todaySlots].sort(byStartTime)) {
    if (slot.id === activeSlot.id) continue;

    const task = nextTaskForSlot(slot);
    if (!task) continue;

    if (!tasks.some((existing) => existing.id === task.id)) {
      tasks.push(task);
      signals.push(task.id.split("-")[0]);
    }

    if (tasks.length >= 5) break;
  }

  for (const homework of snap.homeworkUngraded.slice(0, 3)) {
    tasks.push({
      id: `homework-mark-${homework.homework_id}`,
      label: `Mark ${homework.count} homework submission${homework.count === 1 ? "" : "s"}`,
      detail: `${homework.title}${homework.subject ? ` · ${homework.subject}` : ""}`,
      severity: "urgent",
      href: `/teacher/assessment?classId=${homework.class_id}`,
    });
  }

  if (snap.consecutiveAbsences.length > 0) {
    const first = snap.consecutiveAbsences[0];
    tasks.push({
      id: `absence-${first.studentId}`,
      label: "Follow up learner absence",
      detail: `${first.name} has missed ${first.days} school day${first.days === 1 ? "" : "s"} in a row.`,
      severity: "urgent",
      href: "/teacher/students",
    });
    signals.push("absence");
  }

  const firstTask = tasks[0] ?? null;

  let message = "Today’s teaching flow is clear.";
  let priority: TaskSeverity = "calm";

  if (firstTask) {
    message = firstTask.detail;
    priority = firstTask.severity;
  }

  if (snap.missedLessonPlans.length > 0) {
    signals.push("missing_lesson_plan");
  }

  if (snap.attPending.length > 0) {
    signals.push("attendance_pending");
  }

  return {
    message,
    priority,
    upcomingWarning: null,
    confidence: 100,
    signals,
    tasks: tasks.slice(0, 6),
  };
}