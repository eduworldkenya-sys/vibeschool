"use client";

import type { PulseSnapshot } from "@/lib/types";

function StatPill({ label, value, onClick }: { label: string; value: string | number; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        minWidth: 0,
        minHeight: 58,
        border: "1px solid #e5e7eb",
        background: "#fff",
        borderRadius: 14,
        padding: "9px 8px",
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        fontFamily: "inherit",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 900, color: "#111827", lineHeight: 1.1 }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 10, fontWeight: 800, color: "#6b7280", letterSpacing: 0.25, textTransform: "uppercase" }}>
        {label}
      </div>
    </button>
  );
}

function headlineFor(snap: PulseSnapshot, focusSlot?: PulseSnapshot["todaySlots"][number]): { tag: string; title: string } {
  if (focusSlot) {
    if (focusSlot.attendance_status === "completed") return { tag: "Lesson taught", title: `${focusSlot.class_name} · ${focusSlot.subject}` };
    return { tag: "Today's lesson", title: `${focusSlot.class_name} · ${focusSlot.subject}` };
  }
  const total = snap.todaySlots.length;
  if (total === 0) return { tag: "Today", title: "No lessons scheduled" };
  const markedCount = snap.todaySlots.filter((s) => s.attendance_status === "completed").length;
  if (markedCount === total) return { tag: "Day complete", title: "All lessons taught today" };
  return { tag: "Today's lessons", title: `${total - markedCount} of ${total} lessons remaining` };
}

export default function TodayHero({ snap, focusSlot, focusRoster, onOpenTimetable, onOpenStudents, onOpenAttendance }: {
  snap: PulseSnapshot;
  focusSlot?: PulseSnapshot["todaySlots"][number];
  focusRoster?: PulseSnapshot["myClasses"][number];
  onOpenTimetable?: () => void;
  onOpenStudents?: () => void;
  onOpenAttendance?: () => void;
}) {
  const { tag, title } = headlineFor(snap, focusSlot);
  const markedCount = snap.todaySlots.filter((s) => s.attendance_status === "completed").length;
  const lessonsValue = focusSlot ? 1 : snap.todaySlots.length;
  const studentsValue = focusSlot && focusRoster ? focusRoster.studentCount : snap.totalStudentsToday;
  const attendanceValue = focusSlot
    ? focusSlot.attendance_status === "completed" ? "Marked" : "Not marked"
    : snap.todaySlots.length > 0 ? `${markedCount}/${snap.todaySlots.length}` : "—";
  const pendingValue = focusSlot ? (snap.attPending.some((p) => p.class_id === focusSlot.class_id) ? 1 : 0) : snap.attPending.length;

  return (
    <section style={{ borderRadius: 20, padding: 16, marginBottom: 14, background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 2px 12px rgba(15,23,42,0.05)" }}>
      <div style={{ fontSize: 10, fontWeight: 900, color: "#047857", letterSpacing: 0.8, textTransform: "uppercase" }}>{tag}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#111827", marginTop: 5, lineHeight: 1.2 }}>{title}</div>
      {focusSlot && <div style={{ marginTop: 5, fontSize: 12, color: "#6b7280" }}>{focusSlot.start_time}–{focusSlot.end_time}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginTop: 14 }}>
        <StatPill label="Lessons" value={lessonsValue} onClick={onOpenTimetable} />
        <StatPill label="Students" value={studentsValue} onClick={onOpenStudents} />
        <StatPill label="Attendance" value={attendanceValue} onClick={onOpenAttendance} />
        <StatPill label="Pending" value={pendingValue} onClick={onOpenAttendance} />
      </div>

      {focusSlot && studentsValue === 0 && (
        <div role="status" style={{ marginTop: 10, padding: "9px 10px", borderRadius: 10, background: "#fffbeb", color: "#92400e", fontSize: 12, lineHeight: 1.4 }}>
          No enrolled learners are showing for this class. Check the class roster before teaching.
        </div>
      )}
    </section>
  );
}
