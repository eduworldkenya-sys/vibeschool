"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { FORMAT_META, type PublicationFormat, type VibePublication } from "@/lib/publishTypes"

const BG = "#090D16"
const CARD = "#1a2235"
const ACCENT = "#CCFF00"
const TEXT = "#ffffff"
const MUTED = "rgba(255,255,255,0.4)"
const BORDER = "rgba(255,255,255,0.06)"

type FilterKey = "all" | PublicationFormat

const FILTERS: Array<{ key: FilterKey; label: string; icon: string }> = [
  { key: "all", label: "All", icon: "✦" },
  { key: "vibetextbook", label: "Textbooks", icon: FORMAT_META.vibetextbook.icon },
  { key: "ebook", label: "eBooks", icon: FORMAT_META.ebook.icon },
  { key: "vibepress", label: "Articles", icon: FORMAT_META.vibepress.icon },
]

interface ContinueReadingItem {
  publication_id: string
  title: string | null
  cover_url: string | null
  current_chapter_number: number
  current_chapter_title: string | null
  progress_percent: number
  completed: boolean
}

function publicationHref(pub: Pick<VibePublication, "id" | "format">): string {
  return pub.format === "vibetextbook"
    ? `/read/textbook/${pub.id}`
    : `/global/read/publication/${pub.id}`
}

export default function ReadDiscoverPage() {
  const router = useRouter()
  const [publications, setPublications] = useState<VibePublication[]>([])
  const [authors, setAuthors] = useState<Record<string, string>>({})
  const [continueReading, setContinueReading] = useState<ContinueReadingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [query, setQuery] = useState("")

  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    async function load() {
      const { data: pubs, error } = await sb
        .from("vibe_publications")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(100)

      if (error) {
        setLoading(false)
        return
      }

      const list = (pubs ?? []) as VibePublication[]
      setPublications(list)

      const authorIds = Array.from(new Set(list.map(pub => pub.author_id).filter(Boolean)))
      if (authorIds.length > 0) {
        const { data: profiles } = await sb.from("profiles").select("id,full_name").in("id", authorIds)
        const nextAuthors: Record<string, string> = {}
        for (const profile of profiles ?? []) {
          const row = profile as { id: string; full_name: string | null }
          nextAuthors[row.id] = row.full_name || "Anonymous"
        }
        setAuthors(nextAuthors)
      }

      const { data: continueData } = await sb.rpc("get_continue_reading", { limit_input: 8 })
      if (
        continueData &&
        typeof continueData === "object" &&
        Array.isArray((continueData as { items?: unknown }).items)
      ) {
        setContinueReading((continueData as { items: ContinueReadingItem[] }).items)
      }
      setLoading(false)
    }

    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return publications.filter(pub => {
      if (filter !== "all" && pub.format !== filter) return false
      if (!q) return true
      return (
        (pub.title ?? "").toLowerCase().includes(q) ||
        (pub.description ?? "").toLowerCase().includes(q) ||
        (pub.tags ?? []).some(tag => tag.toLowerCase().includes(q))
      )
    })
  }, [filter, publications, query])

  return (
    <div style={{ background: BG, minHeight: "100dvh", color: TEXT, padding: "12px 4px 28px", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px" }}>Discover</h1>
      <p style={{ color: MUTED, fontSize: 13, margin: "0 0 16px" }}>
        Textbooks, eBooks and articles from one structured publication library.
      </p>

      {continueReading.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Continue Reading</div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {continueReading.map(item => (
              <button
                key={item.publication_id}
                onClick={() => router.push(`/read/textbook/${item.publication_id}`)}
                style={{ flex: "0 0 158px", textAlign: "left", background: CARD, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 0, overflow: "hidden", cursor: "pointer" }}
              >
                <div style={{ height: 86, background: "linear-gradient(135deg,#1a2235,#2d3748)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.cover_url ? <img src={item.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 28 }}>📖</span>}
                </div>
                <div style={{ padding: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, minHeight: 30 }}>{item.title || "Untitled"}</div>
                  <div style={{ fontSize: 9.5, color: MUTED, marginTop: 4 }}>
                    {item.completed ? "Completed" : `Chapter ${item.current_chapter_number}${item.current_chapter_title ? ` · ${item.current_chapter_title}` : ""}`}
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 4, marginTop: 7, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(4, Math.min(100, item.progress_percent))}%`, background: ACCENT }} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <input
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Search titles, topics, tags…"
        style={{ width: "100%", boxSizing: "border-box", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "11px 14px", color: TEXT, fontSize: 14, outline: "none", marginBottom: 12 }}
      />

      <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16 }}>
        {FILTERS.map(item => {
          const active = filter === item.key
          return (
            <button key={item.key} onClick={() => setFilter(item.key)} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 24, border: `1px solid ${active ? ACCENT : BORDER}`, background: active ? "rgba(204,255,0,0.1)" : CARD, color: active ? ACCENT : MUTED, fontWeight: 700, cursor: "pointer" }}>
              {item.icon} {item.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ color: MUTED, padding: 24 }}>Loading publications…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: MUTED, textAlign: "center", padding: 40 }}>No published content matches this view.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
          {filtered.map(pub => {
            const meta = FORMAT_META[pub.format]
            return (
              <button key={pub.id} onClick={() => router.push(publicationHref(pub))} style={{ textAlign: "left", padding: 0, color: TEXT, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", cursor: "pointer" }}>
                <div style={{ height: 110, background: "linear-gradient(135deg,#1a2235,#2d3748)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {pub.cover_url ? <img src={pub.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 34 }}>{meta.icon}</span>}
                  <span style={{ position: "absolute", top: 8, left: 8, background: "rgba(9,13,22,0.8)", borderRadius: 8, padding: "3px 8px", fontSize: 10, color: meta.accent }}>{meta.icon} {meta.label}</span>
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{pub.title || "Untitled"}</div>
                  <div style={{ fontSize: 10.5, color: MUTED, marginTop: 4 }}>{authors[pub.author_id] || "Anonymous"}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: MUTED, fontSize: 10, marginTop: 7 }}>
                    <span>{pub.chapter_count || 0} {meta.chapterPlural.toLowerCase()}</span>
                    <span>{pub.total_reads || 0} reads</span>
                  </div>
                  {pub.cbc_aligned && pub.cbc_subject && <div style={{ marginTop: 6, color: ACCENT, fontSize: 9.5, fontWeight: 700 }}>CBC · {pub.cbc_subject}</div>}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
