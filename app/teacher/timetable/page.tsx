"use client";
import { useState } from "react";
import { TODAY_SLOTS } from "@/lib/data";
import { Card, SectionLabel, ReadinessChip, Btn } from "@/components/teacher/ui";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default function TimetablePage() {
  const [activeDay, setActiveDay] = useState("Mon");

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)", borderRadius: 20, padding: "20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>SmartTimetable</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Weekly Schedule</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Term 2 · Auto-synced with school timetable.</div>
      </div>

      {/* Day tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {DAYS.map(d => (
          <button key={d} onClick={() => setActiveDay(d)} style={{ padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, flexShrink: 0, background: activeDay === d ? "#10b981" : "#f8f9fa", color: activeDay === d ? "#fff" : "#6b7280" }}>
            {d}
          </button>
        ))}
      </div>

      <Card>
        <SectionLabel>{activeDay === "Mon" ? "Today" : activeDay}</SectionLabel>
        {(activeDay === "Mon" ? TODAY_SLOTS : []).length === 0 ? (
          <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", padding: "24px 0" }}>No lessons scheduled.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {TODAY_SLOTS.map(slot => (
              <div key={slot.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 12, background: "#f8f9fa", border: "1px solid #e5e7eb" }}>
                <div style={{ width: 44, flexShrink: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{slot.start}</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{slot.end}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{slot.subject} · <span style={{ color: "#6b7280" }}>{slot.class}</span></div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{slot.room} · Period {slot.period}</div>
                </div>
                <ReadinessChip status={slot.planStatus} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionLabel>Week Summary</SectionLabel>
        {[
          { label: "Total Lessons",   value: "18" },
          { label: "Classes",         value: "3 (6B, 7A, 8C)" },
          { label: "Free Periods",    value: "4" },
          { label: "Duties",          value: "1 (Gate duty — Wed)" },
        ].map(r => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>{r.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{r.value}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}