"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { AttendanceRow, AttendanceStatus } from "@/lib/types";

// ─── Colors ───────────────────────────────────────────────────────────────────
const dark   = "#1e1b4b";
const accent = "#10b981";
const bg     = "#f0f2f5";
const red    = "#ef4444";
const amber  = "#f59e0b";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChildDetail {
  id:         string;
  name:       string;
  className:  string;
  schoolName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function firstName(name: string): string {
  return name.split(" ")[0];
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

function statusLabel(status: AttendanceStatus, name: string): string {
  const n = firstName(name);
  if (status === "present") return `${n} is at school today`;
  if (status === "absent")  return `${n} was marked absent today`;
  if (status === "late")    return `${n} arrived late today`;
  return `${n} was marked excused today`;
}

function attendancePillColor(rows: AttendanceRow[]): string {
  if (rows.some(r => r.status === "present")) return accent;
  if (rows.some(r => r.status === "absent"))  return red;
  if (rows.some(r => r.status === "late"))    return amber;
  return "#6b7280";
}

function attendancePillText(rows: AttendanceRow[], name: string): string {
  if (rows.some(r => r.status === "present")) return `${firstName(name)} is at school today ✓`;
  if (rows.some(r => r.status === "absent"))  return `Marked absent today`;
  if (rows.some(r => r.status === "late"))    return `Arrived late today`;
  return "No attendance recorded yet today";
}

// ─── Shimmer ──────────────────────────────────────────────────────────────────
function Shimmer({ w = "100%", h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
    }} />
  );
}

function LoadingState() {
  return (
    <div style={{ padding: "16px 16px 120px", animation: "fadeIn 0.2s ease" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
      `}</style>
      {/* Hero skeleton */}
      <div style={{ background: "#fff", borderRadius: 20, padding: 20, marginBottom: 16, display: "flex", gap: 14, alignItems: "center" }}>
        <Shimmer w={56} h={56} r={28} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <Shimmer w="55%" h={16} />
          <Shimmer w="40%" h={11} />
          <Shimmer w="70%" h={11} />
        </div>
      </div>
      {/* Cards skeleton */}
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          <Shimmer w="50%" h={13} />
          <Shimmer w="80%" h={11} />
        </div>
      ))}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
      background: dark, color: "#fff", padding: "12px 24px", borderRadius: 40,
      fontSize: 13, fontWeight: 600, zIndex: 9999, whiteSpace: "nowrap",
      boxShadow: "0 4px 24px rgba(0,0,0,0.18)", animation: "slideUp 0.25s ease",
    }}>{msg}</div>
  );
}

// ─── Encouragement Modal ──────────────────────────────────────────────────────
function EncouragementModal({ name, onClose }: { name: string; onClose: () => void }) {
  const msg = `Thinking of you today, ${firstName(name)}. Keep going — I am so proud of you. 💛`;
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "28px 24px 48px", width: "100%", animation: "slideUp 0.25s ease" }}
      >
        <div style={{ width: 40, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 24px" }} />
        <p style={{ fontSize: 18, fontWeight: 800, color: dark, margin: "0 0 16px" }}>Send Encouragement 💌</p>
        <div style={{ background: bg, borderRadius: 14, padding: "16px", fontSize: 14, color: "#374151", lineHeight: 1.7, marginBottom: 24, border: "1px solid #e5e7eb" }}>
          {msg}
        </div>
        <button
          onClick={onClose}
          style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}
        >Send to {firstName(name)}</button>
        <button
          onClick={onClose}
          style={{ width: "100%", marginTop: 10, padding: 12, background: "transparent", border: "none", color: "#9ca3af", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
        >Cancel</button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ChildDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id     = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [loading,           setLoading]           = useState(true);
  const [child,             setChild]             = useState<ChildDetail | null>(null);
  const [todayRows,         setTodayRows]         = useState<AttendanceRow[]>([]);
  const [termPct,           setTermPct]           = useState<number | null>(null);
  const [showEncouragement, setShowEncouragement] = useState(false);
  const [toast,             setToast]             = useState("");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
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

    // Class — only fetch if class_id exists
    const cls = student.class_id ? (await supabase
      .from("classes")
      .select("id, name, stream, school_id")
      .eq("id", student.class_id)
      .single()).data : null;

    // School — only fetch if school_id exists
    const school = cls?.school_id ? (await supabase
      .from("schools")
      .select("id, name")
      .eq("id", cls.school_id)
      .single()).data : null;

    const className = cls
      ? cls.name + (cls.stream ? " " + cls.stream : "")
      : "—";

    setChild({ id: student.id, name: student.name, className, schoolName: school?.name ?? "—" });

    // Today attendance
    const { data: todayAtt } = await supabase
      .from("attendance")
      .select("id, class_id, student_id, date, status, timetable_slot_id")
      .eq("student_id", id)
      .eq("date", todayStr());

    setTodayRows((todayAtt ?? []) as AttendanceRow[]);

    // Term attendance %
    const { data: allAtt } = await supabase
      .from("attendance")
      .select("id, status")
      .eq("student_id", id);

    const total   = allAtt?.length ?? 0;
    const present = allAtt?.filter(r => r.status === "present").length ?? 0;
    setTermPct(total > 0 ? Math.round((present / total) * 100) : null);

    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <LoadingState />;
  if (!child) return (
    <div style={{ textAlign: "center", padding: 40, color: "#6b7280", fontSize: 14 }}>
      Child not found.
    </div>
  );

  const name            = child.name;
  const first           = firstName(name);
  const pillColor       = attendancePillColor(todayRows);
  const pillText        = attendancePillText(todayRows, name);
  const isAbsentToday   = todayRows.some(r => r.status === "absent");
  const hasAttendance   = todayRows.length > 0;

  // Hub tabs
  const HUB_TABS = [
    { emoji: "👤", label: "Profile",  href: "profile"  },
    { emoji: "🌱", label: "Life",     href: "life"      },
    { emoji: "📈", label: "Growth",   href: "growth"    },
    { emoji: "💰", label: "Finance",  href: "finance"   },
    { emoji: "📸", label: "Memories", href: "memories"  },
    { emoji: "❤️", label: "Health",   href: "health"    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes slideUp  { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes slideIn  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 16px 120px", animation: "slideIn 0.22s ease" }}>

        {/* ── COMPACT HERO ── */}
        <div style={{
          background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`,
          borderRadius: 20, padding: "18px 20px", marginBottom: 16, color: "#fff",
        }}>
          {/* Top row — avatar + info */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: accent, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, fontWeight: 900, color: "#fff",
              boxShadow: "0 4px 14px rgba(16,185,129,0.4)",
            }}>
              {name[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.3, marginBottom: 2 }}>{name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 2 }}>
                {child.className} &middot; {child.schoolName}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            </div>
          </div>

          {/* Attendance pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.1)", borderRadius: 20,
            padding: "6px 14px", fontSize: 12, fontWeight: 700,
            color: pillColor === "#6b7280" ? "rgba(255,255,255,0.5)" : pillColor,
            marginBottom: 14,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: pillColor, flexShrink: 0 }} />
            {pillText}
          </div>

          {/* Quick actions — 2×2 grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "💬 Message Teacher", onClick: () => router.push("/parent/connect") },
              { label: "📚 View Homework",   onClick: () => showToast("Homework coming soon") },
              { label: "❤️ Encouragement",   onClick: () => setShowEncouragement(true) },
              { label: "📞 Call School",     onClick: () => showToast("Contact details in school profile") },
            ].map(a => (
              <button
                key={a.label}
                onClick={a.onClick}
                style={{
                  padding: "9px 12px", borderRadius: 12,
                  border: "1.5px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff", fontWeight: 600, fontSize: 12,
                  cursor: "pointer", fontFamily: "inherit",
                  textAlign: "left", whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis",
                }}
              >{a.label}</button>
            ))}
          </div>
        </div>

        {/* ── ABSENT ALERT ── */}
        {isAbsentToday && (
          <div style={{
            background: red + "12", border: `1.5px solid ${red}30`,
            borderRadius: 14, padding: "14px 16px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>⚠️</span>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: red }}>
                {first} was marked absent today
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                Contact the school if this was unexpected.
              </p>
            </div>
          </div>
        )}

        {/* ── ATTENDANCE TODAY ── */}
        {hasAttendance && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "16px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 800, color: dark }}>{"Today's Attendance"}</p>
            {todayRows.map((row, i) => (
              <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? "1px solid #f3f4f6" : "none" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: statusColor(row.status as AttendanceStatus) + "18",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                }}>
                  {statusIcon(row.status as AttendanceStatus)}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: statusColor(row.status as AttendanceStatus) }}>
                    {statusLabel(row.status as AttendanceStatus, name)}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>{row.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── NO ATTENDANCE YET ── */}
        {!hasAttendance && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "20px 16px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 800, color: dark }}>{"Today's Attendance"}</p>
            <p style={{ margin: 0, fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>
              {first}'s attendance hasn't been recorded yet today. Check back after school starts.
            </p>
          </div>
        )}

        {/* ── TERM ATTENDANCE ── */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "16px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 800, color: dark }}>This Term</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: termPct !== null ? accent : "#d1d5db" }}>
                {termPct !== null ? `${termPct}%` : "—"}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Attendance</div>
            </div>
            <div style={{ flex: 1 }}>
              {termPct !== null ? (
                <>
                  <div style={{ height: 8, borderRadius: 8, background: "#f3f4f6", overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ height: "100%", width: `${termPct}%`, background: termPct >= 80 ? accent : termPct >= 60 ? amber : red, borderRadius: 8, transition: "width 0.6s ease" }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                    {termPct >= 80
                      ? `Great attendance — keep it up, ${first}!`
                      : termPct >= 60
                      ? "Attendance could be improved."
                      : "Attendance needs attention."}
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>
                  Attendance tracking begins once {first} starts attending classes.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── CHILD HUB ── */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "16px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 800, color: dark }}>{first}'s Hub</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {HUB_TABS.map(tab => (
              <button
                key={tab.href}
                onClick={() => router.push(`/parent/child/${id}/${tab.href}`)}
                style={{
                  padding: "14px 8px", borderRadius: 14,
                  border: "1.5px solid #e5e7eb", background: "#fafafa",
                  cursor: "pointer", fontFamily: "inherit",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 6,
                  transition: "border-color 0.15s ease, background 0.15s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = dark;
                  (e.currentTarget as HTMLButtonElement).style.background = "#f0f0f9";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb";
                  (e.currentTarget as HTMLButtonElement).style.background = "#fafafa";
                }}
              >
                <span style={{ fontSize: 24 }}>{tab.emoji}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: dark }}>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ── ENCOURAGEMENT MODAL ── */}
      {showEncouragement && (
        <EncouragementModal
          name={name}
          onClose={() => {
            setShowEncouragement(false);
            showToast(`Encouragement sent to ${first} 💛`);
          }}
        />
      )}

      {/* ── TOAST ── */}
      <Toast msg={toast} />
    </div>
  );
}
