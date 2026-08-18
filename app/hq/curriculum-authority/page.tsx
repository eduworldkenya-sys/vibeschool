"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { hqSupabase } from "@/lib/hq/supabase"

type Subject = { id: string; name: string }
type Json = Record<string, unknown>

const C = {
  bg: "#07111f", panel: "#0d1a2d", panel2: "#101f35", line: "rgba(255,255,255,.09)",
  text: "#f8fafc", muted: "rgba(248,250,252,.52)", green: "#34d399", amber: "#fbbf24",
  red: "#fb7185", blue: "#60a5fa", violet: "#a78bfa",
}
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", borderRadius: 10, border: `1px solid ${C.line}`, background: "rgba(255,255,255,.04)", color: C.text, padding: "10px 11px", fontSize: 12 }
const button = (accent = C.blue): React.CSSProperties => ({ border: `1px solid ${accent}55`, background: `${accent}16`, color: accent, borderRadius: 10, padding: "9px 11px", fontWeight: 850, fontSize: 11, cursor: "pointer" })
const badge = (accent = C.blue): React.CSSProperties => ({ display: "inline-flex", border: `1px solid ${accent}45`, background: `${accent}14`, color: accent, borderRadius: 999, padding: "4px 8px", fontSize: 9.5, fontWeight: 900 })

const KICD_G9_PAGE = "https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/"
const KICD_G9_MATH_PREVIEW = "https://drive.google.com/file/d/1HgntYl8nS1zydy8k00KrjEt_zJiMqISL/preview"
const DEFAULT_OBSERVATIONS = JSON.stringify([
  {
    observation_key: "replace-with-source-locator-key",
    curriculum_framework: "CBC",
    grade: "Grade 9",
    subject_label: "Mathematics",
    strand: "",
    sub_strand: "",
    topic: null,
    outcome_text: "",
    outcome_code: null,
    source_locator: "Mathematics Grade 9 - July 2024 - Revised.pdf",
    source_page: null,
    source_section: null,
    competencies: [],
    values: [],
    key_inquiry_questions: [],
    suggested_experiences: [],
    assessment_guidance: [],
  },
], null, 2)

export default function CurriculumAuthorityPage() {
  const router = useRouter()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectId, setSubjectId] = useState("f430f8b3-9d8d-4845-8904-a3e597191ab6")
  const [authorityName, setAuthorityName] = useState("Kenya Institute of Curriculum Development (KICD)")
  const [framework, setFramework] = useState("CBC")
  const [grade, setGrade] = useState("Grade 9")
  const [sourceUrl, setSourceUrl] = useState(KICD_G9_MATH_PREVIEW)
  const [sourceVersion, setSourceVersion] = useState("July 2024 Revised")
  const [sourceId, setSourceId] = useState("")
  const [snapshotId, setSnapshotId] = useState("")
  const [observations, setObservations] = useState(DEFAULT_OBSERVATIONS)
  const [promotionPhrase, setPromotionPhrase] = useState("")
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [result, setResult] = useState<Json | null>(null)
  const [review, setReview] = useState<Json | null>(null)

  const selectedSubject = useMemo(() => subjects.find(s => s.id === subjectId)?.name || "Mathematics", [subjects, subjectId])

  useEffect(() => {
    void (async () => {
      const { data, error } = await hqSupabase.from("subjects").select("id,name").is("school_id", null).order("name")
      if (!error) setSubjects((data || []) as Subject[])
    })()
  }, [])

  async function run(label: string, work: () => Promise<Json>) {
    setBusy(label); setError(""); setResult(null)
    try { const out = await work(); setResult(out); return out }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); throw e }
    finally { setBusy("") }
  }

  async function registerSource() {
    await run("register", async () => {
      const { data, error } = await hqSupabase.rpc("curriculum_authority_register_source", {
        p_authority_name: authorityName.trim(), p_curriculum_framework: framework.trim(), p_grade: grade.trim(),
        p_canonical_subject_id: subjectId, p_source_url: sourceUrl.trim(), p_source_version: sourceVersion.trim(),
        p_source_published_on: null,
        p_metadata: { parent_authority_page: KICD_G9_PAGE, source_title: `${selectedSubject} ${grade} - ${sourceVersion}`, intake_surface: "/hq/curriculum-authority" },
      })
      if (error) throw error
      setSourceId(String(data))
      return { sourceId: String(data), ownerApproved: true }
    }).catch(() => undefined)
  }

  async function invoke(action: string, body: Json) {
    const { data, error } = await hqSupabase.functions.invoke("curriculum-authority-intake", { body: { action, ...body } })
    if (error) throw error
    if (data?.error) throw new Error(String(data.error))
    return data as Json
  }

  async function ingestArtifact() {
    if (!sourceId) return setError("Register the owner-approved source first.")
    await run("artifact", async () => {
      const out = await invoke("ingest_artifact", { sourceId, artifactUrl: sourceUrl.trim() })
      setSnapshotId(String(out.snapshotId || ""))
      return out
    }).catch(() => undefined)
  }

  async function stageObservations() {
    if (!snapshotId) return setError("Create the immutable artifact snapshot first.")
    await run("observations", async () => {
      let parsed: unknown
      try { parsed = JSON.parse(observations) } catch { throw new Error("Observations must be valid JSON.") }
      if (!Array.isArray(parsed)) throw new Error("Observations JSON must be an array.")
      if (parsed.some((o: any) => !o?.strand?.trim?.() || !o?.sub_strand?.trim?.() || !o?.outcome_text?.trim?.())) throw new Error("Every observation needs exact strand, sub_strand and outcome_text from the source. Placeholder rows cannot be staged.")
      return invoke("stage_observations", { snapshotId, observations: parsed })
    }).catch(() => undefined)
  }

  async function sealReconcile() {
    if (!snapshotId) return setError("Snapshot required.")
    await run("seal", () => invoke("seal_reconcile", { snapshotId })).catch(() => undefined)
  }

  async function loadReview() {
    if (!snapshotId) return setError("Snapshot required.")
    await run("review", async () => {
      const { data, error } = await hqSupabase.rpc("curriculum_authority_get_snapshot_review", { p_snapshot_id: snapshotId })
      if (error) throw error
      setReview((data || {}) as Json)
      return (data || {}) as Json
    }).catch(() => undefined)
  }

  async function bindHierarchy() {
    if (!snapshotId) return setError("Snapshot required.")
    await run("bind", async () => {
      const { data, error } = await hqSupabase.rpc("curriculum_authority_bind_hierarchy", { p_snapshot_id: snapshotId })
      if (error) throw error
      setReview(null)
      return (data || {}) as Json
    }).catch(() => undefined)
  }

  async function freshReconcile() {
    if (!snapshotId) return setError("Snapshot required.")
    await run("reconcile", () => invoke("reconcile", { snapshotId })).catch(() => undefined)
  }

  async function promote() {
    if (!snapshotId) return setError("Snapshot required.")
    if (promotionPhrase !== "PROMOTE OFFICIAL") return setError("Type PROMOTE OFFICIAL exactly before final promotion.")
    await run("promote", async () => {
      const { data, error } = await hqSupabase.rpc("curriculum_authority_promote_snapshot", { p_snapshot_id: snapshotId })
      if (error) throw error
      setPromotionPhrase("")
      return (data || {}) as Json
    }).catch(() => undefined)
  }

  return <div style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: "Inter,system-ui,sans-serif" }}>
    <header style={{ position: "sticky", top: 0, zIndex: 40, borderBottom: `1px solid ${C.line}`, background: "rgba(7,17,31,.96)", backdropFilter: "blur(12px)", padding: "14px 18px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div><button onClick={() => router.push("/hq")} style={{ border: 0, background: "transparent", color: C.muted, padding: 0, cursor: "pointer", fontSize: 11 }}>← HQ</button><h1 style={{ margin: "3px 0 0", fontSize: 20 }}>Curriculum Authority</h1><div style={{ color: C.muted, fontSize: 11.5, marginTop: 3 }}>Official source → immutable evidence → reconciliation → hierarchy binding → owner promotion</div></div>
        <div style={{ display: "flex", gap: 6 }}><span style={badge(C.green)}>HQ OWNER</span><span style={badge(C.amber)}>FAIL-CLOSED</span></div>
      </div>
    </header>

    <main style={{ maxWidth: 1180, margin: "0 auto", padding: 18 }}>
      <section style={{ border: `1px solid ${C.amber}35`, background: `${C.amber}0d`, borderRadius: 14, padding: 13, marginBottom: 14, fontSize: 11.5, lineHeight: 1.6 }}>
        This surface never invents curriculum. Source registration and final promotion retain the authenticated HQ owner identity. Artifact fetching, hashing, private storage and staging run through the service lane. Existing matching <code>cbc_strands</code> rows are not official until source-bound.
      </section>
      {error && <div role="alert" style={{ border: `1px solid ${C.red}45`, background: `${C.red}12`, color: "#fecdd3", borderRadius: 12, padding: 11, marginBottom: 12, fontSize: 11.5 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
        <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><strong>1. Owner-approved source</strong><span style={badge(sourceId ? C.green : C.muted)}>{sourceId ? "REGISTERED" : "PENDING"}</span></div>
          <div style={{ color: C.muted, fontSize: 10.5, margin: "4px 0 12px" }}>Canary defaults to the official KICD Grade 9 Mathematics July 2024 revised document embedded by KICD.</div>
          <label style={{ fontSize: 10 }}>Authority</label><input value={authorityName} onChange={e=>setAuthorityName(e.target.value)} style={{...input,margin:"4px 0 9px"}} />
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}><div><label style={{fontSize:10}}>Framework</label><input value={framework} onChange={e=>setFramework(e.target.value)} style={{...input,marginTop:4}} /></div><div><label style={{fontSize:10}}>Grade</label><input value={grade} onChange={e=>setGrade(e.target.value)} style={{...input,marginTop:4}} /></div></div>
          <label style={{ fontSize: 10, display:"block",marginTop:9 }}>Canonical subject</label><select value={subjectId} onChange={e=>setSubjectId(e.target.value)} style={{...input,marginTop:4}}>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <label style={{ fontSize: 10, display:"block",marginTop:9 }}>Artifact/source URL</label><input value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} style={{...input,marginTop:4}} />
          <label style={{ fontSize: 10, display:"block",marginTop:9 }}>Source version</label><input value={sourceVersion} onChange={e=>setSourceVersion(e.target.value)} style={{...input,marginTop:4}} />
          <div style={{ display:"flex",gap:8,marginTop:11,flexWrap:"wrap" }}><button disabled={!!busy} onClick={()=>void registerSource()} style={button(C.green)}>{busy==="register"?"Registering…":"Register approved source"}</button><a href={KICD_G9_PAGE} target="_blank" rel="noreferrer" style={{...button(C.blue),textDecoration:"none"}}>Open KICD evidence</a></div>
          {sourceId && <div style={{ color:C.muted,fontSize:9.5,marginTop:8,wordBreak:"break-all" }}>source_id: {sourceId}</div>}
        </section>

        <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><strong>2. Immutable artifact</strong><span style={badge(snapshotId ? C.green : C.muted)}>{snapshotId ? "HASHED + STORED" : "PENDING"}</span></div>
          <p style={{ color:C.muted,fontSize:10.5,lineHeight:1.55 }}>The service fetches the PDF, rejects unapproved hosts/non-PDF responses, caps size, computes SHA-256 and stores bytes in a private Supabase bucket before creating a staging snapshot.</p>
          <button disabled={!!busy||!sourceId} onClick={()=>void ingestArtifact()} style={button(C.violet)}>{busy==="artifact"?"Fetching + hashing…":"Fetch, hash & retain artifact"}</button>
          {snapshotId && <div style={{ color:C.muted,fontSize:9.5,marginTop:8,wordBreak:"break-all" }}>snapshot_id: {snapshotId}</div>}
        </section>
      </div>

      <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, marginTop:14 }}>
        <div style={{ display:"flex",justifyContent:"space-between",gap:8,alignItems:"start" }}><div><strong>3. Source observations</strong><div style={{ color:C.muted,fontSize:10.5,marginTop:3 }}>Only exact observations transcribed/extracted from the retained artifact belong here. Empty placeholders are rejected.</div></div><span style={badge(C.blue)}>MAX 500 / REQUEST</span></div>
        <textarea value={observations} onChange={e=>setObservations(e.target.value)} spellCheck={false} style={{...input,minHeight:290,marginTop:10,fontFamily:"ui-monospace,SFMono-Regular,monospace",lineHeight:1.5}} />
        <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginTop:10 }}><button disabled={!!busy||!snapshotId} onClick={()=>void stageObservations()} style={button(C.blue)}>{busy==="observations"?"Staging…":"Stage observations"}</button><button disabled={!!busy||!snapshotId} onClick={()=>void sealReconcile()} style={button(C.violet)}>{busy==="seal"?"Sealing…":"Seal + reconcile"}</button><button disabled={!!busy||!snapshotId} onClick={()=>void loadReview()} style={button(C.amber)}>{busy==="review"?"Loading…":"Load owner review"}</button></div>
      </section>

      <section style={{ background:C.panel2,border:`1px solid ${C.line}`,borderRadius:14,padding:14,marginTop:14 }}>
        <strong>4. Hierarchy provenance and promotion</strong>
        <p style={{ color:C.muted,fontSize:10.5,lineHeight:1.55 }}>Bind exact unpaced hierarchy only after reconciliation. Binding deliberately invalidates the reconciliation; run a fresh reconciliation before promotion. Promotion remains an explicit owner action.</p>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}><button disabled={!!busy||!snapshotId} onClick={()=>void bindHierarchy()} style={button(C.blue)}>{busy==="bind"?"Binding…":"Bind exact hierarchy"}</button><button disabled={!!busy||!snapshotId} onClick={()=>void freshReconcile()} style={button(C.violet)}>{busy==="reconcile"?"Reconciling…":"Fresh reconciliation"}</button><button disabled={!!busy||!snapshotId} onClick={()=>void loadReview()} style={button(C.amber)}>Refresh review</button></div>
        {review && <pre style={{ whiteSpace:"pre-wrap",wordBreak:"break-word",background:"rgba(0,0,0,.18)",border:`1px solid ${C.line}`,borderRadius:10,padding:10,fontSize:10,lineHeight:1.5,marginTop:10 }}>{JSON.stringify(review,null,2)}</pre>}
        <div style={{ marginTop:12,paddingTop:12,borderTop:`1px solid ${C.line}` }}><label style={{ fontSize:10,color:C.red,fontWeight:850 }}>Final authority confirmation</label><div style={{ display:"flex",gap:8,marginTop:5,flexWrap:"wrap" }}><input value={promotionPhrase} onChange={e=>setPromotionPhrase(e.target.value)} placeholder="Type PROMOTE OFFICIAL" style={{...input,maxWidth:260}} /><button disabled={!!busy||promotionPhrase!=="PROMOTE OFFICIAL"||!snapshotId} onClick={()=>void promote()} style={button(C.red)}>{busy==="promote"?"Promoting…":"Promote official outcomes"}</button></div></div>
      </section>

      {result && <section style={{ marginTop:14,background:"rgba(0,0,0,.18)",border:`1px solid ${C.line}`,borderRadius:14,padding:12 }}><div style={{ color:C.muted,fontSize:9.5,fontWeight:900,textTransform:"uppercase" }}>Latest operation evidence</div><pre style={{ whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,lineHeight:1.5,margin:"7px 0 0" }}>{JSON.stringify(result,null,2)}</pre></section>}
    </main>
  </div>
}
