"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type TeacherClass = { classId: string; label: string };
type RpcPayload = { ok?: boolean; assessment_id?: string; assignment_id?: string; operation?: string };

export function AssessmentDeliveryPanel({ generatedAssessmentId, approved }: { generatedAssessmentId: string; approved: boolean }) {
  const supabase = useMemo(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), []);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [classId, setClassId] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const { data: assignments } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", authData.user.id).not("class_id", "is", null);
      const ids = Array.from(new Set((assignments ?? []).map(row => row.class_id).filter((value): value is string => typeof value === "string")));
      if (!ids.length) return;
      const { data: classRows } = await supabase.from("classes").select("id,name,stream").in("id", ids).order("name");
      if (cancelled) return;
      const list = (classRows ?? []).map(row => ({ classId: row.id, label: [row.name, row.stream].filter(Boolean).join(" · ") }));
      setClasses(list);
      setClassId(list[0]?.classId ?? "");
    }
    void load();
    return () => { cancelled = true; };
  }, [supabase]);

  async function deliver() {
    if (!approved || !classId || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { data: promotedData, error: promoteError } = await supabase.rpc("ce_promote_generated_assessment", { p_generated_assessment_id: generatedAssessmentId, p_class_id: classId });
      if (promoteError) throw promoteError;
      const promoted = (promotedData ?? {}) as RpcPayload;
      if (!promoted.ok || !promoted.assessment_id) throw new Error("Approved assessment could not be promoted to delivery.");
      const closeIso = closesAt ? new Date(closesAt).toISOString() : null;
      const minutes = timeLimit.trim() ? Math.max(1, Number(timeLimit) || 1) : null;
      const { data: assignedData, error: assignError } = await supabase.rpc("ce_assign_assessment_to_class", { p_assessment_id: promoted.assessment_id, p_closes_at: closeIso, p_time_limit_minutes: minutes });
      if (assignError) throw assignError;
      const assigned = (assignedData ?? {}) as RpcPayload;
      if (!assigned.ok || !assigned.assignment_id) throw new Error("Assessment could not be assigned.");
      const classLabel = classes.find(item => item.classId === classId)?.label ?? "class";
      setMessage(`Assigned to ${classLabel}. Learners now receive it through the existing assessment engine.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Assessment could not be delivered."); }
    finally { setBusy(false); }
  }

  return <section style={{ background: "#fff", border: "1px solid #c7d2fe", borderRadius: 16, padding: 16, marginBottom: 12 }}><strong>Deliver to class</strong><p style={{ fontSize: 12, lineHeight: 1.6, color: "#64748b" }}>Promotion copies this reviewed Content Engine draft into Vibeschool’s authoritative assessment definition/items engine. Attempts, scoring and gradebook continue through the existing assessment system.</p>{!approved ? <div style={{ fontSize: 12, color: "#92400e" }}>Approve the assessment first.</div> : classes.length === 0 ? <div style={{ fontSize: 12, color: "#64748b" }}>No assigned classes are available.</div> : <><label style={label}>Class<select value={classId} onChange={e => setClassId(e.target.value)} style={input}>{classes.map(item => <option key={item.classId} value={item.classId}>{item.label}</option>)}</select></label><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}><label style={label}>Close time<input type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)} style={input} /></label><label style={label}>Time limit (minutes)<input type="number" min={1} value={timeLimit} onChange={e => setTimeLimit(e.target.value)} placeholder="Optional" style={input} /></label></div>{error && <div role="alert" style={{ marginTop: 10, color: "#b91c1c", fontSize: 12 }}>{error}</div>}{message && <div role="status" style={{ marginTop: 10, color: "#166534", fontSize: 12 }}>{message}</div>}<button type="button" disabled={busy || !classId} onClick={() => void deliver()} style={{ width: "100%", marginTop: 12, border: 0, borderRadius: 11, background: "#4f46e5", color: "#fff", padding: 12, fontWeight: 850, cursor: busy ? "wait" : "pointer", opacity: busy ? .6 : 1 }}>{busy ? "Assigning…" : "Assign approved assessment"}</button></>}</section>;
}

const label: React.CSSProperties = { display: "grid", gap: 5, fontSize: 11, fontWeight: 800, color: "#334155" };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 10px", background: "#fff", fontFamily: "inherit" };
