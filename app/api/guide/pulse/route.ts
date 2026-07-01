import { NextResponse } from "next/server";

interface GuideRequest {
  snapshot?: {
    todaySlots?: Array<{
      lesson_plan_id: string | null;
      attendance_status: "none" | "pending" | "completed";
      task_status: "none" | "assigned" | "completed";
      submission_count: number;
      marking_status: "none" | "pending" | "completed";
      class_name: string;
      subject: string;
    }>;
  };
  signals?: string[];
}

function guideMessage(body: GuideRequest): string {
  const slots = body.snapshot?.todaySlots ?? [];
  const signals = body.signals ?? [];

  const missingPlan = slots.find((slot) => !slot.lesson_plan_id);
  if (missingPlan) {
    return `Plan ${missingPlan.subject} for ${missingPlan.class_name} before the lesson starts.`;
  }

  const attendancePending = slots.find((slot) => slot.attendance_status !== "completed");
  if (attendancePending || signals.includes("attendance_pending")) {
    return "Take attendance before continuing with today’s lesson.";
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

    return NextResponse.json({
      message: guideMessage(body),
    });
  } catch {
    return NextResponse.json(
      { message: "Today’s teaching flow is clear." },
      { status: 200 }
    );
  }
}