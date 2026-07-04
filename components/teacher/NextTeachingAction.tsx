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

function parseTimeToday(time: string): Date | null {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const d = new Date();
  d.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return d;
}

function useCountdown(target: Date | null): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [target]);

  if (!target) return null;
  const diffMs = target.getTime() - now;
  if (diffMs <= 0 || diffMs > 12 * 3600000) return null;

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function NextTeachingAction({
  task,
  hasLessons,
  headline,
  snap,
  onNavigate,
}: NextTeachingActionProps) {
  const title =
    task?.label ??
    headline ??
    (hasLessons ? "Continue today’s lesson" : "Continue your teaching workflow");

  const detail =
    task?.detail ??
    (hasLessons
      ? "Open today’s flow and complete the next step."
      : "No lesson is scheduled now. Prepare, review, or mark work.");

  const href = task?.href ?? (hasLessons ? "/teacher/teach-today" : "/teacher/scheme");

  const lastActivity = snap?.recentActivity[0] ?? null;

  const nextUpcoming = useMemo(() => {
    if (!snap) return null;

    const upcoming = snap.todaySlots
      .filter((slot) => slot.attendance_status === "none")
      .map((slot) => ({ slot, time: parseTimeToday(slot.start_time) }))
      .filter((entry): entry is { slot: Slot; time: Date } => Boolean(entry.time))
      .filter((entry) => entry.time.getTime() > Date.now())
      .sort((a, b) => a.time.getTime() - b.time.getTime());

    return upcoming[0] ?? null;
  }, [snap]);

  const countdown = useCountdown(nextUpcoming?.time ?? null);

  return (
    <div
      style={{
        background: "linear-gradient(135deg,#0f172a,#1e1b4b,#064e3b)",
        borderRadius: 24,
        padding: 18,
        marginBottom: 14,
        color: "#fff",
        boxShadow: "0 8px 28px rgba(15,23,42,0.18)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: "#86efac",
          }}
        >
          Do this next
        </div>

        {countdown && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "#fff",
              background: "rgba(255,255,255,0.16)",
              borderRadius: 999,
              padding: "4px 10px",
              whiteSpace: "nowrap",
            }}
          >
            Starting in {countdown}
          </div>
        )}
      </div>

      <div style={{ fontSize: 20, fontWeight: 950, lineHeight: 1.2, marginBottom: 6 }}>
        {title}
      </div>

      <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.45, marginBottom: 14 }}>
        {detail}
      </div>

      {lastActivity && (
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.14)",
          paddingTop: 10,
          marginBottom: 12,
          fontSize: 11,
          color: "#cbd5e1",
          lineHeight: 1.4,
        }}>
          Last done: <span style={{ color: "#fff", fontWeight: 800 }}>{lastActivity.title}</span>
          {lastActivity.subtitle ? ` · ${lastActivity.subtitle}` : ""}
        </div>
      )}

      <button
        onClick={() => onNavigate(href)}
        style={{
          width: "100%",
          border: "none",
          borderRadius: 16,
          padding: "13px 14px",
          background: "#10b981",
          color: "#fff",
          fontSize: 14,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        Start →
      </button>
    </div>
  );
}
