"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

const dark   = "#0a1628"
const accent = "#10b981"
const bg     = "#f0f2f5"
const red    = "#ef4444"
const amber  = "#f59e0b"

const CBC_GRADES = ["PP1","PP2","Grade 1","Grade 2","Grade 3"]
function isCBC(name: string) { return CBC_GRADES.some(g => name.startsWith(g)) }

interface ClassRow   { id: string; name: string; stream: string | null }
interface SubjectRow { id: string; name: string }
interface StudentRow { id: string; name: string; admission_number: string | null }
interface TermRow    { id: string; name: string; term: number; academic_year: number; status: string }

interface TraditionalGrade {
  student_id: string
  assessment: string
  marks: number
  out_of: number
}

interface CbcGrade {
  student_id: string
  strand_id: string
  sub_strand: string
  assessment_type: string
  performance: string
}

interface StrandRow { id: string; name: string }

const PERF_MAP: Record<string, { label: string; color: string }> = {
  exceeds_expectation:    { label: "EE", color: accent },
  meets_expectation:      { label: "ME", color: "#3b82f6" },
  approaches_expectation: { label: "AE", color: amber },
  below_expectation:      { label: "BE", color: red },
}

function perfColor(p: string) { return PERF_MAP[p]?.color ?? "#9ca3af" }
function perfLabel(p: string) { return PERF_MAP[p]?.label ?? "—" }

function marksPct(marks: number, outOf: number): number {
  return outOf > 0 ? Math.round((marks / outOf) * 100) : 0
}

function gradeLabel(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: "EE", color: accent }
  if (pct >= 60) return { label: "ME", color: "#3b82f6" }
  if (pct >= 40) return { label: "AE", color: amber }
  return { label: "BE", color: red }
}

function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: "#f0f4f8", color: "#111827", padding: "12px 24px", borderRadius: 40,
      fontSize: 13, fontWeight: 700, zIndex: 9999, whiteSpace: "nowrap",
      boxShadow: "0 4px 24px rgba(0,0,0,0.25)"
    }}>{msg}</div>
  )
}

export default function GradebookPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [schoolId,   setSchoolId]   = useState("")
  const [loading,    setLoading]    = useState(true)
  const [gradeLoad,  setGradeLoad]  = useState(false)
  const [toast,      setToast]      = useState("")
  const [classes,    setClasses]    = useState<ClassRow[]>([])
  const [subjects,   setSubjects]   = useState<SubjectRow[]>([])
  const [students,   setStudents]   = useState<StudentRow[]>([])
  const [terms,      setTerms]      = useState<TermRow[]>([])
  const [strands,    setStrands]    = useState<StrandRow[]>([])
  const [tradGrades, setTradGrades] = useState<TraditionalGrade[]>([])
  const [cbcGrades,  setCbcGrades]  = useState<CbcGrade[]>([])

  const [classId,    setClassId]    = useState(searchParams.get("class") ?? "")
  const [subjectId,  setSubjectId]  = useState(searchParams.get("subject") ?? "")
  const [termId,     setTermId]     = useState("")

  const fireToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(""), 3000)
  }, [])

  useEffect(() => { bootstrap() }, [])

  async function bootstrap() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      const { data: p } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)

      const [classRes, termRes] = await Promise.all([
        supabase.from("classes").select("id,name,stream").eq("school_id", p.school_id).order("name"),
        supabase.from("academic_terms").select("id,name,term,academic_year,status").eq("school_id", p.school_id).order("academic_year", { ascending: false }),
      ])

      const classList = (classRes.data ?? []) as ClassRow[]
      const termList  = (termRes.data ?? []) as TermRow[]
      setClasses(classList)
      setTerms(termList)

      const activeTerm = termList.find(t => t.status === "active")
      if (activeTerm) setTermId(activeTerm.id)

      const initClass = searchParams.get("class") ?? (classList[0]?.id ?? "")
      if (initClass) {
        setClassId(initClass)
        await loadClassData(p.school_id, initClass)
      }
    } catch {
      fireToast("Failed to load gradebook.")
    } finally {
      setLoading(false)
    }
  }

  async function loadClassData(sid: string, cid: string) {
    const cls = classes.find(c => c.id === cid) ??
      (await supabase.from("classes").select("id,name,stream").eq("id", cid).single()).data as ClassRow | null

    const [studentRes, subjectRes] = await Promise.all([
      supabase.from("students").select("id,name,admission_number").eq("class_id", cid).is("deleted_at", null).order("name"),
      supabase.from("academic_subjects").select("id,name").eq("school_id", sid).eq("class_id", cid).is("deleted_at", null).order("name"),
    ])

    setStudents((studentRes.data ?? []) as StudentRow[])
    setSubjects((subjectRes.data ?? []) as SubjectRow[])

    if (cls && isCBC(cls.name)) {
      const { data: strandData } = await supabase
        .from("strands")
        .select("id,name")
        .eq("school_id", sid)
      setStrands((strandData ?? []) as StrandRow[])
    }

    const initSubject = searchParams.get("subject") ?? ((subjectRes.data ?? [])[0]?.id ?? "")
    if (initSubject) setSubjectId(initSubject)
  }

  async function loadGrades(cid: string, sid: string, tid: string) {
    const cls = classes.find(c => c.id === cid)
    if (!cls || !tid) return
    setGradeLoad(true)
    try {
      const termRow = terms.find(t => t.id === tid)
      if (!termRow) return

      if (isCBC(cls.name)) {
        const { data } = await supabase
          .from("cbc_assessments")
          .select("student_id,strand_id,sub_strand,assessment_type,performance")
          .eq("school_id", schoolId)
          .eq("class_id", cid)
          .eq("subject_id", sid)
          .eq("term", termRow.term)
          .eq("academic_year", termRow.academic_year)
        setCbcGrades((data ?? []) as CbcGrade[])
      } else {
        const { data } = await supabase
          .from("traditional_grades")
          .select("student_id,assessment,marks,out_of")
          .eq("school_id", schoolId)
          .eq("class_id", cid)
          .eq("subject_id", sid)
          .eq("term", termRow.term)
          .eq("academic_year", termRow.academic_year)
        setTradGrades((data ?? []) as TraditionalGrade[])
      }
    } finally {
      setGradeLoad(false)
    }
  }

  useEffect(() => {
    if (classId && schoolId) loadClassData(schoolId, classId)
  }, [classId])

  useEffect(() => {
    if (classId && subjectId && termId && schoolId) {
      loadGrades(classId, subjectId, termId)
    }
  }, [classId, subjectId, termId])

  const selectedClass = classes.find(c => c.id === classId)
  const isClassCBC    = selectedClass ? isCBC(selectedClass.name) : false

  function studentTradFinal(studentId: string): number | null {
    const rows = tradGrades.filter(g => g.student_id === studentId)
    if (!rows.length) return null
    const total    = rows.reduce((sum, g) => sum + marksPct(g.marks, g.out_of), 0)
    return Math.round(total / rows.length)
  }

  function studentCbcSummary(studentId: string): string {
    const rows = cbcGrades.filter(g => g.student_id === studentId)
    if (!rows.length) return "—"
    const counts: Record<string, number> = {}
    rows.forEach(r => { counts[r.performance] = (counts[r.performance] ?? 0) + 1 })
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    return top ? perfLabel(top[0]) : "—"
  }

  const tradAssessmentTypes = Array.from(new Set(tradGrades.map(g => g.assessment)))

  const tradAvgs = tradAssessmentTypes.map(type => {
    const rows = tradGrades.filter(g => g.assessment === type)
    const avg  = rows.length ? Math.round(rows.reduce((s, g) => s + marksPct(g.marks, g.out_of), 0) / rows.length) : null
    return { type, avg }
  })

  const classAvg = (() => {
    const finals = students.map(s => studentTradFinal(s.id)).filter(f => f !== null) as number[]
    return finals.length ? Math.round(finals.reduce((a, b) => a + b, 0) / finals.length) : null
  })()

  if (loading) return (
    <div style={{ padding: 24 }}>
      <div style={{ height: 100, borderRadius: 16, background: "linear-gradient(135deg,#0a1628,#0d2347)", marginBottom: 16 }} />
      {[1,2,3,4].map(i => (
        <div key={i} style={{ height: 56, borderRadius: 12, background: "#e5e7eb", marginBottom: 10 }} />
      ))}
    </div>
  )

  return (
    <div style={{ background: bg, minHeight: "100vh", paddingBottom: 100 }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      {/* HERO */}
      <div style={{
        background: `linear-gradient(135deg, ${dark} 0%, #0d2347 100%)`,
        padding: "24px 20px 28px", position: "relative", overflow: "hidden"
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "#ffffff" }} />
        <div
          onClick={() => router.push("/admin/academics")}
          style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, cursor: "pointer" }}>
          ‹ Academics
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#111827", letterSpacing: -0.5 }}>Gradebook</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
          Read only · Admin view
        </div>

        {classAvg !== null && (
          <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8, background: "#e2e8f0", padding: "8px 16px", borderRadius: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: classAvg >= 70 ? accent : classAvg >= 50 ? amber : red, fontFamily: "monospace" }}>{classAvg}%</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>Class average</div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 16px" }}>

        {/* SELECTORS */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Class</div>
              <select
                value={classId}
                onChange={e => { setClassId(e.target.value); setSubjectId(""); setTradGrades([]); setCbcGrades([]) }}
                style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: dark, fontFamily: "inherit", outline: "none", background: bg }}
              >
                <option value="">Select class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.stream ? " "+c.stream : ""}</option>)}
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
                {terms.map(t => <option key={t.id} value={t.id}>{t.name} {t.academic_year}</option>)}
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

        {/* ASSESSMENT AVERAGES */}
        {!isClassCBC && tradAssessmentTypes.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(tradAssessmentTypes.length, 4)}, 1fr)`, gap: 8, marginBottom: 16 }}>
            {tradAvgs.map(a => (
              <div key={a.type} style={{ background: "#fff", borderRadius: 12, padding: "12px 8px", textAlign: "center", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: a.avg !== null ? (a.avg >= 70 ? accent : a.avg >= 50 ? amber : red) : "#9ca3af", fontFamily: "monospace" }}>
                  {a.avg !== null ? a.avg + "%" : "—"}
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, marginTop: 2 }}>{a.type}</div>
              </div>
            ))}
          </div>
        )}

        {/* GRADEBOOK */}
        {!classId || !subjectId || !termId ? (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: dark, marginBottom: 6 }}>Select class, subject and term</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Grades will appear here.</div>
          </div>
        ) : gradeLoad ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ height: 56, borderRadius: 12, background: "#e5e7eb" }} />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#9ca3af", fontSize: 14 }}>
            No students in this class.
          </div>
        ) : isClassCBC ? (

          /* CBC VIEW */
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ background: "#f0f4f8", padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 60px 60px", gap: 0 }}>
              {["Student", "Rating", "Count"].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", textAlign: h === "Student" ? "left" : "center", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</div>
              ))}
            </div>
            {students.map((s, i) => {
              const summary  = studentCbcSummary(s.id)
              const count    = cbcGrades.filter(g => g.student_id === s.id).length
              const topPerf  = cbcGrades.filter(g => g.student_id === s.id)[0]?.performance ?? ""
              return (
                <div key={s.id} style={{
                  display: "grid", gridTemplateColumns: "1fr 60px 60px",
                  padding: "12px 16px", alignItems: "center",
                  borderBottom: i < students.length - 1 ? "1px solid #f3f4f6" : "none",
                  background: i % 2 === 0 ? "#fff" : "#fafafa"
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: dark }}>{s.name}</div>
                    {s.admission_number && <div style={{ fontSize: 10, color: "#9ca3af" }}>{s.admission_number}</div>}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    {summary !== "—" ? (
                      <div style={{ fontSize: 12, fontWeight: 800, color: perfColor(topPerf), background: perfColor(topPerf) + "18", padding: "3px 8px", borderRadius: 8, display: "inline-block" }}>
                        {summary}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#e5e7eb", fontWeight: 700 }}>—</div>
                    )}
                  </div>
                  <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: count > 0 ? dark : "#e5e7eb" }}>
                    {count > 0 ? count : "—"}
                  </div>
                </div>
              )
            })}
          </div>

        ) : (

          /* TRADITIONAL VIEW */
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 360, background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ background: "#f0f4f8", padding: "12px 16px", display: "grid", gridTemplateColumns: `1fr ${tradAssessmentTypes.map(() => "72px").join(" ")} 72px 52px` }}>
                {["Student", ...tradAssessmentTypes, "Final", "Grade"].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", textAlign: h === "Student" ? "left" : "center", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</div>
                ))}
              </div>
              {students.map((s, i) => {
                const final = studentTradFinal(s.id)
                const grade = final !== null ? gradeLabel(final) : null
                return (
                  <div key={s.id} style={{
                    display: "grid",
                    gridTemplateColumns: `1fr ${tradAssessmentTypes.map(() => "72px").join(" ")} 72px 52px`,
                    padding: "12px 16px", alignItems: "center",
                    borderBottom: i < students.length - 1 ? "1px solid #f3f4f6" : "none",
                    background: i % 2 === 0 ? "#fff" : "#fafafa"
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: dark }}>{s.name}</div>
                      {s.admission_number && <div style={{ fontSize: 10, color: "#9ca3af" }}>{s.admission_number}</div>}
                    </div>
                    {tradAssessmentTypes.map(type => {
                      const g   = tradGrades.find(g => g.student_id === s.id && g.assessment === type)
                      const pct = g ? marksPct(g.marks, g.out_of) : null
                      return (
                        <div key={type} style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: pct !== null ? dark : "#e5e7eb", fontFamily: "monospace" }}>
                          {pct !== null ? pct + "%" : "—"}
                        </div>
                      )
                    })}
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
          </div>
        )}
      </div>

      <Toast msg={toast} />
    </div>
  )
}
