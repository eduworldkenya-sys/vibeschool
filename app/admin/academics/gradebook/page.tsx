"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

const dark   = "#1e1b4b"
const accent = "#10b981"
const bg     = "#f0f2f5"
const red    = "#ef4444"
const amber  = "#f59e0b"

interface Student { id: string; name: string; admission_number: string | null }
interface Subject { id: string; name: string }
interface Term    { id: string; name: string; year: number; status: string }
interface ClassRow { id: string; name: string; stream: string | null }
interface GradeRow { student_id: string; assessment_type: string; marks: number | null }

function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: dark, color: "#fff", padding: "12px 24px", borderRadius: 40,
      fontSize: 13, fontWeight: 700, zIndex: 9999, whiteSpace: "nowrap",
      boxShadow: "0 4px 24px rgba(0,0,0,0.25)", animation: "fadeIn 0.2s ease",
    }}>{msg}</div>
  )
}

function gradeLabel(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: "EE", color: accent }
  if (pct >= 60) return { label: "ME", color: "#3b82f6" }
  if (pct >= 40) return { label: "AE", color: amber }
  return { label: "BE", color: red }
}

export default function GradebookPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [schoolId,  setSchoolId]  = useState("")
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState("")
  const [classes,   setClasses]   = useState<ClassRow[]>([])
  const [subjects,  setSubjects]  = useState<Subject[]>([])
  const [terms,     setTerms]     = useState<Term[]>([])
  const [students,  setStudents]  = useState<Student[]>([])
  const [grades,    setGrades]    = useState<Record<string, Record<string, number | null>>>({})
  const [saving,    setSaving]    = useState<string | null>(null)

  const [classId,   setClassId]   = useState(searchParams.get("class") ?? "")
  const [subjectId, setSubjectId] = useState(searchParams.get("subject") ?? "")
  const [termId,    setTermId]    = useState("")

  const fireToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(""), 3000)
  }, [])

  useEffect(() => { bootstrap() }, [])

  async function bootstrap() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      const { data: p } = await supabase.from("profiles").select("school_id").eq("id", user.id).single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)

      const [classRes, termRes] = await Promise.all([
        supabase.from("classes").select("id,name,stream").eq("school_id", p.school_id).order("name"),
        supabase.from("academic_terms").select("id,name,year,status").eq("school_id", p.school_id).order("year", { ascending: false }),
      ])
      const classList = (classRes.data ?? []) as ClassRow[]
      const termList  = (termRes.data ?? []) as Term[]
      setClasses(classList)
      setTerms(termList)

      const activeTerm = termList.find(t => t.status === "open")
      if (activeTerm) setTermId(activeTerm.id)

      const initClass = searchParams.get("class") ?? (classList[0]?.id ?? "")
      if (initClass) {
        setClassId(initClass)
        await loadSubjects(p.school_id, initClass)
        await loadStudents(initClass)
      }
    } catch { router.push("/admin/login") }
    finally { setLoading(false) }
  }

  async function loadSubjects(sid: string, cid: string) {
    const { data } = await supabase.from("academic_subjects").select("id,name").eq("school_id", sid).eq("class_id", cid).is("deleted_at", null).order("name")
    const list = (data ?? []) as Subject[]
    setSubjects(list)
    const initSubject = searchParams.get("subject") ?? (list[0]?.id ?? "")
    if (initSubject) setSubjectId(initSubject)
  }

  async function loadStudents(cid: string) {
    const { data } = await supabase.from("students").select("id,name,admission_number").eq("class_id", cid).is("deleted_at", null).order("name")
    setStudents((data ?? []) as Student[])
  }

  async function loadGrades(sid: string, tid: string) {
    const { data } = await supabase
      .from("academic_grades")
      .select("student_id,assessment_type,marks")
      .eq("subject_id", sid)
      .eq("term_id", tid)

    const map: Record<string, Record<string, number | null>> = {}
    ;(data ?? []).forEach((g: GradeRow) => {
      if (!map[g.student_id]) map[g.student_id] = {}
      map[g.student_id][g.assessment_type] = g.marks
    })
    setGrades(map)
  }

  useEffect(() => {
    if (subjectId && termId) loadGrades(subjectId, termId)
  }, [subjectId, termId])

  useEffect(() => {
    if (classId && schoolId) {
      loadSubjects(schoolId, classId)
      loadStudents(classId)
    }
  }, [classId])

  async function handleMarkChange(studentId: string, assessmentType: string, value: string) {
    const marks = value === "" ? null : parseFloat(value)
    setGrades(g => ({
      ...g,
      [studentId]: { ...(g[studentId] ?? {}), [assessmentType]: marks }
    }))
  }

  async function saveGrade(studentId: string, assessmentType: string) {
    if (!subjectId || !termId) return
    const key = `${studentId}_${assessmentType}`
    setSaving(key)
    const marks = grades[studentId]?.[assessmentType] ?? null

    const { error } = await supabase.from("academic_grades").upsert({
      school_id:       schoolId,
      student_id:      studentId,
      subject_id:      subjectId,
      term_id:         termId,
      assessment_type: assessmentType,
      marks,
      updated_at:      new Date().toISOString(),
    }, { onConflict: "student_id,subject_id,term_id,assessment_type" })

    setSaving(null)
    if (error) fireToast("Error saving grade.")
  }

  function computeFinal(studentId: string): number | null {
    const cat1 = grades[studentId]?.cat1 ?? null
    const cat2 = grades[studentId]?.cat2 ?? null
    const exam = grades[studentId]?.exam ?? null
    if (cat1 === null && cat2 === null && exam === null) return null
    const catAvg = (cat1 !== null && cat2 !== null) ? (cat1 + cat2) / 2 : (cat1 ?? cat2 ?? 0)
    const e      = exam ?? 0
    return Math.round(catAvg * 0.3 + e * 0.7)
  }

  const activeTerm = terms.find(t => t.id === termId)
  const isLocked   = activeTerm?.status === "locked"

  const finals  = students.map(s => computeFinal(s.id)).filter(f => f !== null) as number[]
  const average  = finals.length ? Math.round(finals.reduce((a, b) => a + b, 0) / finals.length) : null
  const highest  = finals.length ? Math.max(...finals) : null
  const lowest   = finals.length ? Math.min(...finals) : null

  const cellInp: React.CSSProperties = {
    width: "100%", border: "none", outline: "none", background: "transparent",
    fontSize: 14, fontWeight: 700, color: dark, textAlign: "center",
    fontFamily: "inherit", padding: "4px 0",
  }

  if (loading) return (
    <div style={{ padding: 24 }}>
      <div style={{ height: 80, borderRadius: 16, background: "linear-gradient(135deg,#1e1b4b,#2d2a6e)", marginBottom: 16 }} />
      {[1,2,3,4].map(i => <div key={i} style={{ height: 56, borderRadius: 12, background: "#e5e7eb", marginBottom: 10 }} />)}
    </div>
  )

  return (
    <div style={{ background: bg, minHeight: "100vh", paddingBottom: 100 }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        * { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      {/* HERO */}
      <div style={{ background: `linear-gradient(135deg, ${dark} 0%, #2d2a6e 100%)`, padding: "24px 20px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600, marginBottom: 4 }}>ACADEMICS</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>Gradebook</div>
        {isLocked && (
          <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, background: red + "25", padding: "4px 12px", borderRadius: 20 }}>
            <span style={{ fontSize: 12, color: red, fontWeight: 700 }}>🔒 Term Locked — Read Only</span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 16px" }}>

        {/* SELECTORS */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "16px 16px", marginBottom: 16, border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Class</div>
              <select
                value={classId}
                onChange={e => setClassId(e.target.value)}
                style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: dark, fontFamily: "inherit", outline: "none", background: bg }}
              >
                <option value="">Select class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Term</div>
              <select
                value={termId}
                onChange={e => setTermId(e.target.value)}
                style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: dark, fontFamily: "inherit", outline: "none", background: bg }}
              >
                <option value="">Select term</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name} {t.year}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Subject</div>
            <select
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: dark, fontFamily: "inherit", outline: "none", background: bg }}
            >
              <option value="">Select subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* STATS BAR */}
        {average !== null && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Average", value: average + "%", color: accent },
              { label: "Highest", value: highest + "%", color: "#3b82f6" },
              { label: "Lowest",  value: lowest + "%",  color: red },
            ].map(s => (
              <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "12px 8px", textAlign: "center", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* GRADEBOOK TABLE */}
        {!subjectId || !termId ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#9ca3af", fontSize: 14 }}>
            Select a class, subject and term to view the gradebook.
          </div>
        ) : students.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#9ca3af", fontSize: 14 }}>
            No students in this class.
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px 56px", gap: 0, background: dark, padding: "12px 16px" }}>
              {["Student", "CAT 1", "CAT 2", "Exam", "Final", "Grade"].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", textAlign: h === "Student" ? "left" : "center", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {students.map((s, i) => {
              const final = computeFinal(s.id)
              const grade = final !== null ? gradeLabel(final) : null
              return (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px 56px", gap: 0, padding: "12px 16px", borderBottom: i < students.length - 1 ? "1px solid #f3f4f6" : "none", alignItems: "center", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: dark }}>{s.name}</div>
                    {s.admission_number && <div style={{ fontSize: 10, color: "#9ca3af" }}>{s.admission_number}</div>}
                  </div>
                  {(["cat1", "cat2", "exam"] as const).map(type => (
                    <div key={type} style={{ textAlign: "center", background: saving === `${s.id}_${type}` ? accent + "10" : "transparent", borderRadius: 8, padding: "2px" }}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        disabled={isLocked}
                        value={grades[s.id]?.[type] ?? ""}
                        onChange={e => handleMarkChange(s.id, type, e.target.value)}
                        onBlur={() => saveGrade(s.id, type)}
                        style={{ ...cellInp, opacity: isLocked ? 0.5 : 1, cursor: isLocked ? "not-allowed" : "text" }}
                      />
                    </div>
                  ))}
                  <div style={{ textAlign: "center", fontSize: 14, fontWeight: 900, color: final !== null ? dark : "#e5e7eb", fontFamily: "monospace" }}>
                    {final !== null ? final + "%" : "—"}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    {grade && (
                      <div style={{ fontSize: 11, fontWeight: 800, color: grade.color, background: grade.color + "18", padding: "3px 6px", borderRadius: 8, display: "inline-block" }}>
                        {grade.label}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Toast msg={toast} />
    </div>
  )
}
