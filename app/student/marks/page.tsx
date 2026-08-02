"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStudent } from "@/lib/student-context";
import { readCache, writeCache } from "@/lib/student-cache";
import Skel from "@/components/student/Skel";

interface ExamResult {
  id: string; subject: string; marks: number; total_marks: number;
  grade: string; term: number; academic_year: number; exam_name: string;
}
interface CBCAssessment {
  id: string; subjectName: string; sub_strand: string;
  assessment_type: string; performance: string; term: number; academic_year: number;
}
interface TraditionalGrade {
  id: string; subject: string; grade: string; marks: number;
  total_marks: number; term: number; academic_year: number;
}

type Tab = "exams" | "cbc" | "grades"

function IconStar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}
function IconChart() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function gradColor(g: string): string {
  const map: Record<string, string> = { A: "#059669", B: "#0284c7", C: "#d97706", D: "#dc2626", E: "#7c3aed" }
  return map[g?.toUpperCase()?.[0]] ?? "var(--vs-accent)"
}

function perfColor(p: string): string {
  const map: Record<string, string> = {
    "exceeds expectation": "#059669", "meets expectation": "#0284c7",
    "approaches expectation": "#d97706", "below expectation": "#dc2626",
  }
  return map[p?.toLowerCase()] ?? "var(--vs-accent)"
}

function pct(marks: number, total: number): number {
  return total > 0 ? Math.round((marks / total) * 100) : 0
}

function letterGrade(percentage: number): string {
  if (percentage >= 80) return "A"
  if (percentage >= 70) return "B"
  if (percentage >= 60) return "C"
  if (percentage >= 50) return "D"
  return "E"
}

export default function MarksPage() {
  const { identity, loading: idLoading } = useStudent();
  const [tab,        setTab]        = useState<Tab>("exams");
  const [exams,      setExams]      = useState<ExamResult[]>([]);
  const [cbc,        setCbc]        = useState<CBCAssessment[]>([]);
  const [grades,     setGrades]     = useState<TraditionalGrade[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (idLoading || !identity) return;

    const cached = readCache<{ exams: ExamResult[]; cbc: CBCAssessment[]; grades: TraditionalGrade[] }>("marks", identity.studentId);
    if (cached) { setExams(cached.exams); setCbc(cached.cbc); setGrades(cached.grades); setLoading(false); }

    async function load() {
      const [examRes, cbcRes, gradeRes] = await Promise.all([
        supabase
          .from("exam_results")
          .select(
            "id, marks, is_absent, exam_id, subject_id, exams(name, term, academic_year)"
          )
          .eq("student_id", identity!.studentId),

        supabase
          .from("cbc_assessments")
          .select(
            "id, subject_id, sub_strand, assessment_type, performance, term, academic_year"
          )
          .eq("student_id", identity!.studentId),

        supabase
          .from("traditional_grades")
          .select(
            "id, marks, out_of, term, academic_year, subject_id"
          )
          .eq("student_id", identity!.studentId),
      ]);

      // Collect all subject ids
      const subIds = Array.from(
        new Set([
          ...(examRes.data ?? []).map(row => row.subject_id),
          ...(cbcRes.data ?? []).map(row => row.subject_id),
          ...(gradeRes.data ?? []).map(row => row.subject_id),
        ])
      );

      let subMap: Record<string, string> = {};
      if (subIds.length > 0) {
        const { data: subs } = await supabase.from("subjects").select("id, name").in("id", subIds);
        subMap = Object.fromEntries((subs ?? []).map(s => [s.id, s.name]));
      }

      const examData: ExamResult[] = (examRes.data ?? [])
        .filter(row => !row.is_absent)
        .map(row => {
          const exam = Array.isArray(row.exams)
            ? row.exams[0] ?? null
            : row.exams

          const marks = Number(row.marks)
          const totalMarks = 100
          const percentage = pct(marks, totalMarks)

          return {
            id: row.id,
            marks,
            total_marks: totalMarks,
            grade: letterGrade(percentage),
            term: exam?.term ?? 0,
            academic_year: exam?.academic_year ?? 0,
            subject: subMap[row.subject_id] ?? "Subject",
            exam_name: exam?.name ?? "",
          }
        });

      const cbcData: CBCAssessment[] = (cbcRes.data ?? []).map(row => ({
        id: row.id,
        sub_strand: row.sub_strand ?? "General competency",
        assessment_type: row.assessment_type,
        performance: row.performance,
        term: row.term,
        academic_year: row.academic_year,
        subjectName: subMap[row.subject_id] ?? "Subject",
      }));

      const gradeData: TraditionalGrade[] = (gradeRes.data ?? []).map(row => {
        const marks = Number(row.marks)
        const totalMarks = Number(row.out_of)
        const percentage = pct(marks, totalMarks)

        return {
          id: row.id,
          marks,
          total_marks: totalMarks,
          grade: letterGrade(percentage),
          term: row.term,
          academic_year: row.academic_year,
          subject: subMap[row.subject_id] ?? "Subject",
        }
      });

      const fresh = { exams: examData, cbc: cbcData, grades: gradeData };
      writeCache("marks", identity!.studentId, fresh);
      setExams(examData); setCbc(cbcData); setGrades(gradeData);
      setLoading(false);
    }
    load();
  }, [identity, idLoading]);

  const isLoading = idLoading || (loading && exams.length === 0 && cbc.length === 0 && grades.length === 0);

  if (isLoading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
      <Skel h={44} radius={12} /><Skel h={80} radius={12} /><Skel h={80} radius={12} />
    </div>
  );

  const TABS = [
    { id: "exams",  label: "Exams",   icon: <IconChart />, count: exams.length  },
    { id: "cbc",    label: "CBC",     icon: <IconStar />,  count: cbc.length    },
    { id: "grades", label: "Grades",  icon: <IconCheck />, count: grades.length },
  ] as const;

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--vs-text)", fontFamily: "'Bricolage Grotesque', sans-serif" }}>My Progress</h1>
        <p style={{ fontSize: 12, color: "var(--vs-muted)", marginTop: 2 }}>Your results and assessments</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            style={{
              flex: 1, padding: "10px 4px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
              border:      tab === t.id ? "none" : "1px solid var(--vs-border)",
              background:  tab === t.id ? "var(--vs-accent)" : "var(--vs-card)",
              color:       tab === t.id ? "#fff" : "var(--vs-muted)",
              fontWeight:  tab === t.id ? 800 : 500, fontSize: 12, textAlign: "center",
            }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>{t.icon}{t.label}</div>
            <div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>{t.count} record{t.count !== 1 ? "s" : ""}</div>
          </button>
        ))}
      </div>

      {/* Exams */}
      {tab === "exams" && (
        exams.length === 0 ? (
          <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "var(--vs-muted)" }}>No exam results yet</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {exams.map(r => (
              <div key={r.id} style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--vs-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: gradColor(r.grade), flexShrink: 0 }}>
                  {r.grade || "—"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vs-text)" }}>{r.subject}</div>
                  <div style={{ fontSize: 11, color: "var(--vs-muted)", marginTop: 2 }}>Term {r.term} · {r.academic_year}</div>
                  <div style={{ marginTop: 6, height: 4, borderRadius: 4, background: "var(--vs-border)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct(r.marks, r.total_marks)}%`, background: gradColor(r.grade), borderRadius: 4, transition: "width 0.4s ease" }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: gradColor(r.grade) }}>{pct(r.marks, r.total_marks)}%</div>
                  <div style={{ fontSize: 10, color: "var(--vs-muted)" }}>{r.marks}/{r.total_marks}</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* CBC */}
      {tab === "cbc" && (
        cbc.length === 0 ? (
          <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "var(--vs-muted)" }}>No CBC assessments yet</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cbc.map(r => (
              <div key={r.id} style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vs-text)" }}>{r.subjectName}</div>
                    <div style={{ fontSize: 11, color: "var(--vs-muted)", marginTop: 2 }}>{r.sub_strand}</div>
                    <div style={{ fontSize: 10, color: "var(--vs-muted)", marginTop: 2 }}>Term {r.term} · {r.academic_year}</div>
                  </div>
                  <div style={{ padding: "4px 10px", borderRadius: 20, background: perfColor(r.performance) + "22", color: perfColor(r.performance), fontSize: 10, fontWeight: 700, flexShrink: 0, textAlign: "center" }}>
                    {r.performance}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Traditional grades */}
      {tab === "grades" && (
        grades.length === 0 ? (
          <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "var(--vs-muted)" }}>No grades recorded yet</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {grades.map(r => (
              <div key={r.id} style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--vs-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: gradColor(r.grade), flexShrink: 0 }}>
                  {r.grade || "—"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vs-text)" }}>{r.subject}</div>
                  <div style={{ fontSize: 11, color: "var(--vs-muted)", marginTop: 2 }}>Term {r.term} · {r.academic_year}</div>
                  <div style={{ marginTop: 6, height: 4, borderRadius: 4, background: "var(--vs-border)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct(r.marks, r.total_marks)}%`, background: gradColor(r.grade), borderRadius: 4 }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: gradColor(r.grade) }}>{pct(r.marks, r.total_marks)}%</div>
                  <div style={{ fontSize: 10, color: "var(--vs-muted)" }}>{r.marks}/{r.total_marks}</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
