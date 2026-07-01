import { PulseSnapshot } from "@/lib/pulse/fetcher";

export type FlowStatus = "done" | "pending" | "missing" | "comingSoon";

export interface FlowStep {
  key: string;
  label: string;
  status: FlowStatus;
  detail: string;
  href: string | null;
}

function timeStr(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function buildLessonFlow(slot: any, snap: PulseSnapshot): FlowStep[] {
  const plan = snap.todayLessonPlans.find(
    p => p.class_id === slot.class_id && p.subject_id === slot.subject_id
  );
  const lessonId = plan?.id ?? null;

  const attDone = !snap.attPending.some(c => c.class_id === slot.class_id);
  const evidenceCount = lessonId ? (snap.lessonEvidenceCounts[lessonId] ?? 0) : 0;
  const reflectionDone = lessonId ? !!snap.lessonReflectionDone[lessonId] : false;
  const interventionCount = lessonId ? (snap.lessonInterventionCounts[lessonId] ?? 0) : 0;

  const hwForClass = snap.homeworkDue.filter(h => h.class_id === slot.class_id);
  const ungradedForClass = snap.homeworkUngraded.filter(h => h.class_id === slot.class_id);
  const ungradedCount = ungradedForClass.reduce((a, h) => a + h.count, 0);

  const nextSameSubject = snap.tomorrowSlots.find(s => s.subject_id === slot.subject_id);

  return [
    {
      key: "class", label: "Today's Class", status: "done",
      detail: slot.class_name, href: `/teacher/classhub/${slot.class_id}`,
    },
    {
      key: "subject", label: "Today's Subject", status: "done",
      detail: slot.subject, href: null,
    },
    {
      key: "lesson", label: "Today's Lesson",
      status: plan ? "done" : "missing",
      detail: plan?.topic || (plan ? "Plan filed — no topic set" : "No lesson plan filed"),
      href: `/teacher/lessonplan?subjectId=${slot.subject_id}&classId=${slot.class_id}`,
    },
    {
      key: "outcome", label: "Learning Outcome",
      status: plan?.objectives ? "done" : "missing",
      detail: plan?.objectives || "Not set",
      href: `/teacher/lessonplan?subjectId=${slot.subject_id}&classId=${slot.class_id}`,
    },
    {
      key: "resources", label: "Teaching Resources", status: "pending",
      detail: "View subject resources",
      href: `/teacher/resources?subjectId=${slot.subject_id}`,
    },
    {
      key: "attendance", label: "Attendance",
      status: attDone ? "done" : "pending",
      detail: attDone ? "Marked" : "Not marked yet",
      href: `/teacher/attendance?classId=${slot.class_id}`,
    },
    {
      key: "evidence", label: "Learning Evidence",
      status: evidenceCount > 0 ? "done" : "comingSoon",
      detail: evidenceCount > 0
        ? `${evidenceCount} item${evidenceCount !== 1 ? "s" : ""} logged`
        : "Coming soon — capture in progress",
      href: null,
    },
    {
      key: "homework", label: "Homework / Exercise / Project",
      status: hwForClass.length > 0 ? "pending" : "done",
      detail: hwForClass.length > 0 ? `${hwForClass.length} due this week` : "None due",
      href: `/teacher/classhub/${slot.class_id}/homework`,
    },
    {
      key: "marking", label: "Marking",
      status: ungradedCount > 0 ? "pending" : "done",
      detail: ungradedCount > 0 ? `${ungradedCount} to grade` : "All caught up",
      href: ungradedForClass[0]
        ? `/teacher/classhub/${slot.class_id}/homework/${ungradedForClass[0].homework_id}`
        : `/teacher/classhub/${slot.class_id}/homework`,
    },
    {
      key: "intervention", label: "Intervention",
      status: interventionCount > 0 ? "done" : "comingSoon",
      detail: interventionCount > 0
        ? `${interventionCount} flagged`
        : "Coming soon — flagging in progress",
      href: null,
    },
    {
      key: "reflection", label: "Reflection",
      status: reflectionDone ? "done" : "comingSoon",
      detail: reflectionDone ? "Logged" : "Coming soon — reflection entry in progress",
      href: null,
    },
    {
      key: "next", label: "Next Lesson",
      status: "done",
      detail: nextSameSubject
        ? `Tomorrow · ${timeStr(nextSameSubject.start_time)}`
        : "Check timetable",
      href: "/teacher/pulse",
    },
  ];
}
