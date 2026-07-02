"use client";

import { PriorityTask } from "@/lib/pulse/rules";

interface NextTeachingActionProps {
  task: PriorityTask | null;
  hasLessons: boolean;
  headline?: string | null;
  onNavigate: (href: string) => void;
}

export default function NextTeachingAction({
  task,
  hasLessons,
  headline,
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
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "#86efac",
          marginBottom: 8,
        }}
      >
        Do this next
      </div>

      <div style={{ fontSize: 20, fontWeight: 950, lineHeight: 1.2, marginBottom: 6 }}>
        {title}
      </div>

      <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.45, marginBottom: 14 }}>
        {detail}
      </div>

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
