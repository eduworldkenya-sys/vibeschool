"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { nairobiDayOfWeek } from "@/lib/time";
import LessonPlanModal from "@/components/teacher/LessonPlanModal";
import type { TimetableSlot } from "@/lib/types";

// ── Design tokens (exact match to ui.tsx C object) ───────────────────────────
const C = {
  bg:          "#f0f2f5",
  surface:     "#ffffff",
  surface2:    "#f8f9fa",
  accent:      "#10b981",
  accentLight: "#d1fae5",
  dark:        "#1e1b4b",
  border:      "#e5e7eb",
  textPrimary: "#111827",
  textMuted:   "#6b7280",
  error:       "#ef4444",
  warning:     "#f59e0b",
  amber:       "#d97706",
  amberLight:  "#fef3c7",
  indigo:      "#4f46e5",
  indigoLight: "#ede9fe",
  red:         "#e11d48",
  redLight:    "#ffe4e6",
} as const;

interface TeacherSubject {
  subject_id:   string;
  subject_name: string;
  class_id:     string;
  class_name:   string;
  class_stream: string | null;
}

interface TodaySlot {
  slot_id:    string;
  subject_id: string;
  class_id:   string;
  subject:    string;
  class:      string;
  start:      string;
  end:        string;
  room:       string;
  plan_id:    string | null;
  plan_topic: string | null;
  plan_status: "draft" | "published" | "shared_to_parents" | null;
}

interface SubjectStream {
  subject_id:    string;
  subject_name:  string;
  classes:       { id: string; name: string; stream: string | null }[];
  lesson_count:  number;
  note_count:    number;
  assess_count:  number;
  mastered_pct:  number | null;
  coverage_pct:  number | null;
}

interface TermPulse {
  lesson_count:   number;
  note_count:     number;
  assess_count:   number;
  at_risk_count:  number;
  tpad_evidence:  number;
  coverage_pct:   number | null;
}

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return (h % 12 || 12) + ":" + String(m).padStart(2, "0") + " " + ampm;
}

function termStart(): string {
  const n = new Date();
  const y = n.getFullYear();
  const mo = n.getMonth() + 1;
  if (mo <= 4) return `${y}-01-06`;
  if (mo <= 8) return `${y}-05-05`;
  return `${y}-09-01`;
}

function currentTermNum(): number {
  const mo = new Date().getMonth() + 1;
  if (mo <= 4) return 1;
  if (mo <= 8) return 2;
  return 3;
}

function barColor(pct: number): string {
  return pct >= 70 ? C.accent : pct >= 40 ? C.amber : C.red;
}

function planStatusMeta(status: TodaySlot["plan_status"]): {
  label: string; bg: string; color: string
} {
  if (status === "published" || status === "shared_to_parents")
    return { label: "Ready",   bg: C.accentLight, color: "#065f46" };
  if (status === "draft")
    return { label: "Draft",   bg: C.amberLight,  color: "#92400e" };
  return     { label: "No Plan", bg: C.redLight,    color: "#9f1239" };
}

function workflowStep(sub: SubjectStream): "scheme" | "plan" | "notes" | "assess" | "complete" {
  if (sub.lesson_count === 0)  return "scheme";
  if (sub.note_count   === 0)  return "notes";
  if (sub.assess_count === 0)  return "assess";
  return "complete";
}

const STEP_META: Record<string, { label: string; icon: string; route: string; color: string }> = {
  scheme:   { label: "Start your scheme",     icon: "\u{1F4CB}", route: "/teacher/scheme",      color: C.indigo },
  plan:     { label: "Write a lesson plan",   icon: "\u{1F4D6}", route: "/teacher/lessonplan",  color: "#7c3aed" },
  notes:    { label: "Record lesson notes",   icon: "\u{1F4DD}", route: "/teacher/lessonnotes", color: C.accent  },
  assess:   { label: "Record an assessment",  icon: "\u{1F4CA}", route: "/teacher/assessment",  color: C.amber   },
  complete: { label: "Looking good",          icon: "\u2713",    route: "",                     color: C.accent  },
};

function Skel({ h = 56, radius = 14 }: { h?: number; radius?: number }) {
  return (
    <div style={{
      height: h, borderRadius: radius,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
    }} />
  );
}

function MiniBar({ pct, color, h = 5 }: { pct: number; color: string; h?: number }) {
  return (
    <div style={{ width: "100%", height: h, borderRadius: 99, background: C.border, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: color, transition: "width 0.5s ease" }} />
    </div>
  );
}

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, color: C.textMuted,
      letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 12,
    }}>{children}</div>
  );
}

function SlotCard({
  slot, onOpenPlan, router,
}: {
  slot: TodaySlot;
  onOpenPlan: (slot: TimetableSlot) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const meta = planStatusMeta(slot.plan_status);

  function toTimetableSlot(): TimetableSlot {
    return {
      id:               slot.slot_id,
      class_id:         slot.class_id,
      subject_id:       slot.subject_id,
      subject:          slot.subject,
      class:            slot.class,
      room:             slot.room,
      start:            slot.start,
      end:              slot.end,
      period:           0,
      status:           "scheduled",
      planStatus:       slot.plan_status ? (slot.plan_status === "draft" ? "amber" : "green") : "red",
      attendanceMarked: false,
    };
  }

  return (
    <div style={{
      background: C.surface, borderRadius: 16,
      border: `1px solid ${C.border}`,
      padding: "14px 16px", marginBottom: 10,
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary }}>
            {slot.plan_topic || slot.subject}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
            {slot.subject} · {slot.class}
            {slot.room ? ` · ${slot.room}` : ""}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, fontWeight: 600 }}>
            {fmt12(slot.start)} – {fmt12(slot.end)}
          </div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 800,
          padding: "4px 11px", borderRadius: 20,
          background: meta.bg, color: meta.color,
          flexShrink: 0, marginLeft: 10,
        }}>
          {meta.label}
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button
          onClick={() => onOpenPlan(toTimetableSlot())}
          style={{
            flex: 1, padding: "9px 0", borderRadius: 10,
            border: "none",
            background: slot.plan_status ? C.indigoLight : C.accentLight,
            color: slot.plan_status ? C.indigo : "#065f46",
            fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {slot.plan_id ? "\u{1F4DD} Open Plan" : "\u2736 Create Plan"}
        </button>
        <button
          onClick={() => router.push(
            `/teacher/lessonnotes?subjectId=${slot.subject_id}&classId=${slot.class_id}`
          )}
          style={{
            padding: "9px 14px", borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.surface2, color: C.textMuted,
            fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Notes
        </button>
      </div>
    </div>
  );
}

function SubjectStreamCard({
  sub, router,
}: {
  sub: SubjectStream;
  router: ReturnType<typeof useRouter>;
}) {
  const [open, setOpen] = useState(false);
  const step = workflowStep(sub);
  const stepMeta = STEP_META[step];

  const classLabel = sub.classes
    .map(c => c.name + (c.stream ? " " + c.stream : ""))
    .join(", ");

  const mp = sub.mastered_pct;
  const statusColor = mp === null ? C.textMuted : mp >= 70 ? C.accent : mp >= 40 ? C.amber : C.red;
  const statusLabel = mp === null ? "No data" : mp >= 70 ? "On Track" : mp >= 40 ? "Watch" : "Alert";

  const wfSteps: { key: string; label: string; done: boolean }[] = [
    { key: "scheme", label: "Scheme",   done: true },
    { key: "plan",   label: "Plan",     done: sub.lesson_count > 0 },
    { key: "notes",  label: "Taught",   done: sub.note_count > 0   },
    { key: "assess", label: "Assessed", done: sub.assess_count > 0  },
  ];

  return (
    <div style={{
      background: C.surface, borderRadius: 18,
      border: `1px solid ${open ? C.indigo + "55" : C.border}`,
      marginBottom: 12, overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      transition: "border-color 0.2s",
    }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "16px", cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary }}>
              {sub.subject_name}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              {classLabel}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 800,
              padding: "3px 10px", borderRadius: 20,
              background: mp === null ? C.surface2 : mp >= 70 ? C.accentLight : mp >= 40 ? C.amberLight : C.redLight,
              color: statusColor,
            }}>
              {statusLabel}
            </div>
            <div style={{
              fontSize: 18, color: C.textMuted,
              transform: open ? "rotate(90deg)" : "none",
              transition: "transform 0.2s",
            }}>\u203A</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, marginTop: 12, alignItems: "center" }}>
          {wfSteps.map((ws, i) => (
            <div key={ws.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                fontSize: 9, fontWeight: 800,
                padding: "3px 8px", borderRadius: 20,
                background: ws.done ? C.accentLight : C.surface2,
                color: ws.done ? "#065f46" : C.textMuted,
              }}>
                {ws.done ? "\u2713 " : ""}{ws.label}
              </div>
              {i < wfSteps.length - 1 && (
                <div style={{ fontSize: 9, color: C.border, fontWeight: 800 }}>\u2192</div>
              )}
            </div>
          ))}
        </div>

        {sub.coverage_pct !== null && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>Term Coverage</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: barColor(sub.coverage_pct) }}>
                {sub.coverage_pct}%
              </span>
            </div>
            <MiniBar pct={sub.coverage_pct} color={barColor(sub.coverage_pct)} />
          </div>
        )}
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 16px", background: C.surface2 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Plans",    value: sub.lesson_count },
              { label: "Notes",    value: sub.note_count   },
              { label: "Assessed", value: sub.assess_count },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, background: C.surface, borderRadius: 12,
                padding: "10px 8px", textAlign: "center",
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.textPrimary }}>{s.value}</div>
                <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {step !== "complete" && (
            <button
              onClick={() => {
                const subjectId = sub.subject_id;
                const classId = sub.classes[0]?.id ?? "";
                const base = stepMeta.route;
                const url = classId
                  ? `${base}?subjectId=${subjectId}&classId=${classId}`
                  : `${base}?subjectId=${subjectId}`;
                router.push(url);
              }}
              style={{
                width: "100%", padding: "12px 0",
                borderRadius: 12, border: "none",
                background: C.dark, color: "#fff",
                fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: 8,
                marginBottom: 10,
              }}
            >
              <span>{stepMeta.icon}</span>
              <span>{stepMeta.label}</span>
            </button>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[
              { label: "Scheme",     icon: "\u{1F4CB}", route: `/teacher/scheme?subjectId=${sub.subject_id}&classId=${sub.classes[0]?.id ?? ""}` },
              { label: "Plans",      icon: "\u{1F4D6}", route: `/teacher/lessonplan?subjectId=${sub.subject_id}&classId=${sub.classes[0]?.id ?? ""}` },
              { label: "Notes",      icon: "\u{1F4DD}", route: `/teacher/lessonnotes?subjectId=${sub.subject_id}&classId=${sub.classes[0]?.id ?? ""}` },
              { label: "Assessment", icon: "\u{1F4CA}", route: `/teacher/assessment?subjectId=${sub.subject_id}&classId=${sub.classes[0]?.id ?? ""}` },
              { label: "Resources",  icon: "\u{1F30D}", route: `/teacher/resources?subjectId=${sub.subject_id}` },
              { label: "TPAD",       icon: "\u{1F3C5}", route: `/teacher/tpad` },
            ].map(a => (
              <button
                key={a.label}
                onClick={() => router.push(a.route)}
                style={{
                  padding: "11px 4px", borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  background: C.surface,
                  cursor: "pointer", fontFamily: "inherit",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 5,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <span style={{ fontSize: 18 }}>{a.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, textAlign: "center" }}>
                  {a.label}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => router.push(`/teacher/subjecthub?subjectId=${sub.subject_id}`)}
            style={{
              width: "100%", marginTop: 10, padding: "10px",
              borderRadius: 12, border: `1px solid ${C.border}`,
              background: C.surface, color: C.textMuted,
              fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Manage in SubjectHub \u2192
          </button>
        </div>
      )}
    </div>
  );
}

function TermPulseStrip({
  pulse, loading, router,
}: {
  pulse: TermPulse | null;
  loading: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      background: C.dark, borderRadius: 18,
      padding: open ? "16px" : "14px 16px",
      marginBottom: 20,
      boxShadow: "0 2px 12px rgba(30,27,75,0.18)",
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase" }}>
            Term {currentTermNum()} Health
          </div>
          {!loading && pulse && (
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginTop: 3 }}>
              {pulse.lesson_count} plans \u00B7 {pulse.note_count} notes \u00B7 {pulse.assess_count} assessed
              {pulse.at_risk_count > 0 && (
                <span style={{ color: "#fca5a5", marginLeft: 8 }}>
                  \u26A0 {pulse.at_risk_count} at risk
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 18, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
          \u203A
        </div>
      </div>

      {open && !loading && pulse && (
        <div style={{ marginTop: 16 }}>
          {pulse.coverage_pct !== null && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>Curriculum Coverage</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: barColor(pulse.coverage_pct) }}>{pulse.coverage_pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                <div style={{ width: `${pulse.coverage_pct}%`, height: "100%", borderRadius: 99, background: barColor(pulse.coverage_pct), transition: "width 0.5s" }} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[
              { label: "TPAD Evidence", value: pulse.tpad_evidence, color: "#a5b4fc" },
              { label: "At Risk",       value: pulse.at_risk_count, color: pulse.at_risk_count > 0 ? "#fca5a5" : "#bbf7d0" },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, background: "rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "10px 12px", textAlign: "center",
              }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => router.push("/teacher/academics")}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 12,
                border: "none", background: "rgba(255,255,255,0.12)",
                color: "#fff", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Full Academics \u2192
            </button>
            <button
              onClick={() => router.push("/teacher/tpad")}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 12,
                border: "none", background: "rgba(165,180,252,0.18)",
                color: "#a5b4fc", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Open TPAD \u2192
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeachOSPage() {
  const router = useRouter();

  const [loading,        setLoading]        = useState(true);
  const [todaySlots,     setTodaySlots]     = useState<TodaySlot[]>([]);
  const [streams,        setStreams]        = useState<SubjectStream[]>([]);
  const [pulse,          setPulse]          = useState<TermPulse | null>(null);
  const [activePlanSlot, setActivePlanSlot] = useState<TimetableSlot | null>(null);
  const [teacherName,    setTeacherName]    = useState("");
  const [noSubjects,     setNoSubjects]     = useState(false);

  const userIdRef   = useRef<string | null>(null);
  const schoolIdRef = useRef<string | null>(null);

  const boot = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/?role=teacher"); return; }
      userIdRef.current = user.id;

      const [memberRes, teacherRes, profileRes] = await Promise.all([
        supabase.from("school_members").select("school_id").eq("profile_id", user.id).maybeSingle(),
        supabase.from("teacher_profiles").select("school_id").eq("profile_id", user.id).maybeSingle(),
        supabase.from("profiles").select("school_id, full_name").eq("id", user.id).single(),
      ]);
      const schoolId =
        memberRes.data?.school_id ??
        teacherRes.data?.school_id ??
        profileRes.data?.school_id ??
        null;
      schoolIdRef.current = schoolId;
      const rawName = (profileRes.data as { full_name?: string } | null)?.full_name ?? "";
      setTeacherName(rawName.trim().split(" ")[0] || "");

      const { data: tcRows } = await supabase
        .from("teacher_classes")
        .select("class_id, subject_id")
        .eq("teacher_id", user.id);

      const tc = (tcRows ?? []) as { class_id: string; subject_id: string }[];
      if (tc.length === 0) { setNoSubjects(true); setLoading(false); return; }

      const subjectIds = Array.from(new Set(tc.map(r => r.subject_id).filter(Boolean)));
      const classIds   = Array.from(new Set(tc.map(r => r.class_id).filter(Boolean)));

      const tStart  = termStart();
      const tNum    = currentTermNum();
      const tYear   = new Date().getFullYear();
      const todayDow = nairobiDayOfWeek();

      const [
        subjRes, clsRes, slotsRes, plansRes, notesRes,
        assessRes, atRiskRes, evidRes,
      ] = await Promise.allSettled([
        supabase.from("subjects").select("id, name").in("id", subjectIds),
        supabase.from("classes").select("id, name, stream").in("id", classIds),
        supabase
          .from("timetable_slots")
          .select("id, start_time, end_time, room, class_id, subject_id, day_of_week")
          .eq("teacher_id", user.id)
          .eq("day_of_week", todayDow)
          .order("start_time", { ascending: true }),
        supabase
          .from("lesson_plans")
          .select("id, class_id, subject_id, topic, status, week_start, day_of_week")
          .eq("teacher_id", user.id)
          .gte("week_start", tStart),
        supabase
          .from("lesson_notes")
          .select("id, class_id, subject_id")
          .eq("teacher_id", user.id)
          .gte("taught_date", tStart),
        schoolId
          ? supabase.from("cbc_assessments").select("id, subject_id, student_id, performance")
              .eq("teacher_id", user.id).eq("school_id", schoolId).eq("term", tNum).eq("academic_year", tYear)
          : supabase.from("cbc_assessments").select("id, subject_id, student_id, performance")
              .eq("teacher_id", user.id).eq("term", tNum).eq("academic_year", tYear),
        schoolId
          ? supabase.from("cbc_assessments").select("student_id")
              .eq("teacher_id", user.id).eq("school_id", schoolId).eq("term", tNum).eq("academic_year", tYear).eq("performance", "below_expectation")
          : supabase.from("cbc_assessments").select("student_id")
              .eq("teacher_id", user.id).eq("term", tNum).eq("academic_year", tYear).eq("performance", "below_expectation"),
        supabase.from("tpad_evidence").select("id").eq("teacher_id", user.id),
      ]);

      type SubRow  = { id: string; name: string };
      type ClsRow  = { id: string; name: string; stream: string | null };
      type SlotRow = { id: string; start_time: string; end_time: string; room: string | null; class_id: string; subject_id: string; day_of_week: number };
      type PlanRow = { id: string; class_id: string; subject_id: string; topic: string | null; status: string; week_start: string; day_of_week: number };
      type NoteRow = { id: string; class_id: string | null; subject_id: string | null };
      type AssRow  = { id: string; subject_id: string; student_id: string; performance: string };
      type RiskRow = { student_id: string };
      type EvidRow = { id: string };

      const subjects    = (subjRes.status    === "fulfilled" ? subjRes.value.data    ?? [] : []) as SubRow[];
      const classes     = (clsRes.status     === "fulfilled" ? clsRes.value.data     ?? [] : []) as ClsRow[];
      const slots       = (slotsRes.status   === "fulfilled" ? slotsRes.value.data   ?? [] : []) as SlotRow[];
      const plans       = (plansRes.status   === "fulfilled" ? plansRes.value.data   ?? [] : []) as PlanRow[];
      const notes       = (notesRes.status   === "fulfilled" ? notesRes.value.data   ?? [] : []) as NoteRow[];
      const assessments = (assessRes.status  === "fulfilled" ? assessRes.value.data  ?? [] : []) as AssRow[];
      const riskRows    = (atRiskRes.status  === "fulfilled" ? atRiskRes.value.data  ?? [] : []) as RiskRow[];
      const evidRows    = (evidRes.status    === "fulfilled" ? evidRes.value.data    ?? [] : []) as EvidRow[];

      const subjMap = Object.fromEntries(subjects.map(s => [s.id, s.name]));
      const clsMap  = Object.fromEntries(classes.map(c => [c.id, { name: c.name, stream: c.stream }]));

      const planMap = new Map<string, PlanRow>();
      for (const p of plans) {
        planMap.set(`${p.class_id}:${p.subject_id}:${p.day_of_week}`, p);
      }

      const todayList: TodaySlot[] = slots.map(s => {
        const plan = planMap.get(`${s.class_id}:${s.subject_id}:${s.day_of_week}`) ?? null;
        const cls  = clsMap[s.class_id];
        return {
          slot_id:     s.id,
          subject_id:  s.subject_id,
          class_id:    s.class_id,
          subject:     subjMap[s.subject_id] ?? "Unknown",
          class:       cls ? cls.name + (cls.stream ? " " + cls.stream : "") : "",
          start:       s.start_time,
          end:         s.end_time,
          room:        s.room ?? "",
          plan_id:     plan?.id ?? null,
          plan_topic:  plan?.topic ?? null,
          plan_status: plan ? (plan.status as TodaySlot["plan_status"]) : null,
        };
      });
      setTodaySlots(todayList);

      const subClassMap: Record<string, string[]> = {};
      for (const r of tc) {
        if (!subClassMap[r.subject_id]) subClassMap[r.subject_id] = [];
        if (!subClassMap[r.subject_id].includes(r.class_id))
          subClassMap[r.subject_id].push(r.class_id);
      }

      const planCountBySubject:   Record<string, number> = {};
      const noteCountBySubject:   Record<string, number> = {};
      const assessCountBySubject: Record<string, number> = {};
      const masteryBySubject:     Record<string, { met: number; total: number }> = {};

      for (const p of plans)
        planCountBySubject[p.subject_id] = (planCountBySubject[p.subject_id] ?? 0) + 1;
      for (const n of notes)
        if (n.subject_id) noteCountBySubject[n.subject_id] = (noteCountBySubject[n.subject_id] ?? 0) + 1;
      for (const a of assessments) {
        assessCountBySubject[a.subject_id] = (assessCountBySubject[a.subject_id] ?? 0) + 1;
        if (!masteryBySubject[a.subject_id]) masteryBySubject[a.subject_id] = { met: 0, total: 0 };
        masteryBySubject[a.subject_id].total++;
        if (a.performance === "meets_expectation" || a.performance === "exceeds_expectation")
          masteryBySubject[a.subject_id].met++;
      }

      const streamList: SubjectStream[] = subjects.map(sub => {
        const myClassIds = subClassMap[sub.id] ?? [];
        const m = masteryBySubject[sub.id];
        const masteredPct = m && m.total > 0 ? Math.round((m.met / m.total) * 100) : null;
        return {
          subject_id:   sub.id,
          subject_name: sub.name,
          classes:      myClassIds.map(cid => ({
            id:     cid,
            name:   clsMap[cid]?.name   ?? "",
            stream: clsMap[cid]?.stream ?? null,
          })),
          lesson_count: planCountBySubject[sub.id]   ?? 0,
          note_count:   noteCountBySubject[sub.id]   ?? 0,
          assess_count: assessCountBySubject[sub.id] ?? 0,
          mastered_pct: masteredPct,
          coverage_pct: null,
        };
      });
      setStreams(streamList);

      const allMastery = Object.values(masteryBySubject);
      const avgMastery = allMastery.length > 0
        ? Math.round(allMastery.reduce((s, m) => s + (m.total > 0 ? (m.met / m.total) * 100 : 0), 0) / allMastery.length)
        : null;

      setPulse({
        lesson_count:  plans.length,
        note_count:    notes.length,
        assess_count:  assessments.length,
        at_risk_count: new Set(riskRows.map(r => r.student_id)).size,
        tpad_evidence: evidRows.length,
        coverage_pct:  avgMastery,
      });

    } catch (err) {
      console.error("[TeachOS] boot", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { boot(); }, [boot]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayLabel = new Intl.DateTimeFormat("en-KE", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: "Africa/Nairobi",
  }).format(new Date());

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
      `}</style>

      <div style={{ animation: "fadeUp 0.25s ease" }}>

        <div style={{
          background: `linear-gradient(135deg, ${C.dark} 0%, #312e81 60%, #4338ca 140%)`,
          borderRadius: 20, padding: "20px 20px 22px",
          marginBottom: 20, color: "#fff",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -40, right: -40,
            width: 140, height: 140, borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
          }} />
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>
            {greeting}{teacherName ? `, ${teacherName}` : ""}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>Teach</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{todayLabel}</div>
          {!loading && (
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              {todaySlots.length > 0 && (
                <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700 }}>
                  \u{1F4DA} {todaySlots.length} lesson{todaySlots.length !== 1 ? "s" : ""} today
                </div>
              )}
              {todaySlots.filter(s => !s.plan_id).length > 0 && (
                <div style={{ background: "rgba(239,68,68,0.2)", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: "#fca5a5" }}>
                  \u26A0 {todaySlots.filter(s => !s.plan_id).length} plan{todaySlots.filter(s => !s.plan_id).length !== 1 ? "s" : ""} missing
                </div>
              )}
              {todaySlots.length === 0 && (
                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 20, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  No timetable slots today
                </div>
              )}
            </div>
          )}
        </div>

        <TermPulseStrip pulse={pulse} loading={loading} router={router} />

        {(loading || todaySlots.length > 0) && (
          <div style={{ marginBottom: 24 }}>
            <SLabel>Today \u00B7 {DAY_NAMES[nairobiDayOfWeek()]}</SLabel>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2].map(i => <Skel key={i} h={110} />)}
              </div>
            ) : (
              todaySlots.map(slot => (
                <SlotCard key={slot.slot_id} slot={slot} onOpenPlan={setActivePlanSlot} router={router} />
              ))
            )}
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <SLabel>My Subjects</SLabel>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map(i => <Skel key={i} h={100} />)}
            </div>
          ) : noSubjects ? (
            <div style={{
              background: C.surface, borderRadius: 18,
              border: `1.5px dashed ${C.border}`,
              padding: "36px 20px", textAlign: "center",
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>\u{1F4DA}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>No subjects yet</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
                Claim your subjects in SubjectHub to start teaching.
              </div>
              <button
                onClick={() => router.push("/teacher/subjecthub")}
                style={{
                  padding: "11px 24px", borderRadius: 12, border: "none",
                  background: C.dark, color: "#fff",
                  fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Open SubjectHub \u2192
              </button>
            </div>
          ) : (
            streams.map(sub => (
              <SubjectStreamCard key={sub.subject_id} sub={sub} router={router} />
            ))
          )}
        </div>

        {!loading && streams.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SLabel>Planning Tools</SLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Scheme of Work", icon: "\u{1F4CB}", bg: "#075985", route: "/teacher/scheme" },
                { label: "Lesson Planner", icon: "\u{1F4D6}", bg: "#6d28d9", route: "/teacher/lessonplan" },
                { label: "Lesson Notes",   icon: "\u{1F4DD}", bg: "#065f46", route: "/teacher/lessonnotes" },
                { label: "Resources",      icon: "\u{1F30D}", bg: "#0f766e", route: "/teacher/resources" },
              ].map(a => (
                <button
                  key={a.label}
                  onClick={() => router.push(a.route)}
                  style={{
                    padding: "16px 12px", borderRadius: 16,
                    border: "none", background: a.bg,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", flexDirection: "column",
                    alignItems: "flex-start", gap: 8,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  }}
                >
                  <span style={{ fontSize: 24 }}>{a.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {activePlanSlot && (
        <LessonPlanModal
          slot={activePlanSlot}
          onClose={() => { setActivePlanSlot(null); boot(); }}
        />
      )}
    </>
  );
}
