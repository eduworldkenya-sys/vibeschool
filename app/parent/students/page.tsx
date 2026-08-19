"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ChildSummary {
  studentId: string;
  name: string;
  className: string | null;
  schoolName: string | null;
  attendancePct: number | null;
  attendanceRecords: number;
  pendingApproval: boolean;
}

const dark = "#1e1b4b";
const accent = "#059669";
const bg = "#f0f2f5";

function attendanceTone(pct: number) {
  if (pct >= 80) return "#166534";
  if (pct >= 60) return "#92400e";
  return "#b91c1c";
}

function ChildCard({ child, onOpen }: { child: ChildSummary; onOpen: () => void }) {
  const initial = child.name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${child.name}`}
      style={{
        width: "100%", textAlign: "left", background: "#fff", borderRadius: 18,
        border: "1px solid #e2e8f0", borderLeft: `4px solid ${dark}`,
        padding: 16, marginBottom: 12, cursor: "pointer", fontFamily: "inherit",
        boxShadow: "0 2px 10px rgba(15,23,42,0.05)", color: "#0f172a",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span aria-hidden="true" style={{
          width: 48, height: 48, borderRadius: "50%", background: dark, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900,
          flexShrink: 0,
        }}>{initial}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: 17, fontWeight: 800 }}>{child.name}</span>
          <span style={{ display: "block", fontSize: 12, color: "#475569", marginTop: 2 }}>
            {child.className ?? "Class not confirmed"}
          </span>
          <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {child.schoolName ?? "School details not available yet"}
          </span>
        </span>
        <span aria-hidden="true" style={{ fontSize: 24, color: "#94a3b8" }}>›</span>
      </div>

      {child.pendingApproval && (
        <div style={{ marginTop: 12, padding: "9px 11px", borderRadius: 10, background: "#fffbeb", color: "#92400e", fontSize: 12, lineHeight: 1.45 }}>
          <strong>School verification pending.</strong> You will get access to class-linked information after the school confirms the relationship.
        </div>
      )}

      <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 12, paddingTop: 12 }}>
        {child.attendanceRecords === 0 || child.attendancePct === null ? (
          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
            <strong style={{ color: "#334155" }}>Attendance:</strong> No attendance has been recorded yet. This does not mean the learner was absent.
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
              <span style={{ color: "#475569", fontWeight: 650 }}>Recorded attendance</span>
              <span style={{ color: attendanceTone(child.attendancePct), fontWeight: 800 }}>{child.attendancePct}%</span>
            </div>
            <div aria-hidden="true" style={{ height: 6, borderRadius: 999, background: "#e2e8f0", overflow: "hidden", marginTop: 6 }}>
              <div style={{ width: `${child.attendancePct}%`, height: "100%", borderRadius: 999, background: attendanceTone(child.attendancePct) }} />
            </div>
            <div style={{ marginTop: 5, fontSize: 10, color: "#64748b" }}>Based on {child.attendanceRecords} recorded school {child.attendanceRecords === 1 ? "entry" : "entries"}.</div>
          </div>
        )}
      </div>
    </button>
  );
}

function EmptyState() {
  const router = useRouter();
  return (
    <section style={{ background: "#fff", borderRadius: 20, padding: "30px 20px", border: "1px solid #e2e8f0", textAlign: "center" }}>
      <div aria-hidden="true" style={{ fontSize: 42, marginBottom: 10 }}>👨‍👩‍👧</div>
      <h1 style={{ fontSize: 20, margin: 0, color: dark }}>No verified child is linked yet</h1>
      <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: "10px auto 18px", maxWidth: 420 }}>
        For child privacy, knowing a learner&apos;s name is not enough to gain access. Start the verified linking process using a school-authorized claim or invitation.
      </p>
      <button type="button" onClick={() => router.push("/parent/link-child")} style={{
        minHeight: 46, padding: "0 18px", borderRadius: 12, border: "none", background: dark,
        color: "#fff", fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
      }}>Link or request access</button>
    </section>
  );
}

export default function ParentStudentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [children, setChildren] = useState<ChildSummary[]>([]);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data: links, error: linksError } = await supabase
        .from("parent_student_links")
        .select("student_id")
        .eq("parent_id", user.id);
      if (linksError) throw linksError;

      const studentIds = (links ?? []).map(link => link.student_id).filter(Boolean);
      if (studentIds.length === 0) { setChildren([]); return; }

      const { data: students, error: studentError } = await supabase
        .from("students").select("id, name, class_id").in("id", studentIds);
      if (studentError) throw studentError;

      const classIds = Array.from(new Set((students ?? []).map(student => student.class_id).filter((id): id is string => Boolean(id))));
      const { data: classes, error: classError } = classIds.length
        ? await supabase.from("classes").select("id, name, stream, school_id").in("id", classIds)
        : { data: [], error: null };
      if (classError) throw classError;

      const schoolIds = Array.from(new Set((classes ?? []).map(cls => cls.school_id).filter((id): id is string => Boolean(id))));
      const { data: schools, error: schoolError } = schoolIds.length
        ? await supabase.from("schools").select("id, name").in("id", schoolIds)
        : { data: [], error: null };
      if (schoolError) throw schoolError;

      const [{ data: attendance, error: attendanceError }, { data: requests, error: requestError }] = await Promise.all([
        supabase.from("attendance").select("student_id, status").in("student_id", studentIds),
        supabase.from("class_join_requests").select("student_id").in("student_id", studentIds).eq("status", "pending"),
      ]);
      if (attendanceError) throw attendanceError;
      if (requestError) throw requestError;

      const pending = new Set((requests ?? []).map(request => request.student_id));
      const assembled: ChildSummary[] = (students ?? []).map(student => {
        const cls = (classes ?? []).find(row => row.id === student.class_id);
        const school = (schools ?? []).find(row => row.id === cls?.school_id);
        const rows = (attendance ?? []).filter(row => row.student_id === student.id);
        const present = rows.filter(row => row.status === "present" || row.status === "late").length;
        return {
          studentId: student.id,
          name: student.name,
          className: cls ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ""}` : null,
          schoolName: school?.name ?? null,
          attendanceRecords: rows.length,
          attendancePct: rows.length ? Math.round((present / rows.length) * 100) : null,
          pendingApproval: pending.has(student.id) && !student.class_id,
        };
      });
      setChildren(assembled);
    } catch (loadError) {
      console.error("[ParentChildren] load failed", loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void loadChildren(); }, [loadChildren]);

  return (
    <div style={{ minHeight: "100vh", background: bg }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8 }}>Family</div>
            <h1 style={{ margin: "3px 0 4px", color: dark, fontSize: 24 }}>My children</h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Choose a learner to see schoolwork, attendance, progress and messages in the correct child context.</p>
          </div>
          <button type="button" onClick={() => router.push("/parent/profile")} aria-label="Open account and settings" style={{
            minWidth: 44, minHeight: 44, borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff",
            cursor: "pointer", fontSize: 18,
          }}>⚙</button>
        </header>

        {loading && (
          <div role="status" aria-label="Loading children" style={{ display: "grid", gap: 12 }}>
            {[1, 2].map(item => <div key={item} style={{ height: 132, borderRadius: 18, background: "#e2e8f0" }} />)}
          </div>
        )}

        {!loading && error && (
          <section role="alert" style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 16, padding: 18 }}>
            <h2 style={{ margin: 0, color: "#991b1b", fontSize: 16 }}>Children are temporarily unavailable</h2>
            <p style={{ margin: "7px 0 14px", color: "#64748b", fontSize: 13 }}>Your relationship has not been changed. Check your connection and try again.</p>
            <button type="button" onClick={() => void loadChildren()} style={{ minHeight: 44, padding: "0 16px", borderRadius: 10, border: "none", background: dark, color: "#fff", fontWeight: 800 }}>Try again</button>
          </section>
        )}

        {!loading && !error && children.length === 0 && <EmptyState />}
        {!loading && !error && children.map(child => (
          <ChildCard key={child.studentId} child={child} onOpen={() => router.push(`/parent/child/${child.studentId}`)} />
        ))}
      </div>
    </div>
  );
}
