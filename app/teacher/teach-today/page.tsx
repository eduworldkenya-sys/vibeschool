"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchPulseData } from "@/lib/pulse/fetcher";
import type { PulseSnapshot } from "@/lib/types";
import { TeacherWorkspace } from "@/components/teacher/ui";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import LessonFlowCard from "@/components/teacher/LessonFlowCard";

const C = {
  bg: "var(--teacher-canvas, #f5f6f2)",
  card: "#ffffff",
  border: "var(--teacher-border, #dfe5de)",
  text: "var(--teacher-ink, #1c2923)",
  muted: "var(--teacher-muted, #627168)",
  danger: "#dc2626",
};

const documentLinks = [
  { label: "Curriculum", detail: "Learning outcomes and strands", href: "/teacher/subjecthub" },
  { label: "Scheme of Work", detail: "Term sequence and coverage", href: "/teacher/scheme" },
  { label: "Lesson Plans", detail: "Prepare the exact lesson", href: "/teacher/lessonplan" },
  { label: "Timetable", detail: "Your teaching schedule", href: "/teacher/timetable" },
  { label: "VibeLearn", detail: "Curriculum-aware learning library", href: "/teacher/vibelearn" },
  { label: "Progress Record", detail: "Teaching progress and reflection", href: "/teacher/progress" },
];

function activeTeacherSchoolId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const activeSchoolId = Reflect.get(value, "active_school_id");
  return typeof activeSchoolId === "string" && activeSchoolId.length > 0 ? activeSchoolId : null;
}

export default function TeachTodayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [name, setName] = useState("");
  const [snap, setSnap] = useState<PulseSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noSchool, setNoSchool] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        router.replace("/login");
        return;
      }

      const [schoolContextRes, profileRes] = await Promise.all([
        supabase.rpc("get_my_teacher_school_context"),
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      ]);
      if (schoolContextRes.error) throw schoolContextRes.error;
      if (profileRes.error) throw profileRes.error;

      const schoolId = activeTeacherSchoolId(schoolContextRes.data);
      if (!schoolId) {
        setTeacherId(user.id);
        setName(profileRes.data?.full_name?.split(" ")[0] ?? "");
        setSnap(null);
        setNoSchool(true);
        return;
      }
      setNoSchool(false);

      const snapshot = await fetchPulseData(user.id, schoolId, null);
      setTeacherId(user.id);
      setName(profileRes.data?.full_name?.split(" ")[0] ?? "");
      setSnap(snapshot);
    } catch (caught) {
      console.error("Teaching desk load failed", caught);
      setError("The teaching desk could not be loaded. Try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section style={{ minHeight: "100vh", background: C.bg, padding: 20 }}>
        <div style={{ color: C.muted, fontSize: 14 }}>Loading your teaching desk…</div>
      </section>
    );
  }

  if (noSchool && !error) {
    return <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 110px", display: "grid", gap: 16 }}>
      <header><p style={{ fontSize: 12, color: C.muted, margin: 0 }}>VIBESCHOOL · TEACHER OS</p><h1 style={{ margin: "6px 0" }}>Your teaching workspace{name ? `, ${name}` : ""}</h1>
        <p style={{ color: C.muted }}>You can teach privately without joining a school. School lessons will appear when you connect a school.</p></header>
      <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
        <h2 style={{ margin: "0 0 8px" }}>My Tutoring</h2><p style={{ color: C.muted }}>Manage learners, lesson sessions and private conversations using your current account.</p>
        <Link href="/teacher/tutoring" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "10px 16px", borderRadius: 12, background: "#087451", color: "#fff", fontWeight: 700, textDecoration: "none" }}>Open My Tutoring</Link>
      </section>
      <section aria-label="Shared teaching tools" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {documentLinks.filter(item => item.href !== "/teacher/timetable").map(item => <Link key={item.href} href={item.href} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, color: C.text, textDecoration: "none" }}><strong>{item.label}</strong><p style={{ color: C.muted, fontSize: 12 }}>{item.detail}</p></Link>)}
      </section>
      <p style={{ color: C.muted, fontSize: 12 }}>School-specific tools may still require an authorised school context. Tutoring learner access is granted only through accepted private connections.</p>
    </main>;
  }
  if (!snap || error) {
    return (
      <section style={{ minHeight: "100vh", background: C.bg, padding: 20 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
          <div style={{ color: C.danger, fontSize: 14, marginBottom: 12 }}>{error ?? "Teaching data is unavailable."}</div>
          <button onClick={() => void load()} style={{ border: 0, borderRadius: 10, padding: "9px 14px", background: C.text, color: "#fff", fontWeight: 800 }}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <TeacherWorkspace title="Teach today" eyebrow={name ? `${name}’s teaching desk` : "Teaching desk"} actions={<button type="button" className="teacher-icon-button" aria-label={refreshing ? "Refreshing teaching desk" : "Refresh teaching desk"} disabled={refreshing} onClick={()=>void load(true)}><RefreshCw size={20} aria-hidden="true"/></button>}>

      <section aria-label="Today's teaching workflow">
        <LessonFlowCard
          slots={snap.todaySlots}
          snap={snap}
          teacherId={teacherId}
          onNavigate={(href) => router.push(href)}
          onSaved={() => void load(true)}
        />
      </section>

      <section aria-label="Teaching arrangements" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}><Link href="/teacher/classhub" style={{ color: "#087451", fontWeight: 700 }}>School classes</Link><Link href="/teacher/tutoring" style={{ color: "#087451", fontWeight: 700 }}>My Tutoring</Link></section>
      <section style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
          <h2 style={{ margin: 0, color: C.text, fontSize: 16 }}>Teaching documents</h2>
          <span style={{ color: C.muted, fontSize: 11 }}></span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {documentLinks.map((item) => (
            <button key={item.href} onClick={() => router.push(item.href)} style={{ textAlign: "left", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 13, cursor: "pointer" }}>
              <div style={{ color: C.text, fontSize: 13, fontWeight: 750 }}>{item.label}</div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{item.detail}</div>
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 18, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14 }}>
        <h2 style={{ margin: 0, color: C.text, fontSize: 15 }}>Today at a glance</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
          <div><div style={{ fontSize: 20, fontWeight: 750, color: C.text }}>{snap.todaySlots.length}</div><div style={{ color: C.muted, fontSize: 11 }}>Lessons</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 750, color: C.text }}>{snap.missedLessonPlans.length}</div><div style={{ color: C.muted, fontSize: 11 }}>Plans needed</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 750, color: C.text }}>{snap.homeworkUngraded.reduce((sum, item) => sum + item.count, 0)}</div><div style={{ color: C.muted, fontSize: 11 }}>Waiting to mark</div></div>
        </div>
      </section>
    </TeacherWorkspace>
  );
}
