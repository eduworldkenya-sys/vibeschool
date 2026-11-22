"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"
import { useRouter } from "next/navigation"
import { AlertCircle, BookOpen, CheckCircle2, ChevronRight, Circle, LockKeyhole, RefreshCw } from "lucide-react"
import type { VibePublication } from "@/lib/publishTypes"

type LoadState = "loading" | "ready" | "error"
type ChapterEvidence = { id: string; publication_id: string; blocks: unknown }
type Evidence = { images: number; questions: number; chapters: number }
const countOfType = (blocks: unknown, type: string) => Array.isArray(blocks) ? blocks.filter(block => block && typeof block === "object" && (block as { type?: unknown }).type === type).length : 0
const stages = [
  { label: "Curriculum", detail: "Grade, subject and learning outcomes" },
  { label: "Content", detail: "Required lesson and Teacher Guide material" },
  { label: "Answers", detail: "Questions and protected marking keys" },
  { label: "Images", detail: "Upload and accessible links" },
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
  const [selectedPublicationId, setSelectedPublicationId] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<Record<string, Evidence>>({})
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  const [evidenceError, setEvidenceError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  useEffect(() => {
    let active = true
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    async function load() {
      setState("loading")
      const { data: { user }, error: userError } = await sb.auth.getUser()
      if (!active) return
      if (userError || !user) { router.replace("/?role=teacher"); return }
      const { data: profile, error: profileError } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle()
      if (!active) return
      if (profileError || !profile || !["teacher", "admin"].includes(profile.role)) { router.replace("/"); return }
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
        <span style={{ display: "inline-flex", gap: 7, alignItems: "center", padding: "10px 13px", borderRadius: 999, background: "#fef3c7", color: "#92400e", fontSize: 13, fontWeight: 700 }}><LockKeyhole size={16}/> Awaiting Duncan activation</span>
      </header>
      <section style={panel} aria-labelledby="progress-title">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div><h2 id="progress-title" style={{ margin: 0, fontSize: 19 }}>Publication checks</h2><p style={{ color: "#64748b", margin: "5px 0 0", fontSize: 13 }}>Draft images and questions are detected from your saved chapters. Publishing approvals still require server verification.</p></div>
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
              ? `${count} ${isImage ? "images attached" : "questions written"} — release verification still required`
              : currentEvidence && (isImage || isAnswer)
                ? `No ${isImage ? "images" : "questions"} found in this draft`
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
        <p style={{ margin: 0, display: "flex", gap: 9, alignItems: "center", fontWeight: 700 }}><LockKeyhole size={18}/> Publishing locked</p>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>The replacement publishing service is not activated. This screen does not bypass any existing release or authorization boundary. Existing published learner content is unaffected.</p>
        <button disabled style={{ border: 0, borderRadius: 12, padding: "12px 20px", background: "#e2e8f0", color: "#64748b", fontWeight: 700, cursor: "not-allowed" }}>Publish</button>
      </section>
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
