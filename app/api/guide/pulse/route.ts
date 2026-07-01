import { NextResponse } from "next/server";

interface GuideSlot {
  lesson_plan_id: string | null;
  attendance_status: "none" | "pending" | "completed";
  task_status: "none" | "assigned" | "completed";
  submission_count: number;
  marking_status: "none" | "pending" | "completed";
  class_name: string;
  subject: string;
}

interface GuideTask {
  label?: string;
  detail?: string;
}

interface GuideSnapshot {
  todaySlots?: GuideSlot[];
  tasks?: GuideTask[];
  homeworkUngraded?: Array<{ title: string; count: number }>;
  tomorrowSlots?: Array<{ subject: string; class_name: string }>;
}

interface GuideRequest {
  snapshot?: GuideSnapshot;
  signals?: string[];
}

function guideMessage(body: GuideRequest): string {
  const slots = body.snapshot?.todaySlots ?? [];
  const homeworkUngraded = body.snapshot?.homeworkUngraded ?? [];
  const tomorrowSlots = body.snapshot?.tomorrowSlots ?? [];

  if (slots.length === 0) {
    if (homeworkUngraded.length > 0) {
      const first = homeworkUngraded[0];
      return `No lesson is scheduled now. Mark ${first.count} homework submission${first.count === 1 ? "" : "s"} for ${first.title}.`;
    }

    if (tomorrowSlots.length > 0) {
      const first = tomorrowSlots[0];
      return `No lesson is scheduled now. Prepare tomorrow’s ${first.subject} lesson for ${first.class_name}.`;
    }

    return "No lesson is scheduled now. Continue your scheme, homework, or next lesson plan.";
  }

  const missingPlan = slots.find((slot) => !slot.lesson_plan_id);
  if (missingPlan) {
    return `Plan ${missingPlan.subject} for ${missingPlan.class_name} before the lesson starts.`;
  }

  const attendancePending = slots.find((slot) => slot.attendance_status !== "completed");
  if (attendancePending) {
    return `Take attendance for ${attendancePending.class_name} before continuing.`;
  }

  const markingPending = slots.find(
    (slot) => slot.submission_count > 0 && slot.marking_status === "pending"
  );

  if (markingPending) {
    return `Mark learner work for ${markingPending.class_name}.`;
  }

  const taskMissing = slots.find((slot) => slot.task_status === "none");
  if (taskMissing) {
    return `Give ${taskMissing.class_name} a task connected to ${taskMissing.subject}.`;
  }

  return "Today’s teaching flow is clear.";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GuideRequest;
    return NextResponse.json({ message: guideMessage(body) });
  } catch {
    return NextResponse.json({ message: "Continue your teaching workflow." }, { status: 200 });
  }
}
