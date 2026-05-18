"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const dark   = "#1e1b4b"
const accent = "#10b981"
const bg     = "#f0f2f5"
const red    = "#ef4444"
const amber  = "#f59e0b"

interface ClassRow  { id: string; name: string; stream: string | null }
interface SchemeRow {
  class_id: string; subject: string; strand: string; sub_strand: string
  topic: string; status: string; week: number; term: number; academic_year: number
}
interface CurriculumRow {
  grade: string; subject: string; strand: string; sub_strand: string
  topic: string; week: number; term: number
}
interface Term {
  id: string; name: string; term: number; academic_year: number
  start_date: string; end_date: string; status: string
}

const CBC_GRADES = ["PP1","PP2","Grade 1","Grade 2","Grade 3"]
function isCBC(name: string) { return CBC_GRADES.some(g => name.startsWith(g)) }

function weekOf(startDate: string): number {
  const diff = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000*60*60*24*7))
  return Math.max(1, Math.min(diff + 1, 13))
}

function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: dark, color: "#fff", padding: "12px 24px", borderRadius: 40,
      fontSize: 13, fontWeight: 700, zIndex: 9999, whiteSpace: "nowrap",
      boxShadow: "0 4px 24px rgba(0,0,0,0.25)"
    }}>{msg}</div>
  )
}

function CoveragePill({ pct }: { pct: number }) {
  const color = pct >= 80 ? accent : pct >= 50 ? amber : red
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 48, height: 5, background: "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99 }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color, fontFamily: "monospace", minWidth: 32 }}>{pct}%</div>
    </div>
  )
}

export default function CurriculumPage() {
  const router = useRouter()

  const [schoolId,      setSchoolId]      = useState("")
  const [loading,       setLoading]       = useState(true)
  const [toast,         setToast]         = useState("")
  const [term,          setTerm]          = useState<Term | null>(null)
  const [classes,       setClasses]       = useState<ClassRow[]>([])
  const [schemes,       setSchemes]       = useState<SchemeRow[]>([])
  const [curriculum,    setCurriculum]    = useState<CurriculumRow[]>([])
  const [selectedClass, setSelectedClass] = useState<string>("all")
  const [expandedClass, setExpandedClass] = useState<string | null>(null)

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

      const [termRes, classRes] = await Promise.all([
        supabase
          .from("academic_terms")
          .select("id,name,term,academic_year,start_date,end_date,status")
          .eq("school_id", p.school_id)
          .eq("status", "active")
          .single(),
        supabase
          .from("classes")
          .select("id,name,stream")
          .eq("school_id", p.school_id)
          .order("name"),
      ])

      const activeTerm = termRes.data as Term | null
      const classList  = (classRes.data ?? []) as ClassRow[]
      setTerm(activeTerm)
      setClasses(classList)

      if (!activeTerm || !classList.length) { setLoading(false); return }

      const grades = [...new Set(classList.map(c => c.name))]

      const [schemeRes, currRes] = await Promise.all([
        supabase
          .from("scheme_of_work")
          .select("class_id,subject,strand,sub_strand,topic,status,week,term,academic_year")
          .eq("school_id", p.school_id)
          .eq("term", activeTerm.term)
          .eq("academic_year", activeTerm.academic_year),
        supabase
          .from("curriculum")
          .select("grade,subject,strand,sub_strand,topic,week,term")
          .eq("term", activeTerm.term)
          .in("grade", grades),
      ])

      setSchemes((schemeRes.data ?? []) as SchemeRow[])
      setCurriculum((currRes.data ?? []) as CurriculumRow[])
    } catch {
      fireToast("Failed to load curriculum data.")
    } finally {
      setLoading(false)
    }
  }

  function classCoverage(cls: ClassRow) {
    const kicdTopics    = curriculum.filter(c => c.grade === cls.name)
    const schemeRows    = schemes.filter(s => s.class_id === cls.id)
    const deliveredRows = schemeRows.filter(s => s.status === "delivered")
    const subjects      = [...new Set(kicdTopics.map(k => k.subject))]
    const total         = kicdTopics.length
    const delivered     = deliveredRows.length
    const pct           = total > 0 ? Math.round((delivered / total) * 100) : 0
    const currentWeek   = term ? weekOf(term.start_date) : 0
    const expectedPct   = Math.round((currentWeek / 13) * 100)
    const weeklyStatus: "ahead"|"ontrack"|"behind" =
      pct >= expectedPct ? "ontrack" : pct >= expectedPct - 15 ? "behind" : "ahead"
    return { subjects, delivered, total, pct, weeklyStatus }
  }

  function subjectCoverage(cls: ClassRow, subject: string) {
    const kicdTopics = curriculum.filter(c => c.grade === cls.name && c.subject === subject)
    const schemeRows = schemes.filter(s => s.class_id === cls.id && s.subject === subject)
    const topics = kicdTopics.map(k => ({
      topic: k.topic,
      strand: k.strand,
      delivered: schemeRows.some(s => s.topic === k.topic && s.status === "delivered")
    }))
    const delivered = topics.filter(t => t.delivered).length
    const total     = topics.length
    const pct       = total > 0 ? Math.round((delivered / total) * 100) : 0
    return { delivered, total, pct, topics }
  }

  const currentWeek = term ? weekOf(term.start_date) : 0
  const weekPct     = Math.round((currentWeek / 13) * 100)

  const filteredClasses = selectedClass === "all"
    ? classes
    : classes.filter(c => c.id === selectedClass)

  const overallDelivered = filteredClasses.reduce((sum, c) => sum + classCoverage(c).delivered, 0)
  const overallTotal     = filteredClasses.reduce((sum, c) => sum + classCoverage(c).total, 0)
  const overallPct       = overallTotal > 0 ? Math.round((overallDelivered / overallTotal) * 100) : 0

  if (loading) return (
    <div style={{ padding: 24 }}>
      <div style={{ height: 100, borderRadius: 16, background: "linear-gradient(135deg,#1e1b4b,#2d2a6e)", marginBottom: 16 }} />
      {[1,2,3].map(i => (
        <div key={i} style={{ height: 80, borderRadius: 12, background: "#e5e7eb", marginBottom: 10 }} />
      ))}
    </div>
  )

  return (
    <div style={{ background: bg, minHeight: "100vh", paddingBottom: 100 }}>
      <style>{`
        * { box-sizing: border-box; }
        .row-tap:active { background: #f3f4f6 !important; }
      `}</style>

      {/* HERO */}
      <div style={{
        background: `linear-gradient(135deg, ${dark} 0%, #2d2a6e 100%)`,
        padding: "24px 20px 32px", position: "relative", overflow: "hidden"
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div
          onClick={() => router.push("/admin/academics")}
          style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, cursor: "pointer" }}>
          ‹ Academics
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>Curriculum</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
          {term ? `${term.name} ${term.academic_year} · Week ${currentWeek} of 13` : "No active term"}
        </div>

        {term && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
                School coverage · expected {weekPct}%
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: overallPct >= weekPct ? accent : red }}>
                {overallPct}%
              </div>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.12)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${overallPct}%`, background: overallPct >= weekPct ? accent : red, borderRadius: 99, transition: "width 0.6s ease" }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
              Amber line = where you should be today ({weekPct}%)
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 16px" }}>

        {/* CLASS FILTER */}
        <div style={{ marginBottom: 14 }}>
          <select
            value={selectedClass}
            onChange={e => { setSelectedClass(e.target.value); setExpandedClass(null) }}
            style={{
              width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 12,
              padding: "12px 14px", fontSize: 13, color: dark,
              fontFamily: "inherit", outline: "none", background: "#fff", fontWeight: 600
            }}
          >
            <option value="all">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.stream ? " " + c.stream : ""}
              </option>
            ))}
          </select>
        </div>

        {!term ? (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: dark, marginBottom: 6 }}>No Active Term</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Go to Settings to activate a term.</div>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏫</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: dark }}>No classes found</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredClasses.map(cls => {
              const cov      = classCoverage(cls)
              const expanded = expandedClass === cls.id
              const statusColor = cov.weeklyStatus === "ontrack" ? accent : cov.weeklyStatus === "behind" ? amber : red
              const statusLabel = cov.weeklyStatus === "ontrack" ? "On track" : cov.weeklyStatus === "behind" ? "Behind" : "Ahead"

              return (
                <div key={cls.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>

                  <div
                    className="row-tap"
                    onClick={() => setExpandedClass(expanded ? null : cls.id)}
                    style={{ padding: "16px 16px", cursor: "pointer", background: "#fff" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: dark }}>
                          {cls.name}{cls.stream ? " " + cls.stream : ""}
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                          {isCBC(cls.name) ? "CBC · Rubric" : "Traditional · Marks"} · {cov.subjects.length} subject{cov.subjects.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: statusColor + "15", padding: "3px 10px", borderRadius: 20 }}>
                          {statusLabel}
                        </div>
                        <div style={{ fontSize: 18, color: "#d1d5db", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <CoveragePill pct={cov.pct} />
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                        {cov.total === 0
                          ? "No KICD topics loaded for this grade yet"
                          : `${cov.delivered} of ${cov.total} topics delivered`}
                      </div>
                    </div>
                  </div>

                  {expanded && (
                    <div style={{ borderTop: "1px solid #f3f4f6" }}>
                      {cov.subjects.length === 0 ? (
                        <div style={{ padding: "24px 16px", textAlign: "center" }}>
                          <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 6 }}>
                            No KICD topics found for this grade and term.
                          </div>
                          <div style={{ fontSize: 12, color: "#c4c9d4" }}>
                            Teachers can still submit schemes — coverage tracking activates when KICD data is loaded.
                          </div>
                        </div>
                      ) : cov.subjects.map((subject, si) => {
                        const sub = subjectCoverage(cls, subject)
                        return (
                          <div key={subject} style={{ borderBottom: si < cov.subjects.length - 1 ? "1px solid #f9fafb" : "none" }}>
                            <div style={{ padding: "12px 16px", background: "#fafafa" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: dark }}>{subject}</div>
                                <div style={{ fontSize: 12, color: "#9ca3af" }}>{sub.delivered}/{sub.total}</div>
                              </div>
                              <CoveragePill pct={sub.pct} />
                            </div>
                            {sub.topics.map((t, ti) => (
                              <div key={ti} style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "9px 16px 9px 24px",
                                borderTop: "1px solid #f3f4f6",
                                background: "#fff"
                              }}>
                                <div style={{
                                  width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                                  background: t.delivered ? accent : "#e5e7eb",
                                  display: "flex", alignItems: "center", justifyContent: "center"
                                }}>
                                  {t.delivered && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: t.delivered ? dark : "#9ca3af" }}>{t.topic}</div>
                                  <div style={{ fontSize: 10, color: "#c4c9d4" }}>{t.strand}</div>
                                </div>
                                {t.delivered && (
                                  <div style={{ fontSize: 10, fontWeight: 700, color: accent }}>Done</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
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
