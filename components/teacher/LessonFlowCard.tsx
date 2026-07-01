"use client";
import { useState } from "react";
import { PulseSnapshot } from "@/lib/pulse/fetcher";
import { buildLessonFlow, FlowStatus } from "@/lib/pulse/lessonFlow";

function timeStr(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function statusColor(status: FlowStatus) {
  switch (status) {
    case "done": return { dot: "#10b981", bg: "#f0fdf4", text: "#0d7a5f" };
    case "pending": return { dot: "#f59e0b", bg: "#fffbeb", text: "#b45309" };
    case "missing": return { dot: "#ef4444", bg: "#fef2f2", text: "#b91c1c" };
    case "comingSoon": return { dot: "#d1d5db", bg: "#f9fafb", text: "#9ca3af" };
  }
}

function statusLabel(status: FlowStatus) {
  switch (status) {
    case "done": return "Done";
    case "pending": return "Pending";
    case "missing": return "Missing";
    case "comingSoon": return "Soon";
  }
}

function StepRow({
  step, isLast, onNavigate,
}: {
  step: ReturnType<typeof buildLessonFlow>[number];
  isLast: boolean;
  onNavigate: (href: string) => void;
}) {
  const c = statusColor(step.status);
  const [pressed, setPressed] = useState(false);
  const clickable = !!step.href && step.status !== "comingSoon";
  return (
    <div
      onClick={() => clickable && step.href && onNavigate(step.href)}
      onPointerDown={() => clickable && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "flex", gap: 12, cursor: clickable ? "pointer" : "default",
        opacity: pressed ? 0.7 : 1, transition: "opacity 0.12s ease",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 12 }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
          background: c.dot, marginTop: 3,
        }} />
        {!isLast && <div style={{ width: 2, flex: 1, background: "#e5e7eb", marginTop: 4, minHeight: 22 }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b" }}>{step.label}</div>
          <div style={{
            fontSize: 9, fontWeight: 800, color: c.text, background: c.bg,
            borderRadius: 8, padding: "2px 8px", textTransform: "uppercase",
            letterSpacing: 0.5, flexShrink: 0,
          }}>
            {statusLabel(step.status)}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.4 }}>
          {step.detail}
        </div>
      </div>
    </div>
  );
}

export default function LessonFlowCard({
  slots, snap, onNavigate,
}: {
  slots: any[];
  snap: PulseSnapshot;
  onNavigate: (href: string) => void;
}) {
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const defaultSlot = slots.find((s: any) => {
    const [h, m] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    return h * 60 + m <= nowMins && nowMins < eh * 60 + em;
  }) ?? slots.find((s: any) => {
    const [h, m] = s.start_time.split(":").map(Number);
    return h * 60 + m > nowMins;
  }) ?? slots[0];

  const [openId, setOpenId] = useState<string | null>(defaultSlot?.id ?? null);

  if (slots.length === 0) {
    return (
      <div style={{
        background: "#fff", borderRadius: 20, padding: 16, marginBottom: 12,
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)", textAlign: "center",
        color: "#9ca3af", fontSize: 13,
      }}>
        No lessons scheduled today
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {slots.map((slot: any) => {
        const isOpen = openId === slot.id;
        const [h, m] = slot.start_time.split(":").map(Number);
        const [eh, em] = slot.end_time.split(":").map(Number);
        const isNow = h * 60 + m <= nowMins && nowMins < eh * 60 + em;
        const flow = isOpen ? buildLessonFlow(slot, snap) : null;

        return (
          <div key={slot.id} style={{
            background: "#fff", borderRadius: 20, marginBottom: 10,
            boxShadow: "0 2px 16px rgba(0,0,0,0.06)", overflow: "hidden",
          }}>
            <div
              onClick={() => setOpenId(isOpen ? null : slot.id)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 4, height: 34, borderRadius: 4, flexShrink: 0,
                  background: isNow ? "#10b981" : "#6366f1",
                }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b" }}>
                    {slot.subject} — {slot.class_name}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
                    {timeStr(slot.start_time)} – {timeStr(slot.end_time)}
                    {isNow ? " · Now" : ""}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}>
                ▾
              </div>
            </div>

            {isOpen && flow && (
              <div style={{ padding: "0 16px 16px" }}>
                {flow.map((step, i) => (
                  <StepRow key={step.key} step={step} isLast={i === flow.length - 1} onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
