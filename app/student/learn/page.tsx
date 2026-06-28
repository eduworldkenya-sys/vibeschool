"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStudent } from "@/lib/student-context";
import Skel from "@/components/student/Skel";

interface HWItem {
  id: string; title: string; subject: string;
  due_date: string; type: string;
  submitted: boolean; mark: number | null; feedback: string | null;
}
interface LessonItem {
  id: string; title: string; subject: string;
  day: number; student_copy: string;
}
interface AssessmentItem {
  id: string; subjectName: string; sub_strand: string;
  assessment_type: string; performance: string;
  term: number; academic_year: number;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}
function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(dateStr); due.setHours(0,0,0,0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}
function dueBadge(dateStr: string, submitted: boolean) {
  if (submitted) return { label: "Submitted", bg: "#d1fae5", text: "#065f46" };
  const d = daysUntil(dateStr);
  if (d < 0)   return { label: "Overdue",   bg: "#fee2e2", text: "#991b1b" };
  if (d === 0) return { label: "Due Today", bg: "#fef3c7", text: "#92400e" };
  return { label: `Due in ${d}d`, bg: "#e0f2fe", text: "#075985" };
}
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--vs-text)", letterSpacing: 0.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <span>{emoji}</span>{title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}
function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{ background: "var(--vs-card)", borderRadius: 14, border: "1px solid var(--vs-border)", padding: "24px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "var(--vs-muted)" }}>{msg}</div>
    </div>
  );
}

export default function LearnPage() {
  const router = useRouter();
  const { identity, loading: idLoading } = useStudent();
  const [loading,     setLoading]     = useState(true);
  const [homework,    setHomework]    = useState<HWItem[]>([]);
  const [lessons,     setLessons]     = useState<LessonItem[]>([]);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [activeTab,   setActiveTab]   = useState<"assignments"|"lessons"|"assessments"|"papers">("assignments");

  useEffect(() => {
    if (idLoading || !identity) return;
    async function load() {
      const classId   = identity!.classId;
      const studentId = identity!.studentId;

      const [hwRes, subRes, planRes, assessRes] = await Promise.all([
        supabase.from("homework").select("id, title, subject_id, due_date, type").eq("class_id", classId).order("due_date", { ascending: true }),
        supabase.from("homework_submissions").select("homework_id, mark, feedback").eq("student_id", studentId),
        supabase.from("lesson_plans").select("id, title, subject_id, day_of_week, body").eq("class_id", classId).order("day_of_week", { ascending: false }).limit(20),
        supabase.from("cbc_assessments").select("id, subject_id, sub_strand, assessment_type, performance, term, academic_year").eq("student_id", studentId).order("created_at", { ascending: false }),
      ]);

      const allSubjectIds = Array.from(new Set([
        ...(hwRes.data    ?? []).map((r: { subject_id: string }) => r.subject_id),
        ...(planRes.data  ?? []).map((r: { subject_id: string }) => r.subject_id),
        ...(assessRes.data ?? []).map((r: { subject_id: string }) => r.subject_id),
      ].filter(Boolean))) as string[];

      let subjectMap: Record<string, string> = {};
      if (allSubjectIds.length > 0) {
        const { data: subs } = await supabase.from("subjects").select("id, name").in("id", allSubjectIds);
        subjectMap = Object.fromEntries((subs ?? []).map(s => [s.id, s.name]));
      }

      const subMap = new Map<string, { mark: number | null; feedback: string | null }>();
      for (const s of subRes.data ?? []) {
        subMap.set(s.homework_id, { mark: s.mark ?? null, feedback: s.feedback ?? null });
      }

      setHomework((hwRes.data ?? []).map((h: { id: string; title: string; subject_id: string; due_date: string; type: string }) => ({
        id: h.id, title: h.title, due_date: h.due_date, type: h.type,
        subject:   subjectMap[h.subject_id] ?? "Subject",
        submitted: subMap.has(h.id),
        mark:      subMap.get(h.id)?.mark     ?? null,
        feedback:  subMap.get(h.id)?.feedback ?? null,
      })));

      setLessons((planRes.data ?? [])
        .filter((p: { body: string }) => !!p.body)
        .map((p: { id: string; title: string; subject_id: string; day_of_week: number; body: string }) => ({
          id: p.id, title: p.title, day: p.day_of_week, student_copy: p.body,
          subject: subjectMap[p.subject_id] ?? "Lesson",
        })));

      setAssessments((assessRes.data ?? []).map((a: { id: string; subject_id: string; sub_strand: string; assessment_type: string; performance: string; term: number; academic_year: number }) => ({
        id: a.id, sub_strand: a.sub_strand, assessment_type: a.assessment_type,
        performance: a.performance, term: a.term, academic_year: a.academic_year,
        subjectName: subjectMap[a.subject_id] ?? "Subject",
      })));

      setLoading(false);
    }
    load();
  }, [identity, idLoading]);

  const isLoading = idLoading || (loading && homework.length === 0);
  const tabs = [
    { id: "assignments" as const, label: "Work",    emoji: "📝" },
    { id: "lessons"     as const, label: "Lessons", emoji: "📖" },
    { id: "assessments" as const, label: "Results", emoji: "📊" },
    { id: "papers"      as const, label: "Papers",  emoji: "🗂"  },
  ];

  return (
    <div style={{ animation: "fadeIn 0.2s ease" }}>
      <div style={{ background: "linear-gradient(135deg,#1C1A2E 0%,#2D2060 100%)", borderRadius: 20, padding: "14px 16px", marginBottom: 16, color: "#fff" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
          {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{greeting()}, {idLoading ? "…" : identity?.firstName} 📚</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Your school work, all in one place</div>
        {!isLoading && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {[
              { label: "Assignments", value: homework.length },
              { label: "Pending",     value: homework.filter(h => !h.submitted).length },
              { label: "Results",     value: assessments.length },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{s.value}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            flexShrink: 0, border: "none", cursor: "pointer", fontFamily: "inherit",
            padding: "8px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: activeTab === t.id ? "var(--vs-accent)" : "var(--vs-card)",
            color:      activeTab === t.id ? "#fff" : "var(--vs-muted)",
            boxShadow:  activeTab === t.id ? "0 2px 8px rgba(124,110,248,0.3)" : "0 1px 3px rgba(0,0,0,0.06)",
          }}>{t.emoji} {t.label}</button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skel h={80} radius={12} /><Skel h={80} radius={12} /><Skel h={80} radius={12} />
        </div>
      ) : (
        <div style={{ animation: "slideIn 0.2s ease" }}>

          {activeTab === "assignments" && (
            <Section title="Assignments" emoji="📝">
              {homework.length === 0 ? <EmptyState msg="No assignments yet. Check back after class." /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {homework.map(h => {
                    const badge = dueBadge(h.due_date, h.submitted);
                    return (
                      <div key={h.id} style={{ background: "var(--vs-card)", borderRadius: 14, border: "1px solid var(--vs-border)", padding: "14px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vs-text)", flex: 1, marginRight: 8 }}>{h.title}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: badge.text, background: badge.bg, borderRadius: 8, padding: "3px 8px", flexShrink: 0 }}>{badge.label}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--vs-muted)" }}>{h.subject} · {h.type}</div>
                        {h.submitted && h.mark !== null && (
                          <div style={{ marginTop: 8, padding: "6px 10px", background: "#d1fae5", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#065f46" }}>
                            Mark: {h.mark}{h.feedback && <span style={{ fontWeight: 500, marginLeft: 8 }}>— {h.feedback}</span>}
                          </div>
                        )}
                        {!h.submitted && (
                          <button onClick={() => router.push(`/student/homework/${h.id}`)} style={{ marginTop: 10, width: "100%", padding: "9px 0", background: "var(--vs-accent)", color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                            Start Assignment
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {homework.length > 0 && (
                <button onClick={() => router.push("/student/homework")} style={{ marginTop: 10, width: "100%", padding: "10px 0", background: "none", border: "1px solid var(--vs-border)", borderRadius: 10, fontSize: 12, fontWeight: 700, color: "var(--vs-accent)", cursor: "pointer", fontFamily: "inherit" }}>
                  View All Homework →
                </button>
              )}
            </Section>
          )}

          {activeTab === "lessons" && (
            <Section title="Lesson Replay" emoji="📖">
              {lessons.length === 0 ? <EmptyState msg="No lesson content posted yet. Your teacher will add lessons here." /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {lessons.map(l => (
                    <div key={l.id} style={{ background: "var(--vs-card)", borderRadius: 14, border: "1px solid var(--vs-border)", padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vs-text)" }}>{l.title}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--vs-accent)", background: "var(--vs-accent-soft)", borderRadius: 8, padding: "3px 8px" }}>{DAYS[l.day] ?? ""}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--vs-muted)", marginBottom: 8 }}>{l.subject}</div>
                      <div style={{ fontSize: 12, color: "var(--vs-text)", lineHeight: 1.6, maxHeight: 80, overflow: "hidden", position: "relative" }}>
                        {l.student_copy}
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 28, background: "linear-gradient(transparent, var(--vs-card))" }} />
                      </div>
                      <button onClick={() => router.push(`/student/lesson/${l.id}`)} style={{ marginTop: 10, width: "100%", padding: "9px 0", background: "var(--vs-accent-soft)", color: "var(--vs-accent)", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        Read Full Lesson
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {activeTab === "assessments" && (
            <Section title="My Results" emoji="📊">
              {assessments.length === 0 ? <EmptyState msg="No assessment results yet." /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {assessments.map(a => {
                    const p = a.performance?.toLowerCase() ?? "";
                    const pc = p.includes("exceeds")  ? { bg: "#d1fae5", text: "#065f46" }
                      : p.includes("meets")           ? { bg: "#dbeafe", text: "#1e40af" }
                      : p.includes("approach")        ? { bg: "#fef3c7", text: "#92400e" }
                      : { bg: "#fee2e2", text: "#991b1b" };
                    return (
                      <div key={a.id} style={{ background: "var(--vs-card)", borderRadius: 14, border: "1px solid var(--vs-border)", padding: "14px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vs-text)" }}>{a.subjectName}</div>
                            <div style={{ fontSize: 11, color: "var(--vs-muted)", marginTop: 2 }}>{a.sub_strand}</div>
                            <div style={{ fontSize: 11, color: "var(--vs-muted)", marginTop: 1 }}>Term {a.term} · {a.academic_year}</div>
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: pc.text, background: pc.bg, borderRadius: 8, padding: "4px 8px", textAlign: "center", maxWidth: 110 }}>
                            {(a.performance ?? "").replace(/_/g, " ")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          )}

          {activeTab === "papers" && (
            <Section title="Past Papers" emoji="🗂">
              <div style={{ background: "var(--vs-card)", borderRadius: 14, border: "1px dashed var(--vs-border)", padding: "32px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🗂</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--vs-text)", marginBottom: 6 }}>Past Papers Coming Soon</div>
                <div style={{ fontSize: 12, color: "var(--vs-muted)", lineHeight: 1.6 }}>KCPE, KCSE and school-based papers will live here.</div>
              </div>
            </Section>
          )}

        </div>
      )}
    </div>
  );
}
