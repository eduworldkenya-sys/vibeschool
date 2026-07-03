"use client";

import type { PulseSnapshot } from "@/lib/types";

function Chip({
  color,
  value,
  label,
  onClick,
}: {
  color: string;
  value: number;
  label: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "10px 4px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
        <span style={{ fontSize: 18, fontWeight: 900, color: "#1e1b4b" }}>{value}</span>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textAlign: "center" }}>
        {label}
      </div>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const size = 64;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#f3f4f6" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#10b981"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 900,
          color: "#1e1b4b",
        }}
      >
        {pct}%
      </div>
    </div>
  );
}

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
  const dayPct = slots.length > 0 ? Math.round((completed / slots.length) * 100) : 0;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        padding: "12px 12px 12px 16px",
        marginBottom: 12,
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", flex: 1 }}>
        <Chip color="#10b981" value={completed} label="Completed" onClick={() => onNavigate("/teacher/pulse")} />
        <Chip color="#f59e0b" value={pending} label="Pending" onClick={() => onNavigate("/teacher/pulse")} />
        <Chip color="#3b82f6" value={toReview} label="To Review" onClick={() => onNavigate("/teacher/homework")} />
        <Chip color="#8b5cf6" value={upcoming} label="Upcoming" onClick={() => onNavigate("/teacher/pulse")} />
      </div>
      <ProgressRing pct={dayPct} />
    </div>
  );
}
