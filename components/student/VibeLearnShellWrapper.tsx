"use client"

import { useEffect, useCallback, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import VibeActionDock from '@/components/student/VibeActionDock'
import VibeSubmitContent from '@/components/student/VibeSubmitContent'
import VibeProgress from '@/components/student/VibeProgress'
import { awardPoints, updateStreak } from '@/lib/vibelearn-points'
import VibeTwin from '@/components/student/VibeTwin'

type VibeTab = 'feed' | 'indexer' | 'library'
type ContentType = 'ebook' | 'epage' | 'textbook'

interface VibeContent {
  id: string
  title: string
  description: string | null
  subject_id: string | null
  type: ContentType
  url: string
  thumbnail_url: string | null
  tags: string[]
  source: string | null
  view_count: number
  created_at: string
}

function normalizeVibeContent(value: unknown): VibeContent | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return null
  }

  const row = value as Record<string, unknown>

  if (
    typeof row.id !== 'string' ||
    typeof row.title !== 'string' ||
    (row.type !== 'ebook' && row.type !== 'epage' && row.type !== 'textbook')
  ) {
    return null
  }

  return {
    id: row.id,
    title: row.title,
    description:
      typeof row.description === 'string'
        ? row.description
        : null,
    subject_id:
      typeof row.subject_id === 'string'
        ? row.subject_id
        : null,
    type: row.type,
    url:
      typeof row.url === 'string'
        ? row.url
        : '',
    thumbnail_url:
      typeof row.thumbnail_url === 'string'
        ? row.thumbnail_url
        : null,
    tags: Array.isArray(row.tags)
      ? row.tags.filter(
          (tag): tag is string =>
            typeof tag === 'string'
        )
      : [],
    source:
      typeof row.source === 'string'
        ? row.source
        : null,
    view_count:
      typeof row.view_count === 'number'
        ? row.view_count
        : 0,
    created_at:
      typeof row.created_at === 'string'
        ? row.created_at
        : '',
  }
}

function normalizeVibeContentRows(
  values: readonly unknown[]
): VibeContent[] {
  return values.flatMap(value => {
    const normalized = normalizeVibeContent(value)
    return normalized ? [normalized] : []
  })
}

async function resolveCanonicalStudentId(): Promise<string> {
  const { data, error } = await supabase.rpc('current_student_id')
  if (error) throw error
  if (typeof data !== 'string' || !data) {
    throw new Error('Canonical learner identity is unavailable.')
  }
  return data
}

const BG      = '#090D16'
const SURFACE = '#111827'
const CARD    = '#1a2235'
const ACCENT  = '#CCFF00'
const MUTED   = 'rgba(255,255,255,0.4)'
const TEXT    = '#ffffff'
const GREEN   = '#10b981'
const BLUE    = '#60a5fa'

function typeAppearance(type: ContentType) {
  if (type === 'textbook') {
    return { background: 'rgba(96,165,250,0.12)', color: BLUE, label: '📚 Textbook' }
  }
  if (type === 'ebook') {
    return { background: 'rgba(204,255,0,0.1)', color: ACCENT, label: '📖 Ebook' }
  }
  return { background: 'rgba(16,185,129,0.1)', color: GREEN, label: '📄 Epage' }
}

function Skeleton({ h = 56, radius = 12 }: { h?: number; radius?: number }) {
  return (
    <div style={{
      height: h, borderRadius: radius,
      background: 'linear-gradient(90deg,#1a2235 25%,#243044 50%,#1a2235 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function ContentCard({
  item, onSave, isSaved, onOpen,
}: {
  item: VibeContent
  onSave: (id: string) => void
  isSaved: boolean
  onOpen: (item: VibeContent) => void
}) {
  const appearance = typeAppearance(item.type)

  return (
    <div style={{
      background: CARD, borderRadius: 16, padding: '16px',
      border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'inline-block',
            background: appearance.background,
            color: appearance.color,
            fontSize: 9, fontWeight: 800,
            letterSpacing: 1.2, textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 6, marginBottom: 8,
          }}>
            {appearance.label}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, lineHeight: 1.4, marginBottom: 6 }}>
            {item.title}
          </div>
          {item.description && (
            <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 8 }}>
              {item.description.slice(0, 80)}{item.description.length > 80 ? '...' : ''}
            </div>
          )}
          {item.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {item.tags.slice(0, 3).map(tag => (
                <span key={tag} style={{
                  fontSize: 10, color: MUTED,
                  background: 'rgba(255,255,255,0.05)',
                  padding: '2px 8px', borderRadius: 999,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => onSave(item.id)}
          aria-label={isSaved ? 'Remove from library' : 'Save to library'}
          style={{
            background: isSaved ? 'rgba(204,255,0,0.1)' : 'rgba(255,255,255,0.05)',
            border: 'none', borderRadius: 10,
            width: 36, height: 36, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16,
          }}
        >
          {isSaved ? '🔖' : '📌'}
        </button>
      </div>
      <button
        onClick={() => onOpen(item)}
        aria-label={`Open ${item.title}`}
        style={{
          marginTop: 12, width: '100%',
          background: 'rgba(204,255,0,0.08)',
          border: '1px solid rgba(204,255,0,0.2)',
          borderRadius: 10, padding: '10px 0',
          color: ACCENT, fontSize: 12, fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {item.type === 'textbook' ? 'Read Textbook →' : 'Open →'}
      </button>
    </div>
  )
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{body}</div>
    </div>
  )
}

function FeedTab({
  savedIds, onSave, onOpen,
}: {
  savedIds: Set<string>
  onSave: (id: string) => void
  onOpen: (item: VibeContent) => void
}) {
  const [items, setItems]     = useState<VibeContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const channelRef            = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('vibelearn_content')
        .select('*')
        .order('view_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)
      if (err) throw err
      setItems(normalizeVibeContentRows(data ?? []))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    channelRef.current = supabase
      .channel('vl_feed')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vibelearn_content' },
        payload => {
          const item = normalizeVibeContent(payload.new)
          if (item) setItems(prev => [item, ...prev])
        }
      )
      .subscribe()
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [load])

  if (loading) return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: 16 }}><Skeleton h={88} radius={16} /></div>
      {[1,2,3].map(i => <div key={i} style={{ marginBottom: 12 }}><Skeleton h={160} /></div>)}
    </div>
  )

  if (error) return <EmptyState icon="⚠️" title="Something went wrong" body={error} />

  if (items.length === 0) return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: 16 }}><VibeProgress /></div>
      <EmptyState
        icon="📭"
        title="No Vibes Yet"
        body="Be the first to add educational content. Anyone on VibeSchool can contribute."
      />
    </div>
  )

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: 16 }}>
        <VibeProgress />
      </div>
      <div style={{
        fontSize: 11, color: MUTED, fontWeight: 700,
        letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 16,
      }}>
        🔥 Vibe Rising
      </div>
      {items.map(item => (
        <ContentCard
          key={item.id}
          item={item}
          isSaved={savedIds.has(item.id)}
          onSave={onSave}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}

function IndexerTab({
  savedIds, onSave, onOpen,
}: {
  savedIds: Set<string>
  onSave: (id: string) => void
  onOpen: (item: VibeContent) => void
}) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<VibeContent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [filter, setFilter]   = useState<ContentType | 'all'>('all')
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string, f: ContentType | 'all') => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    setError(null)
    try {
      let req = supabase
        .from('vibelearn_content')
        .select('*')
        .textSearch('search_vector', q, { type: 'websearch', config: 'english' })
        .limit(30)
      if (f !== 'all') req = req.eq('type', f)
      const { data, error: err } = await req
      if (err) throw err
      setResults(normalizeVibeContentRows(data ?? []))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query, filter), 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, filter, search])

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <div style={{
          position: 'absolute', left: 14, top: '50%',
          transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none',
        }}>🔍</div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search textbooks, ebooks, epages, topics..."
          aria-label="Search VibeLearn content"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: CARD, border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '14px 16px 14px 44px',
            fontSize: 13, color: TEXT, outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['all', 'textbook', 'ebook', 'epage'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-label={`Filter by ${f}`}
            style={{
              background: filter === f ? ACCENT : 'rgba(255,255,255,0.05)',
              color: filter === f ? '#000' : MUTED,
              border: 'none', borderRadius: 999,
              padding: '7px 16px', fontSize: 11,
              fontWeight: 700, cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: 0.8,
            }}
          >
            {f === 'all' ? 'All' : f === 'textbook' ? '📚 Textbook' : f === 'ebook' ? '📖 Ebook' : '📄 Epage'}
          </button>
        ))}
      </div>

      {!query.trim() && (
        <EmptyState
          icon="🔍"
          title="Search VibeLearn"
          body="Find textbooks, ebooks and epages across VibeSchool. Type anything to begin."
        />
      )}
      {query.trim() && loading && (
        <div>{[1,2,3].map(i => <div key={i} style={{ marginBottom: 12 }}><Skeleton h={160} /></div>)}</div>
      )}
      {query.trim() && !loading && error && (
        <EmptyState icon="⚠️" title="Search failed" body={error} />
      )}
      {query.trim() && !loading && !error && results.length === 0 && (
        <EmptyState
          icon="📭"
          title={`No results for "${query}"`}
          body="Try different keywords or browse the feed for trending content."
        />
      )}
      {!loading && results.map(item => (
        <ContentCard
          key={item.id}
          item={item}
          isSaved={savedIds.has(item.id)}
          onSave={onSave}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}

function LibraryTab({
  savedIds, onUnsave, onOpen,
}: {
  savedIds: Set<string>
  onUnsave: (id: string) => void
  onOpen: (item: VibeContent) => void
}) {
  const [items, setItems]     = useState<VibeContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setItems([]); setLoading(false); return }
        const studentId = await resolveCanonicalStudentId()
        const { data, error: err } = await supabase
          .from('vibelearn_saved')
          .select('content_id, vibelearn_content(*)')
          .eq('student_id', studentId)
          .order('saved_at', { ascending: false })
        if (err) throw err
        const contents = (data ?? []).flatMap(row => {
          const related = row.vibelearn_content

          if (Array.isArray(related)) {
            return normalizeVibeContentRows(related)
          }

          const normalized = normalizeVibeContent(related)
          return normalized ? [normalized] : []
        })

        setItems(contents)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load library')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [savedIds])

  if (loading) return (
    <div style={{ padding: '16px' }}>
      {[1,2].map(i => <div key={i} style={{ marginBottom: 12 }}><Skeleton h={160} /></div>)}
    </div>
  )
  if (error) return <EmptyState icon="⚠️" title="Something went wrong" body={error} />
  if (items.length === 0) return (
    <EmptyState
      icon="📚"
      title="No Saved Vibes Yet"
      body="Save textbooks, ebooks and epages from the Feed or Vibe Check and they will appear here."
    />
  )

  return (
    <div style={{ padding: '16px' }}>
      <div style={{
        fontSize: 11, color: MUTED, fontWeight: 700,
        letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 16,
      }}>
        📚 Your Vibes
      </div>
      {items.map(item => (
        <ContentCard
          key={item.id}
          item={item}
          isSaved={true}
          onSave={onUnsave}
          onOpen={onOpen}
        />
      ))}

    </div>
  )
}

export default function VibeLearnShellWrapper({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [activeTab, setActiveTab]       = useState<VibeTab>('feed')
  const [savedIds, setSavedIds]         = useState<Set<string>>(new Set())
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [openContent, setOpenContent]   = useState<VibeContent | null>(null)
  const [completing, setCompleting]     = useState(false)
  const [submitOpen, setSubmitOpen]     = useState(false)
  const [vibeLock,   setVibeLock]       = useState(false)
  const [twinOpen,   setTwinOpen]       = useState(false)
  const [userId,     setUserId]         = useState('')
  const [userName,   setUserName]       = useState('Learner')
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  function vibeSpeak(text: string) {
    if (typeof window === 'undefined') return
    window.speechSynthesis?.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate  = 0.88
    u.pitch = 1.05
    window.speechSynthesis?.speak(u)
  }

  async function toggleVibeLock() {
    if (!vibeLock) {
      setVibeLock(true)
      vibeSpeak('Vibe lock. Focus mode on.')
      try {
        wakeLockRef.current = await (navigator as any).wakeLock?.request('screen')
      } catch { /* not supported */ }
    } else {
      setVibeLock(false)
      vibeSpeak('Vibe out. Good session.')
      try {
        await wakeLockRef.current?.release()
        wakeLockRef.current = null
      } catch { /* not supported */ }
    }
  }

  useEffect(() => {
    if (!isOpen) return
    async function loadUserSets() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)
        const studentId = await resolveCanonicalStudentId()
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()
        if (profile?.full_name) {
          setUserName(profile.full_name.split(' ')[0])
        }
        const [savedRes, completedRes] = await Promise.all([
          supabase.from('vibelearn_saved').select('content_id').eq('student_id', studentId),
          supabase.from('vibelearn_completed').select('content_id').eq('student_id', studentId),
        ])
        if (savedRes.error) throw savedRes.error
        if (completedRes.error) throw completedRes.error
        if (savedRes.data) {
          const s = new Set<string>()
          savedRes.data.forEach(row => {
            if (row.content_id) s.add(row.content_id)
          })
          setSavedIds(s)
        }
        if (completedRes.data) {
          const c = new Set<string>()
          completedRes.data.forEach(row => {
            if (row.content_id) c.add(row.content_id)
          })
          setCompletedIds(c)
        }
      } catch {
        // Silent
      }
    }
    loadUserSets()
  }, [isOpen])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (submitOpen) { setSubmitOpen(false); return }
      if (openContent) { setOpenContent(null); return }
      onClose()
    }
  }, [onClose, openContent, submitOpen])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  const handleSave = useCallback(async (contentId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const studentId = await resolveCanonicalStudentId()
      if (savedIds.has(contentId)) {
        const { error } = await supabase
          .from('vibelearn_saved')
          .delete()
          .eq('student_id', studentId)
          .eq('content_id', contentId)
        if (error) throw error
        setSavedIds(prev => {
          const next = new Set(prev)
          next.delete(contentId)
          return next
        })
      } else {
        const { error } = await supabase
          .from('vibelearn_saved')
          .insert({ student_id: studentId, content_id: contentId })
        if (error) throw error
        setSavedIds(prev => {
          const next = new Set(prev)
          next.add(contentId)
          return next
        })
      }
    } catch {
      // Silent
    }
  }, [savedIds])

  const handleComplete = useCallback(async (contentId: string) => {
    if (completing || completedIds.has(contentId)) return
    setCompleting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const studentId = await resolveCanonicalStudentId()
      const { error } = await supabase
        .from('vibelearn_completed')
        .insert({ student_id: studentId, content_id: contentId })
      if (error) throw error
      setCompletedIds(prev => {
        const next = new Set(prev)
        next.add(contentId)
        return next
      })
      if (openContent) {
        await awardPoints(
          studentId,
          openContent.type === 'ebook' ? 'complete_ebook' : 'complete_epage',
          contentId
        )
      }
      await updateStreak(studentId)
    } catch {
      // Silent
    } finally {
      setCompleting(false)
    }
  }, [completing, completedIds, openContent])

  const handleOpen = useCallback(async (item: VibeContent) => {
    try {
      const { data: { user: viewer } } = await supabase.auth.getUser()
      await supabase.rpc('increment_view_count', {
        content_id: item.id,
        viewer_id: viewer?.id ?? null
      })
      if (viewer) await awardPoints(viewer.id, 'content_viewed', item.id)
    } catch {
      // Opening content should not be blocked by analytics failures.
    }

    if (item.type === 'textbook') {
      if (item.url) window.location.assign(item.url)
      return
    }

    setOpenContent(item)
  }, [])

  const tabs: { id: VibeTab; label: string; icon: string }[] = [
    { id: 'feed',    label: 'Vibe Feed',    icon: '🔥' },
    { id: 'indexer', label: 'Vibe Check', icon: '🔍' },
    { id: 'library', label: 'My Vibes', icon: '📚' },
  ]

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes vl-slide-up { from{transform:translateY(100vh)} to{transform:translateY(0)} }
        .vl-scroll::-webkit-scrollbar { display:none }
        .vl-scroll { -ms-overflow-style:none; scrollbar-width:none }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="VibeLearn"
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: BG,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transform: isOpen ? 'translateY(0)' : 'translateY(100vh)',
          transition: 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        <header style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0, height: 60,
        }}>
          <button
            onClick={
              vibeLock
                ? undefined
                : openContent
                ? () => setOpenContent(null)
                : submitOpen
                ? () => setSubmitOpen(false)
                : onClose
            }
            aria-label="Go back"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none', color: TEXT,
              padding: '8px 14px', borderRadius: 10,
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
              minWidth: 72,
            }}
          >
            ← Back
          </button>
          <span style={{
            color: ACCENT, fontWeight: 800, fontSize: 13,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {vibeLock ? '🔒 VIBE LOCK' : 'VibeLearn'}
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => setTwinOpen(true)}
              aria-label="Open Vibe Twin"
              style={{
                background: 'rgba(204,255,0,0.08)',
                border: '1px solid rgba(204,255,0,0.2)',
                borderRadius: 10, padding: '7px 10px',
                color: '#CCFF00', fontSize: 14, fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              ✦
            </button>
            <button
              onClick={toggleVibeLock}
              aria-label={vibeLock ? 'Exit Vibe Lock' : 'Enter Vibe Lock'}
              style={{
                background: vibeLock ? 'rgba(204,255,0,0.15)' : 'rgba(255,255,255,0.05)',
                border: vibeLock ? '1px solid rgba(204,255,0,0.4)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '7px 10px',
                color: vibeLock ? ACCENT : 'rgba(255,255,255,0.4)',
                fontSize: 14, fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🔒
            </button>
            {!vibeLock && (
              <button
                onClick={() => setSubmitOpen(true)}
                aria-label="Submit content"
                style={{
                  background: 'rgba(204,255,0,0.1)',
                  border: '1px solid rgba(204,255,0,0.2)',
                  borderRadius: 10, padding: '7px 12px',
                  color: ACCENT, fontSize: 11, fontWeight: 800,
                  cursor: 'pointer', letterSpacing: 0.4,
                  minWidth: 72,
                }}
              >
                Drop a Vibe
              </button>
            )}
          </div>
        </header>

        {submitOpen && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            backgroundColor: BG,
            display: 'flex', flexDirection: 'column',
            animation: 'vl-slide-up 250ms ease-out',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0, height: 60,
            }}>
              <button
                onClick={() => setSubmitOpen(false)}
                aria-label="Close submit"
                style={{
                  background: 'rgba(255,255,255,0.05)', border: 'none',
                  color: TEXT, padding: '8px 14px', borderRadius: 10,
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  minWidth: 72,
                }}
              >
                ← Back
              </button>
              <div style={{
                flex: 1, textAlign: 'center',
                fontSize: 13, fontWeight: 700, color: TEXT,
              }}>
                Submit Content
              </div>
              <div style={{ minWidth: 72 }} />
            </div>
            <div className="vl-scroll" style={{ flex: 1, overflowY: 'auto' }}>
              <VibeSubmitContent onClose={() => setSubmitOpen(false)} />
            </div>
          </div>
        )}

        {openContent && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            backgroundColor: BG,
            display: 'flex', flexDirection: 'column',
            animation: 'vl-slide-up 250ms ease-out',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0, height: 60,
            }}>
              <button
                onClick={() => setOpenContent(null)}
                aria-label="Close content"
                style={{
                  background: 'rgba(255,255,255,0.05)', border: 'none',
                  color: TEXT, padding: '8px 14px', borderRadius: 10,
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  minWidth: 72,
                }}
              >
                ← Back
              </button>
              <div style={{
                flex: 1, textAlign: 'center',
                fontSize: 13, fontWeight: 700, color: TEXT,
                padding: '0 12px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {openContent.title}
              </div>
              <div style={{ minWidth: 72 }} />
            </div>

            <div className="vl-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
              <div style={{
                display: 'inline-block',
                background: typeAppearance(openContent.type).background,
                color: typeAppearance(openContent.type).color,
                fontSize: 9, fontWeight: 800,
                letterSpacing: 1.2, textTransform: 'uppercase',
                padding: '3px 8px', borderRadius: 6, marginBottom: 12,
              }}>
                {typeAppearance(openContent.type).label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 8, lineHeight: 1.3 }}>
                {openContent.title}
              </div>
              {openContent.description && (
                <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, marginBottom: 20 }}>
                  {openContent.description}
                </div>
              )}
              {openContent.source && (
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 20 }}>
                  Source: {openContent.source}
                </div>
              )}
              {openContent.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
                  {openContent.tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: 10, color: MUTED,
                      background: 'rgba(255,255,255,0.05)',
                      padding: '3px 10px', borderRadius: 999,
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <a
                href={openContent.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${openContent.title} in new tab`}
                style={{
                  display: 'block', width: '100%', boxSizing: 'border-box',
                  background: ACCENT, color: '#000',
                  borderRadius: 14, padding: '16px',
                  fontSize: 14, fontWeight: 800,
                  textAlign: 'center', textDecoration: 'none',
                  marginBottom: 8,
                }}
              >
                Open Content →
              </a>
            </div>

            <VibeActionDock
              contentId={openContent.id}
              isSaved={savedIds.has(openContent.id)}
              isCompleted={completedIds.has(openContent.id)}
              onToggleSave={handleSave}
              onComplete={handleComplete}
            />
          </div>
        )}

        <main className="vl-scroll" style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'feed' && (
            <FeedTab savedIds={savedIds} onSave={handleSave} onOpen={handleOpen} />
          )}
          {activeTab === 'indexer' && (
            <IndexerTab savedIds={savedIds} onSave={handleSave} onOpen={handleOpen} />
          )}
          {activeTab === 'library' && (
            <LibraryTab savedIds={savedIds} onUnsave={handleSave} onOpen={handleOpen} />
          )}
        </main>

        <nav style={{
          display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0, height: 64, background: SURFACE,
        }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-label={tab.label}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 4,
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: isActive ? ACCENT : MUTED,
                  position: 'relative',
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute', top: 0, width: 32, height: 2,
                    background: ACCENT, borderRadius: '0 0 3px 3px',
                  }} />
                )}
                <span style={{ fontSize: 20 }}>{tab.icon}</span>
                <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600 }}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </nav>
      </div>
      <VibeTwin
        isOpen={twinOpen}
        onClose={() => setTwinOpen(false)}
        userName={userName}
      />
    </>
  )
}
