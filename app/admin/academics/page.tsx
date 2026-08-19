"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"

interface TermRow {
  id: string
  name: string
  term: number
  academic_year: number
  start_date: string
  end_date: string
}

interface ClassRow {
  id: string
  name: string
  stream: string | null
}

interface SchemeRow {
  class_id: string | null
  status: string | null
}

interface TeachingRow {
  class_id: string
  lifecycle: string
}

interface AssessmentRow {
  class_id: string
  status: string
}

export default function AdminAcademicsPage() {
  const router = useRouter()
  const [term, setTerm] = useState<TermRow | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [schemes, setSchemes] = useState<SchemeRow[]>([])
  const [teaching, setTeaching] = useState<TeachingRow[]>([])
  const [assessments, setAssessments] = useState<AssessmentRow[]>([])
  const [resultCount, setResultCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      const sid = authority.schoolId
      const termRes = await supabase
        .from("academic_terms")
        .select("id,name,term,academic_year,start_date,end_date")
        .eq("school_id", sid)
        .eq("status", "active")
        .limit(1)
        .maybeSingle()
      if (termRes.error) throw termRes.error
      const activeTerm = termRes.data as TermRow | null
      setTerm(activeTerm)

      const classRes = await supabase
        .from("classes")
        .select("id,name,stream")
        .eq("school_id", sid)
        .order("name")
        .order("stream")
      if (classRes.error) throw classRes.error
      const classRows = (classRes.data ?? []) as ClassRow[]
      setClasses(classRows)

      if (!activeTerm || classRows.length === 0) {
        setSchemes([])
        setTeaching([])
        setAssessments([])
        setResultCount(0)
        return
      }

      const classIds = classRows.map(row => row.id)
      const [schemeRes, teachingRes, assessmentRes, resultRes] = await Promise.all([
        supabase
          .from("scheme_of_work")
          .select("class_id,status")
          .eq("school_id", sid)
          .eq("academic_term_id", activeTerm.id)
          .in("class_id", classIds),
        supabase
          .from("teaching_occurrences")
          .select("class_id,lifecycle")
          .eq("school_id", sid)
          .gte("occurrence_date", activeTerm.start_date)
          .lte("occurrence_date", activeTerm.end_date)
          .in("class_id", classIds),
        supabase
          .from("assessment_definitions")
          .select("class_id,status")
          .eq("school_id", sid)
          .in("class_id", classIds)
          .neq("status", "archived"),
        supabase
          .from("exam_results")
          .select("id", { count: "exact", head: true })
          .eq("school_id", sid)
          .in("class_id", classIds)
          .gte("created_at", `${activeTerm.start_date}T00:00:00+03:00`)
          .lte("created_at", `${activeTerm.end_date}T23:59:59+03:00`),
      ])

      const firstError = [schemeRes.error, teachingRes.error, assessmentRes.error, resultRes.error].find(Boolean)
      if (firstError) throw firstError
      setSchemes((schemeRes.data ?? []) as SchemeRow[])
      setTeaching((teachingRes.data ?? []) as TeachingRow[])
      setAssessments((assessmentRes.data ?? []) as AssessmentRow[])
      setResultCount(resultRes.count ?? 0)
    } catch (cause) {
      console.error("Admin academics load failed", cause)
      setError(cause instanceof Error ? cause.message : "Academic oversight could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  const rows = useMemo(() => {
    return classes.map(classRow => {
      const schemeRows = schemes.filter(row => row.class_id === classRow.id)
      const teachingRows = teaching.filter(row => row.class_id === classRow.id)
      const assessmentRows = assessments.filter(row => row.class_id === classRow.id)
      return {
        ...classRow,
        schemeItems: schemeRows.length,
        schemeCovered: schemeRows.filter(row => row.status === "covered" || row.status === "completed").length,
        sessions: teachingRows.length,
        taught: teachingRows.filter(row => row.lifecycle === "completed").length,
        assessments: assessmentRows.length,
        publishedAssessments: assessmentRows.filter(row => row.status === "published" || row.status === "closed").length,
      }
    })
  }, [classes, schemes, teaching, assessments])

  const totals = useMemo(() => ({
    schemeClasses: rows.filter(row => row.schemeItems > 0).length,
    teachingClasses: rows.filter(row => row.taught > 0).length,
    assessmentClasses: rows.filter(row => row.assessments > 0).length,
    sessions: teaching.length,
    taught: teaching.filter(row => row.lifecycle === "completed").length,
  }), [rows, teaching])

  if (loading) return <div aria-busy="true" style={{ minHeight: 260, borderRadius: 18, background: "#e2e8f0" }} />

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 24 }}>Teaching & learning oversight</h1>
        <p style={{ color: "#64748b", margin: "5px 0 0" }}>
          {term ? `${term.name} · ${term.academic_year}` : "No active academic term"} · operational evidence only, without Student Twin private conversations.
        </p>
      </header>

      {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 12 }}>{error}</div>}

      {!term ? (
        <button onClick={() => router.push("/admin/settings/term")} style={{ textAlign: "left", background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 16, padding: 18, cursor: "pointer" }}>
          <strong>Activate the academic term</strong>
          <div style={{ color: "#92400e", marginTop: 5 }}>Academic oversight is term-bound. Open Term settings to complete setup.</div>
        </button>
      ) : classes.length === 0 ? (
        <button onClick={() => router.push("/admin/settings/classes")} style={{ textAlign: "left", background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 16, padding: 18, cursor: "pointer" }}>
          <strong>Create classes and streams</strong>
          <div style={{ color: "#92400e", marginTop: 5 }}>Teaching evidence cannot be reconciled until the school academic structure exists.</div>
        </button>
      ) : (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10 }}>
            {[
              ["Scheme coverage", `${totals.schemeClasses}/${classes.length} classes`, "/admin/academics/curriculum"],
              ["Teaching evidence", `${totals.taught}/${totals.sessions} sessions`, "/admin/academics"],
              ["Assessment activity", `${totals.assessmentClasses}/${classes.length} classes`, "/admin/academics/gradebook"],
              ["Results recorded", String(resultCount), "/admin/academics/gradebook"],
            ].map(([label, value, href]) => (
              <button key={label} onClick={() => router.push(href)} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: 21, fontWeight: 820 }}>{value}</div>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>{label}</div>
              </button>
            ))}
          </section>

          <section style={{ display: "grid", gap: 9 }}>
            {rows.map(row => {
              const needsAttention = row.schemeItems === 0 || row.sessions === 0 || row.assessments === 0
              return (
                <article key={row.id} style={{ background: "white", border: `1px solid ${needsAttention ? "#fde68a" : "#e2e8f0"}`, borderRadius: 14, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <strong>{row.name}{row.stream ? ` ${row.stream}` : ""}</strong>
                    <span style={{ color: needsAttention ? "#92400e" : "#047857", fontSize: 12 }}>{needsAttention ? "Needs attention" : "Evidence present"}</span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13, marginTop: 6, lineHeight: 1.55 }}>
                    Scheme: {row.schemeCovered}/{row.schemeItems} covered · Teaching: {row.taught}/{row.sessions} completed · Assessments: {row.publishedAssessments}/{row.assessments} published/closed
                  </div>
                </article>
              )
            })}
          </section>
        </>
      )}
    </main>
  )
}
