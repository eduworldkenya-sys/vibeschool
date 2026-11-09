"use client";

import { useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type Identity = {
  name: string;
  admission_number: string | null;
  gender: string | null;
  date_of_birth: string | null;
};

export default function LearnerIdentityFields({
  classId,
  studentId,
  identity,
  onSaved,
  onCancel,
  onBusyChange,
}: {
  classId: string;
  studentId: string;
  identity: Identity;
  onSaved: () => Promise<void>;
  onCancel?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState(identity);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const retry = useRef<{ key: string; id: string } | null>(null);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

  async function save() {
    if (lock.current || !draft.name.trim()) return;
    lock.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setMessage("");
    const payload = {
      ...draft,
      name: draft.name.trim(),
      admission_number: draft.admission_number?.trim() || null,
      expected: identity,
    };
    const key = JSON.stringify(payload);
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    try {
      const result = await supabase.rpc("teacher_manage_class_learner", {
        p_class_id: classId,
        p_student_id: studentId,
        p_action: "edit",
        p_payload: payload,
        p_request_id: retry.current.id,
      });
      if (result.error) {
        throw new Error(result.error.message.includes("learner_edit_conflict")
          ? "These school details changed elsewhere. Refresh the learner profile before trying again. Your changes were not saved."
          : result.error.message.includes("admission_identifier_conflict")
            ? "That admission number is already in use at this school."
            : result.error.message);
      }
      if (result.data !== studentId) {
        throw new Error("The saved learner identity could not be confirmed. Retry.");
      }
      retry.current = null;
      await onSaved();
      setMessage("Saved learner details.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not confirm the save. Retry.");
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  const inputStyle = {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    border: "1px solid #d4ded7",
    borderRadius: 10,
    boxSizing: "border-box" as const,
    background: "#fff",
    color: "#1d3427",
    font: "inherit",
  };
  const labelStyle = { display: "grid", gap: 5, fontSize: 12, fontWeight: 650 as const, color: "#314e3b" };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save();
  }

  return (
    <form onSubmit={submit} aria-label="Edit school details" style={{ display: "grid", gap: 14 }}>
      <label style={labelStyle}>
        Full name
        <input style={inputStyle} required maxLength={200} disabled={busy} value={draft.name}
          onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}/>
      </label>
      <label style={labelStyle}>
        Admission number (optional)
        <input style={inputStyle} maxLength={80} disabled={busy} value={draft.admission_number ?? ""}
          onChange={event => setDraft(current => ({ ...current, admission_number: event.target.value || null }))}/>
      </label>
      <label style={labelStyle}>
        Date of birth (optional)
        <input style={inputStyle} type="date" max={today} disabled={busy} value={draft.date_of_birth ?? ""}
          onChange={event => setDraft(current => ({ ...current, date_of_birth: event.target.value || null }))}/>
      </label>
      <label style={labelStyle}>
        Gender (optional)
        <select style={inputStyle} disabled={busy} value={draft.gender ?? ""}
          onChange={event => setDraft(current => ({ ...current, gender: event.target.value || null }))}>
          <option value="">Not recorded</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
          {draft.gender && !["male", "female", "other"].includes(draft.gender) &&
            <option value={draft.gender}>{draft.gender}</option>}
        </select>
      </label>
      {message && <p role={message.startsWith("Saved") ? "status" : "alert"} style={{ margin: 0, fontSize: 12 }}>{message}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, flexWrap: "wrap" }}>
        {onCancel && <button type="button" disabled={busy} onClick={onCancel}
          style={{ minHeight: 44, padding: "0 16px", border: "1px solid #d4ded7", borderRadius: 11, background: "#fff", color: "#314e3b", fontWeight: 700 }}>
          Cancel
        </button>}
        <button type="submit" disabled={busy || !draft.name.trim() || !!draft.date_of_birth && draft.date_of_birth > today}
          style={{ minHeight: 44, padding: "0 18px", border: 0, borderRadius: 11, background: "#176747", color: "#fff", fontWeight: 750 }}>
          {busy ? "Saving…" : "Save details"}
        </button>
      </div>
    </form>
  );
}
