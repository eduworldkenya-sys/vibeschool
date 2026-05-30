'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import VibeTwin from '@/components/student/VibeTwin'

const BG      = '#f5f2ee'
const SURFACE = '#ffffff'
const CARD    = '#ffffff'
const ACCENT  = '#f0b429'
const MUTED   = '#6b6b6b'
const TEXT    = '#1a1a1a'
const GREEN   = '#003826'
const GOLD    = '#f0b429'

type GlobalTab = 'feed' | 'create' | 'listen' | 'profile'

interface VibeContent {
  id:          string
  title:       string
  description: string | null
  type:        'epage' | 'ebook'
  source:      string | null
  url:         string
  tags:        string[]
  status:      string
  view_count:  number
  vibe_count:  number
  earnings_ksh: number
  created_at:  string
  submitted_by: string
}

interface UserProfile {
  id:        string
  full_name: string
  country_code: string | null
  vibe_count:   number
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function isValidUrl(u: string): boolean {
  try { return ['http:','https:'].includes(new URL(u).protocol) }
  catch { return false }
}

function Shimmer({ h = 80, r = 14 }: { h?: number; r?: number }) {
  return (
    <div style={{
      height: h, borderRadius: r,
      background: 'linear-gradient(90deg,#1a2235 25%,#243044 50%,#1a2235 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      marginBottom: 12,
    }} />
  )
}

const SUBJECTS = [
  'Mathematics','English','Kiswahili','Biology','Chemistry',
  'Physics','History','Geography','Business','Technology',
  'News','Health','Sports','Entertainment','Politics',
]

const TAGS_PRESET = [
  'Kenya','Nairobi','KCSE','Education','News',
  'Health','Business','Sports','Tech','Finance',
]

export default function VibeGlobalDashboard() {
  const router = useRouter()

  const [tab,       setTab]       = useState<GlobalTab>('feed')
  const [user,      setUser]      = useState<UserProfile | null>(null)
  const [feed,      setFeed]      = useState<VibeContent[]>([])
  const [loading,   setLoading]   = useState(true)
  const [twinOpen,  setTwinOpen]  = useState(false)
  const [vibing,    setVibing]    = useState<string | null>(null)
  const [ttsItem,   setTtsItem]   = useState<VibeContent | null>(null)
  const [speaking,  setSpeaking]  = useState(false)

  // Create form
  const [cType,    setCType]    = useState<'epage'|'ebook'>('epage')
  const [cTitle,   setCTitle]   = useState('')
  const [cDesc,    setCDesc]    = useState('')
  const [cSubject, setCSubject] = useState(SUBJECTS[0])
  const [cUrl,     setCUrl]     = useState('')
  const [cFile,    setCFile]    = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [cTags,    setCTags]    = useState<string[]>([])
  const [cErr,     setCErr]     = useState('')
  const [cOk,      setCOk]      = useState(false)
  const [dropping, setDropping] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.replace('/global/signin'); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, country_code')
        .eq('id', u.id)
        .maybeSingle()
      if (profile) setUser({ ...profile, vibe_count: 0 })
      await loadFeed()
      setLoading(false)
    }
    init()
  }, [])

  const loadFeed = useCallback(async () => {
    const { data } = await supabase
      .from('vibelearn_content')
      .select('id,title,description,type,source,url,tags,status,view_count,vibe_count,earnings_ksh,created_at,submitted_by')
      .eq('status', 'live')
      .order('view_count', { ascending: false })
      .limit(30)
    setFeed((data ?? []) as VibeContent[])
  }, [])

  async function handleVibe(item: VibeContent) {
    if (vibing || !user) return
    setVibing(item.id)
    try {
      await supabase.from('vibelearn_vibes')
        .insert({ content_id: item.id, user_id: user.id })
      setFeed(prev => prev.map(c =>
        c.id === item.id ? { ...c, vibe_count: c.vibe_count + 1 } : c
      ))
    } catch { /* already vibed */ } finally {
      setVibing(null)
    }
  }

  async function handleOpen(item: VibeContent) {
    if (user) {
      await supabase.rpc('increment_view_count', {
        content_id: item.id,
        viewer_id:  user.id,
      })
    }
    window.open(item.url, '_blank', 'noopener')
  }

  function handleListen(item: VibeContent) {
    if (speaking) {
      window.speechSynthesis?.cancel()
      setSpeaking(false)
      setTtsItem(null)
      return
    }
    setTtsItem(item)
    setSpeaking(true)
    const text = `${item.title}. ${item.description ?? ''}`
    const u    = new SpeechSynthesisUtterance(text)
    u.rate     = 0.9
    u.pitch    = 1.05
    const voices = window.speechSynthesis?.getVoices() ?? []
    const voice  = voices.find(v =>
      v.name.includes('Google UK English Female') ||
      v.lang === 'en-GB'
    )
    if (voice) u.voice = voice
    u.onend = () => { setSpeaking(false); setTtsItem(null) }
    window.speechSynthesis?.speak(u)
  }

  async function handleDrop() {
    setCErr('')
    if (!cTitle.trim())           { setCErr('Title required.'); return }
    if (!cDesc.trim())            { setCErr('Description required.'); return }
    if (!cFile)                   { setCErr('Please select a file.'); return }
    
    if (!user) return
    setDropping(true)
    setUploading(true)
    try {
      // Upload file to Supabase Storage
      const ext = cFile!.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('vibelearn-content')
        .upload(path, cFile!, { upsert: false })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage
        .from('vibelearn-content')
        .getPublicUrl(path)
      const publicUrl = urlData.publicUrl

      const { error } = await supabase.from('vibelearn_content').insert({
        title:        cTitle.trim(),
        description:  cDesc.trim(),
        type:         cType,
        source:       cSubject,
        url:          publicUrl,
        tags:         cTags,
        status:       'live',
        submitted_by: user.id,
        view_count:   0,
        vibe_count:   0,
        earnings_ksh: 0,
      })
      if (error) throw error
      setCTitle(''); setCDesc(''); setCUrl(''); setCTags([]); setCFile(null)
      setCOk(true)
      setTimeout(() => setCOk(false), 3000)
      await loadFeed()
      setTab('feed')
    } catch (e: unknown) {
      setCErr((e as Error).message ?? 'Failed to drop vibe.')
    } finally {
      setDropping(false)
      setUploading(false)
    }
  }

  const firstName = user?.full_name?.split(' ')[0] ?? 'Vibe'

  const card: React.CSSProperties = {
    background: CARD, borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '16px', marginBottom: 12,
  }

  if (loading) return (
    <div style={{ background: BG, minHeight: '100dvh', padding: '20px 16px' }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      {[1,2,3,4].map(i => <Shimmer key={i} />)}
    </div>
  )

  return (
    <div style={{ background: BG, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes slideIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes twinGlow{0%,100%{box-shadow:0 0 16px 4px rgba(204,255,0,0.2)}50%{box-shadow:0 0 28px 8px rgba(204,255,0,0.4)}}
        * { box-sizing: border-box; }
      `}</style>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', background: SURFACE,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: TEXT, letterSpacing: -0.5 }}>
          Vibe<span style={{ color: ACCENT }}>Global</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* TTS indicator */}
          {speaking && (
            <div style={{
              fontSize: 10, fontWeight: 800, color: ACCENT,
              background: 'rgba(204,255,0,0.1)',
              border: '1px solid rgba(204,255,0,0.2)',
              borderRadius: 20, padding: '4px 10px',
              animation: 'twinGlow 1.5s infinite',
            }}>
              🔊 Listening
            </div>
          )}
          {/* Twin button */}
          <button
            onClick={() => setTwinOpen(true)}
            style={{
              background: 'rgba(204,255,0,0.1)',
              border: '1px solid rgba(204,255,0,0.25)',
              borderRadius: 20, padding: '7px 14px',
              color: ACCENT, fontSize: 12, fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ✦ Twin
          </button>
          {/* Avatar */}
          <div
            onClick={() => setTab('profile')}
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1a2235, #243044)',
              border: '2px solid rgba(204,255,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: ACCENT, cursor: 'pointer',
            }}
          >
            {firstName[0]?.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px' }}>

        {/* ══ FEED ══ */}
        {tab === 'feed' && (
          <div style={{ animation: 'slideIn 0.2s ease' }}>
            {/* Hero greeting */}
            <div style={{
              background: 'linear-gradient(135deg, #0a1628 0%, #0d1f12 100%)',
              borderRadius: 18, padding: '18px 20px', marginBottom: 16,
              border: '1px solid rgba(204,255,0,0.1)',
            }}>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>VibeGlobal</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: TEXT }}>Vibe, {firstName}.</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>What are we learning today?</div>
            </div>

            {/* TTS player bar */}
            {ttsItem && (
              <div style={{
                ...card, marginBottom: 16,
                background: 'rgba(204,255,0,0.06)',
                border: '1px solid rgba(204,255,0,0.2)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ fontSize: 22 }}>🔊</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>Now Playing</div>
                  <div style={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ttsItem.title}</div>
                </div>
                <button
                  onClick={() => { window.speechSynthesis?.cancel(); setSpeaking(false); setTtsItem(null) }}
                  style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 18, cursor: 'pointer' }}
                >
                  ⏹
                </button>
              </div>
            )}

            {/* Feed label */}
            <div style={{ fontSize: 10, fontWeight: 800, color: MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
              🔥 Vibe Rising
            </div>

            {feed.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✦</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 6 }}>No Vibes Yet</div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Be the first to drop a vibe.</div>
                <button onClick={() => setTab('create')} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: ACCENT, color: '#000', fontWeight: 800, cursor: 'pointer' }}>
                  Drop a Vibe ✦
                </button>
              </div>
            ) : feed.map((item, idx) => (
              <div key={item.id} style={{ ...card, animation: `slideIn 0.2s ease ${Math.min(idx * 0.04, 0.3)}s both` }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: item.type === 'ebook' ? 'rgba(124,92,252,0.15)' : 'rgba(16,185,129,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>
                    {item.type === 'ebook' ? '📚' : '📄'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{item.source} · {relativeDate(item.created_at)}</div>
                    {item.description && (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.5 }}>
                        {item.description.slice(0, 80)}{item.description.length > 80 ? '…' : ''}
                      </div>
                    )}
                    {item.tags?.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                        {item.tags.slice(0, 3).map(t => (
                          <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: MUTED }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, flexShrink: 0, textAlign: 'right' }}>
                    {item.view_count} views
                  </div>
                </div>

                {/* Action row */}
                <div style={{ display: 'flex', gap: 6, marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
                  <button
                    onClick={() => handleVibe(item)}
                    disabled={!!vibing}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
                      background: 'rgba(204,255,0,0.06)',
                      color: ACCENT, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    }}
                  >
                    ✦ {item.vibe_count > 0 ? item.vibe_count : ''} Vibe
                  </button>
                  <button
                    onClick={() => handleListen(item)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
                      background: ttsItem?.id === item.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                      color: ttsItem?.id === item.id ? ACCENT : MUTED,
                      fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    }}
                  >
                    {ttsItem?.id === item.id ? '⏹ Stop' : '🔊 Listen'}
                  </button>
                  <button
                    onClick={() => handleOpen(item)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
                      background: 'rgba(255,255,255,0.04)',
                      color: MUTED, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    }}
                  >
                    Vibe In →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ CREATE ══ */}
        {tab === 'create' && (
          <div style={{ animation: 'slideIn 0.2s ease' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: TEXT, marginBottom: 4 }}>Drop a Vibe</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Share knowledge. Earn when people read it.</div>

            {cOk && (
              <div style={{ ...card, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>✓ Vibe dropped. You are now earning.</div>
              </div>
            )}

            <div style={card}>
              {/* Type toggle */}
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, marginBottom: 16 }}>
                {(['epage','ebook'] as const).map(t => (
                  <button key={t} onClick={() => setCType(t)} style={{
                    flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                    background: cType === t ? SURFACE : 'transparent',
                    color: cType === t ? TEXT : MUTED,
                    fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}>
                    {t === 'epage' ? '📄 EPAGE' : '📚 EBOOK'}
                  </button>
                ))}
              </div>

              {[
                { id: 'vg-title', label: 'TITLE *', value: cTitle, set: setCTitle, ph: "e.g. How Kenya's Economy Works", type: 'text' },
              ].map(f => (
                <div key={f.id} style={{ marginBottom: 12 }}>
                  <label htmlFor={f.id} style={{ fontSize: 10, fontWeight: 800, color: MUTED, letterSpacing: 1, display: 'block', marginBottom: 6, textTransform: 'uppercase' as const }}>{f.label}</label>
                  <input id={f.id} type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                    style={{ width: '100%', background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: TEXT, outline: 'none' }} />
                </div>
              ))}

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: '#6b6b6b', letterSpacing: 1, display: 'block', marginBottom: 6, textTransform: 'uppercase' as const }}>UPLOAD FILE *</label>
                <label htmlFor="vg-file" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  width: '100%', padding: '20px 0', borderRadius: 12, cursor: 'pointer',
                  border: '2px dashed rgba(0,56,38,0.25)',
                  background: cFile ? 'rgba(0,56,38,0.06)' : '#f9f9f9',
                  color: cFile ? '#003826' : '#6b6b6b', fontWeight: 700, fontSize: 13,
                }}>
                  <span style={{ fontSize: 22 }}>{cFile ? '📄' : '⬆️'}</span>
                  {cFile ? cFile.name : 'Tap to choose PDF, DOC, image…'}
                </label>
                <input id="vg-file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.epub"
                  onChange={e => setCFile(e.target.files?.[0] ?? null)}
                  style={{ display: 'none' }} />
                {uploading && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#003826', fontWeight: 700 }}>Uploading…</div>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="vg-desc" style={{ fontSize: 10, fontWeight: 800, color: MUTED, letterSpacing: 1, display: 'block', marginBottom: 6, textTransform: 'uppercase' as const }}>DESCRIPTION *</label>
                <textarea id="vg-desc" value={cDesc} onChange={e => setCDesc(e.target.value)} rows={3} placeholder="What will people learn?"
                  style={{ width: '100%', background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: TEXT, outline: 'none', resize: 'none', lineHeight: 1.6 }} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="vg-subject" style={{ fontSize: 10, fontWeight: 800, color: MUTED, letterSpacing: 1, display: 'block', marginBottom: 6, textTransform: 'uppercase' as const }}>SUBJECT</label>
                <div style={{ position: 'relative' }}>
                  <select id="vg-subject" value={cSubject} onChange={e => setCSubject(e.target.value)}
                    style={{ width: '100%', background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '11px 36px 11px 14px', fontSize: 13, color: TEXT, outline: 'none', appearance: 'none' as const }}>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: MUTED, pointerEvents: 'none' }}>▾</div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: MUTED, letterSpacing: 1, display: 'block', marginBottom: 8, textTransform: 'uppercase' as const }}>TAGS</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {TAGS_PRESET.map(t => {
                    const sel = cTags.includes(t)
                    return (
                      <button key={t} onClick={() => setCTags(p => sel ? p.filter(x => x !== t) : [...p, t].slice(0, 10))}
                        style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', background: sel ? ACCENT : 'rgba(255,255,255,0.06)', color: sel ? '#000' : MUTED }}>
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>

              {cErr && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{cErr}</div>}

              <button onClick={handleDrop} disabled={dropping} style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                background: dropping ? 'rgba(204,255,0,0.3)' : ACCENT,
                color: '#000', fontWeight: 900, fontSize: 15, cursor: dropping ? 'not-allowed' : 'pointer',
              }}>
                {dropping ? 'Dropping…' : 'Drop a Vibe ✦'}
              </button>
            </div>
          </div>
        )}

        {/* ══ LISTEN ══ */}
        {tab === 'listen' && (
          <div style={{ animation: 'slideIn 0.2s ease' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: TEXT, marginBottom: 4 }}>Listen</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Ask Twin anything. Tap the Twin button above.</div>
            <div style={{ ...card, textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✦</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Activate Vibe Twin</div>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 20, lineHeight: 1.6 }}>
                Ask for news, lessons, or any topic. Twin searches the web and reads it to you.
              </div>
              <button onClick={() => setTwinOpen(true)} style={{
                padding: '12px 28px', borderRadius: 12, border: 'none',
                background: ACCENT, color: '#000', fontWeight: 800, cursor: 'pointer',
              }}>
                Wake Twin ✦
              </button>
            </div>
          </div>
        )}

        {/* ══ PROFILE ══ */}
        {tab === 'profile' && (
          <div style={{ animation: 'slideIn 0.2s ease' }}>
            <div style={{ ...card, textAlign: 'center', padding: '28px 20px' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', margin: '0 auto 12px',
                background: 'linear-gradient(135deg, #1a2235, #243044)',
                border: '3px solid rgba(204,255,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 900, color: ACCENT,
              }}>
                {firstName[0]?.toUpperCase()}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: TEXT }}>{user?.full_name}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{user?.country_code ?? 'Global'} · VibeGlobal</div>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 20 }}>
                {[
                  { label: 'Vibes', val: feed.filter(c => c.submitted_by === user?.id).length },
                  { label: 'Dropped', val: feed.filter(c => c.submitted_by === user?.id).reduce((a, c) => a + c.view_count, 0) },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: ACCENT }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: MUTED, fontWeight: 700 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={async () => { await supabase.auth.signOut(); router.replace('/global/signin') }}
              style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: MUTED, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginTop: 8 }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: SURFACE, borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', height: 64,
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 200,
      }}>
        {([
          { id: 'feed',    icon: '🔥', label: 'Vibe Feed' },
          { id: 'listen',  icon: '✦',  label: 'Listen' },
          { id: 'create',  icon: '＋',  label: 'Drop' },
          { id: 'profile', icon: '👤', label: 'Profile' },
        ] as const).map(t => {
          const isActive = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3, border: 'none', background: 'none', cursor: 'pointer',
              color: isActive ? ACCENT : MUTED,
              position: 'relative',
            }}>
              {isActive && (
                <div style={{ position: 'absolute', top: 0, width: 28, height: 2, background: ACCENT, borderRadius: '0 0 3px 3px' }} />
              )}
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 500 }}>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Twin */}
      <VibeTwin
        isOpen={twinOpen}
        onClose={() => setTwinOpen(false)}
        userName={firstName}
        userId={user?.id ?? ''}
      />
    </div>
  )
}
