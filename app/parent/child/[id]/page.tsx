"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { AttendanceRow, AttendanceStatus } from "@/lib/types";

// ─── Colors ──────────────────────────────────────────────────────────────────
const dark   = "#1e1b4b";
const accent = "#10b981";
const bg     = "#f0f2f5";
const red    = "#ef4444";
const amber  = "#f59e0b";

// ─── Local types ─────────────────────────────────────────────────────────────
interface ChildDetail {
  id:         string;
  name:       string;
  className:  string;
  schoolName: string;
}

interface TimelineItem {
  time:  string;
  icon:  string;
  label: string;
  color: string;
  mock:  boolean;
  noteKey?: string;
}

// ─── Mock data (clearly labeled) ─────────────────────────────────────────────
const MOCK_NOTE_TEXT =
  "James has been engaged and participative this week. Keep encouraging him at home.";

const MOCK_TEACHER = "Mrs. Mwangi";
const MOCK_NOTE_TIME = "Today, 10:30am";

const ENCOURAGEMENT_MSG =
  "Thinking of you today. Keep going, I am proud of you.";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function statusColor(status: AttendanceStatus): string {
  if (status === "present") return accent;
  if (status === "absent")  return red;
  if (status === "late")    return amber;
  return "#6b7280";
}

function statusIcon(status: AttendanceStatus): string {
  if (status === "present") return "✅";
  if (status === "absent")  return "❌";
  if (status === "late")    return "⏰";
  return "📋";
}

function heroHeadline(name: string, rows: AttendanceRow[]): string {
  const first = name.split(" ")[0];
  if (rows.some(r => r.status === "present")) return `${first} is at school today ✓`;
  if (rows.some(r => r.status === "absent"))  return `${first} was marked absent today`;
  return "No attendance recorded yet today";
}

function heroColor(rows: AttendanceRow[]): string {
  if (rows.some(r => r.status === "present")) return accent;
  if (rows.some(r => r.status === "absent"))  return red;
  return "#6b7280";
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 16, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
      flexShrink: 0,
    }} />
  );
}

function LoadingState() {
  return (
    <div style={{ animation: "fadeIn 0.2s ease" }}>
      {/* Hero skeleton */}
      <div style={{ background: "#fff", borderRadius: 20, padding: 24, marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <Skeleton w={72} h={72} radius={36} />
        <Skeleton w={140} h={16} />
        <Skeleton w={100} h={11} />
        <Skeleton w={180} h={13} />
      </div>
      {/* Timeline skeleton */}
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center" }}>
          <Skeleton w={44} h={11} />
          <Skeleton w={24} h={24} radius={12} />
          <Skeleton w="60%" h={13} />
        </div>
      ))}
    </div>
  );
}

function EncouragementModal({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 900,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: "20px 20px 0 0",
          padding: "28px 24px 40px",
          width: "100%", maxWidth: 768,
          animation: "slideIn 0.22s ease",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: dark, marginBottom: 12 }}>
          Send Encouragement 💌
        </div>
        <div style={{
          background: bg, borderRadius: 12, padding: "14px 16px",
          fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 20,
          border: "1px solid #e5e7eb",
        }}>
          {ENCOURAGEMENT_MSG}
        </div>
        <button
          onClick={onClose}
          style={{
            width: "100%", padding: 14, borderRadius: 12,
            border: "none", background: accent, color: "#fff",
            fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Send to {name.split(" ")[0]}
        </button>
      </div>
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  return (
    <div style={{
      position: "fixed", bottom: 140, left: "50%",
      transform: "translateX(-50%)",
      background: dark, color: "#fff",
      padding: "11px 22px", borderRadius: 12,
      fontSize: 13, fontWeight: 600,
      zIndex: 9999, animation: "fadeIn 0.2s ease",
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
      whiteSpace: "nowrap",
    }}>
      {msg}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ChildDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id     = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [loading,              setLoading]              = useState(true);
  const [child,                setChild]                = useState<ChildDetail | null>(null);
  const [todayRows,            setTodayRows]            = useState<AttendanceRow[]>([]);
  const [termPct,              setTermPct]              = useState<number | null>(null);
  const [noteExpanded,         setNoteExpanded]         = useState(false);
  const [showEncouragement,    setShowEncouragement]    = useState(false);
  const [toastMsg,             setToastMsg]             = useState<string | null>(null);
  const [noteInlineExpanded,   setNoteInlineExpanded]   = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/academy/signin?role=parent"); return; }

    // Student
    const { data: student } = await supabase
      .from("students")
      .select("id, name, class_id")
      .eq("id", id)
      .single();

    if (!student) { setLoading(false); return; }

    // Class
    const { data: cls } = await supabase
      .from("classes")
      .select("id, name, stream, school_id")
      .eq("id", student.class_id)
      .single();

    // School
    const { data: school } = await supabase
      .from("schools")
      .select("id, name")
      .eq("id", cls?.school_id ?? "")
      .single();

    const className = cls
      ? cls.name + (cls.stream ? " " + cls.stream : "")
      : "—";

    setChild({
      id:         student.id,
      name:       student.name,
      className,
      schoolName: school?.name ?? "—",
    });

    // Todays attendance
    const { data: todayAtt } = await supabase
      .from("attendance")
      .select("id, class_id, student_id, date, status, timetable_slot_id")
      .eq("student_id", id)
      .eq("date", todayStr());

    setTodayRows((todayAtt ?? []) as AttendanceRow[]);

    // All attendance for term percentage
    const { data: allAtt } = await supabase
      .from("attendance")
      .select("id, status")
      .eq("student_id", id);

    const total   = allAtt?.length ?? 0;
    const present = allAtt?.filter(r => r.status === "present").length ?? 0;
    setTermPct(total > 0 ? Math.round((present / total) * 100) : null);

    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Build timeline ──────────────────────────────────────────────────────────
  const realItems: TimelineItem[] = todayRows.map(row => ({
    time:  row.date ? "Today" : "—",
    icon:  statusIcon(row.status as AttendanceStatus),
    label: `Marked ${row.status}`,
    color: statusColor(row.status as AttendanceStatus),
    mock:  false,
  }));

  // MOCK timeline items
  const mockItems: TimelineItem[] = [
    {
      time:    "Due today",
      icon:    "📝",
      label:   "Homework due — Maths",
      color:   "#6b7280",
      mock:    true,
    },
    {
      time:    "10:30am",
      icon:    "💬",
      label:   "Teacher left a note — tap to read",
      color:   dark,
      mock:    true,
      noteKey: "teacher-note",
    },
  ];

  const timelineItems: TimelineItem[] =
    realItems.length > 0
      ? [...realItems, ...mockItems]
      : [
          // MOCK example shown when no real attendance today
          {
            time:  "Example",
            icon:  "✅",
            label: "Marked present (example — no data yet today)",
            color: accent,
            mock:  true,
          },
          ...mockItems,
        ];

  // ── Quick actions ───────────────────────────────────────────────────────────
  const isAbsentToday = todayRows.some(r => r.status === "absent");

  if (loading) return <LoadingState />;
  if (!child)  return (
    <div style={{ textAlign: "center", padding: 40, color: "#6b7280", fontSize: 14 }}>
      Child not found.
    </div>
  );

  const firstName = child.name.split(" ")[0];

  return (
    <div style={{ animation: "slideIn 0.22s ease", paddingBottom: 120 }}>

      {/* ── HERO ── */}
      <div style={{
        background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`,
        borderRadius: 20, padding: "24px 20px",
        marginBottom: 20, color: "#fff",
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", gap: 6,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 30, fontWeight: 900, color: "#fff",
          marginBottom: 4,
          boxShadow: "0 4px 18px rgba(16,185,129,0.4)",
        }}>
          {child.name[0].toUpperCase()}
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.4 }}>
          {child.name}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
          {child.className} &middot; {child.schoolName}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
          {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <div style={{
          marginTop: 10, fontSize: 13, fontWeight: 700,
          color: heroColor(todayRows),
          background: "rgba(255,255,255,0.1)",
          borderRadius: 20, padding: "6px 16px",
        }}>
          {heroHeadline(child.name, todayRows)}
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        {[
          {
            label: "💬 Message Teacher",
            onClick: () => router.push("/parent/connect"),
            always: true,
          },
          {
            label: "📞 Call School",
            onClick: () => { window.location.href = "tel:"; },
            always: isAbsentToday,
          },
          {
            label: "📚 View Homework",
            onClick: () => showToast("Coming soon"),
            always: true,
          },
          {
            label: "❤️ Send Encouragement",
            onClick: () => setShowEncouragement(true),
            always: true,
          },
        ]
          .filter(a => a.always)
          .map(a => (
            <button
              key={a.label}
              onClick={a.onClick}
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                borderRadius: 20,
                border: `1.5px solid ${dark}`,
                background: "#fff",
                color: dark,
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {a.label}
            </button>
          ))}
      </div>

      {/* ── TODAY TIMELINE ── */}
      <div style={{
        background: "#fff", borderRadius: 16,
        border: "1px solid #e5e7eb",
        padding: "18px 16px", marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: dark, marginBottom: 16 }}>
          {"Today's Timeline"}
        </div>

        {timelineItems.map((item, i) => (
          <div key={i}>
            <div
              onClick={() => item.noteKey === "teacher-note" && setNoteInlineExpanded(p => !p)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                marginBottom: 16, cursor: item.noteKey ? "pointer" : "default",
              }}
            >
              {/* Time */}
              <div style={{ width: 52, fontSize: 10, color: "#9ca3af", fontWeight: 600, paddingTop: 3, flexShrink: 0, textAlign: "right" }}>
                {item.time}
              </div>

              {/* Line + dot */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: item.color + "18",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14,
                }}>
                  {item.icon}
                </div>
                {i < timelineItems.length - 1 && (
                  <div style={{ width: 2, height: 20, background: "#f3f4f6", marginTop: 2 }} />
                )}
              </div>

              {/* Label */}
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: item.color, lineHeight: 1.4 }}>
                  {item.label}
                </div>
                {item.mock && (
                  <div style={{ fontSize: 10, color: "#d1d5db", marginTop: 1 }}>mock data</div>
                )}
              </div>
            </div>

            {/* Inline note expansion */}
            {item.noteKey === "teacher-note" && noteInlineExpanded && (
              <div style={{
                marginLeft: 92, marginTop: -8, marginBottom: 16,
                background: "#f0fdf4", borderRadius: 10, padding: "10px 12px",
                fontSize: 13, color: "#065f46", lineHeight: 1.6,
                border: "1px solid #d1fae5",
                animation: "fadeIn 0.18s ease",
              }}>
                {MOCK_NOTE_TEXT}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── TEACHER NOTE CARD ── */}
      <div style={{
        background: "#fff", borderRadius: 16,
        border: "1px solid #e5e7eb",
        padding: "16px", marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "#ede9fe",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, flexShrink: 0,
          }}>
            👩‍🏫
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>{MOCK_TEACHER}</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{MOCK_NOTE_TIME} &middot; mock data</div>
          </div>
        </div>

        <div style={{
          fontSize: 13, color: "#374151", lineHeight: 1.6,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: noteExpanded ? undefined : 2,
          WebkitBoxOrient: "vertical" as const,
        }}>
          {MOCK_NOTE_TEXT}
        </div>

        {!noteExpanded && (
          <div
            onClick={() => setNoteExpanded(true)}
            style={{ fontSize: 12, fontWeight: 700, color: accent, marginTop: 6, cursor: "pointer" }}
          >
            Read more
          </div>
        )}
      </div>

      {/* ── TERM SNAPSHOT ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <div style={{
          flex: 1, background: "#fff", borderRadius: 14,
          border: "1px solid #e5e7eb", padding: "14px 12px",
          textAlign: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: accent }}>
            {termPct !== null ? `${termPct}%` : "—"}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginTop: 2 }}>
            Attendance this term
          </div>
        </div>
        <div style={{
          flex: 1, background: "#fff", borderRadius: 14,
          border: "1px solid #e5e7eb", padding: "14px 12px",
          textAlign: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#9ca3af" }}>—</div>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginTop: 2 }}>
            Homework submitted
          </div>
          <div style={{ fontSize: 10, color: "#d1d5db", marginTop: 1 }}>Coming soon</div>
        </div>
      </div>

      {/* ── ENCOURAGEMENT MODAL ── */}
      {showEncouragement && (
        <EncouragementModal
          name={child.name}
          onClose={() => {
            setShowEncouragement(false);
            showToast(`Encouragement sent to ${firstName}`);
          }}
        />
      )}

      {/* ── TOAST ── */}
      {toastMsg && <Toast msg={toastMsg} />}
    </div>
  );
}
