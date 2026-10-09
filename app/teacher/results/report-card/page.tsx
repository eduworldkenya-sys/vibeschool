"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadProgressAuthority, loadProgressRoster } from "@/lib/learner-intelligence/progress-data";

interface ClassOption { id: string; name: string; stream: string | null; }
interface Student { id: string; name: string; admission_number: string | null; }
interface Exam { id: string; name: string; term: number; academic_year: number; exam_type: string; }
interface StudentSummary { student: Student; totalMarks: number; subjectCount: number; meanGrade: string; hasRemarks: boolean; position: number | null; }

function getGrade(marks: number): string {
  if (marks >= 80) return "EE"; if (marks >= 60) return "ME"; if (marks >= 40) return "AE"; return "BE";
}
function gradeColor(grade: string): { bg: string; color: string } {
  if (grade === "EE") return { bg: "#d1fae5", color: "#065f46" };
  if (grade === "ME") return { bg: "#dbeafe", color: "#1e40af" };
  if (grade === "AE") return { bg: "#fef3c7", color: "#92400e" };
  return { bg: "#fee2e2", color: "#991b1b" };
}
function Skel({ h = 48 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 14, background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />;
}
function initials(name: string): string {
  return name.trim().split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join("");
}
function avatarColor(name: string): string {
  const colors = ["#7c3aed","#0284c7","#059669","#d97706","#db2777","#1e1b4b","#0f766e","#6d28d9"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

function PickerInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [step,        setStep]        = useState<"class" | "exam" | "students">("class");
  const [classes,     setClasses]     = useState<ClassOption[]>([]);
  const [exams,       setExams]       = useState<Exam[]>([]);
  const [summaries,   setSummaries]   = useState<StudentSummary[]>([]);
  const [selectedCls, setSelectedCls] = useState<ClassOption | null>(null);
  const [selectedExam,setSelectedExam]= useState<Exam | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");

  const [error, setError] = useState("");
  const request = useRef(0);

  async function loadClasses() {
    const current = ++request.current;
    setLoading(true); setError("");
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push("/"); return; }
      const response = await supabase.rpc("teacher_get_operating_context");
      if (response.error) throw response.error;
      const context = response.data;
      if (!context || typeof context !== "object" || Array.isArray(context) || context.teacher_id !== user.id || typeof context.school_id !== "string") throw new Error("Your active teacher school could not be confirmed.");
      const options = new Map<string, ClassOption>();
      for (const assignment of Array.isArray(context.classes) ? context.classes : []) {
        if (!assignment || typeof assignment !== "object" || Array.isArray(assignment) || typeof assignment.class_id !== "string") throw new Error("Your class assignments could not be read.");
        options.set(assignment.class_id, { id: assignment.class_id, name: typeof assignment.class_name === "string" ? assignment.class_name : "Class", stream: typeof assignment.stream === "string" ? assignment.stream : null });
      }
      if (current === request.current) setClasses(Array.from(options.values()));
    } catch (failure) {
      if (current === request.current) setError(failure instanceof Error ? failure.message : "Classes could not be loaded. Try again.");
    } finally { if (current === request.current) setLoading(false); }
  }

  useEffect(() => { void loadClasses(); return () => { ++request.current; }; }, []);

  async function loadExams(cls: ClassOption) {
    const current = ++request.current;
    setSelectedCls(cls); setSelectedExam(null); setExams([]); setSummaries([]);
    setLoading(true); setError(""); setStep("exam");
    try {
      const authority = await loadProgressAuthority(cls.id);
      const { data: examRows, error: resultError } = await supabase.from("exam_results").select("exam_id").eq("class_id", cls.id).eq("school_id", authority.schoolId);
      if (resultError) throw resultError;
      const examIds = Array.from(new Set((examRows ?? []).map(row => row.exam_id).filter((id): id is string => typeof id === "string" && id.length > 0)));
      const response = examIds.length ? await supabase.from("exams").select("id, name, term, academic_year, exam_type").in("id", examIds).order("academic_year", { ascending: false }).order("term", { ascending: false }) : { data: [], error: null };
      if (response.error) throw response.error;
      if (current === request.current) setExams(response.data ?? []);
    } catch (failure) {
      if (current === request.current) setError(failure instanceof Error ? failure.message : "Exams could not be loaded. Try again.");
    } finally { if (current === request.current) setLoading(false); }
  }

  async function loadStudents(exam: Exam) {
    if (!selectedCls) return;
    const current = ++request.current;
    setSelectedExam(exam); setLoading(true); setError(""); setSearch(""); setSummaries([]); setStep("students");
    try {
    const authority = await loadProgressAuthority(selectedCls.id);
    const [resultResponse, students, remarkResponse] = await Promise.all([
      supabase.from("exam_results").select("student_id, marks, is_absent").eq("exam_id", exam.id).eq("class_id", authority.classId).eq("school_id", authority.schoolId),
      loadProgressRoster(authority, false),
      supabase.from("report_card_remarks").select("student_id").eq("exam_id", exam.id).eq("class_id", authority.classId).eq("school_id", authority.schoolId),
    ]);
    if (resultResponse.error) throw resultResponse.error;
    if (remarkResponse.error) throw remarkResponse.error;
    const results = resultResponse.data, remarkRows = remarkResponse.data;
    const remarkedSet = new Set((remarkRows ?? []).map(r => r.student_id));
    const resultMap: Record<string, { total: number; count: number }> = {};
    for (const r of (results ?? []) as { student_id: string; marks: number; is_absent: boolean }[]) {
      if (!r.is_absent) { if (!resultMap[r.student_id]) resultMap[r.student_id] = { total: 0, count: 0 }; resultMap[r.student_id].total += r.marks; resultMap[r.student_id].count += 1; }
    }
    const totals = students.map(s => ({ id: s.id, total: resultMap[s.id]?.total ?? 0 }));
    const sorted = [...totals].sort((a, b) => b.total - a.total);
    const built: StudentSummary[] = students.map(s => {
      const rm = resultMap[s.id]; const total = rm?.total ?? 0; const count = rm?.count ?? 0;
      const mean = count > 0 ? total / count : 0; const grade = count > 0 ? getGrade(mean) : "—";
      const pos  = count > 0 ? sorted.findIndex(x => x.id === s.id) + 1 : null;
      return { student: s, totalMarks: total, subjectCount: count, meanGrade: grade, hasRemarks: remarkedSet.has(s.id), position: pos };
    });
    built.sort((a, b) => { if (a.position === null && b.position === null) return a.student.name.localeCompare(b.student.name); if (a.position === null) return 1; if (b.position === null) return -1; return a.position - b.position; });
    if (current === request.current) setSummaries(built);
    } catch (failure) {
      if (current === request.current) setError(failure instanceof Error ? failure.message : "Report cards could not be loaded. Try again.");
    } finally { if (current === request.current) setLoading(false); }
  }

  const filteredSummaries = summaries.filter(s => s.student.name.toLowerCase().includes(search.toLowerCase()) || (s.student.admission_number ?? "").toLowerCase().includes(search.toLowerCase()));
  const remarkedCount   = summaries.filter(s => s.hasRemarks).length;
  const totalStudentCnt = summaries.length;

  return (
    <div style={{ paddingBottom: 100 }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ background: "#fff", border: "1px solid var(--teacher-border)", borderRadius: 20, padding: "20px", marginBottom: 16, color: "var(--teacher-ink)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" as const }}>
          <button type="button" style={{ minHeight: 44, background: "transparent", border: 0, font: "inherit", color: "var(--teacher-muted)", cursor: "pointer", fontWeight: 600 }} onClick={() => { ++request.current; setError(""); setLoading(false); setStep("class"); setSelectedCls(null); setSelectedExam(null); setSummaries([]); }}>Classes</button>
          {selectedCls && (<><span style={{ fontSize: 11, color: "var(--teacher-muted)" }}>›</span><button type="button" style={{ minHeight: 44, background: "transparent", border: 0, font: "inherit", color: step === "exam" ? "var(--teacher-ink)" : "var(--teacher-muted)", cursor: step === "students" ? "pointer" : "default", fontWeight: 600 }} onClick={() => { if (step === "students") { ++request.current; setError(""); setLoading(false); setStep("exam"); setSummaries([]); setSelectedExam(null); } }}>{selectedCls.name}{selectedCls.stream ? ` ${selectedCls.stream}` : ""}</button></>)}
          {selectedExam && (<><span style={{ fontSize: 11, color: "var(--teacher-muted)" }}>›</span><span style={{ fontSize: 11, color: "var(--teacher-ink)", fontWeight: 600 }}>{selectedExam.name}</span></>)}
        </div>
        <div style={{ fontSize: 11, color: "var(--teacher-muted)", fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase" as const }}>Report Cards</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 0" }}>
          {step === "class" ? "Select Class" : step === "exam" ? `${selectedCls?.name} — Select Exam` : `${selectedExam?.name} · Term ${selectedExam?.term}`}
        </h1>
        {step === "students" && totalStudentCnt > 0 && (
          <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "var(--teacher-muted)" }}><span style={{ fontWeight: 800, color: "var(--teacher-green, #087451)", fontSize: 14 }}>{remarkedCount}</span>/{totalStudentCnt} remarked</div>
            <div style={{ flex: 1, alignSelf: "center" }}><div style={{ height: 4, borderRadius: 4, background: "var(--teacher-border)" }}><div style={{ height: 4, borderRadius: 4, background: "var(--teacher-green, #087451)", width: `${totalStudentCnt > 0 ? (remarkedCount / totalStudentCnt) * 100 : 0}%`, transition: "width 0.5s ease" }} /></div></div>
          </div>
        )}
      </div>

      {error && <div role="alert" style={{ padding: 16, marginBottom: 16, border: "1px solid var(--teacher-border)", borderRadius: 14, background: "#fff", color: "var(--teacher-ink)" }}>
        <p>{error}</p><button type="button" style={{ minHeight: 44, padding: "8px 16px" }} onClick={() => { if (step === "students" && selectedExam) void loadStudents(selectedExam); else if (step === "exam" && selectedCls) void loadExams(selectedCls); else void loadClasses(); }}>Try again</button>
      </div>}
      {!error && <>
      {/* Step 1: Class */}
      {step === "class" && (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, animation: "fadeUp 0.25s ease" }}>
          {loading ? [1,2,3].map(i => <Skel key={i} h={72} />) : classes.length === 0 ? (
            <div style={{ textAlign: "center" as const, padding: 40, color: "var(--teacher-muted, #627168)", fontSize: 13 }}>No classes found. Create a class in ClassHub first.</div>
          ) : classes.map(cls => (
            <button key={cls.id} onClick={() => loadExams(cls)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", borderRadius: 16, background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const, width: "100%", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: "linear-gradient(135deg,#1e1b4b,#2d2a6e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📋</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: "var(--teacher-ink, #1c2923)" }}>{cls.name}{cls.stream ? ` · ${cls.stream}` : ""}</div><div style={{ fontSize: 12, color: "var(--teacher-muted, #627168)", marginTop: 2 }}>Tap to view exams</div></div>
              <span style={{ fontSize: 18, color: "var(--teacher-muted, #627168)" }}>›</span>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Exam */}
      {step === "exam" && (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, animation: "fadeUp 0.25s ease" }}>
          {loading ? [1,2,3].map(i => <Skel key={i} h={72} />) : exams.length === 0 ? (
            <div style={{ textAlign: "center" as const, padding: 40, color: "var(--teacher-muted, #627168)", fontSize: 13 }}>No exams recorded for this class yet.</div>
          ) : exams.map(exam => {
            const typeColors: Record<string, { bg: string; color: string }> = { endterm: { bg: "#fee2e2", color: "#991b1b" }, midterm: { bg: "#fef3c7", color: "#92400e" }, opener: { bg: "#d1fae5", color: "#065f46" }, cat: { bg: "#dbeafe", color: "#1e40af" }, summative: { bg: "#ede9fe", color: "#5b21b6" } };
            const tc = typeColors[exam.exam_type] ?? { bg: "#f3f4f6", color: "#374151" };
            return (
              <button key={exam.id} onClick={() => loadStudents(exam)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", borderRadius: 16, background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const, width: "100%", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: tc.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 11, fontWeight: 800, color: tc.color, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{exam.exam_type.slice(0, 3).toUpperCase()}</span></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: "var(--teacher-ink, #1c2923)" }}>{exam.name}</div><div style={{ fontSize: 12, color: "var(--teacher-muted, #627168)", marginTop: 2 }}>Term {exam.term} · {exam.academic_year}</div></div>
                <span style={{ fontSize: 18, color: "var(--teacher-muted, #627168)" }}>›</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Step 3: Students */}
      {step === "students" && (
        <div style={{ animation: "fadeUp 0.25s ease" }}>
          <div style={{ marginBottom: 14 }}>
            <input aria-label="Search students" placeholder="Search student or admission no…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "12px 16px", borderRadius: 14, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none", color: "var(--teacher-ink, #1c2923)", boxSizing: "border-box" as const, background: "#fff" }} />
          </div>
          {loading ? <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>{[1,2,3,4,5].map(i => <Skel key={i} h={76} />)}</div>
          : filteredSummaries.length === 0 ? <div style={{ textAlign: "center" as const, padding: 40, color: "var(--teacher-muted, #627168)", fontSize: 13 }}>{search ? "No students match your search." : "No students enrolled in this class."}</div>
          : (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {filteredSummaries.map((s) => {
                const gc  = s.meanGrade !== "—" ? gradeColor(s.meanGrade) : { bg: "#f3f4f6", color: "#9ca3af" };
                const ini = initials(s.student.name);
                const avc = avatarColor(s.student.name);
                return (
                  <button key={s.student.id} onClick={() => router.push(`/teacher/results/report-card/${s.student.id}?examId=${selectedExam?.id}&mode=844`)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 16, background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const, width: "100%", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: avc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff" }}>{ini}</div>
                      {s.position !== null && s.position <= 3 && (
                        <div style={{ position: "absolute", bottom: -4, right: -4, width: 20, height: 20, borderRadius: "50%", background: s.position === 1 ? "#f59e0b" : s.position === 2 ? "#9ca3af" : "#b45309", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 750, color: "#fff" }}>
                          {s.position === 1 ? "🥇" : s.position === 2 ? "🥈" : "🥉"}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--teacher-ink, #1c2923)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{s.student.name}</div>
                      <div style={{ fontSize: 11, color: "var(--teacher-muted, #627168)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                        {s.student.admission_number && <span>#{s.student.admission_number}</span>}
                        {s.position !== null && <span style={{ padding: "1px 6px", borderRadius: 6, background: "#f3f4f6", color: "#374151", fontSize: 11, fontWeight: 700 }}>Pos {s.position}/{totalStudentCnt}</span>}
                        {s.hasRemarks && <span style={{ fontSize: 11, color: "var(--teacher-green, #087451)", fontWeight: 700 }}>✓ Remarked</span>}
                      </div>
                    </div>
                    <div style={{ padding: "6px 12px", borderRadius: 10, background: gc.bg, color: gc.color, fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{s.meanGrade}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      </>}
    </div>
  );
}

export default function ReportCardPickerPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: "var(--teacher-muted, #627168)", fontSize: 13 }}>Loading…</div>}>
      <PickerInner />
    </Suspense>
  );
}
