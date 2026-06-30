"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStudent } from "@/lib/student-context";
import { readCache, writeCache } from "@/lib/student-cache";
import Skel from "@/components/student/Skel";

interface DashData {
  attendancePct:  number;
  totalPresent:   number;
  totalDays:      number;
  pendingHW:      number;
  todaySlots:     { subject: string; start: string; end: string; room: string }[];
  avgMarksPct:    number | null;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// SVG icons
function IconAttendance() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <polyline points="16 11 18 13 22 9"/>
    </svg>
  );
}
function IconWork() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="15" y2="17"/>
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8"  y1="2" x2="8"  y2="6"/>
      <line x1="3"  y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function IconMarks() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
  );
}
function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

export default function StudentHomePage() {
  const router              = useRouter();
  const { identity, loading: idLoading } = useStudent();
  const [data,    setData]    = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (idLoading || !identity) return;

    // Show cache instantly
    const cached = readCache<DashData>("dashboard", identity.studentId);
    if (cached) {
      setData(cached);
      setLoading(false);
    }

    async function load() {
      if (!identity) return;

      // Attendance
      const { data: att } = await supabase
        .from("attendance")
        .select("status")
        .eq("student_id", identity.studentId);

      const totalDays    = att?.length ?? 0;
      const totalPresent = att?.filter(a => a.status === "present").length ?? 0;
      const attendancePct = totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : 0;

      // Pending homework — day_of_week is integer Mon=1…Sun=7
      const { data: hw } = await supabase
        .from("homework")
        .select("id, homework_submissions(id)")
        .eq("class_id", identity.classId)
        .gte("due_date", new Date().toISOString().split("T")[0]);

      const pendingHW = (hw ?? []).filter(h => {
        const subs = (h.homework_submissions as { id: string }[]) ?? [];
        return subs.length === 0;
      }).length;

      // Today timetable — integer day Mon=1 Tue=2 Wed=3 Thu=4 Fri=5 Sat=6 Sun=7
      const jsDay = new Date().getDay(); // 0=Sun
      const dayInt = jsDay === 0 ? 7 : jsDay;

      const { data: slots } = identity.classId ? await supabase
        .from("timetable_slots")
        .select("start_time, end_time, room, subject_id")
        .eq("class_id", identity.classId)
        .eq("day_of_week", dayInt)
        .order("start_time", { ascending: true }) : { data: [] };

      const subjectIds = Array.from(
        new Set((slots ?? []).map((s: { subject_id: string }) => s.subject_id).filter(Boolean))
      ) as string[];

      let subjectMap: Record<string, string> = {};
      if (subjectIds.length > 0) {
        const { data: subjects } = await supabase
          .from("subjects")
          .select("id, name")
          .in("id", subjectIds);
        subjectMap = Object.fromEntries((subjects ?? []).map(s => [s.id, s.name]));
      }

      const todaySlots = (slots ?? []).map((s: { subject_id: string; start_time: string; end_time: string; room: string }) => ({
        subject: subjectMap[s.subject_id] ?? "Lesson",
        start:   s.start_time?.slice(0, 5) ?? "",
        end:     s.end_time?.slice(0, 5)   ?? "",
        room:    s.room ?? "",
      }));

      // My Progress — average % across all exam_results on file
      const { data: examRows } = await supabase
        .from("exam_results")
        .select("marks, total_marks, term, academic_year")
        .eq("student_id", identity.studentId);

      let avgMarksPct: number | null = null;
      if (examRows && examRows.length > 0) {
        const valid = examRows.filter(
          r => typeof r.marks === "number" && typeof r.total_marks === "number" && r.total_marks > 0
        );
        if (valid.length > 0) {
          const pctSum = valid.reduce((sum, r) => sum + (r.marks / r.total_marks) * 100, 0);
          avgMarksPct = Math.round(pctSum / valid.length);
        }
      }

      const fresh: DashData = { attendancePct, totalPresent, totalDays, pendingHW, todaySlots, avgMarksPct };
      writeCache("dashboard", identity.studentId, fresh);
      setData(fresh);
      setLoading(false);
    }

    load();
  }, [identity, idLoading]);

  const isLoading = idLoading || (loading && !data);

  if (isLoading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
      <Skel h={90}  radius={16} />
      <div style={{ display: "flex", gap: 12 }}>
        <Skel h={80} radius={12} />
        <Skel h={80} radius={12} />
        <Skel h={80} radius={12} />
      </div>
      <Skel h={180} radius={16} />
      <Skel h={120} radius={16} />
    </div>
  );

  if (!data || !identity) return null;

  const attColor  = data.attendancePct >= 80 ? "var(--vs-success)" : "var(--vs-warning)";

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>

      {/* Hero */}
      <div style={{
        background:    "linear-gradient(135deg, #1C1A2E 0%, #2D2060 100%)",
        borderRadius:  20,
        padding:       "14px 16px",
        marginBottom:  14,
        color:         "#fff",
      }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600, marginBottom: 2 }}>
          {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>
          {greeting()}, {identity.firstName}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
          {identity.className}{identity.className && identity.schoolName ? " · " : ""}{identity.schoolName}
        </div>
        {identity.admissionNo && (
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
            Adm: {identity.admissionNo}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          {
            label: "Attendance",
            value: `${data.attendancePct}%`,
            sub:   `${data.totalPresent}/${data.totalDays} days`,
            icon:  <IconAttendance />,
            color: attColor,
          },
          {
            label: "My Work",
            value: data.pendingHW > 0 ? `${data.pendingHW}` : "All done",
            sub:   data.pendingHW > 0 ? "pending" : "No pending",
            icon:  <IconWork />,
            color: data.pendingHW > 0 ? "var(--vs-warning)" : "var(--vs-success)",
            href:  "/student/homework",
          },
          {
            label: "My Progress",
            value: data.avgMarksPct !== null ? `${data.avgMarksPct}%` : "—",
            sub:   data.avgMarksPct !== null ? "Average" : "No marks yet",
            icon:  <IconMarks />,
            color: data.avgMarksPct === null
                     ? "var(--vs-muted)"
                     : data.avgMarksPct >= 70 ? "var(--vs-success)"
                     : data.avgMarksPct >= 50 ? "var(--vs-accent)"
                     : "var(--vs-warning)",
            href:  "/student/marks",
          },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => (s as {href?: string}).href && router.push((s as {href?: string}).href!)}
            style={{
              flex:          1,
              background:    "var(--vs-card)",
              border:        "1px solid var(--vs-border)",
              borderRadius:  12,
              padding:       "12px 8px",
              textAlign:     "center",
              cursor:        (s as {href?: string}).href ? "pointer" : "default",
              fontFamily:    "inherit",
            }}
          >
            <div style={{ color: s.color, display: "flex", justifyContent: "center", marginBottom: 4 }}>
              {s.icon}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--vs-muted)", marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: 9, color: "var(--vs-muted)", marginTop: 1 }}>{s.sub}</div>
          </button>
        ))}
      </div>

      {/* Due Today banner */}
      {data.pendingHW > 0 && (
        <button
          onClick={() => router.push("/student/homework")}
          style={{ width: "100%", background: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "1px solid #f59e0b", borderRadius: 14, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: "inherit" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>📚</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#92400e" }}>{data.pendingHW} assignment{data.pendingHW !== 1 ? "s" : ""} pending</div>
              <div style={{ fontSize: 11, color: "#b45309", marginTop: 1 }}>Tap to see your homework</div>
            </div>
          </div>
          <span style={{ fontSize: 18, color: "#b45309" }}>›</span>
        </button>
      )}

      {/* Today timetable */}
      <div style={{
        background:   "var(--vs-card)",
        borderRadius: 16,
        border:       "1px solid var(--vs-border)",
        padding:      16,
        marginBottom: 14,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vs-text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--vs-accent)" }}><IconCalendar /></span>
          My Day
        </div>
        {data.todaySlots.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--vs-muted)", textAlign: "center", padding: "16px 0" }}>
            No lessons scheduled today
          </div>
        ) : (
          data.todaySlots.map((slot, i) => (
            <div
              key={i}
              style={{
                display:      "flex",
                alignItems:   "center",
                gap:          12,
                padding:      "10px 0",
                borderBottom: i < data.todaySlots.length - 1 ? "1px solid var(--vs-border)" : "none",
              }}
            >
              <div style={{ minWidth: 52, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span style={{ color: "var(--vs-accent)" }}><IconClock /></span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--vs-accent)" }}>{slot.start}</span>
                <span style={{ fontSize: 10, color: "var(--vs-muted)" }}>{slot.end}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vs-text)" }}>{slot.subject}</div>
                {slot.room && <div style={{ fontSize: 11, color: "var(--vs-muted)" }}>Room {slot.room}</div>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick links */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {[
          { label: "My Progress", icon: <IconMarks />,    href: "/student/marks"     },
          { label: "Study Room",  icon: <IconWork />,     href: "/student/resources" },
          { label: "My Day",      icon: <IconCalendar />, href: "/student/timetable" },
          { label: "School Fees", icon: <IconAttendance />, href: "/student/fees"    },
        ].map(q => (
          <button
            key={q.label}
            onClick={() => router.push(q.href)}
            style={{
              background:    "var(--vs-card)",
              border:        "1px solid var(--vs-border)",
              borderRadius:  14,
              padding:       "16px 12px",
              display:       "flex",
              alignItems:    "center",
              justifyContent: "space-between",
              cursor:        "pointer",
              fontFamily:    "inherit",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--vs-accent)" }}>{q.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--vs-text)" }}>{q.label}</span>
            </div>
            <span style={{ color: "var(--vs-muted)" }}><IconArrow /></span>
          </button>
        ))}
      </div>

    </div>
  );
}
