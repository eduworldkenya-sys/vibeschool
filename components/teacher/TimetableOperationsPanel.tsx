"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { duplicateActiveTimetable, restoreTimetableSnapshot, snapshotTimetable } from "@/lib/teaching/slots";
import { nairobiDateAdd, nairobiDateStr } from "@/lib/time";

type SchoolOption = { id: string; name: string };
type CalendarException = {
  id: string;
  exception_date: string;
  kind: "holiday" | "closure" | "exam" | "event";
  label: string;
  suppress_ordinary_teaching: boolean;
};
type UndoState = { snapshotId: string; label: string; createdAt: string };

const panel: React.CSSProperties = {
  border: "1px solid var(--border-color, #e5e7eb)",
  borderRadius: 16,
  background: "var(--surface-card, #fff)",
  padding: 14,
  marginBottom: 14,
};

function nextMonday(from: string): string {
  const date = new Date(from + "T12:00:00Z");
  const day = date.getUTCDay();
  const delta = day === 0 ? 1 : 8 - day;
  return nairobiDateAdd(from, delta);
}

export default function TimetableOperationsPanel({
  weekStart,
  onChanged,
}: {
  weekStart: string;
  onChanged: () => void;
}) {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [activeSchoolId, setActiveSchoolId] = useState("");
  const [events, setEvents] = useState<CalendarException[]>([]);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [repeatFrom, setRepeatFrom] = useState(() => nextMonday(nairobiDateStr()));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const weekEnd = useMemo(() => nairobiDateAdd(weekStart, 6), [weekStart]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [contextRes, membershipsRes] = await Promise.all([
      supabase.rpc("teacher_get_operating_context", {}),
      supabase
        .from("school_members")
        .select("school_id")
        .eq("profile_id", user.id)
        .eq("role", "teacher"),
    ]);

    const context = contextRes.data as { school_id?: string | null } | null;
    const active = context?.school_id ?? "";
    setActiveSchoolId(active);

    const ids = Array.from(new Set((membershipsRes.data ?? []).map((row: { school_id: string }) => row.school_id)));
    if (ids.length) {
      const schoolRes = await supabase.from("schools").select("id,name").in("id", ids);
      if (!schoolRes.error) {
        setSchools(((schoolRes.data ?? []) as SchoolOption[]).sort((a, b) => a.name.localeCompare(b.name)));
      }
    } else {
      setSchools([]);
    }

    if (active) {
      const exceptionRes = await supabase
        .from("school_calendar_exceptions")
        .select("id,exception_date,kind,label,suppress_ordinary_teaching")
        .eq("school_id", active)
        .gte("exception_date", weekStart)
        .lte("exception_date", weekEnd)
        .order("exception_date");
      if (!exceptionRes.error) setEvents((exceptionRes.data ?? []) as CalendarException[]);
    } else {
      setEvents([]);
    }

    try {
      const raw = localStorage.getItem("teacher-timetable-last-undo");
      setUndo(raw ? (JSON.parse(raw) as UndoState) : null);
    } catch {
      setUndo(null);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => { void load(); }, [load]);

  async function switchSchool(schoolId: string) {
    if (!schoolId || schoolId === activeSchoolId || busy) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("set_my_active_teacher_school", { p_school_id: schoolId });
    if (error) {
      setMessage("Could not switch school. Your current timetable is unchanged.");
      setBusy(false);
      return;
    }
    window.location.assign("/teacher/timetable");
  }

  async function undoLastChange() {
    if (!undo || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await restoreTimetableSnapshot(undo.snapshotId, nairobiDateStr());
      localStorage.removeItem("teacher-timetable-last-undo");
      setUndo(null);
      setMessage("Last timetable change restored.");
      await load();
      onChanged();
    } catch (error) {
      console.error("[Timetable] undo failed", error);
      setMessage("Could not restore that change. Existing teaching history was left untouched.");
    } finally {
      setBusy(false);
    }
  }

  async function repeatTimetable() {
    if (busy || !repeatFrom) return;
    if (repeatFrom < nairobiDateStr()) {
      setMessage("Choose today or a future date.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const snapshotId = await snapshotTimetable("Before repeating timetable from " + repeatFrom);
      localStorage.setItem("teacher-timetable-last-undo", JSON.stringify({
        snapshotId,
        label: "Before repeating timetable",
        createdAt: new Date().toISOString(),
      } satisfies UndoState));
      const count = await duplicateActiveTimetable(repeatFrom);
      setUndo({ snapshotId, label: "Before repeating timetable", createdAt: new Date().toISOString() });
      setMessage(count ? `Repeated ${count} lesson slot${count === 1 ? "" : "s"} from ${repeatFrom}.` : "No active lessons needed repeating.");
      onChanged();
    } catch (error) {
      console.error("[Timetable] repeat failed", error);
      setMessage("Could not repeat the timetable. No partial copy was accepted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="no-print" style={panel} aria-label="Timetable tools">
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Timetable tools</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            School context, exceptions, repeat and safe undo.
          </div>
        </div>
        <a
          href="/teacher/lessonplan/new"
          style={{ padding: "8px 12px", borderRadius: 10, background: "#eef2ff", color: "#4338ca", textDecoration: "none", fontSize: 12, fontWeight: 800 }}
        >
          Plan lesson without timetable
        </a>
      </div>

      {schools.length > 1 && (
        <div style={{ marginTop: 12 }}>
          <label htmlFor="timetable-school" style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 5 }}>
            School
          </label>
          <select
            id="timetable-school"
            value={activeSchoolId}
            disabled={busy}
            onChange={e => void switchSchool(e.target.value)}
            style={{ width: "100%", minHeight: 42, borderRadius: 10, border: "1px solid #dbe3ec", padding: "0 10px", background: "#fff" }}
          >
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div style={{ marginTop: 5, fontSize: 11, color: "#64748b" }}>
            Cross-school teacher clashes are checked before save and enforced by the database.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, marginTop: 12 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>Undo</div>
          {undo ? (
            <>
              <div style={{ fontSize: 12, marginTop: 5 }}>{undo.label}</div>
              <button disabled={busy} onClick={() => void undoLastChange()} style={{ marginTop: 8, minHeight: 36, width: "100%", borderRadius: 9, border: "1px solid #c7d2fe", background: "#eef2ff", fontWeight: 800 }}>
                Undo last timetable change
              </button>
            </>
          ) : <div style={{ fontSize: 12, color: "#64748b", marginTop: 5 }}>No change is waiting to be undone.</div>}
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>Repeat timetable</div>
          <input
            type="date"
            min={nairobiDateStr()}
            value={repeatFrom}
            onChange={e => setRepeatFrom(e.target.value)}
            style={{ marginTop: 6, minHeight: 36, width: "100%", borderRadius: 9, border: "1px solid #dbe3ec", padding: "0 8px" }}
          />
          <button disabled={busy} onClick={() => void repeatTimetable()} style={{ marginTop: 8, minHeight: 36, width: "100%", borderRadius: 9, border: 0, background: "#111827", color: "#fff", fontWeight: 800 }}>
            Repeat current schedule
          </button>
        </div>
      </div>

      {events.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 6 }}>This week</div>
          {events.map(event => (
            <div key={event.id} style={{ fontSize: 12, padding: "6px 0", display: "flex", gap: 7 }}>
              <strong>{event.exception_date}</strong>
              <span>{event.label}</span>
              <span style={{ color: "#64748b" }}>· {event.kind}{event.suppress_ordinary_teaching ? " · ordinary lessons paused" : ""}</span>
            </div>
          ))}
        </div>
      )}

      {message && <div role="status" style={{ marginTop: 10, fontSize: 12, fontWeight: 700 }}>{message}</div>}
    </section>
  );
}
