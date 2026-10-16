"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nairobiDateStr } from "@/lib/time";
import {
  appointClassLearner,
  endClassLearnerAppointment,
  getClassLeadership,
  type ClassLeadershipRole,
  type ClassLeadershipSnapshot,
} from "@/lib/class-life/leadership";

// Reusable Class Hub section, not an alternative appointment authority.
// Only integrate after the canonical SQL RPCs have been deployed.
// Existing Class Hub controls and visual tokens are deliberately preserved.
type LearnerOption = { id: string; name: string };
type GroupOption = { id: string; name: string };
type Props = {
  classId: string;
  learners: LearnerOption[];
  canManage: boolean;
  scope: "class" | "group";
  group?: GroupOption;
  termEndOn?: string;
  focusedStudentId?: string;
  onBusyChange?: (busy: boolean) => void;
};

const empty: ClassLeadershipSnapshot = { current: [], upcoming: [], termEndOn: null };
const fieldStyle: React.CSSProperties = {
  width: "100%", minHeight: 44, border: "1px solid #cbd5e1",
  borderRadius: 10, padding: "8px 10px", fontSize: 14, boxSizing: "border-box",
};
const actionStyle: React.CSSProperties = {
  minHeight: 42, border: 0, borderRadius: 10, padding: "0 14px",
  background: "#173f32", color: "#fff", fontWeight: 800, cursor: "pointer",
};
const labelStyle: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, fontWeight: 800 };
const roleLabels: Record<ClassLeadershipRole, string> = {
  representative: "Class representative",
  deputy: "Deputy representative",
  prefect: "Prefect",
  group_leader: "Group leader",
};

export default function ClassLeadershipPanel({
  classId, learners, canManage, scope, group, termEndOn, focusedStudentId, onBusyChange,
}: Props) {
  const [snapshot, setSnapshot] = useState(empty);
  const effectiveTermEnd = termEndOn ?? snapshot.termEndOn;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [studentId, setStudentId] = useState("");
  const [role, setRole] = useState<ClassLeadershipRole>(
    scope === "group" ? "group_leader" : "representative",
  );
  const [startOn, setStartOn] = useState(nairobiDateStr());
  const [endOn, setEndOn] = useState("");
  const mutationLock = useRef(false);
  const requestRef = useRef<{ payload: string; id: string } | null>(null);

  const load = useCallback(async () => {
    const result = await getClassLeadership(classId);
    setSnapshot(result);
  }, [classId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getClassLeadership(classId)
      .then(result => { if (active) { setSnapshot(result); setError(""); } })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Leadership could not load."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [classId]);

  useEffect(() => {
    setStudentId(focusedStudentId ?? "");
    setRole(scope === "group" ? "group_leader" : "representative");
    requestRef.current = null;
  }, [scope, group?.id, focusedStudentId]);

  // Default to the actual school term, not an invented academic window.
  // Never overwrite a teacher's manually chosen valid ending date.
  useEffect(() => {
    if (effectiveTermEnd && effectiveTermEnd >= startOn && !endOn) setEndOn(effectiveTermEnd);
  }, [effectiveTermEnd, startOn, endOn]);

  const rows = useMemo(() => {
    const allowed = (row: { group_id: string | null; student_id: string }) =>
      (!focusedStudentId || row.student_id === focusedStudentId) &&
      (scope === "class" ? row.group_id === null : row.group_id === group?.id);
    return {
      current: snapshot.current.filter(allowed),
      upcoming: snapshot.upcoming.filter(allowed),
    };
  }, [snapshot, scope, group?.id, focusedStudentId]);

  async function appoint() {
    if (busy || mutationLock.current || !canManage) return;
    if (!studentId || !startOn || !endOn || endOn < startOn || Boolean(effectiveTermEnd && endOn > effectiveTermEnd)) {
      setError("Choose a learner and dates within the current school term.");
      return;
    }
    if (scope === "group" && !group?.id) {
      setError("Choose a school-authorized group first.");
      return;
    }
    const input = {
      classId, studentId, role: scope === "group" ? "group_leader" as const : role,
      startsOn: startOn, endsOn: endOn,
      groupId: scope === "group" ? group!.id : null,
    };
    const payload = JSON.stringify(input);
    if (requestRef.current?.payload !== payload) {
      requestRef.current = { payload, id: crypto.randomUUID() };
    }
    mutationLock.current = true; setBusy(true); onBusyChange?.(true); setError(""); setMessage("");
    try {
      await appointClassLearner({ ...input, requestId: requestRef.current.id });
      requestRef.current = null;
      await load();
      window.dispatchEvent(new Event("learner-leadership-changed"));
      setMessage("Learner appointment saved. Previous appointments remain in history.");
      setStudentId(focusedStudentId ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The appointment could not be saved.");
    } finally {
      mutationLock.current = false; setBusy(false); onBusyChange?.(false);
    }
  }

  async function finish(id: string) {
    if (busy || mutationLock.current || !canManage) return;
    mutationLock.current = true; setBusy(true); onBusyChange?.(true); setError(""); setMessage("");
    try {
      await endClassLearnerAppointment(id, "completed");
      await load();
      window.dispatchEvent(new Event("learner-leadership-changed"));
      setMessage("Appointment ended. History has been preserved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The appointment could not be ended.");
    } finally {
      mutationLock.current = false; setBusy(false); onBusyChange?.(false);
    }
  }

  const readable = (value: string) => value.slice(0, 10);
  const title = scope === "group" ? "Group leadership" : "Class leadership";
  const selectedScopeReady = scope === "class" || !!group;
  return (
    <section aria-label={title} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 14 }}>
      <h2 style={{ fontSize: 17, marginTop: 0 }}>{title}</h2>
      {loading ? <p role="status">Loading appointments…</p> : null}
      {error ? <div role="alert" style={{ padding: 10, borderRadius: 10, background: "#fef2f2", color: "#991b1b" }}>{error}
        <button type="button" onClick={() => { setLoading(true); void load().then(() => setError("")).catch(err => setError(err instanceof Error ? err.message : "Leadership could not load.")).finally(() => setLoading(false)); }} style={{ marginLeft: 8 }}>Retry</button>
      </div> : null}
      {message ? <p role="status" style={{ color: "#065f46" }}>{message}</p> : null}
      {!loading && !rows.current.length && !rows.upcoming.length
        ? <p style={{ fontSize: 13, color: "#64748b" }}>No learner appointments recorded.</p> : null}
      {(["current", "upcoming"] as const).map(kind => (
        rows[kind].length ? <div key={kind} style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          <h3 style={{ fontSize: 13, margin: "8px 0 0" }}>{kind === "current" ? "Serving now" : "Scheduled next"}</h3>
          {rows[kind].map(item => <article key={item.id} style={{
            border: "1px solid #e2e8f0", borderRadius: 10, padding: 11,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
          }}>
            <div>
              <strong style={{ fontSize: 13 }}>{item.student_name}</strong>
              <div style={{ fontSize: 12, color: "#475569" }}>{roleLabels[item.role]} · {readable(item.starts_on)}–{readable(item.ends_on)}</div>
            </div>
            {canManage && <button type="button" onClick={() => void finish(item.id)}
              disabled={busy} style={{ ...actionStyle, minHeight: 36, background: "#334155" }}>End</button>}
          </article>)}
        </div> : null
      ))}
      {canManage && selectedScopeReady && <div style={{
        display: "grid", gap: 9, background: "var(--teacher-canvas, #f5f6f2)",
        padding: 12, borderRadius: 12, marginTop: 12,
      }}>
        <label style={labelStyle}>Learner
          <select style={fieldStyle} value={studentId} onChange={e => { setStudentId(e.target.value); requestRef.current = null; }}>
            <option value="">Choose learner</option>
            {learners.map(learner => <option key={learner.id} value={learner.id}>{learner.name}</option>)}
          </select>
        </label>
        {scope === "class" && <label style={labelStyle}>Responsibility
          <select style={fieldStyle} value={role} onChange={e => { setRole(e.target.value as ClassLeadershipRole); requestRef.current = null; }}>
            <option value="representative">Class representative</option>
            <option value="deputy">Deputy representative</option>
            <option value="prefect">Prefect</option>
          </select>
        </label>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 9 }}>
          <label style={labelStyle}>From
            <input type="date" style={fieldStyle} min={nairobiDateStr()} value={startOn}
              onChange={e => { setStartOn(e.target.value); requestRef.current = null; }} />
          </label>
          <label style={labelStyle}>Through
            <input type="date" style={fieldStyle} min={startOn} max={effectiveTermEnd ?? undefined} value={endOn}
              onChange={e => { setEndOn(e.target.value); requestRef.current = null; }} />
          </label>
        </div>
        <button type="button" style={actionStyle} disabled={busy || !studentId || !endOn || endOn < startOn}
          onClick={() => void appoint()}>{busy ? "Saving…" : "Appoint learner"}</button>
      </div>}
      {!canManage && <p style={{ fontSize: 13, color: "#64748b" }}>Your teaching assignment allows viewing these appointments, not changing them.</p>}
    </section>
  );
}
