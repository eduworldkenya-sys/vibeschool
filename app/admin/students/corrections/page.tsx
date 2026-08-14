"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const C = {
  bg: "#f0f4f8", surface: "#ffffff", border: "#e2e8f0", text: "#0f172a",
  muted: "#64748b", dark: "#0a1628", accent: "#10b981", amber: "#f59e0b", red: "#ef4444",
};

type StatusFilter = "pending" | "approved" | "rejected" | "all";
type Decision = "approved" | "rejected";

interface CorrectionRequest {
  id: string;
  student_id: string;
  student_name: string;
  class_name: string;
  field: string;
  old_value: string | null;
  new_value: string;
  reason: string | null;
  status: string | null;
  parent_id: string;
  created_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

function label(field: string) {
  return ({ name: "Full name", admission_number: "Admission number", date_of_birth: "Date of birth", gender: "Gender" } as Record<string, string>)[field] ?? field;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

export default function LearnerCorrectionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CorrectionRequest[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { router.replace("/admin/login"); return; }
    const { data, error: rpcError } = await supabase.rpc("list_school_child_change_requests", { p_status: filter === "all" ? null : filter });
    if (rpcError) { setRows([]); setError("Learner correction inbox could not be loaded."); }
    else setRows((data ?? []) as CorrectionRequest[]);
    setLoading(false);
  }, [filter, router]);

  useEffect(() => { void load(); }, [load]);

  async function decide(row: CorrectionRequest, decision: Decision) {
    if (row.status !== "pending") return;
    const verb = decision === "approved" ? "Approve and apply" : "Reject";
    if (!window.confirm(`${verb} ${label(row.field).toLowerCase()} correction for ${row.student_name}?`)) return;
    const note = window.prompt("Review note (optional):", "") ?? "";
    setWorkingId(row.id); setError(""); setNotice("");
    const { error: rpcError } = await supabase.rpc("review_child_change_request", { p_request_id: row.id, p_decision: decision, p_review_note: note.trim() || null });
    setWorkingId(null);
    if (rpcError) { setError("This request could not be reviewed. It may already have been handled or your school authority changed."); return; }
    setNotice(decision === "approved" ? "Correction approved and canonical learner identity updated." : "Correction rejected. Canonical learner identity was not changed.");
    await load();
  }

  const pendingCount = useMemo(() => rows.filter(row => row.status === "pending").length, [rows]);

  return <main style={{ minHeight: "100%", background: C.bg, padding: "18px 16px 40px" }}>
    <button onClick={() => router.push("/admin/students")} style={{ border: "none", background: "none", padding: "0 0 14px", color: C.muted, fontSize: 12, fontWeight: 750, cursor: "pointer" }}>← Students</button>
    <section style={{ background: C.dark, color: "#fff", borderRadius: 22, padding: 20, marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 850, letterSpacing: 1.1, opacity: .62 }}>LEARNER IDENTITY GOVERNANCE</div>
      <h1 style={{ margin: "5px 0 6px", fontSize: 22 }}>Profile corrections</h1>
      <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, opacity: .72 }}>Review parent-submitted identity corrections. Approval updates the canonical school learner record atomically; rejection leaves it unchanged.</p>
    </section>

    <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 10 }}>
      {(["pending", "approved", "rejected", "all"] as StatusFilter[]).map(item => <button key={item} onClick={() => setFilter(item)} style={{ border: `1px solid ${filter === item ? C.accent : C.border}`, background: filter === item ? "#ecfdf5" : "#fff", color: filter === item ? "#047857" : C.muted, borderRadius: 99, padding: "8px 11px", fontSize: 10, fontWeight: 850, textTransform: "capitalize", cursor: "pointer", whiteSpace: "nowrap" }}>{item}{item === "pending" && filter === "pending" && pendingCount > 0 ? ` · ${pendingCount}` : ""}</button>)}
    </div>

    {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: 12, borderRadius: 12, marginBottom: 10, fontSize: 11 }}>{error}</div>}
    {notice && <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857", padding: 12, borderRadius: 12, marginBottom: 10, fontSize: 11 }}>{notice}</div>}

    {loading ? <div style={{ background: "#fff", borderRadius: 16, padding: 18, color: C.muted, fontSize: 12 }}>Loading correction requests…</div> : rows.length === 0 ? <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, textAlign: "center" }}><div style={{ fontSize: 26 }}>✓</div><strong style={{ display: "block", marginTop: 6, color: C.text, fontSize: 13 }}>No {filter === "all" ? "correction" : filter} requests</strong><p style={{ margin: "5px 0 0", color: C.muted, fontSize: 10 }}>Nothing requires action in this view.</p></div> : <div style={{ display: "grid", gap: 10 }}>
      {rows.map(row => <article key={row.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 15 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}><div><strong style={{ color: C.text, fontSize: 13 }}>{row.student_name}</strong><div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{row.class_name || "Class unavailable"} · {formatDate(row.created_at)}</div></div><span style={{ borderRadius: 99, padding: "5px 8px", fontSize: 9, fontWeight: 850, textTransform: "uppercase", background: row.status === "approved" ? "#ecfdf5" : row.status === "rejected" ? "#fef2f2" : "#fffbeb", color: row.status === "approved" ? "#047857" : row.status === "rejected" ? "#b91c1c" : "#b45309" }}>{row.status ?? "pending"}</span></div>
        <div style={{ marginTop: 12, background: "#f8fafc", borderRadius: 12, padding: 12 }}><div style={{ fontSize: 10, fontWeight: 850, color: C.muted, textTransform: "uppercase" }}>{label(row.field)}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 18px 1fr", gap: 7, alignItems: "center", marginTop: 7 }}><div><div style={{ color: C.muted, fontSize: 9 }}>Current</div><strong style={{ color: C.text, fontSize: 11, overflowWrap: "anywhere" }}>{row.old_value || "—"}</strong></div><div style={{ color: C.muted, textAlign: "center" }}>→</div><div><div style={{ color: C.muted, fontSize: 9 }}>Requested</div><strong style={{ color: C.text, fontSize: 11, overflowWrap: "anywhere" }}>{row.new_value}</strong></div></div>{row.reason && <p style={{ margin: "9px 0 0", color: C.muted, fontSize: 10, lineHeight: 1.45 }}>Parent reason: {row.reason}</p>}</div>
        {row.review_note && <p style={{ margin: "9px 0 0", color: C.muted, fontSize: 10 }}>Review note: {row.review_note}</p>}
        {row.status === "pending" && <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button disabled={workingId === row.id} onClick={() => void decide(row, "rejected")} style={{ flex: 1, border: `1px solid #fecaca`, background: "#fff", color: "#b91c1c", borderRadius: 11, padding: 10, fontSize: 10, fontWeight: 850, cursor: "pointer" }}>Reject</button><button disabled={workingId === row.id} onClick={() => void decide(row, "approved")} style={{ flex: 1, border: "none", background: workingId === row.id ? "#94a3b8" : C.accent, color: "#fff", borderRadius: 11, padding: 10, fontSize: 10, fontWeight: 850, cursor: "pointer" }}>{workingId === row.id ? "Reviewing…" : "Approve & apply"}</button></div>}
      </article>)}
    </div>}
  </main>;
}
