"use client";
import { useState } from "react";
import { STUDENTS, TODAY_SLOTS } from "@/lib/data";
import { Card, SectionLabel, Btn } from "@/components/teacher/ui";

const STATUS_COLORS: Record<string, string> = {
  present: "#10b981",
  absent: "#ef4444",
  late: "#f59e0b",
  excused: "#6366f1",
};
const OPTIONS = ["present", "absent", "late", "excused"];

export default function AttendancePage() {
  const [selectedSlot, setSelectedSlot] = useState(TODAY_SLOTS[0]);
  const [statuses, setStatuses] = useState<Record<number, string>>(
    Object.fromEntries(STUDENTS.map(s => [s.id, "present"]))
  );
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // TODO: persist via Supabase
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)", borderRadius: 20, padding: "20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Attendance</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Mark Register</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Synced to ClassHub and progressive record.</div>
      </div>

      {/* Slot selector */}
      <Card>
        <SectionLabel>Select Period</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {TODAY_SLOTS.map(slot => (
            <button
              key={slot.id}
              onClick={() => setSelectedSlot(slot)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 14px", borderRadius: 12, border: "none", cursor: "pointer",
                fontFamily: "inherit", textAlign: "left",
                background: selectedSlot.id === slot.id ? "#d1fae5" : "#f8f9fa",
                outline: selectedSlot.id === slot.id ? "2px solid #10b981" : "none",
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{slot.subject} · {slot.class}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{slot.start}–{slot.end} · {slot.room}</div>
              </div>
              {slot.attendanceMarked && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#065f46", background: "#d1fae5", padding: "3px 10px", borderRadius: 20 }}>✓ Done</span>
              )}
            </button>
          ))}
        </div>
      </Card>

      {/* Register */}
      <Card>
        <SectionLabel>Register — {selectedSlot.class} · {selectedSlot.start}</SectionLabel>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>Tap to change status. Default: Present.</div>
        {STUDENTS.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{s.name}</span>
            <div style={{ display: "flex", gap: 4 }}>
              {OPTIONS.map(o => (
                <button
                  key={o}
                  onClick={() => setStatuses(p => ({ ...p, [s.id]: o }))}
                  style={{
                    padding: "4px 8px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                    background: statuses[s.id] === o ? STATUS_COLORS[o] : "#f3f4f6",
                    color: statuses[s.id] === o ? "#fff" : "#6b7280",
                  }}
                >
                  {o.charAt(0).toUpperCase() + o.slice(1)}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          {saved && <span style={{ fontSize: 13, color: "#10b981", fontWeight: 700, alignSelf: "center" }}>✓ Saved</span>}
          <Btn onClick={handleSave}>Save Attendance</Btn>
        </div>
      </Card>
    </div>
  );
}