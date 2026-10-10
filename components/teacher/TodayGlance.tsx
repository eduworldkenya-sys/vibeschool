"use client";

import type { PulseSnapshot } from "@/lib/types";

export default function TodayGlance({
  snap,
  onNavigate,
}: {
  snap: PulseSnapshot;
  onNavigate: (href: string) => void;
}) {
  const slots = snap.todaySlots;
  const completed = slots.filter((s) => s.attendance_status === "completed").length;
  const pending = slots.filter((s) => s.attendance_status === "pending").length;
  const upcoming = slots.filter((s) => s.attendance_status === "none").length;
  const toReview = snap.homeworkUngraded.reduce((sum, h) => sum + h.count, 0);
  const summary = [
    { label: "Lessons today", value: slots.length, href: "/teacher/timetable" },
    { label: "Awaiting marking", value: toReview, href: "/teacher/homework" },
    { label: "Attendance to record", value: pending + upcoming, href: "/teacher/attendance" },
  ];
  const attendancePercent = slots.length ? Math.round(completed / slots.length * 100) : null;
  return <section className="studio-glance" aria-label="Today's recorded evidence">{summary.map(item => <button type="button" key={item.label} onClick={() => onNavigate(item.href)}><strong>{item.value}</strong><small>{item.label}</small>{item.label === "Lessons today" && <small>Attendance marked: {completed}</small>}{item.label === "Lessons today" && attendancePercent !== null && <span className="studio-outcome-meter"><progress max={100} value={attendancePercent} aria-label={`${attendancePercent}% of scheduled lessons have attendance marked`} /></span>}</button>)}</section>;
}
