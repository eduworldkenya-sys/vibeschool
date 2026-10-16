"use client";

import { useEffect, useState } from "react";
import {
  getLearnerLeadershipHistory,
  type LearnerLeadershipHistory,
  type ClassLeadershipRole,
} from "@/lib/class-life/leadership";

// A read-only projection of the SAME school appointment ledger used by
// Class Hub. Import into existing learner profile after the RPC goes live.
// This component never grants the learner any additional permissions.
type Props = { classId: string; studentId: string };
const labels: Record<ClassLeadershipRole, string> = {
  representative: "Class representative", deputy: "Deputy representative",
  prefect: "Prefect", group_leader: "Group leader",
};
function appointmentStatus(row: LearnerLeadershipHistory): string {
  if (row.ended_at) {
    return row.ended_reason === "resigned" ? "Resigned" :
      row.ended_reason === "removed" ? "Removed" :
      row.ended_reason === "replaced" ? "Handed over" : "Completed";
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  return row.starts_on > today ? "Scheduled" : row.ends_on < today ? "Completed" : "Serving";
}
export default function LearnerLeadershipHistoryPanel({ classId, studentId }: Props) {
  const [rows, setRows] = useState<LearnerLeadershipHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true); setError("");
    getLearnerLeadershipHistory(classId, studentId)
      .then(result => { if (current) setRows(result); })
      .catch(err => { if (current) setError(err instanceof Error ? err.message : "Leadership history is unavailable."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [classId, studentId, reloadCount]);
  useEffect(() => {
    const refresh = () => setReloadCount(value => value + 1);
    window.addEventListener("learner-leadership-changed", refresh);
    return () => window.removeEventListener("learner-leadership-changed", refresh);
  }, []);
  return (
    <section aria-label="Learner leadership history" style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 14,
    }}>
      <h2 style={{ fontSize: 17, marginTop: 0 }}>Class leadership history</h2>
      {loading ? <p role="status" style={{ fontSize: 13 }}>Loading history…</p> : null}
      {error && <div role="alert" style={{ color: "#991b1b", fontSize: 13 }}>
        {error} <button type="button" onClick={() => setReloadCount(value => value + 1)}>Retry</button>
      </div>}
      {!loading && !error && rows.length === 0
        ? <p style={{ color: "#64748b", fontSize: 13 }}>No leadership appointments recorded for this learner.</p> : null}
      {!loading && rows.map(row => <article key={row.id}
        style={{ borderTop: "1px solid #e2e8f0", padding: "10px 0" }}>
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <strong style={{ fontSize: 13 }}>{labels[row.role]}</strong>
          <span style={{ fontSize: 12, color: row.ended_at ? "#64748b" : "#065f46" }}>
            {appointmentStatus(row)}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
          {row.starts_on.slice(0, 10)} to {row.ends_on.slice(0, 10)}
        </div>
      </article>)}
    </section>
  );
}
