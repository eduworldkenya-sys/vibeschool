"use client";

import type { Slot } from "@/lib/types";
import { nairobiDateStr } from "@/lib/time";

interface ActionItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

function Tile({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ minWidth: 0, minHeight: 76, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff", color: "#374151", fontFamily: "inherit", padding: "9px 6px" }}
    >
      <span style={{ width: 32, height: 32, borderRadius: 10, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669" }}>
        {icon}
      </span>
      <span style={{ fontSize: 11, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{label}</span>
    </button>
  );
}

const iconProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconAttendance() { return <svg {...iconProps}><path d="M20 6L9 17l-5-5" /></svg>; }
function IconPlan() { return <svg {...iconProps}><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M9 3h6v4H9zM8 11h8M8 15h5" /></svg>; }
function IconNotes() { return <svg {...iconProps}><path d="M4 4h12l4 4v12H4z" /><path d="M16 4v5h5M8 13h8M8 17h5" /></svg>; }
function IconHomework() { return <svg {...iconProps}><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M9 3h6v4H9zM8 12h8" /></svg>; }
function IconFolder() { return <svg {...iconProps}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" /></svg>; }
function IconProgress() { return <svg {...iconProps}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>; }
function IconMarking() { return <svg {...iconProps}><path d="M5 4h14v16H5z"/><path d="M8 12l2 2 5-5"/></svg>; }
function IconTimetable() { return <svg {...iconProps}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>; }

function exactLessonUrl(slot: Slot): string {
  const occurrenceDate = slot.teaching_workspace?.key.occurrenceDate ?? nairobiDateStr();
  return `/teacher/lessonplan?timetableSlotId=${encodeURIComponent(slot.id)}&date=${encodeURIComponent(occurrenceDate)}&subjectId=${encodeURIComponent(slot.subject_id)}&classId=${encodeURIComponent(slot.class_id)}`;
}

function actionsFor(slot?: Slot): ActionItem[] {
  if (!slot) {
    return [
      { label: "Timetable", href: "/teacher/timetable", icon: <IconTimetable /> },
      { label: "New lesson", href: "/teacher/lessonplan", icon: <IconPlan /> },
      { label: "Resources", href: "/teacher/resources", icon: <IconFolder /> },
      { label: "Gradebook", href: "/teacher/assessment/gradebook", icon: <IconMarking /> },
    ];
  }

  const lessonUrl = exactLessonUrl(slot);
  const lessonPlanId = slot.teaching_workspace?.lessonPlanId ?? slot.lesson_plan_id;
  const occurrenceId = slot.teaching_workspace?.occurrenceId ?? "";
  const notesUrl = lessonPlanId
    ? `/teacher/lesson-notes?lessonPlanId=${encodeURIComponent(lessonPlanId)}`
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
      { label: "Attendance", href: `/teacher/attendance?mode=lesson&classId=${encodeURIComponent(slot.class_id)}&timetableSlotId=${encodeURIComponent(slot.id)}&date=${encodeURIComponent(slot.teaching_workspace?.key.occurrenceDate ?? nairobiDateStr())}&subjectId=${encodeURIComponent(slot.subject_id)}`, icon: <IconAttendance /> },
      { label: "Homework", href: homeworkUrl, icon: <IconHomework /> },
      { label: "Resources", href: "/teacher/resources", icon: <IconFolder /> },
    ];
  }

  return [
    { label: "Progress", href: progressUrl, icon: <IconProgress /> },
    { label: "Homework", href: homeworkUrl, icon: <IconHomework /> },
    { label: "Marking", href: `/teacher/classhub/${encodeURIComponent(slot.class_id)}/homework`, icon: <IconMarking /> },
    { label: "Resources", href: "/teacher/resources", icon: <IconFolder /> },
  ];
}

export default function QuickActions({
  slot,
  onNavigate,
}: {
  slot?: Slot;
  onNavigate: (href: string) => void;
}) {
  const actions = actionsFor(slot);

  return (
    <section style={{ background: "#fff", borderRadius: 18, padding: 12, marginBottom: 12, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }} aria-labelledby="teacher-quick-tools-title">
      <div id="teacher-quick-tools-title" style={{ fontSize: 10, fontWeight: 900, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", margin: "2px 2px 10px" }}>
        Quick tools
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
        {actions.map((action) => (
          <Tile key={action.label} label={action.label} icon={action.icon} onClick={() => onNavigate(action.href)} />
        ))}
      </div>
    </section>
  );
}
