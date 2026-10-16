"use client";

import { useEffect, useRef, useState } from "react";
import LearnerDetailSheet from "./LearnerDetailSheet";
import { supabase } from "@/lib/supabase";

type Identity = { name: string; admission_number: string | null; gender: string | null; date_of_birth: string | null };
export default function LearnerIdentityFields({ classId, studentId, identity, onSaved }: {
  classId: string; studentId: string; identity: Identity; onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(identity);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const retry = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    if (!dirty) setDraft({ name: identity.name, admission_number: identity.admission_number, gender: identity.gender, date_of_birth: identity.date_of_birth });
  }, [identity.name, identity.admission_number, identity.gender, identity.date_of_birth, dirty]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  async function save() {
    if (lock.current || !draft.name.trim()) return;
    lock.current = true; setBusy(true); setMessage("");
    const payload = { ...draft, name: draft.name.trim(), admission_number: draft.admission_number?.trim() || null, expected: identity };
    const key = JSON.stringify(payload);
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    try {
      const result = await supabase.rpc("teacher_manage_class_learner", {
        p_class_id: classId, p_student_id: studentId, p_action: "edit", p_payload: payload, p_request_id: retry.current.id,
      });
      if (result.error) throw new Error(result.error.message.includes("learner_edit_conflict")
        ? "This learner’s details changed elsewhere. Refresh the profile before saving again; your changes have not overwritten them."
        : result.error.message.includes("admission_identifier_conflict") ? "That admission number is already in use at this school." : result.error.message);
      if (result.data !== studentId) throw new Error("The saved learner identity could not be confirmed. Retry.");
      retry.current = null;
      await onSaved();
      setDirty(false);
      setMessage("Saved learner details.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not confirm the save. Retry."); }
    finally { lock.current = false; setBusy(false); }
  }
  const input = { width: "100%", minHeight: 44, padding: 10, border: "1px solid #d1dcd5", borderRadius: 10, boxSizing: "border-box" as const, font: "inherit" };
  return <article style={{ background: "#fff", border: "1px solid #e1e7e3", borderRadius: 12, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 14 }}>School identity</h3>
      <button type="button" aria-label="Edit school identity" style={{ minHeight: 44, background: "transparent", border: 0, color: "#166534", fontWeight: 700 }} onClick={() => setEditing(true)}>Edit details</button>
    </div>
    <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "12px 0 0", fontSize: 13, overflowWrap: "anywhere" }}>
      {[["Full name", identity.name], ["Admission number", identity.admission_number], ["Date of birth", identity.date_of_birth], ["Gender", identity.gender]].map(([label,value]) => <div key={label}><dt style={{ color: "#627168", fontSize: 12 }}>{label}</dt><dd style={{ margin: "3px 0 0", textTransform: label === "Gender" ? "capitalize" : undefined }}>{value || "Not recorded"}</dd></div>)}
    </dl>
    {dirty && <p role="status" style={{ color: "#92400e", fontSize: 12 }}>Unsaved identity changes · reopen to continue</p>}
    {editing && <LearnerDetailSheet title="School identity" learnerName={identity.name} busy={busy} onClose={() => setEditing(false)}>
    <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
      <label>Full name<input style={input} required maxLength={200} disabled={busy} value={draft.name} onChange={event => { setDirty(true); setDraft({ ...draft, name: event.target.value }); }}/></label>
      <label>Admission number (optional)<input style={input} maxLength={80} disabled={busy} value={draft.admission_number ?? ""} onChange={event => { setDirty(true); setDraft({ ...draft, admission_number: event.target.value || null }); }}/></label>
      <label>Date of birth (optional)<input style={input} type="date" max={today} disabled={busy} value={draft.date_of_birth ?? ""} onChange={event => { setDirty(true); setDraft({ ...draft, date_of_birth: event.target.value || null }); }}/></label>
      <label>Gender (optional)<select style={input} disabled={busy} value={draft.gender ?? ""} onChange={event => { setDirty(true); setDraft({ ...draft, gender: event.target.value || null }); }}><option value="">Not recorded</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>{draft.gender && !["male", "female", "other"].includes(draft.gender) && <option value={draft.gender}>{draft.gender}</option>}</select></label>
      <button type="button" disabled={busy || !draft.name.trim() || !!draft.date_of_birth && draft.date_of_birth > today} style={{ ...input, background: "#087455", color: "#fff", cursor: "pointer" }} onClick={() => void save()}>{busy ? "Saving…" : "Save identity details"}</button>
      {message && <p role={message.startsWith("Saved") ? "status" : "alert"}>{message}</p>}
    </div>
    </LearnerDetailSheet>}
  </article>;
}
