"use client";

import type { Slot } from "@/lib/types";
import { nairobiDateStr } from "@/lib/time";

interface ActionItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface TeachingContext {
  classId: string;
  subjectId: string;
}

function Tile({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="studio-tools__tile">
    <span className="vs-teacher-action-tile__icon" aria-hidden="true">{icon}</span>
    <strong>{label}</strong><span className="studio-arrow" aria-hidden="true">↗</span>
  </button>;
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconAttendance() { return <svg {...iconProps}><path d="M20 6L9 17l-5-5" /></svg>; }
function IconPlan() { return <svg {...iconProps}><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M9 3h6v4H9zM8 11h8M8 15h5" /></svg>; }
function IconNotes() { return <svg {...iconProps}><path d="M4 4h12l4 4v12H4z" /><path d="M16 4v5h5M8 13h8M8 17h5" /></svg>; }
function IconHomework() { return <svg {...iconProps}><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M9 3h6v4H9zM8 12h8" /></svg>; }
function IconFolder() { return <svg {...iconProps}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" /></svg>; }
function IconProgress() { return <svg {...iconProps}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>; }
function IconMarking() { return <svg {...iconProps}><path d="M5 4h14v16H5z" /><path d="M8 12l2 2 5-5" /></svg>; }
function IconTimetable() { return <svg {...iconProps}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>; }

function exactLessonUrl(slot: Slot): string {
  const occurrenceDate = slot.teaching_workspace?.key.occurrenceDate ?? nairobiDateStr();
  return `/teacher/lessonplan?timetableSlotId=${encodeURIComponent(slot.id)}&date=${encodeURIComponent(occurrenceDate)}&subjectId=${encodeURIComponent(slot.subject_id)}&classId=${encodeURIComponent(slot.class_id)}`;
}

function contextualLessonUrl(context?: TeachingContext): string {
  if (!context?.classId || !context.subjectId) return "/teacher/lessonplan";
  return `/teacher/lessonplan?classId=${encodeURIComponent(context.classId)}&subjectId=${encodeURIComponent(context.subjectId)}`;
}

function actionsFor(slot?: Slot, context?: TeachingContext): ActionItem[] {
  if (!slot) {
    return [
      { label: "Timetable", href: "/teacher/timetable", icon: <IconTimetable /> },
      { label: "New lesson", href: contextualLessonUrl(context), icon: <IconPlan /> },
      { label: "Resources", href: "/teacher/resources", icon: <IconFolder /> },
      { label: "Class Results", href: "/teacher/assessment/gradebook", icon: <IconMarking /> },
    ];
  }

  const lessonUrl = exactLessonUrl(slot);
  const lessonPlanId = slot.teaching_workspace?.lessonPlanId ?? slot.lesson_plan_id;
  const occurrenceId = slot.teaching_workspace?.occurrenceId ?? "";
  const notesUrl = lessonPlanId
    ? `/teacher/lesson-notes?lessonPlanId=${encodeURIComponent(lessonPlanId)}&occurrenceId=${encodeURIComponent(occurrenceId)}&classId=${encodeURIComponent(slot.class_id)}&subjectId=${encodeURIComponent(slot.subject_id)}`
    : lessonUrl;
  const homeworkUrl = `/teacher/classhub/${encodeURIComponent(slot.class_id)}/homework?lessonPlanId=${encodeURIComponent(lessonPlanId ?? "")}&occurrenceId=${encodeURIComponent(occurrenceId)}&subjectId=${encodeURIComponent(slot.subject_id)}&subject=${encodeURIComponent(slot.subject)}`;
  const progressUrl = `/teacher/progress?planId=${encodeURIComponent(lessonPlanId ?? "")}&occurrenceId=${encodeURIComponent(occurrenceId)}&classId=${encodeURIComponent(slot.class_id)}&subjectId=${encodeURIComponent(slot.subject_id)}`;

  if (!lessonPlanId) {
    return [
      { label: "Plan lesson", href: lessonUrl, icon: <IconPlan /> },
      { label: "Prepare notes", href: notesUrl, icon: <IconNotes /> },
      { label: "Resources", href: "/teacher/resources", icon: <IconFolder /> },
      { label: "Timetable", href: "/teacher/timetable", icon: <IconTimetable /> },
    ];
  }

  if (slot.attendance_status !== "completed") {
    return [
      { label: "Lesson notes", href: notesUrl, icon: <IconNotes /> },
      {
        label: "Attendance",
        href: `/teacher/attendance?mode=lesson&classId=${encodeURIComponent(slot.class_id)}&timetableSlotId=${encodeURIComponent(slot.id)}&date=${encodeURIComponent(slot.teaching_workspace?.key.occurrenceDate ?? nairobiDateStr())}&subjectId=${encodeURIComponent(slot.subject_id)}`,
        icon: <IconAttendance />,
      },
      { label: "Homework", href: homeworkUrl, icon: <IconHomework /> },
      { label: "Resources", href: "/teacher/resources", icon: <IconFolder /> },
    ];
  }

  return [
    { label: "Progress", href: progressUrl, icon: <IconProgress /> },
    { label: "Homework", href: homeworkUrl, icon: <IconHomework /> },
    {
      label: "Mark homework",
      href: `/teacher/classhub/${encodeURIComponent(slot.class_id)}/homework`,
      icon: <IconMarking />,
    },
    { label: "Resources", href: "/teacher/resources", icon: <IconFolder /> },
  ];
}

export default function QuickActions({
  slot,
  context,
  onNavigate,
}: {
  slot?: Slot;
  context?: TeachingContext;
  onNavigate: (href: string) => void;
}) {
  const actions = actionsFor(slot, context);

  return <section className="studio-tools" aria-labelledby="teacher-quick-tools-title">
    <h2 id="teacher-quick-tools-title">Quick tools</h2>
    <div className="studio-tools__grid">{actions.map(action => <Tile key={action.label} label={action.label} icon={action.icon} onClick={() => onNavigate(action.href)}/>)}</div>
  </section>;
}
