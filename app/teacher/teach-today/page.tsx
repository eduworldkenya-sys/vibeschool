"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchPulseData } from "@/lib/pulse/fetcher";
import type { PulseSnapshot } from "@/lib/types";
import LessonFlowCard from "@/components/teacher/LessonFlowCard";

const C = {
  bg: "#f8fafc",
  card: "#ffffff",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  danger: "#dc2626",
};

const documentLinks = [
  { label: "Academics", detail: "Curriculum, coverage and learner signals", href: "/teacher/academics" },
  { label: "Scheme of Work", detail: "Term sequence and coverage", href: "/teacher/scheme" },
  { label: "Lesson Plans", detail: "Prepare the exact lesson", href: "/teacher/lessonplan" },
  { label: "Timetable", detail: "Scheduled teaching occurrences", href: "/teacher/timetable" },
  { label: "VibeLearn", detail: "Textbooks and teaching resources", href: "/teacher/vibelearn" },
  { label: "Lesson Notes", detail: "Record of progress and remarks", href: "/teacher/progress" },
];

export default function TeachTodayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [name, setName] = useState("");
  const [snap, setSnap] = useState<PulseSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      const [memberRes, profileRes] = await Promise.all([
        supabase.from("school_members").select("school_id").eq("profile_id", user.id).maybeSingle(),
        supabase.from("profiles").select("full_name, school_id").eq("id", user.id).single(),
      ]);
      if (memberRes.error) throw memberRes.error;
      if (profileRes.error) throw profileRes.error;

      const schoolId = memberRes.data?.school_id ?? profileRes.data?.school_id;
      if (!schoolId) throw new Error("school_context_missing");

      const snapshot = await fetchPulseData(user.id, schoolId, null);
      setTeacherId(user.id);
      setName(profileRes.data?.full_name?.split(" ")[0] ?? "");
      setSnap(snapshot);
    } catch (caught) {
      console.error("Teaching desk load failed", caught);
      setError("The teaching desk could not be loaded. Check your connection and try again.");
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
      <main aria-live="polite" aria-busy="true" style={{ minHeight: "100vh", background: C.bg, padding: 20 }}>
        <div style={{ color: C.muted, fontSize: 14, marginBottom: 12 }}>Loading your teaching desk…</div>
        {[96, 72, 72].map((height, index) => <div key={index} style={{ height, borderRadius: 16, background: "#e5e7eb", marginBottom: 10 }} />)}
      </main>
    );
  }

  if (!snap || error) {
    return (
      <main style={{ minHeight: "100vh", background: C.bg, padding: 20 }}>
        <div role="alert" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
          <div style={{ color: C.danger, fontSize: 14, marginBottom: 12 }}>{error ?? "Teaching data is unavailable."}</div>
          <button type="button" onClick={() => void load()} style={{ minHeight: 44, border: 0, borderRadius: 10, padding: "0 16px", background: C.text, color: "#fff", fontWeight: 800 }}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: C.bg, padding: "20px 16px 96px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: C.muted, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6 }}>Plan & Teach</div>
          <h1 style={{ margin: "4px 0 0", color: C.text, fontSize: 24, lineHeight: 1.2 }}>
            {name ? `${name}'s Teaching Desk` : "Teaching Desk"}
          </h1>
          <p style={{ margin: "6px 0 0", color: C.muted, fontSize: 13, lineHeight: 1.5 }}>
            Move from the scheduled lesson into planning, attendance, teaching, homework and reflection without losing context.
          </p>
        </div>
        <button type="button" aria-label="Refresh teaching desk" disabled={refreshing} onClick={() => void load(true)} style={{ minHeight: 44, border: `1px solid ${C.border}`, background: C.card, borderRadius: 10, padding: "0 12px", color: C.text, fontWeight: 800, opacity: refreshing ? 0.6 : 1, flexShrink: 0 }}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section aria-label="Today's teaching workflow">
        <LessonFlowCard
          slots={snap.todaySlots}
          snap={snap}
          teacherId={teacherId}
          onNavigate={(href) => router.push(href)}
          onSaved={() => void load(true)}
        />
      </section>

      <section style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
          <h2 style={{ margin: 0, color: C.text, fontSize: 16 }}>Plan & teaching tools</h2>
          <span style={{ color: C.muted, fontSize: 11 }}>Curriculum-linked</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {documentLinks.map((item) => (
            <button type="button" key={item.href} onClick={() => router.push(item.href)} style={{ minHeight: 72, textAlign: "left", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 13, cursor: "pointer" }}>
              <div style={{ color: C.text, fontSize: 13, fontWeight: 900 }}>{item.label}</div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{item.detail}</div>
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 18, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14 }}>
        <h2 style={{ margin: 0, color: C.text, fontSize: 15 }}>Today's control totals</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
          <div><div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{snap.todaySlots.length}</div><div style={{ color: C.muted, fontSize: 11 }}>Lessons</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{snap.missedLessonPlans.length}</div><div style={{ color: C.muted, fontSize: 11 }}>Plans needed</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{snap.homeworkUngraded.reduce((sum, item) => sum + item.count, 0)}</div><div style={{ color: C.muted, fontSize: 11 }}>Waiting to mark</div></div>
        </div>
      </section>
    </main>
  );
}
