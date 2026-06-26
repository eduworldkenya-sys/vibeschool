"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { nairobiDateStr } from "@/lib/time";

const C = {
  bg:          "#000000",
  surface:     "#09090b",
  surface2:    "#111113",
  border:      "#1f1f23",
  border2:     "#2a2a30",
  text:        "#f4f4f5",
  text2:       "#a1a1aa",
  text3:       "#52525b",
  emerald:     "#10b981",
  emeraldDim:  "#064e3b",
  emeraldGlow: "rgba(16,185,129,0.15)",
  indigo:      "#6366f1",
  indigoDim:   "#1e1b4b",
  amber:       "#f59e0b",
  amberDim:    "#78350f",
  red:         "#ef4444",
  redDim:      "#7f1d1d",
} as const;

interface SubjectSummary {
  id:          string;
  name:        string;
  lessonCount: number;
  assessCount: number;
  masteredPct: number | null;
  assessedPct: number | null;
  coveragePct: number | null;
  avgPerfPct:  number | null;
  classes:     number;
}

interface TermStat {
  totalLessons:   number;
  totalAssess:    number;
  tpadScore:      number;
  subjectCount:   number;
  studentCount:   number;
}

function barColor(pct: number) {
  return pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";
}

function Skeleton({ h = 56 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: "linear-gradient(90deg,#1f1f23 25%,#2a2a30 50%,#1f1f23 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }} />
  );
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ width: "100%", height: 4, borderRadius: 4, background: "#2a2a30", overflow: "hidden" }}>
      <div style={{
        width: pct + "%", height: "100%", borderRadius: 4,
        background: color, transition: "width 0.4s ease",
      }} />
    </div>
  );
}

export default function TeacherAcademicsPage() {
  const router = useRouter();
  const [loading,   setLoading]   = useState(true);
  const [subjects,  setSubjects]  = useState<SubjectSummary[]>([]);
  const [termStats, setTermStats] = useState<TermStat | null>(null);
  const [activeTerm,setActiveTerm]= useState(1);
  const [expanded,  setExpanded]  = useState<string | null>(null);

  const boot = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/?role=teacher"); return; }

      const termStart = nairobiDateStr(
        new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 4) * 4, 1)
      );

      const { data: tcRows } = await supabase
        .from("teacher_classes")
        .select("class_id, subject_id")
        .eq("teacher_id", user.id);

      const rows       = tcRows ?? [];
      const subjectIds = Array.from(new Set(rows.map((r: any) => r.subject_id).filter(Boolean)));
      const classIds   = Array.from(new Set(rows.map((r: any) => r.class_id).filter(Boolean)));

      if (subjectIds.length === 0) { setLoading(false); return; }

      const [subRes, lpRes, assRes, outcomeRes, perfRes, studentRes] = await Promise.all([
        supabase.from("subjects").select("id, name").in("id", subjectIds),
        supabase.from("lesson_plans").select("id, subject_id").eq("teacher_id", user.id).gte("created_at", termStart),
        supabase.from("cbc_assessments").select("id, subject_id, performance").eq("teacher_id", user.id).gte("created_at", termStart),
        supabase.from("learner_outcomes").select("subject_id, status").in("subject_id", subjectIds),
        supabase.from("cbc_assessments").select("subject_id, performance").eq("teacher_id", user.id).gte("created_at", termStart),
        classIds.length > 0
          ? supabase.from("student_classes").select("student_id, class_id").in("class_id", classIds).eq("is_current", true)
          : Promise.resolve({ data: [] }),
      ]);

      const subList     = (subRes.data     ?? []) as { id: string; name: string }[];
      const lpData      = (lpRes.data      ?? []) as { id: string; subject_id: string }[];
      const assData     = (assRes.data     ?? []) as { id: string; subject_id: string; performance: string }[];
      const outcomeData = (outcomeRes.data ?? []) as { subject_id: string; status: string }[];
      const perfData    = (perfRes.data    ?? []) as { subject_id: string; performance: string }[];
      const studentData = (studentRes.data ?? []) as { student_id: string; class_id: string }[];

      const PERF_SCORE: Record<string, number> = {
        exceeds_expectation: 4, meets_expectation: 3,
        approaches_expectation: 2, below_expectation: 1,
      };

      const subjectClassMap: Record<string, Set<string>> = {};
      for (const r of rows as any[]) {
        if (!subjectClassMap[r.subject_id]) subjectClassMap[r.subject_id] = new Set();
        subjectClassMap[r.subject_id].add(r.class_id);
      }

      const classStudentCount: Record<string, number> = {};
      for (const r of studentData) {
        classStudentCount[r.class_id] = (classStudentCount[r.class_id] ?? 0) + 1;
      }
      const totalStudents = Object.values(classStudentCount).reduce((a, b) => a + b, 0);

      const summaries: SubjectSummary[] = subList.map(sub => {
        const lCount   = lpData.filter(l => l.subject_id === sub.id).length;
        const aCount   = assData.filter(a => a.subject_id === sub.id).length;
        const outcomes = outcomeData.filter(o => o.subject_id === sub.id);
        const total    = outcomes.length;
        const covered  = outcomes.filter(o => ["assessed","mastered"].includes(o.status ?? "")).length;
        const assessed = outcomes.filter(o => o.status === "assessed").length;
        const mastered = outcomes.filter(o => o.status === "mastered").length;
        const perfs    = perfData.filter(p => p.subject_id === sub.id);
        const perfSum  = perfs.reduce((s, p) => s + (PERF_SCORE[p.performance] ?? 0), 0);
        const avgPerf  = perfs.length > 0 ? Math.round((perfSum / (perfs.length * 4)) * 100) : null;
        return {
          id:          sub.id,
          name:        sub.name,
          lessonCount: lCount,
          assessCount: aCount,
          coveragePct: total > 0 ? Math.round((covered  / total) * 100) : null,
          assessedPct: total > 0 ? Math.round((assessed / total) * 100) : null,
          masteredPct: total > 0 ? Math.round((mastered / total) * 100) : null,
          avgPerfPct:  avgPerf,
          classes:     subjectClassMap[sub.id]?.size ?? 0,
        };
      });

      setSubjects(summaries);
      setActiveTerm(Math.floor(new Date().getMonth() / 4) + 1);
      setTermStats({
        totalLessons:  lpData.length,
        totalAssess:   assData.length,
        tpadScore:     (lpData.length * 15) + (assData.length * 8),
        subjectCount:  subList.length,
        studentCount:  totalStudents,
      });
    } catch (e) {
      console.error("TeacherAcademics boot", e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { boot(); }, [boot]);

  const overallMastery = subjects.length > 0
    ? Math.round(subjects.reduce((s, sub) => s + (sub.masteredPct ?? 0), 0) / subjects.length)
    : 0;

  return (
    <div style={{ background: "#000000", minHeight: "100vh", paddingBottom: 100, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
      `}</style>

      {/* HERO */}
      <div style={{ background: "linear-gradient(135deg,#064e3b 0%,#065f46 50%,#10b981 150%)", padding: "24px 20px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}>← Back</button>
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>My Academics</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>Term {activeTerm} Overview</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>All subjects · All classes · One view</div>
        {!loading && termStats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 20 }}>
            {[
              { label: "Subjects",  value: termStats.subjectCount, color: "#5eead4" },
              { label: "Students",  value: termStats.studentCount, color: "#a5f3fc" },
              { label: "Lessons",   value: termStats.totalLessons, color: "#86efac" },
              { label: "Assessed",  value: termStats.totalAssess,  color: "#fde68a" },
            ].map(s => (
              <div key={s.label} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "16px" }}>

        {/* MASTERY RING */}
        {!loading && subjects.length > 0 && (
          <div style={{ background: "#09090b", borderRadius: 20, border: "1px solid #1f1f23", padding: 18, marginBottom: 14, animation: "fadeUp 0.3s ease" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#52525b", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>School-wide Mastery</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "conic-gradient(" + barColor(overallMastery) + " " + (overallMastery * 3.6) + "deg, #2a2a30 0deg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#09090b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: barColor(overallMastery) }}>{overallMastery}%</div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#f4f4f5" }}>{overallMastery >= 70 ? "On Track" : overallMastery >= 40 ? "Needs Attention" : "Behind"}</div>
                <div style={{ fontSize: 12, color: "#a1a1aa", marginTop: 2 }}>Avg mastery across {subjects.length} subject{subjects.length !== 1 ? "s" : ""}</div>
              </div>
            </div>
            {termStats && (
              <div style={{ background: "#1e1b4b", borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#a5b4fc", letterSpacing: 1, textTransform: "uppercase" }}>TPAD Impact Score</div>
                  <div style={{ fontSize: 13, color: "#c7d2fe", marginTop: 2 }}>Evidence ready for TSC</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#818cf8" }}>{termStats.tpadScore}</div>
              </div>
            )}
          </div>
        )}

        {/* SUBJECT CARDS */}
        <div style={{ fontSize: 10, fontWeight: 800, color: "#52525b", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Subject Breakdown</div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1,2,3].map(i => <Skeleton key={i} h={90} />)}
          </div>
        ) : subjects.length === 0 ? (
          <div style={{ background: "#09090b", borderRadius: 16, border: "1.5px dashed #2a2a30", padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#f4f4f5", marginBottom: 6 }}>No subjects assigned</div>
            <div style={{ fontSize: 13, color: "#52525b" }}>Go to SubjectHub to claim your subjects.</div>
            <button onClick={() => router.push("/teacher/subjecthub")} style={{ marginTop: 16, padding: "10px 24px", borderRadius: 12, background: "#10b981", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Go to SubjectHub</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {subjects.map(sub => {
              const isOpen = expanded === sub.id;
              const mp     = sub.masteredPct;
              const hColor = mp === null ? "#52525b" : mp >= 70 ? "#10b981" : mp >= 40 ? "#f59e0b" : "#ef4444";
              const hBg    = mp === null ? "#111113" : mp >= 70 ? "#064e3b" : mp >= 40 ? "#78350f" : "#7f1d1d";
              const hLabel = mp === null ? "No data" : mp >= 70 ? "On Track" : mp >= 40 ? "Watch" : "Alert";
              return (
                <div key={sub.id} style={{ background: "#09090b", borderRadius: 16, border: "1px solid " + (isOpen ? "#10b98144" : "#1f1f23"), overflow: "hidden", transition: "border-color 0.2s", animation: "fadeUp 0.25s ease" }}>
                  <div onClick={() => setExpanded(isOpen ? null : sub.id)} style={{ padding: "16px", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#f4f4f5" }}>{sub.name}</div>
                        <div style={{ fontSize: 11, color: "#52525b", marginTop: 2 }}>{sub.classes} class{sub.classes !== 1 ? "es" : ""} · {sub.lessonCount} lessons · {sub.assessCount} assessments</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: hColor, background: hBg, padding: "3px 10px", borderRadius: 20 }}>{hLabel}</div>
                        <div style={{ fontSize: 16, color: "#52525b", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {[
                        { label: "Coverage", pct: sub.coveragePct, color: "#075985" },
                        { label: "Assessed", pct: sub.assessedPct, color: "#6366f1" },
                        { label: "Mastered", pct: sub.masteredPct, color: "#10b981" },
                      ].map(({ label, pct, color }) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontSize: 10, color: "#52525b", fontWeight: 600, width: 58, flexShrink: 0 }}>{label}</div>
                          <div style={{ flex: 1 }}><MiniBar pct={pct ?? 0} color={pct !== null ? color : "#2a2a30"} /></div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: pct !== null ? color : "#52525b", width: 32, textAlign: "right" }}>{pct !== null ? pct + "%" : "—"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop: "1px solid #1f1f23", padding: "14px 16px" }}>
                      {sub.avgPerfPct !== null && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: "#a1a1aa", fontWeight: 600 }}>Avg Performance</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: barColor(sub.avgPerfPct) }}>{sub.avgPerfPct}%</span>
                          </div>
                          <MiniBar pct={sub.avgPerfPct} color={barColor(sub.avgPerfPct)} />
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                          { label: "Lesson Plans", icon: "📖", route: "/teacher/lessonplan?subjectId=" + sub.id },
                          { label: "Lesson Notes", icon: "📝", route: "/teacher/lessonnotes"                    },
                          { label: "Assessment",   icon: "📊", route: "/teacher/assessment?subjectId=" + sub.id },
                          { label: "Scheme",       icon: "📋", route: "/teacher/scheme?subjectId=" + sub.id    },
                        ].map(a => (
                          <button key={a.label} onClick={() => router.push(a.route)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #2a2a30", background: "#111113", cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 16 }}>{a.icon}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#a1a1aa" }}>{a.label}</span>
                          </button>
                        ))}
                      </div>
                      <button onClick={() => router.push("/teacher/subjecthub")} style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 12, border: "none", background: "#064e3b", color: "#10b981", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Open in SubjectHub →</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* QUICK NAV */}
        {!loading && subjects.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#52525b", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Quick Actions</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[
                { label: "SubjectHub",   icon: "🔬", route: "/teacher/subjecthub",  bg: "#075985" },
                { label: "Scheme",       icon: "📋", route: "/teacher/scheme",       bg: "#1e1b4b" },
                { label: "Assessment",   icon: "📊", route: "/teacher/assessment",   bg: "#92400e" },
                { label: "Lesson Plans", icon: "📖", route: "/teacher/lessonplan",   bg: "#6d28d9" },
                { label: "Lesson Notes", icon: "📝", route: "/teacher/lessonnotes",  bg: "#065f46" },
                { label: "TPAD",         icon: "🏅", route: "/teacher/tpad",         bg: "#1e1b4b" },
              ].map(a => (
                <button key={a.label} onClick={() => router.push(a.route)} style={{ padding: "14px 4px", borderRadius: 14, border: "none", background: a.bg, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 22 }}>{a.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", textAlign: "center", lineHeight: 1.3 }}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
