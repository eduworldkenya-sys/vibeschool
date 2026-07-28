
"use client";

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { VibePublication, PublicationFormat, FORMAT_META } from '@/lib/publishTypes'

const BG     = '#090D16'
const CARD   = '#1a2235'
const ACCENT = '#CCFF00'
const TEXT   = '#ffffff'
const MUTED  = 'rgba(255,255,255,0.4)'
const BORDER = 'rgba(255,255,255,0.06)'

type FilterKey = 'all' | PublicationFormat

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all',            label: 'All',       icon: '✦'  },
  { key: 'vibetextbook',   label: 'Textbooks', icon: '🎓' },
  { key: 'vibechronicles', label: 'Stories',   icon: '📖' },
  { key: 'vibepress',      label: 'Articles',  icon: '📰' },
  { key: 'vibevoice',      label: 'Audio',     icon: '🎙️' },
  { key: 'vibescripture',  label: 'Scripture', icon: '📿' },
]

interface AuthorMap { [id: string]: string }

interface ContinueReadingItem {
  publication_id: string
  title: string | null
  cover_url: string | null
  cbc_subject: string | null
  cbc_grade: string | null
  current_chapter_id: string
  current_chapter_number: number
  current_chapter_title: string | null
  progress_percent: number
  last_read_at: string
  completed: boolean
}

export default function ReadDiscoverPage() {
  const router = useRouter()
  const [publications, setPublications] = useState<VibePublication[]>([])
  const [authors,       setAuthors]      = useState<AuthorMap>({})
  const [loading,       setLoading]      = useState(true)
  const [filter,        setFilter]       = useState<FilterKey>('all')
  const [query,         setQuery]        = useState('')
  const [continueReading, setContinueReading] = useState<ContinueReadingItem[]>([])

  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    async function load() {
      const { data: pubs } = await sb
        .from('vibe_publications')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(100)

      const list = (pubs || []) as VibePublication[]
      setPublications(list)

      const authorIds = Array.from(new Set(list.map(p => p.author_id).filter(Boolean)))
      if (authorIds.length > 0) {
        const { data: profs } = await sb
          .from('profiles')
          .select('id,full_name')
          .in('id', authorIds)
        const map: AuthorMap = {}
        for (const p of profs || []) map[p.id as string] = (p as { full_name: string | null }).full_name || 'Anonymous'
        setAuthors(map)
      }
      const { data: crData } = await sb.rpc('get_continue_reading', { limit_input: 8 })
      const crItems =
        crData &&
        typeof crData === 'object' &&
        Array.isArray((crData as { items?: unknown }).items)
          ? (crData as { items: ContinueReadingItem[] }).items
          : []
      setContinueReading(crItems)

      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    let list = publications
    if (filter !== 'all') list = list.filter(p => p.format === filter)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.toLowerCase().includes(q))
      )
    }
    return list
  }, [publications, filter, query])

  return (
    <div style={{ background: BG, minHeight: '100dvh', color: TEXT, fontFamily: 'system-ui,-apple-system,sans-serif', paddingBottom: 24 }}>
      <div style={{ padding: '8px 4px 4px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.03em' }}>
          Discover
        </h1>
        <p style={{ color: MUTED, fontSize: 13, margin: '0 0 16px' }}>
          Ebooks, stories and articles published by the VibeGlobal community
        </p>

        {continueReading.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, marginBottom: 10 }}>
              Continue Reading
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {continueReading.map(item => (
                <div
                  key={item.publication_id}
                  onClick={() => router.push('/read/textbook/' + item.publication_id)}
                  style={{
                    flexShrink: 0, width: 156, background: CARD, borderRadius: 14,
                    overflow: 'hidden', border: '1px solid ' + BORDER, cursor: 'pointer',
                  }}
                >
                  <div style={{
                    height: 90, position: 'relative', overflow: 'hidden',
                    background: item.cover_url ? 'none' : 'linear-gradient(135deg,#1a2235,#2d3748)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {item.cover_url
                      ? <img src={item.cover_url} alt={item.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 26 }}>{FORMAT_META.vibetextbook?.icon || '🎓'}</span>
                    }
                    {item.completed && (
                      <div style={{
                        position: 'absolute', top: 6, right: 6,
                        background: 'rgba(9,13,22,0.8)', borderRadius: 6,
                        padding: '2px 6px', fontSize: 9, fontWeight: 700, color: ACCENT,
                      }}>
                        ✓ Done
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{
                      fontSize: 11.5, fontWeight: 700, color: TEXT, lineHeight: 1.3,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                      minHeight: 28,
                    }}>
                      {item.title || 'Untitled'}
                    </div>
                    <div style={{ fontSize: 9.5, color: MUTED, marginTop: 4 }}>
                      {item.completed
                        ? 'Completed'
                        : 'Ch. ' + item.current_chapter_number + (item.current_chapter_title ? ' · ' + item.current_chapter_title : '')}
                    </div>
                    <div style={{
                      marginTop: 6, height: 4, borderRadius: 2,
                      background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
                    }}>
                      <div style={{
                        width: Math.max(4, Math.min(100, item.progress_percent)) + '%',
                        height: '100%', background: item.completed ? ACCENT : 'rgba(204,255,0,0.6)',
                      }} />
                    </div>
                    <div style={{ fontSize: 9, color: MUTED, marginTop: 4 }}>
                      {item.completed ? '100%' : item.progress_percent + '%'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search titles, topics, tags…"
          style={{
            width: '100%', boxSizing: 'border-box', background: CARD,
            border: '1px solid ' + BORDER, borderRadius: 10,
            padding: '10px 14px', color: TEXT, fontSize: 14,
            outline: 'none', marginBottom: 14,
          }}
        />

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
          {FILTERS.map(f => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 24, fontSize: 12.5, fontWeight: 700,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  border: '1px solid ' + (active ? ACCENT : BORDER),
                  background: active ? 'rgba(204,255,0,0.1)' : CARD,
                  color: active ? ACCENT : MUTED,
                }}
              >
                <span>{f.icon}</span>{f.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ height: 172, borderRadius: 14, background: CARD, border: '1px solid ' + BORDER }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: MUTED, fontSize: 14 }}>
          {query.trim() ? 'No works match your search.' : 'Nothing published in this category yet — be the first.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {filtered.map(pub => {
            const fmeta = FORMAT_META[pub.format]
            return (
              <div
                key={pub.id}
                onClick={() => router.push(
                  pub.format === 'vibetextbook'
                    ? '/read/textbook/' + pub.id
                    : '/global/read/publication/' + pub.id
                )}
                style={{
                  background: CARD, borderRadius: 14, overflow: 'hidden',
                  border: '1px solid ' + BORDER, cursor: 'pointer',
                }}
              >
                <div style={{
                  height: 110, position: 'relative', overflow: 'hidden',
                  background: pub.cover_url ? 'none' : 'linear-gradient(135deg,#1a2235,#2d3748)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {pub.cover_url
                    ? <img src={pub.cover_url} alt={pub.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 32 }}>{fmeta?.icon}</span>
                  }
                  <div style={{
                    position: 'absolute', top: 8, left: 8,
                    background: 'rgba(9,13,22,0.75)', borderRadius: 8,
                    padding: '3px 8px', fontSize: 10, fontWeight: 700, color: fmeta?.accent,
                  }}>
                    {fmeta?.icon} {fmeta?.label}
                  </div>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: TEXT, lineHeight: 1.3,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                  }}>
                    {pub.title || 'Untitled'}
                  </div>
                  <div style={{ fontSize: 10.5, color: MUTED, marginTop: 4 }}>
                    {authors[pub.author_id] || 'Anonymous'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: MUTED }}>
                      {pub.chapter_count || 0} {(fmeta?.chapterPlural || 'Chapters').toLowerCase()}
                    </span>
                    <span style={{ fontSize: 10, color: MUTED }}>
                      {pub.total_reads || 0} reads
                    </span>
                  </div>
                  {pub.cbc_aligned && pub.cbc_subject && (
                    <div style={{
                      marginTop: 6, display: 'inline-block',
                      background: 'rgba(204,255,0,0.1)', color: ACCENT,
                      fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                    }}>
                      CBC · {pub.cbc_subject}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
