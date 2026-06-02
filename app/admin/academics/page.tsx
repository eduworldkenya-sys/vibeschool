'use client'
"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const dark   = "#0a1628"
const accent = "#10b981"
const bg     = "#f0f2f5"
const red    = "#ef4444"
const amber  = "#f59e0b"

const CBC_GRADES = ["PP1","PP2","Grade 1","Grade 2","Grade 3"]

interface Term {
  id: string
  name: string
  term: number
  academic_year: number
  start_date: string
  end_date: string
  status: string
}

interface ClassRow {
  id: string
  name: string
  stream: string | null
}

interface SchemeRow {
  class_id: string
  status: string
}

interface GradeRow {
  class_id: string
  marks: number
  out_of: number
}

interface CbcRow {
  class_id: string
  performance: string
}

function isCBC(className: string): boolean {
  return CBC_GRADES.some(g => className.startsWith(g))
}

function weekOf(startDate: string): number {
  const start = new Date(startDate)
  const today = new Date()
  const diff  = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7))
  return Math.max(1, Math.min(diff + 1, 13))
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

function HealthCard({
  label, value, sub, color, onClick
}: {
  label: string
  value: string
  sub: string
  color: string
  onClick: () => void
}) {
  return (
    <div onClick={onClick} style={{
      background: "#fff", borderRadius: 16, padding: "16px 12px",
      border: "1px solid #e5e7eb", cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)", flex: 1
    }}>
      <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: dark, marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{sub}</div>
    </div>
  )
}

export default function AcademicsPage() {
  const router = useRouter()

  const [schoolId,  setSchoolId]  = useState("")
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState("")
  const [term,      setTerm]      = useState<Term | null>(null)
  const [classes,   setClasses]   = useState<ClassRow[]>([])
  const [schemes,   setSchemes]   = useState<SchemeRow[]>([])
  const [grades,    setGrades]    = useState<GradeRow[]>([])
  const [cbcData,   setCbcData]   = useState<CbcRow[]>([])

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

      const activeTerm  = termRes.data as Term | null
      const classList   = (classRes.data ?? []) as ClassRow[]
      setTerm(activeTerm)
      setClasses(classList)

      if (!activeTerm) { setLoading(false); return }

      await loadAcademicData(p.school_id, activeTerm)
    } catch {
      fireToast("Failed to load academics.")
    } finally {
      setLoading(false)
    }
  }

  async function loadAcademicData(sid: string, t: Term) {
    const [schemeRes, gradeRes, cbcRes] = await Promise.all([
      supabase
        .from("scheme_of_work")
        .select("class_id,status")
        .eq("school_id", sid)
        .eq("term", t.term)
        .eq("academic_year", t.academic_year),
      supabase
        .from("traditional_grades")
        .select("class_id,marks,out_of")
        .eq("school_id", sid)
        .eq("term", t.term)
        .eq("academic_year", t.academic_year),
      supabase
        .from("cbc_assessments")
        .select("class_id,performance")
        .eq("school_id", sid)
        .eq("term", t.term)
        .eq("academic_year", t.academic_year),
    ])

    setSchemes((schemeRes.data ?? []) as SchemeRow[])
    setGrades((gradeRes.data ?? []) as GradeRow[])
    setCbcData((cbcRes.data ?? []) as CbcRow[])
  }

  const currentWeek    = term ? weekOf(term.start_date) : 0
  const weekPct        = Math.round((currentWeek / 13) * 100)
  const expectedCovPct = weekPct

  const classesWithScheme = new Set(schemes.map(s => s.class_id)).size
  const schemePct         = classes.length ? Math.round((classesWithScheme / classes.length) * 100) : 0

  const classesWithGrades = new Set([
    ...grades.map(g => g.class_id),
    ...cbcData.map(c => c.class_id),
  ]).size
  const gradePct = classes.length ? Math.round((classesWithGrades / classes.length) * 100) : 0

  const traditionalClasses = classes.filter(c => !isCBC(c.name))
  let schoolAvg: number | null = null
  if (grades.length) {
    const total = grades.reduce((sum, g) => sum + (g.out_of > 0 ? (g.marks / g.out_of) * 100 : 0), 0)
    schoolAvg   = Math.round(total / grades.length)
  }

  function classSchemeStatus(classId: string): "done" | "partial" | "none" {
    const rows = schemes.filter(s => s.class_id === classId)
    if (!rows.length) return "none"
    const delivered = rows.filter(s => s.status === "delivered").length
    if (delivered === rows.length) return "done"
    return "partial"
  }

  function classGradeStatus(classId: string, className: string): "done" | "partial" | "none" {
    if (isCBC(className)) {
      return cbcData.some(c => c.class_id === classId) ? "partial" : "none"
    }
    return grades.some(g => g.class_id === classId) ? "partial" : "none"
  }

  function classAvg(classId: string): number | null {
    const rows = grades.filter(g => g.class_id === classId)
    if (!rows.length) return null
    const total = rows.reduce((sum, g) => sum + (g.out_of > 0 ? (g.marks / g.out_of) * 100 : 0), 0)
    return Math.round(total / rows.length)
  }

  function statusDot(status: "done" | "partial" | "none"): string {
    if (status === "done")    return accent
    if (status === "partial") return amber
    return red
  }

  const alerts: string[] = []
  classes.forEach(c => {
    if (classSchemeStatus(c.id) === "none")
      alerts.push(`${c.name}${c.stream ? " "+c.stream : ""} — no scheme of work submitted`)
    if (classGradeStatus(c.id, c.name) === "none")
      alerts.push(`${c.name}${c.stream ? " "+c.stream : ""} — no assessments captured`)
    if (!isCBC(c.name)) {
      const avg = classAvg(c.id)
      if (avg !== null && avg < 50)
        alerts.push(`${c.name}${c.stream ? " "+c.stream : ""} — class average ${avg}% (below 50%)`)
    }
  })

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
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        * { box-sizing: border-box; }
        .class-row:active { background: #f3f4f6 !important; }
      `}</style>

      {/* HERO */}
      <div style={{
        background: `linear-gradient(135deg, ${dark} 0%, #0d2347 100%)`,
        padding: "24px 20px 32px", position: "relative", overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 160, height: 160, borderRadius: "50%",
          background: "#ffffff"
        }} />
        <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(16,185,129,0.08)" }} />
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>School Hub</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#111827", letterSpacing: -0.5 }}>Academics</div>

        {term ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                {term.name} {term.academic_year} &nbsp;·&nbsp; Week {currentWeek} of 13
              </div>
              <div style={{ fontSize: 12, color: accent, fontWeight: 700 }}>{weekPct}%</div>
            </div>
            <div style={{ height: 6, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${weekPct}%`, background: accent, borderRadius: 99, transition: "width 0.6s ease" }} />
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
              Expected syllabus coverage: {expectedCovPct}%
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, fontSize: 13, color: amber, fontWeight: 600 }}>
            ⚠ No active term set — go to Settings to activate a term
          </div>
        )}
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 16px" }}>

        {/* HEALTH CARDS */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <HealthCard
            label="Curriculum"
            value={`${schemePct}%`}
            sub={`${classesWithScheme} of ${classes.length} classes`}
            color={schemePct >= 80 ? accent : schemePct >= 50 ? amber : red}
            onClick={() => router.push("/admin/academics/curriculum")}
          />
          <HealthCard
            label="Assessments"
            value={`${gradePct}%`}
            sub={`${classesWithGrades} of ${classes.length} classes`}
            color={gradePct >= 80 ? accent : gradePct >= 50 ? amber : red}
            onClick={() => router.push("/admin/academics/gradebook")}
          />
          <HealthCard
            label="Performance"
            value={schoolAvg !== null ? `${schoolAvg}%` : "—"}
            sub={schoolAvg !== null ? (schoolAvg >= 70 ? "On track" : schoolAvg >= 50 ? "At risk" : "Danger zone") : "No data yet"}
            color={schoolAvg !== null ? (schoolAvg >= 70 ? accent : schoolAvg >= 50 ? amber : red) : "#9ca3af"}
            onClick={() => router.push("/admin/academics/reports")}
          />
        </div>

        {/* ALERTS */}
        {alerts.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${red}30`, marginBottom: 16, overflow: "hidden" }}>
            <div style={{ background: red + "12", padding: "12px 16px", borderBottom: `1px solid ${red}20` }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: red, textTransform: "uppercase", letterSpacing: 0.5 }}>
                ⚠ {alerts.length} Alert{alerts.length > 1 ? "s" : ""} Require Attention
              </div>
            </div>
            {alerts.slice(0, 5).map((a, i) => (
              <div key={i} style={{
                padding: "10px 16px", fontSize: 13, color: dark, fontWeight: 500,
                borderBottom: i < Math.min(alerts.length, 5) - 1 ? "1px solid #f3f4f6" : "none"
              }}>
                {a}
              </div>
            ))}
            {alerts.length > 5 && (
              <div style={{ padding: "10px 16px", fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>
                +{alerts.length - 5} more issues
              </div>
            )}
          </div>
        )}

        {alerts.length === 0 && term && (
          <div style={{ background: accent + "12", border: `1px solid ${accent}30`, borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: accent }}>✓ All classes on track</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>No issues detected for {term.name} {term.academic_year}</div>
          </div>
        )}

        {/* CLASS LIST */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            All Classes
          </div>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            {classes.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 14, color: "#9ca3af" }}>
                No classes found for this school.
              </div>
            ) : classes.map((c, i) => {
              const schemeStatus = classSchemeStatus(c.id)
              const gradeStatus  = classGradeStatus(c.id, c.name)
              const avg          = isCBC(c.name) ? null : classAvg(c.id)
              const cbcCount     = cbcData.filter(d => d.class_id === c.id).length

              return (
                <div
                  key={c.id}
                  className="class-row"
                  onClick={() => router.push(`/admin/academics/gradebook?class=${c.id}`)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px", cursor: "pointer",
                    borderBottom: i < classes.length - 1 ? "1px solid #f3f4f6" : "none",
                    background: "#fff", transition: "background 0.15s"
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: dark }}>
                      {c.name}{c.stream ? " " + c.stream : ""}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                      {isCBC(c.name) ? `CBC · ${cbcCount} assessments recorded` : "Traditional · Marks based"}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Scheme dot */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot(schemeStatus), margin: "0 auto 2px" }} />
                      <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 600 }}>SCH</div>
                    </div>

                    {/* Grade dot */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot(gradeStatus), margin: "0 auto 2px" }} />
                      <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 600 }}>GRD</div>
                    </div>

                    {/* Avg */}
                    <div style={{ minWidth: 44, textAlign: "right" }}>
                      {avg !== null ? (
                        <div style={{
                          fontSize: 14, fontWeight: 900, fontFamily: "monospace",
                          color: avg >= 70 ? accent : avg >= 50 ? amber : red
                        }}>{avg}%</div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#d1d5db", fontWeight: 700 }}>—</div>
                      )}
                    </div>

                    <div style={{ fontSize: 16, color: "#d1d5db" }}>›</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* LEGEND */}
        <div style={{ display: "flex", gap: 16, padding: "0 4px", marginBottom: 20 }}>
          {[
            { color: accent, label: "On track" },
            { color: amber,  label: "Partial" },
            { color: red,    label: "Not started" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
              <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{l.label}</div>
            </div>
          ))}
        </div>

        {/* BOTTOM ACTIONS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "📚  View Curriculum Coverage", path: "/admin/academics/curriculum" },
            { label: "📊  View Gradebook",           path: "/admin/academics/gradebook" },
            { label: "📄  Generate Report Cards",    path: "/admin/academics/reports" },
          ].map(btn => (
            <div
              key={btn.path}
              onClick={() => router.push(btn.path)}
              style={{
                background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14,
                padding: "16px 20px", fontSize: 14, fontWeight: 700, color: dark,
                cursor: "pointer", display: "flex", justifyContent: "space-between",
                alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
              }}
            >
              {btn.label}
              <span style={{ color: "#d1d5db", fontSize: 18 }}>›</span>
            </div>
          ))}
        </div>
      </div>

      <Toast msg={toast} />
    </div>
  )
}
