"use client";
import { useState } from "react";
import { Modal, Btn, C } from "./ui";
import { STUDENTS } from "@/lib/data";
import type { TimetableSlot, AttendanceStatus } from "@/lib/types";

const OPTIONS: AttendanceStatus[] = ["present", "absent", "late", "excused"];
const OPT_COLOR: Record<AttendanceStatus, string> = {
  present: "#10b981",
  absent:  "#ef4444",
  late:    "#f59e0b",
  excused: "#6366f1",
};

interface Props {
  slot: TimetableSlot;
  onClose: () => void;
  onSave: (slotId: number, statuses: Record<number, AttendanceStatus>) => void;
}

export default function AttendanceModal({ slot, onClose, onSave }: Props) {
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>(
    Object.fromEntries(STUDENTS.map(s => [s.id, "present"]))
  );

  return (
    <Modal open onClose={onClose} title={`Attendance — ${slot.subject} ${slot.class} · ${slot.start}`}>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>
        Tap to change status. Default: Present.
      </div>

      {STUDENTS.map(s => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{s.name}</span>
          <div style={{ display: "flex", gap: 4 }}>
            {OPTIONS.map(o => (
              <button
                key={o}
                onClick={() => setStatuses(p => ({ ...p, [s.id]: o }))}
                style={{
                  padding: "4px 8px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                  background: statuses[s.id] === o ? OPT_COLOR[o] : C.surface,
                  color:      statuses[s.id] === o ? "#fff"        : C.textMuted,
                }}
              >
                {o.charAt(0).toUpperCase() + o.slice(1)}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => { onSave(slot.id, statuses); onClose(); }}>Save Attendance</Btn>
      </div>
    </Modal>
  );
}