"use client";
import { useState } from "react";
import { Modal, Btn, C } from "./ui";
import type { Student } from "@/lib/types";

interface Props {
  student: Student | null;
  onClose: () => void;
}

export default function MessageModal({ student, onClose }: Props) {
  const [msg, setMsg] = useState(
    student
      ? `Hi, I wanted to reach out regarding ${student.name}. I've noticed some concerns and would like to discuss with you.`
      : ""
  );
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <Modal open onClose={onClose} title="Message Sent">
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 15, color: C.textPrimary, fontWeight: 600 }}>Message sent.</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>Thread created in VibeConnect.</div>
          <Btn style={{ marginTop: 20 }} onClick={onClose}>Done</Btn>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`Message${student ? ` — ${student.name}` : ""}`}>
      <div style={{ marginBottom: 12, fontSize: 13, color: C.textMuted }}>
        Opens a thread in VibeConnect. Students cannot see this.
      </div>
      <textarea
        value={msg}
        onChange={e => setMsg(e.target.value)}
        style={{
          width: "100%", minHeight: 120,
          border: `1.5px solid ${C.border}`, borderRadius: 12,
          padding: "12px 14px", fontSize: 14, fontFamily: "inherit",
          color: C.textPrimary, resize: "vertical", outline: "none",
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => setSent(true)} disabled={!msg.trim()}>Send</Btn>
      </div>
    </Modal>
  );
}