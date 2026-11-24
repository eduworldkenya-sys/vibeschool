"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"
import { useRouter } from "next/navigation"
import { AlertCircle, BookOpen, CheckCircle2, ChevronRight, Circle, LockKeyhole, RefreshCw } from "lucide-react"
import type { VibePublication } from "@/lib/publishTypes"
import { isMumbi2Publisher } from "@/lib/studioPublisherIdentity"
import { importGrade4SocialStudiesDraft } from "@/lib/grade4SocialStudiesDraftImport"

type LoadState = "loading" | "ready" | "error"
type ChapterEvidence = { id: string; publication_id: string; blocks: unknown }
type Evidence = { images: number; questions: number; chapters: number }
const countOfType = (blocks: unknown, type: string) => Array.isArray(blocks) ? blocks.filter(block => block && typeof block === "object" && (block as { type?: unknown }).type === type).length : 0
const stages = [
  { label: "Curriculum", detail: "Grade, subject and learning outcomes" },
  { label: "Content", detail: "Reading text and chapters; Teacher Guide optional" },
  { label: "Answers", detail: "Optional — develop assessments later" },
  { label: "Images", detail: "Optional — existing images remain available" },
  { label: "Security", detail: "Publisher access and material rights" },
  { label: "Publication", detail: "Server-confirmed release" },
  { label: "Learn", detail: "Verified public learner page" },
] as const

/**
 * Non-commissioned replacement shell. Do NOT infer a passed check from publication.status.
 * These stages need trustworthy server-side evidence before they may be marked passed.
 * This screen cannot invoke a publishing mutation.
 */
export default function PublishingReplacementPage() {
  const router = useRouter()
  const [state, setState] = useState<LoadState>("loading")
  const [items, setItems] = useState<VibePublication[]>([])
  const [message, setMessage] = useState("")
  const [canPublish, setCanPublish] = useState(false)
  const [selectedPublicationId, setSelectedPublicationId] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<Record<string, Evidence>>({})
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  const [evidenceError, setEvidenceError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState("")
  async function importPreparedBook() {
    if (!canPublish || importing) return
    setImporting(true); setImportError("")
    try { const id = await importGrade4SocialStudiesDraft(); router.push(`/teacher/studio/editor?format=vibetextbook&publication=${encodeURIComponent(id)}`) }
    catch (error) { setImportError(error instanceof Error ? error.message : "Draft import failed. Retry to resume.") }
    finally { setImporting(false) }
  }
  useEffect(() => {
    let active = true
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    async function load() {
      setState("loading")
      setCanPublish(false)
      const { data: { user }, error: userError } = await sb.auth.getUser()
      if (!active) return
      if (userError || !user) { router.replace("/?role=teacher"); return }
      const { data: profile, error: profileError } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle()
      if (!active) return
      if (profileError || !profile || !["teacher", "admin"].includes(profile.role)) { router.replace("/"); return }
      setCanPublish(isMumbi2Publisher(user.id, profile.role))
      const { data, error } = await sb.from("vibe_publications").select("*").eq("author_id", user.id).in("format", ["vibetextbook", "ebook"]).order("updated_at", { ascending: false })
      if (!active) return
      if (error) { setMessage("Could not load your publications. Try again."); setState("error"); return }
      const publications = (data ?? []) as VibePublication[]
      setItems(publications)
      setSelectedPublicationId(previous => previous && publications.some(item => item.id === previous) ? previous : publications[0]?.id ?? null)
      setMessage("")
      setState("ready")
    }
    void load()
    return () => { active = false }
  }, [router, refreshKey])

  useEffect(() => {
    if (!selectedPublicationId || state !== "ready") return
    let active = true
    const publicationId = selectedPublicationId
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    async function loadEvidence() {
      setEvidenceLoading(true)
      setEvidenceError(false)
      // Read canonical chapter draft JSON, the same blocks used by PublicationEditor.
      const { data, error } = await sb.from("vibe_chapters").select("id,publication_id,blocks").eq("publication_id", publicationId)
      if (!active) return
      setEvidenceLoading(false)
      if (error) { setEvidenceError(true); return }
      const chapters = (data ?? []) as ChapterEvidence[]
      setEvidence(previous => ({
        ...previous,
        [publicationId]: {
          chapters: chapters.length,
          images: chapters.reduce((count, chapter) => count + countOfType(chapter.blocks, "image"), 0),
          questions: chapters.reduce((count, chapter) => count + countOfType(chapter.blocks, "question"), 0),
        },
      }))
    }
    void loadEvidence()
    return () => { active = false }
  }, [selectedPublicationId, state])

  const selected = items.find(item => item.id === selectedPublicationId)
  const currentEvidence = selectedPublicationId ? evidence[selectedPublicationId] : undefined
  const editorHref = selected ? `/teacher/studio/editor?format=${selected.format === "ebook" ? "ebook" : "vibetextbook"}&publication=${encodeURIComponent(selected.id)}` : ""

  const panel: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 20 }
  return <main style={{ minHeight: "100dvh", background: "#f8fafc", color: "#111827", padding: "22px 14px 80px", fontFamily: "system-ui, sans-serif" }}>
    <div style={{ maxWidth: 870, margin: "auto", display: "grid", gap: 18 }}>
      <nav aria-label="Breadcrumb"><Link href="/teacher/studio" style={{ color: "#475569" }}>← Content Studio</Link></nav>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div><p style={{ margin: "0 0 5px", fontWeight: 700, fontSize: 12, color: "#475569" }}>VIBESCHOOL</p><h1 style={{ fontSize: 29, margin: 0 }}>Publishing</h1></div>
        <span style={{ display: "inline-flex", gap: 7, alignItems: "center", padding: "10px 13px", borderRadius: 999, background: "#fef3c7", color: "#92400e", fontSize: 13, fontWeight: 700 }}>{canPublish ? <CheckCircle2 size={16}/> : <LockKeyhole size={16}/>} {canPublish ? "Mumbi2 authenticated" : "Mumbi2 sign-in required"}</span>
      </header>
      <section style={panel} aria-labelledby="progress-title">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div><h2 id="progress-title" style={{ margin: 0, fontSize: 19 }}>Publication checks</h2><p style={{ color: "#64748b", margin: "5px 0 0", fontSize: 13 }}>Publish textbook reading content first. Questions and Teacher’s Guide are optional and can be developed later.</p></div>
          <strong aria-label="Zero of seven release checks verified">0 / 7</strong>
        </div>
        <div aria-label="No checks verified" style={{ height: 8, background: "#e5e7eb", borderRadius: 20, margin: "17px 0" }}/>
        <p style={{ fontSize: 13, color: "#475569", margin: "0 0 10px" }}>
          {selected ? <>Checking <strong>{selected.title || "Untitled"}</strong></> : "Select a publication below to inspect its actual materials."}
        </p>
        {evidenceLoading && <p role="status">Checking existing chapter materials…</p>}
        {evidenceError && <p role="alert">Could not verify draft materials. Refresh to retry; do not add duplicates.</p>}
        <ol style={{ padding: 0, margin: 0, listStyle: "none" }}>
          {stages.map((stage, i) => {
            const isImage = stage.label === "Images"
            const isAnswer = stage.label === "Answers"
            const found = !evidenceError && currentEvidence && (isImage ? currentEvidence.images > 0 : isAnswer ? currentEvidence.questions > 0 : false)
            const count = isImage ? currentEvidence?.images : isAnswer ? currentEvidence?.questions : null
            const description = found
              ? `${count} ${isImage ? "images attached" : "questions written"} — optional for reading release`
              : currentEvidence && (isImage || isAnswer)
                ? `No ${isImage ? "images" : "questions"} — optional, not a reading publication blocker`
                : stage.detail
            return <li key={stage.label} style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 2px", borderBottom: i === stages.length-1 ? "none" : "1px solid #f1f5f9" }}>
              {found ? <CheckCircle2 size={19} color="#16a34a" aria-label="Draft material present"/> : <Circle size={19} color="#94a3b8" aria-hidden="true"/>}
              <div style={{ flex: 1 }}><strong style={{ fontSize: 14 }}>{stage.label}</strong><p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 12 }}>{description}</p></div>
              <span style={{ color: found ? "#166534" : "#64748b", fontSize: 12, textAlign: "right" }}>{found ? "Found in draft" : "Not verified"}</span>
              {selected && <Link href={editorHref} aria-label={`Review ${stage.label} in ${selected.title || "Untitled"}`} style={{ color: "#1d4ed8", fontSize: 12, fontWeight: 600 }}>Review</Link>}
            </li>
          } )}
        </ol>
      </section>
      <section id="publishing-availability" style={panel} aria-label="Publishing availability">
        <p style={{ margin: 0, display: "flex", gap: 9, alignItems: "center", fontWeight: 700 }}>{canPublish ? <CheckCircle2 size={18} color="#15803d"/> : <LockKeyhole size={18}/>} {canPublish ? "Mumbi2 can request publication" : "Publishing restricted to Mumbi2"}</p>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>Your Mumbi2 login is sufficient publishing identity. No separate owner activation. Reading textbooks do not require questions or Teacher’s Guide. Publication still requires valid content and authorized access.</p>
        <button type="button" disabled={!canPublish || !selected || selected.status === "published"} onClick={() => router.push(editorHref)}
          style={{ border: 0, borderRadius: 12, padding: "12px 20px", background: canPublish && selected?.status !== "published" ? "#2563eb" : "#e2e8f0", color: canPublish && selected?.status !== "published" ? "#fff" : "#64748b", fontWeight: 700, cursor: canPublish && selected?.status !== "published" ? "pointer" : "not-allowed" }}>
          {selected?.status === "published" ? "Already published" : "Open and publish"}
        </button>
      </section>
      {canPublish && state === "ready" && <section style={panel} aria-label="Prepared textbooks"><h2 style={{margin:"0 0 10px",fontSize:18}}>Prepared textbooks</h2><button type="button" disabled={importing} onClick={() => void importPreparedBook()} style={{border:"1px solid #d1d5db",background:"#fff",color:"#111827",padding:"12px",cursor:importing?"wait":"pointer"}}>{importing ? "Importing textbook…" : "Open Grade 4 Social Studies draft"}</button>{importError && <p role="alert">{importError}</p>}</section>}
      <section style={panel} aria-label="Your publications">
        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center" }}><h2 style={{ fontSize: 18, margin: 0 }}>Your content</h2><button type="button" onClick={() => setRefreshKey(x => x + 1)} style={{ display: "inline-flex", gap: 7, alignItems: "center", border: "1px solid #cbd5e1", background: "white", borderRadius: 9, padding: "7px 10px", cursor: "pointer" }}><RefreshCw size={15}/> Refresh</button></div>
        {state === "loading" && <p role="status">Loading your content…</p>}
        {state === "error" && <p role="alert" style={{ color: "#b91c1c", display: "flex", alignItems: "center", gap: 7 }}><AlertCircle size={18}/>{message}</p>}
        {state === "ready" && items.length === 0 && <p style={{ color: "#64748b" }}>No content found in your existing library.</p>}
        {state === "ready" && items.map(item => <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, borderTop: "1px solid #f1f5f9", padding: "13px 0" }}>
          {item.status === "published" ? <CheckCircle2 size={20} color="#16a34a"/> : <BookOpen size={20} color="#64748b"/>}
          <div style={{ flex: 1, minWidth: 0 }}><button type="button" onClick={() => setSelectedPublicationId(item.id)} aria-pressed={item.id === selectedPublicationId} style={{ display: "block", border: 0, background: "transparent", padding: 0, color: "#1d4ed8", fontWeight: 700, textAlign: "left", cursor: "pointer", overflowWrap: "anywhere" }}>{item.title || "Untitled"}{item.id === selectedPublicationId ? " · Selected" : ""}</button><small style={{ color: "#64748b" }}>Existing record: {item.status} · {item.format}</small></div>
          <Link href={`/teacher/studio/editor?format=${item.format === "ebook" ? "ebook" : "vibetextbook"}&publication=${encodeURIComponent(item.id)}`} aria-label={`Open ${item.title || "Untitled"} in existing editor`}><ChevronRight size={20}/></Link>
        </div>)}
      </section>
      <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>Existing record status is not evidence that the replacement's checks have passed or Learn visibility is verified.</p>
    </div>
  </main>
}
