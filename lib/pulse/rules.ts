import type { PulseSnapshot, Slot, TaskSeverity, PriorityTask, RuleResult } from "@/lib/types";
import { detectTeacherMode } from "./userMode";
import { nairobiDateAdd, nairobiDateStr } from "@/lib/time";

function byStartTime(a: Slot, b: Slot): number {
  return a.start_time.localeCompare(b.start_time);
}

function firstCurrentSlot(slots: Slot[]): Slot | null {
  const sorted = [...slots].sort(byStartTime);
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const currentMins = Number(parts.find(p => p.type === 'hour')?.value) * 60 + Number(parts.find(p => p.type === 'minute')?.value);

  return (
    sorted.find((slot) => {
      const [startHour, startMin] = slot.start_time.split(":").map(Number);
      const [endHour, endMin] = slot.end_time.split(":").map(Number);
      return currentMins >= startHour * 60 + startMin && currentMins <= endHour * 60 + endMin;
    }) ??
    sorted.find((slot) => {
      const [startHour, startMin] = slot.start_time.split(":").map(Number);
      return startHour * 60 + startMin >= currentMins;
    }) ??
    sorted[0] ??
    null
  );
}

function exactLessonHref(slot: Slot, fallbackDate = nairobiDateStr()): string {
  const query = new URLSearchParams({ classId: slot.class_id, subjectId: slot.subject_id, timetableSlotId: slot.id, date: slot.teaching_workspace?.key.occurrenceDate ?? fallbackDate });
  return `/teacher/lessonplan?${query}`;
}

function nextTaskForSlot(slot: Slot): PriorityTask | null {
  const workspace = slot.teaching_workspace;
  if (workspace) {
    const action = workspace.primaryAction;
    if (action === 'none') return null;
    const labels = { prepare_lesson: 'Plan lesson', start_lesson: 'Start teaching', continue_lesson: 'Continue teaching', review_lesson: 'Review lesson', record_progress: 'Record learner progress', recover_lesson: 'Recover lesson' };
    return { id: `lesson-${slot.id}`, label: labels[action], detail: `${slot.subject} · ${slot.class_name}`, severity: action === 'start_lesson' || action === 'continue_lesson' ? 'critical' : 'calm', href: exactLessonHref(slot) };
  }
  if (!slot.lesson_plan_id) {
    return {
      id: `plan-${slot.id}`,
      label: "Plan lesson",
      detail: `${slot.subject} for ${slot.class_name} needs a lesson plan.`,
      severity: "urgent",
      href: exactLessonHref(slot),
    };
  }

  if (slot.attendance_status !== "completed") {
    return {
      id: `attendance-${slot.id}`,
      label: "Take attendance before teaching",
      detail: `${slot.class_name} is not marked yet.`,
      severity: "critical",
      href:
        `/teacher/attendance?mode=lesson` +
        `&classId=${encodeURIComponent(slot.class_id)}` +
        `&timetableSlotId=${encodeURIComponent(slot.id)}` +
        `&date=${encodeURIComponent(nairobiDateStr())}`,
    };
  }

  // A saved plan and completed attendance do not mean the lesson was taught.
  // Without occurrence authority, open the lesson rather than promoting homework.
  if (slot.task_status === 'none') {
    return { id: `teach-${slot.id}`, label: 'Open lesson', detail: `${slot.subject} · ${slot.class_name}`, severity: 'calm', href: exactLessonHref(slot) };
  }

  if (slot.submission_count > 0 && slot.marking_status === "pending") {
    return {
      id: `mark-${slot.id}`,
      label: `Mark ${slot.submission_count} submission${slot.submission_count === 1 ? "" : "s"}`,
      detail: `${slot.class_name} has learner work waiting for marking.`,
      severity: "critical",
      href: `/teacher/classhub/${encodeURIComponent(slot.class_id)}/homework`,
    };
  }

  return null;
}

function noLessonTasks(snap: PulseSnapshot): PriorityTask[] {
  const tasks: PriorityTask[] = [];

  if (snap.currStats.length > 0) {
    const weakest = [...snap.currStats].sort((a, b) => {
      const ap = a.total > 0 ? a.covered / a.total : 1;
      const bp = b.total > 0 ? b.covered / b.total : 1;
      return ap - bp;
    })[0];

    if (weakest) {
      tasks.push({
        id: `scheme-${weakest.classId}-${weakest.subjectId}`,
        label: "Continue scheme of work",
        detail: `${weakest.subject} needs the next teaching step.`,
        severity: "urgent",
        href: `/teacher/lessonplan?subjectId=${weakest.subjectId}&classId=${weakest.classId}`,
      });
    }
  }

  if (snap.homeworkUngraded.length > 0) {
    const first = snap.homeworkUngraded[0];
    tasks.push({
      id: `mark-homework-${first.homework_id}`,
      label: `Mark ${first.count} homework submission${first.count === 1 ? "" : "s"}`,
      detail: first.title,
      severity: "urgent",
      href: `/teacher/classhub/${encodeURIComponent(first.class_id)}/homework/${encodeURIComponent(first.homework_id)}`,
    });
  }

  if (snap.tomorrowSlots.length > 0) {
    const first = snap.tomorrowSlots[0];
    tasks.push({
      id: `prepare-${first.id}`,
      label: "Prepare tomorrow’s lesson",
      detail: `${first.subject} for ${first.class_name}.`,
      severity: "calm",
      href: exactLessonHref(first, nairobiDateAdd(nairobiDateStr(), 1)),
    });
  }

  tasks.push(
    {
      id: "open-scheme",
      label: "Review scheme",
      detail: "Check what should be taught next.",
      severity: "calm",
      href: "/teacher/scheme",
    },
    {
      id: "open-homework",
      label: "Review homework",
      detail: "Check learner tasks and pending work.",
      severity: "calm",
      href: "/teacher/homework",
    }
  );

  return tasks.slice(0, 5);
}

function computeConfidence(snap: PulseSnapshot, isFallback: boolean, taskCount: number): number {
  let score = 100;
  if (isFallback) score -= 40;
  if ((snap.atRisk?.length ?? 0) > 0) score -= 20;
  if ((snap.streak ?? 0) >= 5) score -= 15;
  if (taskCount === 0) score -= 20;
  return Math.max(0, Math.min(100, score));
}

export function runRules(snap: PulseSnapshot): RuleResult {
  const signals: string[] = [];
  const tasks: PriorityTask[] = [];
  const mode = detectTeacherMode(snap);
  const activeSlot = firstCurrentSlot(snap.todaySlots);

  if (!activeSlot) {
    const fallbackTasks = noLessonTasks(snap);

    return {
      message: fallbackTasks[0]?.detail ?? mode.explanation,
      priority: fallbackTasks[0]?.severity ?? "calm",
      upcomingWarning: mode.headline,
      confidence: computeConfidence(snap, true, fallbackTasks.length),
      signals: ["no_current_lesson", "continue_workflow", `teacher_${mode.mode}`],
      tasks: fallbackTasks,
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
    if (!tasks.some((existing) => existing.id === task.id)) tasks.push(task);
    if (tasks.length >= 5) break;
  }

  for (const homework of snap.homeworkUngraded.slice(0, 3)) {
    tasks.push({
      id: `homework-mark-${homework.homework_id}`,
      label: `Mark ${homework.count} homework submission${homework.count === 1 ? "" : "s"}`,
      detail: `${homework.title}${homework.subject ? ` · ${homework.subject}` : ""}`,
      severity: "urgent",
      href: `/teacher/classhub/${encodeURIComponent(homework.class_id)}/homework/${encodeURIComponent(homework.homework_id)}`,
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
  }

  const firstTask = tasks[0];

  return {
    message: firstTask?.detail ?? mode.explanation,
    priority: firstTask?.severity ?? "calm",
    upcomingWarning: null,
    confidence: computeConfidence(snap, false, tasks.length),
    signals,
    tasks: tasks.slice(0, 6),
  };
}
