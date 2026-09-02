"use client";

import { useEffect, useMemo, useState } from "react";
import type { PriorityTask, PulseSnapshot, Slot } from "@/lib/types";

interface NextTeachingActionProps { task: PriorityTask | null; hasLessons: boolean; headline?: string | null; snap?: PulseSnapshot; onNavigate: (href: string) => void }

function parseTimeToday(time: string): Date | null {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const d = new Date(); d.setHours(Number(match[1]), Number(match[2]), 0, 0); return d;
}

function useCountdown(target: Date | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!target) return; const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, [target]);
  if (!target) return null;
  const diffMs = target.getTime() - now;
  if (diffMs <= 0 || diffMs > 12 * 3600000) return null;
  const totalMinutes = Math.floor(diffMs / 60000); const hours = Math.floor(totalMinutes / 60); const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function NextTeachingAction({ task, hasLessons, headline, snap, onNavigate }: NextTeachingActionProps) {
  const title = task?.label ?? headline ?? (hasLessons ? "Continue today's lesson" : "Continue your teaching workflow");
  const detail = task?.detail ?? (hasLessons ? "Complete the next required step for this lesson." : "No lesson is scheduled now. Prepare, review, or mark work.");
  const href = task?.href ?? (hasLessons ? "/teacher/teach-today" : "/teacher/scheme");

  const nextUpcoming = useMemo(() => {
    if (!snap) return null;
    return snap.todaySlots.filter((slot) => slot.attendance_status === "none")
      .map((slot) => ({ slot, time: parseTimeToday(slot.start_time) }))
      .filter((entry): entry is { slot: Slot; time: Date } => Boolean(entry.time))
      .filter((entry) => entry.time.getTime() > Date.now())
      .sort((a, b) => a.time.getTime() - b.time.getTime())[0] ?? null;
  }, [snap]);

  const countdown = useCountdown(nextUpcoming?.time ?? null);

  return (
    <section style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 20, padding: 16, marginBottom: 14, color: "#111827", boxShadow: "0 2px 12px rgba(15,23,42,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 7 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#047857" }}>Next step</div>
        {countdown && <div style={{ fontSize: 10, fontWeight: 800, color: "#047857", background: "#fff", border: "1px solid #d1fae5", borderRadius: 999, padding: "4px 9px", whiteSpace: "nowrap" }}>In {countdown}</div>}
      </div>
      <div style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.2, marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.45, marginBottom: 13 }}>{detail}</div>
      <button onClick={() => onNavigate(href)} style={{ width: "100%", minHeight: 46, border: "none", borderRadius: 13, padding: "12px 14px", background: "#10b981", color: "#fff", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>
        {task?.label ? `${task.label} →` : "Continue →"}
      </button>
    </section>
  );
}
