"use client";

import { useEffect, useMemo, useState } from "react";
import type { PriorityTask, PulseSnapshot, Slot } from "@/lib/types";

interface NextTeachingActionProps {
  task: PriorityTask | null;
  hasLessons: boolean;
  headline?: string | null;
  snap?: PulseSnapshot;
  onNavigate: (href: string) => void;
}

interface UpcomingLesson {
  slot: Slot;
  time: Date;
}

function parseTimeToday(time: string): Date | null {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

function useCountdown(target: Date | null): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;

    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [target]);

  if (!target) return null;

  const diffMs = target.getTime() - now;
  if (diffMs <= 0 || diffMs > 12 * 60 * 60 * 1000) return null;

  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function nextUpcomingLesson(snap?: PulseSnapshot): UpcomingLesson | null {
  if (!snap) return null;

  return snap.todaySlots
    .filter((slot) => slot.attendance_status === "none")
    .map((slot) => ({ slot, time: parseTimeToday(slot.start_time) }))
    .filter((entry): entry is UpcomingLesson => Boolean(entry.time))
    .filter((entry) => entry.time.getTime() > Date.now())
    .sort((a, b) => a.time.getTime() - b.time.getTime())[0] ?? null;
}

export default function NextTeachingAction({
  task,
  hasLessons,
  headline,
  snap,
  onNavigate,
}: NextTeachingActionProps) {
  const title = task?.label
    ?? headline
    ?? (hasLessons ? "Continue today's lesson" : "Continue your teaching workflow");
  const detail = task?.detail
    ?? (hasLessons
      ? "Complete the next required step for this lesson."
      : "No lesson is scheduled now. Prepare, review, or mark work.");
  const href = task?.href ?? (hasLessons ? "/teacher/teach-today" : "/teacher/scheme");

  const upcoming = useMemo(() => nextUpcomingLesson(snap), [snap]);
  const countdown = useCountdown(upcoming?.time ?? null);

  return (
    <section
      aria-labelledby="teacher-next-action-title"
      style={{
        background: "#ecfdf5",
        border: "1px solid #a7f3d0",
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        color: "#111827",
        boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 7 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#047857" }}>
          Next step
        </div>
        {countdown && (
          <div style={{ fontSize: 10, fontWeight: 800, color: "#047857", background: "#fff", border: "1px solid #d1fae5", borderRadius: 999, padding: "4px 9px", whiteSpace: "nowrap" }}>
            In {countdown}
          </div>
        )}
      </div>

      <h2 id="teacher-next-action-title" style={{ margin: "0 0 5px", fontSize: 19, fontWeight: 900, lineHeight: 1.2 }}>
        {title}
      </h2>
      <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.45, marginBottom: 13 }}>
        {detail}
      </div>

      <button
        type="button"
        onClick={() => onNavigate(href)}
        style={{ width: "100%", minHeight: 46, border: "none", borderRadius: 13, padding: "12px 14px", background: "#10b981", color: "#fff", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}
      >
        {task?.label ? `${task.label} →` : "Continue →"}
      </button>
    </section>
  );
}
