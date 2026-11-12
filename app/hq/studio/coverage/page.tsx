"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { hqSupabase } from "@/lib/hq/supabase"

type SubjectRow = {
  grade: string; subject: string; phase: string | null; pathway: string | null
  subject_kind: string | null; source_ref: string | null; registered: boolean
  curriculum_rows: number; strands: number; sub_strands: number; topics: number
  outcomes: number; verified_outcomes: number; authored_outcomes: number
  question_outcomes: number; certified_outcomes: number
  core_release_claims: number; approved_questions: number
}
type OutcomeRow = {
  id: string; grade: string | null; subject: string | null
  strand: string | null; sub_strand: string | null; topic: string | null
  outcome_text: string; mapping_status: string; source_verified: boolean
  progress_state: string; resources: number; blocks: number
  approved_questions: number; certified_packages: number; core_release_claims: number
}
type TopicRow = { strand: string | null; sub_strand: string | null; topic: string | null; curriculum_rows: number; outcomes: number; authored_outcomes: number; verified_outcomes: number; approved_questions: number }
type CoverageReport = {
  subjects: SubjectRow[]; outcomes: OutcomeRow[]; topics: TopicRow[]
  generated_at: string
  diagnostics: { unlocated_outcomes: number; archived_outcomes: number; detail_limit: number; detail_truncated: boolean }
}
const GROUPS = [
  { name: "Early Years", grades: ["Playgroup", "PP1", "PP2"] },
  { name: "Primary", grades: ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"] },
  { name: "Junior School", grades: ["Grade 7", "Grade 8", "Grade 9"] },
  { name: "Senior School", grades: ["Grade 10", "Grade 11", "Grade 12"] },
  { name: "Legacy Forms", grades: ["Form 1", "Form 2", "Form 3", "Form 4"] },
] as const
const C = {
  bg: "#07111f", panel: "#0d1b2f", line: "rgba(255,255,255,.12)",
  text: "#f8fafc", muted: "#94a3b8", green: "#34d399",
  amber: "#fbbf24", blue: "#93c5fd", red: "#fda4af",
}
const panel: React.CSSProperties = { background: C.panel, border: "1px solid " + C.line, borderRadius: 14, padding: 16 }
const btn: React.CSSProperties = { border: "1px solid " + C.line, background: "#14233a", color: C.text, padding: "9px 12px", borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: 12 }
const human = (value: string) => value.replaceAll("_", " ")
function Metric({ label, value, help }: { label: string; value: number; help: string }) {
  return <div style={panel}><div style={{ fontSize: 12, color: C.muted }}>{label}</div><strong style={{ display: "block", fontSize: 26, marginTop: 7 }}>{value.toLocaleString()}</strong><small style={{ color: C.muted }}>{help}</small></div>
}
function progress(row: SubjectRow) {
  return row.outcomes ? Math.round(100 * row.authored_outcomes / row.outcomes) : null
}
export default function HQContentCoveragePage() {
  const router = useRouter()
  const [grade, setGrade] = useState("Grade 4")
  const [subject, setSubject] = useState("")
  const [query, setQuery] = useState("")
  const [report, setReport] = useState<CoverageReport | null>(null)
  const [details, setDetails] = useState<OutcomeRow[]>([])
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [detailTruncated, setDetailTruncated] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState("")
  const [detailError, setDetailError] = useState("")
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision(v => v + 1), [])

  useEffect(() => {
    let current = true
    async function load() {
      setFetching(true); setError("")
      const { data, error: e } = await hqSupabase.rpc("hq_content_coverage" as never)
      if (!current) return
      if (e) { setError(e.message); setReport(null) }
      else setReport(data as CoverageReport)
      setFetching(false)
    }
    void load()
    return () => { current = false }
  }, [revision])

  const subjects = useMemo(() => {
    const matched = (report?.subjects ?? []).filter(row =>
      row.grade === grade && row.subject.toLowerCase().includes(query.trim().toLowerCase()))
    return matched.sort((a, b) => a.subject.localeCompare(b.subject))
  }, [grade, query, report])
  const activeSubject = useMemo(() =>
    report?.subjects.find(r => r.grade === grade && r.subject === subject) ?? null,
  [grade, subject, report])
  const totals = useMemo(() => (report?.subjects ?? []).reduce((v, r) => ({
    registered: v.registered + Number(r.registered),
    outcomes: v.outcomes + r.outcomes,
    verified: v.verified + r.verified_outcomes,
    authored: v.authored + r.authored_outcomes,
    certified: v.certified + r.certified_outcomes,
  }), { registered: 0, outcomes: 0, verified: 0, authored: 0, certified: 0 }), [report])

  useEffect(() => {
    let current = true
    if (!subject || !activeSubject) { setDetails([]); setTopics([]); setDetailLoading(false); return }
    async function load() {
      setDetailLoading(true); setDetailError(""); setDetails([]); setTopics([])
      const { data, error: e } = await hqSupabase.rpc("hq_content_coverage" as never, {
        p_grade: grade, p_subject: subject,
      } as never)
      if (!current) return
      if (e) setDetailError(e.message)
      else {
        const result = data as CoverageReport
        setDetails(result?.outcomes ?? [])
        setTopics(result?.topics ?? [])
        setDetailTruncated(Boolean(result?.diagnostics?.detail_truncated))
      }
      setDetailLoading(false)
    }
    void load()
    return () => { current = false }
  }, [grade, subject, activeSubject, revision])

  return <main style={{ minHeight: "100dvh", background: C.bg, color: C.text, padding: "18px 18px 80px" }}>
    <div style={{ maxWidth: 1250, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button style={btn} onClick={() => router.push("/hq/studio")}>HQ Studio</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: C.green, fontSize: 10, fontWeight: 800, letterSpacing: 1.5 }}>READ-ONLY CANONICAL COVERAGE</div>
          <h1 style={{ margin: "4px 0" }}>Curriculum & Content Progress</h1>
          <p style={{ color: C.muted, margin: 0, fontSize: 12 }}>Playgroup to Form 4, including senior pathways. Counts come from existing curriculum and content records.</p>
        </div>
        <button style={btn} onClick={reload} disabled={fetching}>Refresh</button>
      </div>
      <p style={{ fontSize: 12, color: C.amber, marginTop: 16 }}>
        Content recorded does not mean complete, certified or visible to learners. Verified-status outcomes are not a full official-source reconciliation. No progress is entered manually.
      </p>
      {error && <div role="alert" style={{ ...panel, color: C.red }}>Coverage unavailable: {error}. Check that the HQ coverage migration is deployed.</div>}
      {fetching && <p role="status" style={{ color: C.muted }}>Reading curriculum and content evidence…</p>}
      {report && <>
        <section aria-label="Coverage totals" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 10, marginTop: 14 }}>
          <Metric label="Registered subjects" value={totals.registered} help="Existing grade/subject register" />
          <Metric label="Located outcomes" value={totals.outcomes} help="Resolved to a grade and subject" />
          <Metric label="Verified-status outcomes" value={totals.verified} help="Source locator and verified import" />
          <Metric label="Content recorded" value={totals.authored} help="Resource or chapter block linked" />
          <Metric label="Certified packages" value={totals.certified} help="Canonical package version" />
        </section>
        <p style={{ fontSize: 12, color: report.diagnostics.unlocated_outcomes ? C.amber : C.muted }}>
          {report.diagnostics.unlocated_outcomes.toLocaleString()} existing outcomes have no resolvable grade/subject and are excluded from subject percentages. {report.diagnostics.archived_outcomes} archived outcomes excluded.
        </p>
        <section style={{ ...panel, marginTop: 15 }}>
          <h2 style={{ fontSize: 17, marginTop: 0 }}>Select a class</h2>
          <div style={{ display: "flex", gap: 15, flexWrap: "wrap" }}>
            {GROUPS.map(group => <div key={group.name} style={{ flex: "1 1 160px" }}>
              <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>{group.name}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {group.grades.map(g => <button key={g} aria-pressed={grade === g} onClick={() => { setGrade(g); setSubject(""); setDetails([]) }}
                  style={{ ...btn, background: grade === g ? "#145b50" : "#14233a", borderColor: grade === g ? C.green : C.line }}>{g}</button>)}
              </div>
            </div>)}
          </div>
        </section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,440px),1fr))", gap: 13, marginTop: 14, alignItems: "start" }}>
          <section style={panel}>
            <h2 style={{ fontSize: 17, marginTop: 0 }}>{grade} — subjects</h2>
            <input aria-label="Find a subject" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search this class"
              style={{ width: "100%", boxSizing: "border-box", background: C.bg, color: C.text, border: "1px solid " + C.line, borderRadius: 8, padding: 11, marginBottom: 12 }} />
            {subjects.length === 0 ? <p style={{ color: C.amber, fontSize: 13 }}>
              No subjects registered for this class in the current canonical inventory. This is a cataloguing gap, not completed curriculum.
            </p> : <div style={{ maxHeight: 570, overflowY: "auto" }}>
              {subjects.map(s => <button key={s.grade + s.subject} onClick={() => setSubject(s.subject)}
                aria-pressed={subject === s.subject}
                style={{ display: "block", width: "100%", textAlign: "left", border: "1px solid " + (subject === s.subject ? C.green : C.line), background: subject === s.subject ? "#153c3a" : C.panel, color: C.text, padding: 11, borderRadius: 9, marginBottom: 7, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>{s.subject}</strong>
                  <span style={{ color: s.registered ? C.green : C.amber, fontSize: 10 }}>{s.registered ? "Registered" : "Not registered"}</span>
                </div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 5 }}>
                  {s.outcomes} located outcomes · {s.authored_outcomes} with content · {s.verified_outcomes} verified-status
                  {s.outcomes === 0 && " · outcome inventory missing"}
                </div>
                <div style={{ height: 5, background: "#26364a", marginTop: 9, borderRadius: 4 }}>
                  <div style={{ height: 5, borderRadius: 4, width: String(progress(s) ?? 0) + "%", background: C.green }} />
                </div>
                <small style={{ color: C.muted }}>{progress(s) == null ? "Completion % unavailable: no outcome denominator" : String(progress(s)) + "% have some recorded content (not necessarily complete)"}</small>
              </button>)}
            </div>}
          </section>
          <section style={panel}>
            {!activeSubject ? <>
              <h2 style={{ marginTop: 0, fontSize: 17 }}>Select a subject</h2>
              <p style={{ color: C.muted, fontSize: 13 }}>Open a subject to inspect its actual strands, topics, sub-strands, learning outcomes and evidence of content production.</p>
            </> : <>
              <h2 style={{ marginTop: 0, fontSize: 17 }}>{grade} · {activeSubject.subject}</h2>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
                {activeSubject.pathway ? activeSubject.pathway + " · " : ""}{activeSubject.subject_kind || "Subject"}
                <div>Register source: {activeSubject.source_ref || "Not recorded"} (source claim, not independent certification)</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginBottom: 12 }}>
                <Metric label="Curriculum rows" value={activeSubject.curriculum_rows} help="Mapped schedule entries" />
                <Metric label="Topics" value={activeSubject.topics} help="Distinct current labels" />
                <Metric label="Approved questions" value={activeSubject.approved_questions} help="Outcome-linked platform bank" />
              </div>
              {activeSubject.outcomes === 0 && <p style={{ color: C.amber, fontSize: 13 }}>No resolvable learning outcomes. Topic/subtopic completeness cannot be calculated until the official curriculum and canonical mapping are reconciled.</p>}
              {detailError && <div role="alert" style={{ color: C.red }}>{detailError}</div>}
              {detailLoading ? <p role="status" style={{ color: C.muted }}>Loading outcome evidence…</p> : <>
                <h3 style={{ fontSize: 14 }}>Curriculum topics and subtopics ({topics.length})</h3>
                <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 14 }}>
                  {topics.length === 0 && <p style={{ color: C.amber, fontSize: 12 }}>No topic inventory recorded for this subject.</p>}
                  {topics.map((t, i) => <div key={i} style={{ padding: "10px 0", borderTop: "1px solid " + C.line }}>
                    <strong style={{ fontSize: 12 }}>{[t.strand, t.sub_strand, t.topic].filter(Boolean).join(" / ") || "Unlabelled curriculum area"}</strong>
                    <div style={{ fontSize: 11, color: C.muted }}>{t.curriculum_rows} curriculum rows · {t.outcomes} linked outcomes · {t.authored_outcomes} with content · {t.verified_outcomes} source-verified · {t.approved_questions} approved questions</div>
                    {t.outcomes === 0 && <div style={{ color: C.amber, fontSize: 11 }}>No outcomes linked — completion cannot be determined</div>}
                  </div>)}
                </div>
                <h3 style={{ fontSize: 14 }}>Learning outcomes ({details.length})</h3>
                <div style={{ maxHeight: 660, overflowY: "auto" }}>
                  {details.map(o => <article key={o.id} style={{ padding: "12px 0", borderTop: "1px solid " + C.line }}>
                    <div style={{ fontSize: 11, color: C.blue }}>{[o.strand, o.sub_strand, o.topic].filter(Boolean).join(" / ") || "Unclassified topic"}</div>
                    <p style={{ fontSize: 12, lineHeight: 1.55, margin: "6px 0" }}>{o.outcome_text}</p>
                    <div style={{ color: o.core_release_claims ? C.green : o.source_verified ? C.blue : C.amber, fontSize: 11 }}>
                      {human(o.progress_state)} · {o.source_verified ? "source-verified import" : "source reconciliation not proven"}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      Resources: {o.resources} · linked content blocks: {o.blocks} · approved questions: {o.approved_questions} · certified packages: {o.certified_packages}
                    </div>
                  </article>)}
                </div>
                {detailTruncated && <p style={{ color: C.amber }}>Some outcomes are beyond the configured detail limit.</p>}
              </>}
            </>}
          </section>
        </div>
      </>}
    </div>
  </main>
}
