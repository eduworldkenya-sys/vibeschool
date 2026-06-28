"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStudent } from "@/lib/student-context";
import { readCache, writeCache } from "@/lib/student-cache";
import Skel from "@/components/student/Skel";

interface Slot {
  id:         string;
  day_of_week: number;
  start_time:  string;
  end_time:    string;
  room:        string;
  subject:     string;
}

const DAYS = [
  { label: "Mon", int: 1 },
  { label: "Tue", int: 2 },
  { label: "Wed", int: 3 },
  { label: "Thu", int: 4 },
  { label: "Fri", int: 5 },
]

function todayInt(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

function IconClock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}
function IconRoom() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

export default function TimetablePage() {
  const { identity, loading: idLoading } = useStudent();
  const [slots,   setSlots]   = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(todayInt());

  useEffect(() => {
    if (idLoading || !identity?.classId) { setLoading(false); return; }

    const cached = readCache<Slot[]>("timetable", identity.studentId);
    if (cached) { setSlots(cached); setLoading(false); }

    async function load() {
      const { data: raw } = await supabase
        .from("timetable_slots")
        .select("id, day_of_week, start_time, end_time, room, subject_id")
        .eq("class_id", identity!.classId)
        .order("day_of_week", { ascending: true })
        .order("start_time",  { ascending: true });

      const subjectIds = Array.from(
        new Set((raw ?? []).map((s: { subject_id: string }) => s.subject_id).filter(Boolean))
      ) as string[];

      let subjectMap: Record<string, string> = {};
      if (subjectIds.length > 0) {
        const { data: subjects } = await supabase
          .from("subjects").select("id, name").in("id", subjectIds);
        subjectMap = Object.fromEntries((subjects ?? []).map(s => [s.id, s.name]));
      }

      const result: Slot[] = (raw ?? []).map((s: { id: string; day_of_week: number; start_time: string; end_time: string; room: string; subject_id: string }) => ({
        id:          s.id,
        day_of_week: s.day_of_week,
        start_time:  s.start_time?.slice(0, 5) ?? "",
        end_time:    s.end_time?.slice(0, 5)   ?? "",
        room:        s.room ?? "",
        subject:     subjectMap[s.subject_id]  ?? "Lesson",
      }));

      writeCache("timetable", identity!.studentId, result);
      setSlots(result);
      setLoading(false);
    }
    load();
  }, [identity, idLoading]);

  const daySlots = slots.filter(s => s.day_of_week === activeDay);
  const isLoading = idLoading || (loading && slots.length === 0);

  if (isLoading) return (
    <div className="space-y-3 pt-2">
      <Skel h={44} radius={12} />
      <Skel h={80} radius={12} />
      <Skel h={80} radius={12} />
      <Skel h={80} radius={12} />
    </div>
  );

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--vs-text)", fontFamily: "'Bricolage Grotesque', sans-serif" }}>
          My Day
        </h1>
        <p style={{ fontSize: 12, color: "var(--vs-muted)", marginTop: 2 }}>
          {identity?.className} timetable
        </p>
      </div>

      {/* Day tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {DAYS.map(d => {
          const isToday  = d.int === todayInt();
          const isActive = d.int === activeDay;
          const count    = slots.filter(s => s.day_of_week === d.int).length;
          return (
            <button
              key={d.int}
              onClick={() => setActiveDay(d.int)}
              style={{
                flex:          1,
                padding:       "10px 4px",
                borderRadius:  12,
                border:        isActive ? "none" : "1px solid var(--vs-border)",
                background:    isActive ? "var(--vs-accent)" : "var(--vs-card)",
                color:         isActive ? "#fff" : isToday ? "var(--vs-accent)" : "var(--vs-muted)",
                cursor:        "pointer",
                fontFamily:    "inherit",
                fontWeight:    isActive || isToday ? 800 : 500,
                fontSize:      12,
                textAlign:     "center",
                transition:    "all 0.15s",
              }}
            >
              <div>{d.label}</div>
              <div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>{count} lesson{count !== 1 ? "s" : ""}</div>
            </button>
          );
        })}
      </div>

      {/* Slots */}
      {!identity?.classId ? (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--vs-muted)" }}>No class assigned yet</div>
        </div>
      ) : daySlots.length === 0 ? (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--vs-muted)" }}>No lessons on {DAYS.find(d => d.int === activeDay)?.label}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {daySlots.map((slot, i) => (
            <div
              key={slot.id}
              style={{
                background:   "var(--vs-card)",
                border:       "1px solid var(--vs-border)",
                borderRadius: 14,
                padding:      "14px 16px",
                display:      "flex",
                alignItems:   "center",
                gap:          14,
              }}
            >
              {/* Time column */}
              <div style={{
                minWidth:       52,
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                gap:            2,
                color:          "var(--vs-accent)",
              }}>
                <IconClock />
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--vs-accent)" }}>{slot.start_time}</span>
                <span style={{ fontSize: 10, color: "var(--vs-muted)" }}>{slot.end_time}</span>
              </div>

              {/* Divider */}
              <div style={{ width: 2, height: 44, borderRadius: 2, background: "var(--vs-accent-soft)", flexShrink: 0 }} />

              {/* Subject */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--vs-text)" }}>{slot.subject}</div>
                {slot.room && (
                  <div style={{ fontSize: 11, color: "var(--vs-muted)", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <IconRoom />
                    Room {slot.room}
                  </div>
                )}
              </div>

              {/* Period number */}
              <div style={{
                width:          28,
                height:         28,
                borderRadius:   "50%",
                background:     "var(--vs-accent-soft)",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                fontSize:       11,
                fontWeight:     800,
                color:          "var(--vs-accent)",
                flexShrink:     0,
              }}>
                {i + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
