"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchPulseData } from "@/lib/pulse/fetcher";
import type { PulseSnapshot } from "@/lib/types";

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

function toLessonSummary(snap: PulseSnapshot, slot: any): NextLesson {
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

interface LessonGroups {
  taught: NextLesson[];
  upcoming: NextLesson[];
  tomorrow: NextLesson[];
}

function deriveLessonGroups(snap: PulseSnapshot): LessonGroups {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const sortedToday = [...snap.todaySlots].sort((a: any, b: any) =>
    (a.start_time ?? "").localeCompare(b.start_time ?? "")
  );

  const taught: NextLesson[] = [];
  const upcoming: NextLesson[] = [];

  for (const s of sortedToday) {
    const [h, m] = (s.start_time ?? "0:0").split(":").map(Number);
    const mins = h * 60 + m;
    const lesson = toLessonSummary(snap, s);
    if (mins < nowMins) taught.push(lesson);
    else upcoming.push(lesson);
  }

  const tomorrow = [...(snap.tomorrowSlots ?? [])]
    .sort((a: any, b: any) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
    .map((s: any) => toLessonSummary(snap, s));

  return { taught, upcoming, tomorrow };
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
  const { taught, upcoming, tomorrow } = deriveLessonGroups(snap);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 96 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 13, color: C.muted }}>Today</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
          {name ? `Hi ${name}` : "Your teaching day"}
        </div>
      </div>

      {/* Upcoming lesson today (next one to teach) */}
      {upcoming.length > 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
            padding: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Next lesson
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginTop: 6 }}>
              {upcoming[0].subject} — {upcoming[0].className}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
              {upcoming[0].startTime}
              {upcoming[0].hasPlan ? " · plan ready" : " · no plan yet"}
            </div>
            {!upcoming[0].hasPlan && (
              <button
                onClick={() => router.push(`/teacher/lessonplan?classId=${upcoming[0].classId}`)}
                style={{
                  marginTop: 10, padding: "8px 14px", borderRadius: 10, border: "none",
                  background: C.urgent, color: "#fff", fontSize: 13, fontWeight: 600,
                }}
              >
                Write plan now
              </button>
            )}
            {upcoming.length > 1 && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>
                +{upcoming.length - 1} more lesson{upcoming.length - 1 === 1 ? "" : "s"} later today
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lessons already taught today */}
      {taught.length > 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 8 }}>
            Taught today
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {taught.map(l => (
              <div key={l.id} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                    {l.subject} — {l.className}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{l.startTime}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.accent }}>Done</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nothing left today — show tomorrow or advice */}
      {upcoming.length === 0 && taught.length === 0 && tomorrow.length === 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16,
          }}>
            <div style={{ fontSize: 14, color: C.muted }}>
              No lessons scheduled today. Good time to get ahead — file a lesson plan or check your curriculum coverage below.
            </div>
          </div>
        </div>
      )}

      {upcoming.length === 0 && taught.length > 0 && tomorrow.length === 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16,
          }}>
            <div style={{ fontSize: 14, color: C.muted }}>
              That's your last lesson for today — nice work. Nothing else scheduled.
            </div>
          </div>
        </div>
      )}

      {upcoming.length === 0 && tomorrow.length > 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 8 }}>
            Tomorrow
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tomorrow.map(l => (
              <button
                key={l.id}
                onClick={() => router.push(`/teacher/lessonplan?classId=${l.classId}`)}
                style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  width: "100%", textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                    {l.subject} — {l.className}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {l.startTime}{l.hasPlan ? " · plan ready" : " · no plan yet"}
                  </div>
                </div>
                {!l.hasPlan && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.urgent }}>Plan it</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

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

      {tasks.length === 0 && upcoming.length === 0 && taught.length === 0 && tomorrow.length === 0 && (
        <div style={{ padding: 16, textAlign: "center", color: C.muted, fontSize: 14 }}>
          You're all caught up for today.
        </div>
      )}
    </div>
  );
}
