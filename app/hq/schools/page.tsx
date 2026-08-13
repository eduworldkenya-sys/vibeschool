"use client"

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { hqSupabase } from "@/lib/hq/supabase"
import { HQPage, HQPanel, HQ_THEME as C, hqButtonStyle } from "@/components/hq/HQShell"

type Candidate = {
  id: string
  status: string
  confidence: number | null
  match_reason: string | null
  directory_school_id: string | null
  canonical_school_id: string | null
  directory_name: string | null
  directory_county: string | null
  directory_sub_county: string | null
  canonical_name: string | null
  canonical_county: string | null
  canonical_sub_county: string | null
}

type Request = {
  id: string
  status: string
  request_type: string | null
  name: string
  county: string | null
  sub_county: string | null
  ward: string | null
  level: string | null
  school_code: string | null
  alternative_name: string | null
  notes: string | null
  requested_by: string
  created_at: string
}

type Queue = { candidates: Candidate[]; requests: Request[] }
type Canonical = { id: string; name: string; county: string | null; sub_county: string | null; source: string }

export default function HQSchoolsPage() {
  const router = useRouter()
  const [queue, setQueue] = useState<Queue>({ candidates: [], requests: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [dialog, setDialog] = useState<{ kind: "candidate" | "request"; id: string; action: "matched" | "created" } | null>(null)
  const [canonicalSearch, setCanonicalSearch] = useState("")
  const [canonicalRows, setCanonicalRows] = useState<Canonical[]>([])
  const [selectedCanonical, setSelectedCanonical] = useState<Canonical | null>(null)
  const [alias, setAlias] = useState("")
  const [note, setNote] = useState("")

  const refresh = useCallback(async () => {
    setError("")
    const { data, error } = await hqSupabase.rpc("hq_list_school_identity_queue", { p_status: "pending", p_limit: 100 })
    if (error) {
      setError(error.message)
      return
    }
    setQueue((data || { candidates: [], requests: [] }) as Queue)
  }, [])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      await refresh()
      setLoading(false)
    })()
  }, [refresh])

  useEffect(() => {
    if (!dialog || dialog.action !== "matched" || canonicalSearch.trim().length < 2) {
      setCanonicalRows([])
      return
    }
    const timer = setTimeout(async () => {
      const { data, error } = await hqSupabase.rpc("search_school_directory", {
        p_query: canonicalSearch.trim(),
        p_level: null,
        p_county: null,
        p_sub_county: null,
        p_lat: null,
        p_lng: null,
        p_limit: 20,
      })
      if (error) {
        setError(error.message)
        return
      }
      setCanonicalRows(((data || []) as Canonical[]).filter((row) => row.source === "CANONICAL"))
    }, 180)
    return () => clearTimeout(timer)
  }, [canonicalSearch, dialog])

  function openMatch(kind: "candidate" | "request", id: string) {
    setDialog({ kind, id, action: "matched" })
    setCanonicalSearch("")
    setCanonicalRows([])
    setSelectedCanonical(null)
    setAlias("")
    setNote("")
    setError("")
  }

  async function actCandidate(id: string, action: "matched" | "new" | "rejected") {
    setBusy(id)
    setError("")
    try {
      const { error } = await hqSupabase.rpc("hq_review_school_identity_candidate", {
        p_candidate_id: id,
        p_action: action,
        p_canonical_school_id: action === "matched" ? selectedCanonical?.id : null,
        p_alias: alias.trim() || null,
        p_note: note.trim() || null,
      })
      if (error) throw error
      setDialog(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Identity review failed")
    } finally {
      setBusy("")
    }
  }

  async function actRequest(id: string, action: "matched" | "created" | "rejected") {
    setBusy(id)
    setError("")
    try {
      const { error } = await hqSupabase.rpc("hq_resolve_school_discovery_request", {
        p_request_id: id,
        p_action: action,
        p_canonical_school_id: action === "matched" ? selectedCanonical?.id : null,
        p_school_name: null,
        p_alias: alias.trim() || null,
        p_note: note.trim() || null,
      })
      if (error) throw error
      setDialog(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discovery request resolution failed")
    } finally {
      setBusy("")
    }
  }

  return (
    <HQPage
      title="School identity"
      description="Reconcile directory records and teacher-submitted schools without silently creating duplicates."
      actions={<><button onClick={() => router.push("/hq")} style={hqButtonStyle}>HQ</button><button onClick={() => void refresh()} style={hqButtonStyle}>Refresh</button></>}
    >
      {error && <div role="alert" style={{ marginBottom: 14, padding: 12, borderRadius: 11, border: `1px solid ${C.red}55`, background: `${C.red}12`, color: C.red, fontSize: 12 }}>{error}</div>}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 18 }}>
        <HQPanel title="Pending identity matches"><div style={{ fontSize: 28, fontWeight: 950 }}>{queue.candidates.length}</div><div style={{ color: C.muted, fontSize: 11 }}>Directory records awaiting reconciliation</div></HQPanel>
        <HQPanel title="Pending school requests"><div style={{ fontSize: 28, fontWeight: 950 }}>{queue.requests.length}</div><div style={{ color: C.muted, fontSize: 11 }}>Teacher-submitted missing/new schools</div></HQPanel>
      </section>

      <section style={{ marginBottom: 22 }}>
        <HQPanel title="Directory identity queue">
          {loading ? <div style={{ padding: 14, color: C.muted }}>Loading queue…</div> : queue.candidates.length === 0 ? <div style={{ padding: 14, color: C.muted }}>No pending identity candidates.</div> : queue.candidates.map((c, i) => (
            <div key={c.id} style={{ padding: 14, borderTop: i ? `1px solid ${C.border}` : 0 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>{c.directory_name || "Unnamed directory record"}</div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{[c.directory_sub_county, c.directory_county].filter(Boolean).join(" · ") || "Location unavailable"}</div>
              <div style={{ color: C.muted, fontSize: 10.5, marginTop: 4 }}>{c.match_reason || "No deterministic canonical match"}</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
                <button onClick={() => openMatch("candidate", c.id)} style={{ ...hqButtonStyle, color: C.green }}>Match canonical</button>
                <button disabled={busy === c.id} onClick={() => void actCandidate(c.id, "new")} style={{ ...hqButtonStyle, color: C.amber }}>{busy === c.id ? "Working…" : "Create pending school"}</button>
                <button disabled={busy === c.id} onClick={() => void actCandidate(c.id, "rejected")} style={{ ...hqButtonStyle, color: C.red }}>{busy === c.id ? "Working…" : "Reject"}</button>
              </div>
            </div>
          ))}
        </HQPanel>
      </section>

      <section>
        <HQPanel title="Teacher discovery requests">
          {loading ? <div style={{ padding: 14, color: C.muted }}>Loading requests…</div> : queue.requests.length === 0 ? <div style={{ padding: 14, color: C.muted }}>No pending school requests.</div> : queue.requests.map((r, i) => (
            <div key={r.id} style={{ padding: 14, borderTop: i ? `1px solid ${C.border}` : 0 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>{r.name}</div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{[r.sub_county, r.county, r.level, r.school_code].filter(Boolean).join(" · ") || "No extra identity data"}</div>
              {r.alternative_name && <div style={{ color: C.muted, fontSize: 10.5, marginTop: 4 }}>Also known as: {r.alternative_name}</div>}
              {r.notes && <div style={{ color: C.muted, fontSize: 10.5, marginTop: 4, whiteSpace: "pre-wrap" }}>{r.notes}</div>}
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
                <button onClick={() => openMatch("request", r.id)} style={{ ...hqButtonStyle, color: C.green }}>Match existing school</button>
                <button disabled={busy === r.id} onClick={() => void actRequest(r.id, "created")} style={{ ...hqButtonStyle, color: C.amber }}>{busy === r.id ? "Working…" : "Create pending school"}</button>
                <button disabled={busy === r.id} onClick={() => void actRequest(r.id, "rejected")} style={{ ...hqButtonStyle, color: C.red }}>{busy === r.id ? "Working…" : "Reject"}</button>
              </div>
            </div>
          ))}
        </HQPanel>
      </section>

      {dialog && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 200, display: "grid", placeItems: "center", padding: 18, background: "rgba(2,6,23,.78)" }}>
          <div style={{ width: "min(100%,560px)", maxHeight: "90dvh", overflow: "auto", border: `1px solid ${C.border}`, borderRadius: 16, background: C.panel, padding: 18, color: C.text }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>Match to canonical school</h2>
            <p style={{ margin: "0 0 12px", fontSize: 11.5, color: C.muted }}>Search the canonical school registry and choose the exact school. Do not use name similarity alone when the location is ambiguous.</p>
            <input autoFocus value={canonicalSearch} onChange={(e) => setCanonicalSearch(e.target.value)} placeholder="Search canonical school name" style={{ width: "100%", boxSizing: "border-box", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,.04)", color: C.text }} />
            <div style={{ marginTop: 8 }}>{canonicalRows.map((row) => <button key={row.id} onClick={() => setSelectedCanonical(row)} style={{ display: "block", width: "100%", textAlign: "left", padding: 10, marginTop: 6, borderRadius: 9, border: selectedCanonical?.id === row.id ? `2px solid ${C.green}` : `1px solid ${C.border}`, background: selectedCanonical?.id === row.id ? `${C.green}12` : "transparent", color: C.text }}><b>{row.name}</b><div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{[row.sub_county, row.county].filter(Boolean).join(" · ")}</div></button>)}</div>
            {selectedCanonical && <div style={{ marginTop: 10, padding: 10, borderRadius: 9, background: `${C.green}12`, fontSize: 11 }}>Selected: <b>{selectedCanonical.name}</b> · {[selectedCanonical.sub_county, selectedCanonical.county].filter(Boolean).join(" · ")}</div>}
            <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Verified alias to add (optional)" style={{ width: "100%", boxSizing: "border-box", marginTop: 10, padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,.04)", color: C.text }} />
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Review note (optional)" rows={3} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,.04)", color: C.text, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}><button onClick={() => setDialog(null)} style={hqButtonStyle}>Cancel</button><button disabled={!selectedCanonical || Boolean(busy)} onClick={() => dialog.kind === "candidate" ? void actCandidate(dialog.id, "matched") : void actRequest(dialog.id, "matched")} style={{ ...hqButtonStyle, color: C.green }}>{busy ? "Saving…" : "Confirm match"}</button></div>
          </div>
        </div>
      )}
    </HQPage>
  )
}
