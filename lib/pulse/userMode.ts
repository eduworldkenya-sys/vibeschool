import type { PulseSnapshot } from "@/lib/types";

export type TeacherMode = "new" | "daily" | "returning";

export interface TeacherModeResult {
  mode: TeacherMode;
  headline: string;
  explanation: string;
}

function hasStartedTeaching(snapshot: PulseSnapshot): boolean {
  return (
    snapshot.todaySlots.some((slot) => slot.lesson_plan_id !== null) ||
    snapshot.recentActivity.length > 0 ||
    snapshot.currStats.some((stat) => stat.lessonCount > 0)
  );
}

function hasRecentWork(snapshot: PulseSnapshot): boolean {
  return (
    snapshot.todaySlots.length > 0 ||
    snapshot.homeworkUngraded.length > 0 ||
    snapshot.attPending.length > 0 ||
    snapshot.missedLessonPlans.length > 0
  );
}

export function detectTeacherMode(snapshot: PulseSnapshot): TeacherModeResult {
  if (!hasStartedTeaching(snapshot)) {
    return {
      mode: "new",
      headline: "Start your first teaching flow",
      explanation: "Create a lesson plan first. After that, Vibeschool will guide the next step.",
    };
  }

  if (!hasRecentWork(snapshot)) {
    return {
      mode: "returning",
      headline: "Welcome back",
      explanation: "No active lesson is scheduled now. Continue from scheme, homework, or tomorrow’s lesson.",
    };
  }

  return {
    mode: "daily",
    headline: "Continue today’s teaching",
    explanation: "Follow the next action and Vibeschool will unlock the next step.",
  };
}
