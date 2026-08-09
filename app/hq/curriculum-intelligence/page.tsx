"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Proposal = {
  id: string
  title: string
  proposal_type: string
  claim: string | null
  current_content: string | null
  proposed_content: string
  rationale: string
  curriculum_relevance: string
  confidence: number
  verification_status: string
  volatility: string
  status: string
  generated_at: string
  publication_id: string | null
  chapter_id: string | null
}

type Source = {
  id: string
  proposal_id: string
  url: string
  title: string | null
  publisher: string | null
  source_type: string
  authority_score: number
  supports_claim: boolean | null
  evidence_summary: string | null
}

type WatchTarget = {
  id: string
  label: string
  scope_type: string
  subject: string | null
  grade: string | null
  query: string
  cadence: string
  enabled: boolean
  last_checked_at: string | null
}

const C = {
  bg: "#0a1628",
  panel: "#0f1d33",
  line: "rgba(255,255,255,.08)",
  text: "#fff",
  muted: "rgba(255,255,255,.48)",
  accent: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
  violet: "#8b5cf6",
}

const badge = (color: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 8px",
  fontSize: 10, fontWeight: 800, color, background: `${color}20`, border: `1px solid ${color}35`,
})

function confidenceLabel(v: number) {
  const pct = Math.round(Number(v || 0) * 100)
  return `${pct}% confidence`
}

export default function CurriculumIntelligencePage() {
  const router = useRouter()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [targets, setTargets] = useState<WatchTarget[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState("pending_review")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [note, setNote] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    const [proposalRes, sourceRes, targetRes] = await Promise.all([
      supabase.from("curriculum_intelligence_proposals").select("id,title,proposal_type,claim,current_content,proposed_content,rationale,curriculum_relevance,confidence,verification_status,volatility,status,generated_at,publication_id,chapter_id").order("generated_at", { ascending: false }).limit(200),
      supabase.from("curriculum_intelligence_sources").select("id,proposal_id,url,title,publisher,source_type,authority_score,supports_claim,evidence_summary").order("authority_score", { ascending: false }),
      supabase.from("curriculum_intelligence_watch_targets").select("id,label,scope_type,subject,grade,query,cadence,enabled,last_checked_at").order("created_at", { ascending: false }),
    ])
    if (proposalRes.error || sourceRes.error || targetRes.error) {
      setError(proposalRes.error?.message || sourceRes.error?.message || targetRes.error?.message || "Could not load Curriculum Intelligence")
    } else {
      setProposals((proposalRes.data || []) as Proposal[])
      setSources((sourceRes.data || []) as Source[])
      setTargets((targetRes.data || []) as WatchTarget[])
      if (!selectedId && proposalRes.data?.[0]?.id) setSelectedId(proposalRes.data[0].id)
    }
    setLoading(false)
  }, [selectedId])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => filter === "all" ? proposals : proposals.filter(p => p.status === filter), [proposals, filter])
  const selected = proposals.find(p => p.id === selectedId) || visible[0] || null
  const selectedSources = selected ? sources.filter(s => s.proposal_id === selected.id) : []

  async function review(action: "approve" | "reject") {
    if (!selected) return
    setBusy(action)
    setError("")
    const { error: rpcError } = await supabase.rpc("hq_review_curriculum_intelligence_proposal", {
      p_proposal_id: selected.id,
      p_action: action,
      p_note: note.trim() || null,
    })
    if (rpcError) setError(rpcError.message)
    else { setNote(""); await load() }
    setBusy(null)
  }

  async function applyApproved() {
    if (!selected) return
    setBusy("apply")
    setError("")
    const { error: rpcError } = await supabase.rpc("hq_apply_curriculum_intelligence_proposal", { p_proposal_id: selected.id })
    if (rpcError) setError(rpcError.message)
    else await load()
    setBusy(null)
  }

  const pending = proposals.filter(p => p.status === "pending_review").length
  const approved = proposals.filter(p => p.status === "approved").length
  const applied = proposals.filter(p => p.status === "applied").length
  const verified = proposals.filter(p => p.verification_status === "verified").length

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: "Inter,system-ui,sans-serif" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,22,40,.96)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.line}`, padding: "14px 18px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <button onClick={() => router.push("/hq")} style={{ border: 0, background: "transparent", color: C.muted, padding: 0, cursor: "pointer", fontSize: 11 }}>← HQ</button>
            <h1 style={{ margin: "3px 0 0", fontSize: 20 }}>Curriculum Intelligence</h1>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>Research → verify → compare → draft → approve → apply</div>
          </div>
          <button onClick={() => void load()} style={{ border: `1px solid ${C.line}`, background: "rgba(255,255,255,.04)", color: C.text, borderRadius: 10, padding: "9px 12px", cursor: "pointer", fontWeight: 700 }}>Refresh</button>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: 18 }}>
        {error && <div style={{ background: `${C.red}18`, border: `1px solid ${C.red}45`, color: "#fecaca", borderRadius: 12, padding: 12, marginBottom: 14 }}>{error}</div>}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 16 }}>
          {[
            ["Pending review", pending, C.amber], ["Approved", approved, C.blue], ["Applied", applied, C.accent], ["Verified claims", verified, C.violet], ["Watch targets", targets.filter(t => t.enabled).length, C.text],
          ].map(([label, value, color]) => <div key={String(label)} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 13 }}><div style={{ fontSize: 25, fontWeight: 900, color: String(color) }}>{value}</div><div style={{ color: C.muted, fontSize: 11 }}>{label}</div></div>)}
        </section>

        <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <div><div style={{ fontWeight: 800 }}>Watch list</div><div style={{ color: C.muted, fontSize: 11 }}>What the research engine is expected to keep checking.</div></div>
            <span style={badge(C.accent)}>{targets.filter(t => t.enabled).length} active</span>
          </div>
          {targets.length === 0 ? <div style={{ color: C.muted, fontSize: 12, padding: "8px 0" }}>No watch targets yet. The control plane is ready for the research runner to seed them.</div> : targets.slice(0, 8).map(t => <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${C.line}` }}><div><div style={{ fontSize: 12.5, fontWeight: 750 }}>{t.label}</div><div style={{ color: C.muted, fontSize: 10.5 }}>{[t.grade,t.subject,t.scope_type,t.cadence].filter(Boolean).join(" · ")}</div></div><span style={badge(t.enabled ? C.accent : C.muted)}>{t.enabled ? "WATCHING" : "PAUSED"}</span></div>)}
        </section>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {["pending_review","approved","applied","rejected","all"].map(f => <button key={f} onClick={() => setFilter(f)} style={{ border: `1px solid ${filter === f ? C.accent : C.line}`, background: filter === f ? `${C.accent}18` : "transparent", color: filter === f ? C.accent : C.muted, borderRadius: 999, padding: "7px 10px", cursor: "pointer", fontWeight: 700, fontSize: 11 }}>{f.replaceAll("_"," ")}</button>)}
        </div>

        {loading ? <div style={{ color: C.muted, padding: 30, textAlign: "center" }}>Loading intelligence inbox…</div> : (
          <section style={{ display: "grid", gridTemplateColumns: "minmax(260px,.8fr) minmax(0,1.4fr)", gap: 14 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", alignSelf: "start" }}>
              {visible.length === 0 ? <div style={{ padding: 18, color: C.muted, fontSize: 12 }}>No proposals in this state.</div> : visible.map(p => (
                <button key={p.id} onClick={() => setSelectedId(p.id)} style={{ width: "100%", textAlign: "left", border: 0, borderBottom: `1px solid ${C.line}`, background: selected?.id === p.id ? "rgba(255,255,255,.06)" : "transparent", color: C.text, padding: 13, cursor: "pointer" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}><strong style={{ fontSize: 12.5 }}>{p.title}</strong><span style={badge(p.verification_status === "verified" ? C.accent : C.amber)}>{p.verification_status}</span></div>
                  <div style={{ color: C.muted, fontSize: 10.5, marginTop: 5 }}>{p.proposal_type.replaceAll("_"," ")} · {p.curriculum_relevance} · {confidenceLabel(p.confidence)}</div>
                </button>
              ))}
            </div>

            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, minWidth: 0 }}>
              {!selected ? <div style={{ color: C.muted }}>Select a proposal.</div> : <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "start" }}>
                  <div><h2 style={{ margin: 0, fontSize: 18 }}>{selected.title}</h2><div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{new Date(selected.generated_at).toLocaleString()} · {selected.volatility} volatility</div></div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><span style={badge(C.violet)}>{selected.curriculum_relevance}</span><span style={badge(selected.verification_status === "verified" ? C.accent : C.amber)}>{selected.verification_status}</span><span style={badge(C.blue)}>{confidenceLabel(selected.confidence)}</span></div>
                </div>

                {selected.claim && <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(255,255,255,.035)" }}><div style={{ color: C.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>Claim being evaluated</div><div style={{ marginTop: 5, fontSize: 13, lineHeight: 1.55 }}>{selected.claim}</div></div>}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 10, marginTop: 12 }}>
                  <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}><div style={{ color: C.red, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>Current Vibeschool</div><div style={{ whiteSpace: "pre-wrap", marginTop: 6, color: selected.current_content ? C.text : C.muted, fontSize: 12.5, lineHeight: 1.6 }}>{selected.current_content || "No existing passage attached."}</div></div>
                  <div style={{ border: `1px solid ${C.accent}45`, borderRadius: 12, padding: 12, background: `${C.accent}08` }}><div style={{ color: C.accent, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>Proposed draft</div><div style={{ whiteSpace: "pre-wrap", marginTop: 6, fontSize: 12.5, lineHeight: 1.6 }}>{selected.proposed_content}</div></div>
                </div>

                <div style={{ marginTop: 12 }}><div style={{ color: C.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>Why this change</div><div style={{ marginTop: 5, fontSize: 12.5, lineHeight: 1.6 }}>{selected.rationale}</div></div>

                <div style={{ marginTop: 14 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontWeight: 800, fontSize: 12 }}>Evidence</div><span style={badge(selectedSources.length >= 2 ? C.accent : C.amber)}>{selectedSources.length} sources</span></div>
                  {selectedSources.length === 0 ? <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>No evidence sources attached. Do not approve this proposal.</div> : selectedSources.map(s => <a key={s.id} href={s.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 8, border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, color: C.text, textDecoration: "none" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ fontSize: 11.5 }}>{s.title || s.publisher || s.url}</strong><span style={badge(C.blue)}>{Math.round(Number(s.authority_score || 0)*100)} authority</span></div><div style={{ color: C.muted, fontSize: 10, marginTop: 4 }}>{s.source_type}{s.publisher ? ` · ${s.publisher}` : ""}</div>{s.evidence_summary && <div style={{ fontSize: 11, marginTop: 6, lineHeight: 1.45 }}>{s.evidence_summary}</div>}</a>)}
                </div>

                {selected.status === "pending_review" && <div style={{ marginTop: 16, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
                  <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Review note (optional)" style={{ width: "100%", minHeight: 72, resize: "vertical", background: "rgba(255,255,255,.04)", border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, color: C.text, fontFamily: "inherit" }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button disabled={!!busy} onClick={() => void review("reject")} style={{ flex: 1, border: `1px solid ${C.red}55`, background: `${C.red}15`, color: "#fecaca", borderRadius: 10, padding: 11, fontWeight: 800, cursor: "pointer" }}>Reject</button><button disabled={!!busy || selectedSources.length === 0} onClick={() => void review("approve")} style={{ flex: 1, border: 0, background: C.accent, color: "#052e24", borderRadius: 10, padding: 11, fontWeight: 900, cursor: selectedSources.length === 0 ? "not-allowed" : "pointer", opacity: selectedSources.length === 0 ? .45 : 1 }}>Approve draft</button></div>
                </div>}

                {selected.status === "approved" && <button disabled={!!busy} onClick={() => void applyApproved()} style={{ width: "100%", marginTop: 16, border: 0, background: C.blue, color: "white", borderRadius: 10, padding: 12, fontWeight: 900, cursor: "pointer" }}>Apply approved patch to Vibeschool</button>}
                {selected.status === "applied" && <div style={{ marginTop: 16, padding: 11, borderRadius: 10, background: `${C.accent}14`, color: "#a7f3d0", fontWeight: 750, fontSize: 12 }}>Applied to Vibeschool. Audit history is retained.</div>}
              </>}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
