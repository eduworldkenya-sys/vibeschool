"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { LinkedChild } from "@/lib/types";

// ─── Colors ───────────────────────────────────────────────────────────────────
const dark   = "#1e1b4b";
const accent = "#10b981";
const bg     = "#f0f2f5";
const red    = "#ef4444";
const amber  = "#f59e0b";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-KE", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function attendanceColor(pct: number): string {
  if (pct >= 80) return accent;
  if (pct >= 60) return amber;
  return red;
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

// ─── Child Card ───────────────────────────────────────────────────────────────
function ChildCard({ child, onTap }: { child: LinkedChild; onTap: () => void }) {
  const initial  = child.name.trim()[0]?.toUpperCase() ?? "?";
  const hasAtt   = child.attendance_pct > 0;
  const attColor = attendanceColor(child.attendance_pct);
  const isPending = child.pending_approval && child.class_name === "—";

  // Warm one-liner
  const h = new Date().getHours();
  const vibe = h < 9
    ? "Early start — off to a great day 🌅"
    : h < 12
    ? "Morning check-in — you're a great parent 💛"
    : h < 15
    ? "Midday — hope the day is going well 🌤️"
    : h < 18
    ? "Afternoon — almost home time 🏠"
    : "Evening — another day done with love ⭐";

  return (
    <div
      onClick={onTap}
      style={{
        background: "#fff", borderRadius: 20, border: "1px solid #e5e7eb",
        padding: "18px 16px", marginBottom: 12, cursor: "pointer",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        WebkitTapHighlightColor: "transparent",
        transition: "box-shadow 0.15s ease, transform 0.15s ease",
        borderLeft: `4px solid ${dark}`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(0,0,0,0.1)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
        {/* Avatar */}
        <div style={{
          width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
          background: `linear-gradient(135deg, ${dark} 0%, #4c1d95 100%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 900, color: "#fff",
          boxShadow: "0 4px 12px rgba(30,27,75,0.25)",
        }}>
          {initial}
        </div>

        {/* Name + class + school */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: dark, marginBottom: 2 }}>
            {child.name}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {child.class_name !== "—" ? child.class_name : "Class not assigned"}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {child.school_name !== "—" ? child.school_name : "School not linked"}
          </div>
          {isPending && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 20, padding: "2px 10px" }}>
              <span style={{ fontSize: 10 }}>⏳</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#92400e" }}>Waiting for teacher approval</span>
            </div>
          )}
        </div>

        {/* Chevron */}
        <div style={{ fontSize: 20, color: "#d1d5db", flexShrink: 0 }}>›</div>
      </div>

      {/* Attendance bar */}
      {hasAtt && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Attendance this term</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: attColor }}>{child.attendance_pct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 6, background: "#f3f4f6", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${child.attendance_pct}%`,
              background: attColor, borderRadius: 6,
              transition: "width 0.6s ease",
            }} />
          </div>
        </div>
      )}

      {/* Vibe line */}
      <div style={{
        fontSize: 11, color: "#9ca3af", paddingTop: 8,
        borderTop: "1px solid #f3f4f6",
      }}>{vibe}</div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
  const router = useRouter();
  return (
    <div style={{
      background: "#fff", borderRadius: 20, padding: "40px 24px",
      textAlign: "center", border: "1px solid #e5e7eb", marginTop: 8,
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>👨‍👩‍👧</div>
      <p style={{ fontSize: 17, fontWeight: 800, color: dark, margin: "0 0 8px" }}>
        Your children appear here
      </p>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 28px", lineHeight: 1.6 }}>
        Link an existing student with a claim code, or add your child to get started.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={() => router.push("/parent/link-child")}
          style={{
            padding: "14px 24px", borderRadius: 14, border: "none",
            background: dark, color: "#fff", fontWeight: 700,
            fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}
        >🔗 Link with Claim Code</button>
        <button
          onClick={() => router.push("/parent/create-child")}
          style={{
            padding: "14px 24px", borderRadius: 14,
            border: `1.5px solid ${dark}`, background: "transparent",
            color: dark, fontWeight: 700, fontSize: 14,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >+ Add Child to Class</button>
      </div>
    </div>
  );
}

// ─── Love Card ────────────────────────────────────────────────────────────────
function LoveCard() {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`,
      borderRadius: 20, padding: "20px", marginBottom: 12,
      color: "#fff", textAlign: "center",
    }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>💛</div>
      <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
        Every day you check in is a day they feel loved.
      </p>
      <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
        VibeSchool — keeping you close to what matters most.
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ParentStudentsPage() {
  const router = useRouter();

  const [loading,  setLoading]  = useState(true);
  const [children, setChildren] = useState<LinkedChild[]>([]);

  const fetchChildren = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/academy/signin?role=parent"); return; }

    const { data: links } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("parent_id", user.id);

    if (!links || links.length === 0) { setLoading(false); return; }

    const studentIds = links.map((l: { student_id: string }) => l.student_id);

    const { data: students } = await supabase
      .from("students")
      .select("id, name, class_id")
      .in("id", studentIds);

    if (!students || students.length === 0) { setLoading(false); return; }

    const classIds = students.map((s: { class_id: string }) => s.class_id).filter(Boolean);

    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, stream, school_id")
      .in("id", classIds);

    const schoolIds = Array.from(
      new Set((classes ?? []).map((c: { school_id: string }) => c.school_id).filter(Boolean))
    ) as string[];

    const { data: schools } = await supabase
      .from("schools")
      .select("id, name")
      .in("id", schoolIds);

    // Attendance — single query for all students
    const { data: allAtt } = await supabase
      .from("attendance")
      .select("student_id, status")
      .in("student_id", studentIds);

    const attMap: Record<string, number> = {};
    for (const sid of studentIds) {
      const rows    = (allAtt ?? []).filter((r: { student_id: string }) => r.student_id === sid);
      const total   = rows.length;
      const present = rows.filter((r: { status: string }) => r.status === "present").length;
      attMap[sid]   = total > 0 ? Math.round((present / total) * 100) : 0;
    }

    // Pending join requests
    const { data: pendingReqs } = await supabase
      .from("class_join_requests")
      .select("student_id")
      .in("student_id", studentIds)
      .eq("status", "pending");

    const pendingSet = new Set((pendingReqs ?? []).map((r: { student_id: string }) => r.student_id));

    const assembled: LinkedChild[] = students.map((s: { id: string; name: string; class_id: string }) => {
      const cls    = (classes ?? []).find((c: { id: string }) => c.id === s.class_id);
      const school = (schools ?? []).find((sc: { id: string }) => sc.id === cls?.school_id);
      const className = cls ? cls.name + (cls.stream ? " " + cls.stream : "") : "—";
      return {
        student_id:       s.id,
        name:             s.name,
        class_name:       className,
        attendance_pct:   attMap[s.id] ?? 0,
        school_name:      school?.name ?? "—",
        pending_approval: pendingSet.has(s.id),
      };
    });

    setChildren(assembled);
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchChildren(); }, [fetchChildren]);

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 16px 120px", animation: "slideIn 0.22s ease" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: dark }}>{greeting()}</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{todayLabel()}</div>
          </div>
          <div
            onClick={() => router.push("/parent/settings")}
            style={{ fontSize: 22, cursor: "pointer", color: "#6b7280" }}
          >⚙️</div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2].map(i => (
              <div key={i} style={{ background: "#fff", borderRadius: 20, padding: "18px 16px", border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                  <Shimmer w={52} h={52} r={26} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <Shimmer w="55%" h={15} />
                    <Shimmer w="40%" h={11} />
                    <Shimmer w="65%" h={10} />
                  </div>
                </div>
                <Shimmer h={6} r={6} />
              </div>
            ))}
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && children.length === 0 && <EmptyState />}

        {/* ── Children list ── */}
        {!loading && children.length > 0 && (
          <>
            {children.map(child => (
              <ChildCard
                key={child.student_id}
                child={child}
                onTap={() => router.push(`/parent/child/${child.student_id}/profile`)}
              />
            ))}

            {/* Love card */}
            <LoveCard />

            {/* Add another */}
            <button
              onClick={() => router.push("/parent/create-child")}
              style={{
                width: "100%", padding: "16px", borderRadius: 16,
                border: `1.5px solid ${dark}`, background: "#fff",
                color: dark, fontWeight: 700, fontSize: 14,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <span style={{ fontSize: 18 }}>+</span> Add Another Child
            </button>
          </>
        )}
      </div>
    </div>
  );
}
