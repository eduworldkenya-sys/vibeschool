"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"

type ClassRow = { id: string; name: string; stream: string | null }
type SubjectRow = { id: string; name: string }
type StudentRow = { id: string; name: string; admission_number: string | null }
type TermRow = { id: string; name: string; term: number; academic_year: number }
type ExamRow = { id: string; name: string; exam_type: string; pass_mark: number; is_locked: boolean }
type ResultRow = { exam_id: string; student_id: string; marks: number | null; is_absent: boolean }
type ConfigRow = { exam_id: string; subject_id: string; pass_mark: number; max_marks: number }

const fieldStyle = { width: "100%", boxSizing: "border-box" as const, border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 11px", background: "white", fontSize: 14 }

export default function AdminGradebookPage() {
  const [schoolId, setSchoolId] = useState("")
  const [term, setTerm] = useState<TermRow | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [classId, setClassId] = useState("")
  const [subjectId, setSubjectId] = useState("")
  const [students, setStudents] = useState<StudentRow[]>([])
  const [exams, setExams] = useState<ExamRow[]>([])
  const [configs, setConfigs] = useState<ConfigRow[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { void bootstrap() }, [])
  useEffect(() => { if (schoolId && classId && subjectId && term) void loadGradebook() }, [schoolId, classId, subjectId, term])

  async function bootstrap() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      setSchoolId(authority.schoolId)
      const [termRes, classRes, subjectRes] = await Promise.all([
        supabase.from("academic_terms").select("id,name,term,academic_year").eq("school_id", authority.schoolId).eq("status", "active").limit(1).maybeSingle(),
        supabase.from("classes").select("id,name,stream").eq("school_id", authority.schoolId).order("name").order("stream"),
        supabase.from("subjects").select("id,name").eq("school_id", authority.schoolId).order("name"),
      ])
      const firstError = [termRes.error, classRes.error, subjectRes.error].find(Boolean)
      if (firstError) throw firstError
      const classRows = (classRes.data ?? []) as ClassRow[]
      const subjectRows = (subjectRes.data ?? []) as SubjectRow[]
      setTerm(termRes.data as TermRow | null)
      setClasses(classRows)
      setSubjects(subjectRows)
      setClassId(classRows[0]?.id ?? "")
      setSubjectId(subjectRows[0]?.id ?? "")
    } catch (cause) {
      console.error("Admin gradebook bootstrap failed", cause)
      setError(cause instanceof Error ? cause.message : "Gradebook could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  async function loadGradebook() {
    if (!term) return
    setDetailLoading(true)
    setError("")
    try {
      const enrollmentRes = await supabase
        .from("student_classes")
        .select("student_id")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("is_current", true)
      if (enrollmentRes.error) throw enrollmentRes.error
      const studentIds = Array.from(new Set((enrollmentRes.data ?? []).map(row => row.student_id)))

      const [studentRes, examRes] = await Promise.all([
        studentIds.length ? supabase.from("students").select("id,name,admission_number").in("id", studentIds).is("deleted_at", null).order("name") : Promise.resolve({ data: [], error: null }),
        supabase.from("exams").select("id,name,exam_type,pass_mark,is_locked").eq("school_id", schoolId).eq("term", term.term).eq("academic_year", term.academic_year).order("created_at"),
      ])
      if (studentRes.error) throw studentRes.error
      if (examRes.error) throw examRes.error
      const examRows = (examRes.data ?? []) as ExamRow[]
      const examIds = examRows.map(row => row.id)

      const configRes = examIds.length
        ? await supabase.from("exam_subject_config").select("exam_id,subject_id,pass_mark,max_marks").in("exam_id", examIds).eq("subject_id", subjectId)
        : { data: [], error: null }
      if (configRes.error) throw configRes.error
      const configuredExamIds = new Set((configRes.data ?? []).map(row => row.exam_id))
      const relevantExams = examRows.filter(row => configuredExamIds.has(row.id))

      const resultRes = relevantExams.length && studentIds.length
        ? await supabase
            .from("exam_results")
            .select("exam_id,student_id,marks,is_absent")
            .eq("school_id", schoolId)
            .eq("class_id", classId)
            .eq("subject_id", subjectId)
            .in("exam_id", relevantExams.map(row => row.id))
            .in("student_id", studentIds)
        : { data: [], error: null }
      if (resultRes.error) throw resultRes.error

      setStudents((studentRes.data ?? []) as StudentRow[])
      setExams(relevantExams)
      setConfigs((configRes.data ?? []) as ConfigRow[])
      setResults((resultRes.data ?? []) as ResultRow[])
    } catch (cause) {
      console.error("Admin gradebook detail failed", cause)
      setError(cause instanceof Error ? cause.message : "Results could not be loaded.")
    } finally {
      setDetailLoading(false)
    }
  }

  const resultMap = useMemo(() => new Map(results.map(row => [`${row.exam_id}:${row.student_id}`, row])), [results])
  const configMap = useMemo(() => new Map(configs.map(row => [row.exam_id, row])), [configs])

  if (loading) return <div aria-busy="true" style={{ minHeight: 260, borderRadius: 18, background: "#e2e8f0" }} />

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
      <header><h1 style={{ margin: 0, fontSize: 24 }}>Assessments & results</h1><p style={{ color: "#64748b", margin: "5px 0 0" }}>{term ? `${term.name} · ${term.academic_year}` : "No active term"} · read-only school oversight of canonical exam results.</p></header>
      {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 12 }}>{error}</div>}
      {!term ? (
        <section style={{ background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 16, padding: 20 }}><strong>Activate an academic term first</strong><p style={{ color: "#92400e" }}>Assessment oversight is term-bound.</p></section>
      ) : classes.length === 0 || subjects.length === 0 ? (
        <section style={{ background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 16, padding: 20 }}><strong>Complete academic setup</strong><p style={{ color: "#92400e" }}>Classes and subjects must exist before results can be reconciled.</p></section>
      ) : (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 }}>
            <select aria-label="Class" value={classId} onChange={event => setClassId(event.target.value)} style={fieldStyle}>{classes.map(row => <option key={row.id} value={row.id}>{row.name}{row.stream ? ` ${row.stream}` : ""}</option>)}</select>
            <select aria-label="Subject" value={subjectId} onChange={event => setSubjectId(event.target.value)} style={fieldStyle}>{subjects.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
          </section>
          {detailLoading ? <div aria-busy="true" style={{ height: 180, background: "#e2e8f0", borderRadius: 16 }} /> : exams.length === 0 ? (
            <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 26, textAlign: "center" }}><strong>No configured exams for this subject</strong><p style={{ color: "#64748b" }}>Teacher-created assessments/results will appear here when they use the canonical exam and subject identity.</p></section>
          ) : (
            <section style={{ overflowX: "auto", background: "white", border: "1px solid #e2e8f0", borderRadius: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: Math.max(640, 250 + exams.length * 140) }}>
                <thead><tr><th style={{ textAlign: "left", padding: 12, position: "sticky", left: 0, background: "white" }}>Learner</th>{exams.map(exam => <th key={exam.id} style={{ textAlign: "left", padding: 12 }}>{exam.name}<div style={{ color: "#64748b", fontSize: 10 }}>{exam.exam_type}{exam.is_locked ? " · locked" : ""}</div></th>)}</tr></thead>
                <tbody>{students.map(student => (
                  <tr key={student.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ padding: 12, position: "sticky", left: 0, background: "white", minWidth: 220 }}><strong>{student.name}</strong><div style={{ color: "#64748b", fontSize: 11 }}>{student.admission_number || "No admission number"}</div></td>
                    {exams.map(exam => {
                      const result = resultMap.get(`${exam.id}:${student.id}`)
                      const config = configMap.get(exam.id)
                      const max = config?.max_marks ?? 100
                      const pass = config?.pass_mark ?? exam.pass_mark
                      const marks = result?.marks ?? null
                      const passed = marks !== null && marks >= pass
                      return <td key={exam.id} style={{ padding: 12 }}>{result?.is_absent ? <span style={{ color: "#b91c1c" }}>Absent</span> : marks === null ? <span style={{ color: "#94a3b8" }}>—</span> : <><strong style={{ color: passed ? "#047857" : "#b45309" }}>{marks}/{max}</strong><div style={{ color: "#64748b", fontSize: 10 }}>{Math.round((Number(marks) / Math.max(max, 1)) * 100)}%</div></>}</td>
                    })}
                  </tr>
                ))}</tbody>
              </table>
            </section>
          )}
        </>
      )}
    </main>
  )
}
