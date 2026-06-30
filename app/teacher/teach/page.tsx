"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchPulseData, PulseSnapshot } from "@/lib/pulse/fetcher";

// ── Design tokens (matches existing teacher portal palette) ──────────────
const C = {
  bg: "#f9fafb",
  card: "#ffffff",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  accent: "#10b981",
  critical: "#ef4444",
  urgent: "#f59e0b",
};

// Teaching-only task derived from PulseSnapshot. We deliberately do NOT use
// lib/pulse/rules.ts runRules() here — that mixes in attendance/TPAD/messages
// which belong to the cross-tray Today (Pulse), not the Teach tray. This page
// reads the same snapshot but applies its own narrower filter.
interface TeachTask {
  id: string;
  label: string;
  detail: string;
  severity: "critical" | "urgent" | "normal";
  href: string;
}

function buildTeachTasks(snap: PulseSnapshot): TeachTask[] {
  const tasks: TeachTask[] = [];

  // "Things to close" — surfaced first and with equal visual weight to
  // "things to prepare", per the corrected brief: teaching is interrupt-driven.
  if (snap.homeworkUngraded.length > 0) {
    const total = snap.homeworkUngraded.reduce((sum, h) => sum + h.count, 0);
    tasks.push({
      id: "homework_ungraded",
      label: "Homework to grade",
      detail: `${total} submission${total === 1 ? "" : "s"} across ${snap.homeworkUngraded.length} assignment${snap.homeworkUngraded.length === 1 ? "" : "s"}`,
      severity: "critical",
      // NOTE: /teacher/homework does not read a status query param (confirmed
      // against app/teacher/homework/page.tsx). Linking plainly rather than
      // implying a filter that doesn't exist.
      href: `/teacher/homework`,
    });
  }

  if (snap.missedLessonPlans.length > 0) {
    tasks.push({
      id: "missed_plans",
      label: "Lessons missing a plan",
      detail: snap.missedLessonPlans.map(m => `${m.className} ${m.subject}`).join(", "),
      severity: "urgent",
      href: `/teacher/lessonplan`,
    });
  }

  // "Things to prepare"
  if (snap.homeworkDue.length > 0) {
    tasks.push({
      id: "homework_due",
      label: "Homework due soon",
      detail: snap.homeworkDue.map(h => h.title).join(", "),
      severity: "normal",
      href: `/teacher/homework`,
    });
  }

  return tasks;
}

interface NextLesson {
  id: string;
  className: string;
  subject: string;
  classId: string;
  startTime: string;
  hasPlan: boolean;
}

function deriveNextLesson(snap: PulseSnapshot): NextLesson | null {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const upcoming = snap.todaySlots
    .filter((s: any) => {
      const [h, m] = s.start_time.split(":").map(Number);
      return h * 60 + m >= nowMins;
    })
    .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));

  const slot = upcoming[0];
  if (!slot) return null;

  // FIX: fetchPulseData() already flattens each slot to class_name/subject
  // strings (see lib/pulse/fetcher.ts ~line 55-65) — there is no nested
  // .classes/.subjects join object on todaySlots entries. Reading
  // slot.classes?.name here always returned undefined, silently showing
  // the literal placeholder text "Class"/"Subject" instead of real data.
  const missing = snap.missedLessonPlans.find(
    (m) => m.class_id === slot.class_id && m.subject_id === slot.subject_id
  );

  return {
    id: slot.id,
    className: slot.class_name ?? "Class",
    subject: slot.subject ?? "Subject",
    classId: slot.class_id,
    startTime: slot.start_time,
    hasPlan: !missing,
  };
}

function Severity({ level }: { level: TeachTask["severity"] }) {
  const color = level === "critical" ? C.critical : level === "urgent" ? C.urgent : C.accent;
  return <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: color }} />;
}

export default function TeachTodayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [snap, setSnap] = useState<PulseSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }

        const [memberRes, profileRes] = await Promise.all([
          supabase.from("school_members").select("school_id").eq("profile_id", user.id).maybeSingle(),
          supabase.from("profiles").select("full_name,school_id").eq("id", user.id).single(),
        ]);
        const schoolId = memberRes.data?.school_id ?? profileRes.data?.school_id ?? "";

        const data = await fetchPulseData(user.id, schoolId, null);
        if (cancelled) return;
        setName(profileRes.data?.full_name?.split(" ")[0] ?? "");
        setSnap(data);
      } catch (e) {
        if (!cancelled) setError("Couldn't load today's teaching view. Pull to refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: 16 }}>
        <div style={{ color: C.muted, fontSize: 14 }}>Loading today's teaching view…</div>
      </div>
    );
  }

  if (error || !snap) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: 16 }}>
        <div style={{ color: C.critical, fontSize: 14 }}>{error ?? "Something went wrong."}</div>
      </div>
    );
  }

  const tasks = buildTeachTasks(snap);
  const nextLesson = deriveNextLesson(snap);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 96 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 13, color: C.muted }}>Today</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
          {name ? `Hi ${name}` : "Your teaching day"}
        </div>
      </div>

      {/* Next lesson */}
      <div style={{ padding: "0 16px 16px" }}>
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Next lesson
          </div>
          {nextLesson ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginTop: 6 }}>
                {nextLesson.subject} — {nextLesson.className}
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
                {nextLesson.startTime}
                {nextLesson.hasPlan ? " · plan ready" : " · no plan yet"}
              </div>
              {!nextLesson.hasPlan && (
                <button
                  onClick={() => router.push(`/teacher/lessonplan?classId=${nextLesson.classId}`)}
                  style={{
                    marginTop: 10, padding: "8px 14px", borderRadius: 10, border: "none",
                    background: C.urgent, color: "#fff", fontSize: 13, fontWeight: 600,
                  }}
                >
                  Write plan now
                </button>
              )}
            </>
          ) : (
            <div style={{ fontSize: 14, color: C.muted, marginTop: 6 }}>
              No more lessons scheduled today.
            </div>
          )}
        </div>
      </div>

      {/* Tasks — closing items weighted equally with prep items */}
      {tasks.length > 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 8 }}>
            Needs attention
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tasks.map(t => (
              <button
                key={t.id}
                onClick={() => router.push(t.href)}
                style={{
                  display: "flex", gap: 10, alignItems: "stretch", textAlign: "left",
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                  padding: 12, width: "100%",
                }}
              >
                <Severity level={t.severity} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{t.detail}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Curriculum coverage snapshot */}
      {/* Entry point to the curriculum-rooted week view — discoverable,
          not forced. Teacher chooses to go deeper into per-subject
          artifact status (Scheme/Plan/Notes/HW/Assess), this page stays
          the lightweight daily-task view. */}
      <div style={{ padding: "0 16px 16px" }}>
        <button
          onClick={() => router.push("/teacher/week")}
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            width: "100%", textAlign: "left",
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
              View full teaching week
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              Scheme, Plan, Notes, Homework, Assessment — all subjects
            </div>
          </div>
          <div style={{ fontSize: 18, color: C.muted }}>→</div>
        </button>
      </div>

      {snap.currStats.length > 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 8 }}>
            Curriculum coverage this term
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {snap.currStats.map(s => (
              <div key={`${s.classId}-${s.subjectId}`} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.subject}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {s.covered}/{s.total} strands covered · {s.lessonCount} lessons this term
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && !nextLesson && (
        <div style={{ padding: 16, textAlign: "center", color: C.muted, fontSize: 14 }}>
          You're all caught up for today.
        </div>
      )}
    </div>
  );
}
