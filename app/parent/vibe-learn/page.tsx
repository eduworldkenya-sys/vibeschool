'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const BG      = '#0a0a1a'
const SURFACE = '#12122a'
const CARD    = '#1a1a35'
const GOLD    = '#f5a623'
const GREEN   = '#10b981'
const MUTED   = 'rgba(255,255,255,0.45)'
const WHITE   = '#ffffff'
const DARK    = '#1e1b4b'

interface Child {
  student_id: string
  name:       string
  class_id:   string
  school_id:  string
}

interface LessonRow {
  id:           string
  title:        string
  subject_name: string
  student_copy: string
  created_at:   string
}

interface StreakRow {
  type:          string
  current_count: number
  longest_count: number
}

interface BadgeRow {
  id:        string
  earned_at: string
  badges: {
    name: string
    icon: string
  }
}

interface TwinSession {
  id:               string
  task_type:        string
  duration_seconds: number
  created_at:       string
}

function Skeleton({ h = 56, radius = 12 }: { h?: number; radius?: number }) {
  return (
    <div style={{
      height: h, borderRadius: radius,
      background: 'linear-gradient(90deg,#1e1e3a 25%,#252545 50%,#1e1e3a 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 800, color: MUTED, letterSpacing: 1.2,
      textTransform: 'uppercase', marginBottom: 12, marginTop: 28 }}>
      {children}
    </div>
  )
}

export default function VibeLearnPage() {
  const [children, setChildren]       = useState<Child[]>([])
  const [activeChild, setActiveChild] = useState<Child | null>(null)
  const [lessons, setLessons]         = useState<LessonRow[]>([])
  const [streaks, setStreaks]         = useState<StreakRow[]>([])
  const [badges, setBadges]           = useState<BadgeRow[]>([])
  const [sessions, setSessions]       = useState<TwinSession[]>([])
  const [twinMsg, setTwinMsg]         = useState('')
  const [loading, setLoading]         = useState(true)
  const [childLoading, setChildLoading] = useState(false)
  const [search, setSearch]           = useState('')
  const [searchResults, setSearchResults] = useState<LessonRow[]>([])

  // ── 1. Load parent + children ──────────────────────────────────────────────
  useEffect(() => {
    async function boot() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: links } = await supabase
        .from('parent_student_links')
        .select('student_id, school_id')
        .eq('parent_id', user.id)

      if (!links || links.length === 0) { setLoading(false); return }

      const ids = links.map((l: { student_id: string }) => l.student_id)

      const { data: studs } = await supabase
        .from('students')
        .select('id, name, class_id')
        .in('id', ids)

      if (!studs) { setLoading(false); return }

      const mapped: Child[] = studs.map((s: { id: string; name: string; class_id: string }) => {
        const link = links.find((l: { student_id: string; school_id: string }) => l.student_id === s.id)
        return {
          student_id: s.id,
          name:       s.name,
          class_id:   s.class_id,
          school_id:  link?.school_id ?? '',
        }
      })

      setChildren(mapped)
      setActiveChild(mapped[0])
      setLoading(false)
    }
    boot()
  }, [])

  // ── 2. Load child data when active child changes ───────────────────────────
  useEffect(() => {
    if (!activeChild) return
    loadChildData(activeChild)
  }, [activeChild])

  async function loadChildData(child: Child) {
    setChildLoading(true)

    const [
      lessonPlansRes,
      streaksRes,
      badgesRes,
      sessionsRes,
    ] = await Promise.all([
      supabase
        .from('lesson_plans')
        .select('id, title, subject_id, class_id')
        .eq('class_id', child.class_id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('child_streaks')
        .select('type, current_count, longest_count')
        .eq('student_id', child.student_id),
      supabase
        .from('child_badges')
        .select('id, earned_at, badges(name, icon)')
        .eq('student_id', child.student_id)
        .order('earned_at', { ascending: false })
        .limit(6),
      supabase
        .from('twin_sessions')
        .select('id, task_type, duration_seconds, created_at')
        .eq('user_id', child.student_id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const plans = lessonPlansRes.data ?? []
    const planIds = plans.map((p: { id: string }) => p.id)
    const subjectIds = Array.from(new Set(plans.map((p: { subject_id: string }) => p.subject_id)))

    const [contentRes, subjectsRes] = await Promise.all([
      planIds.length > 0
        ? supabase
            .from('lesson_content')
            .select('id, lesson_plan_id, student_copy, created_at')
            .in('lesson_plan_id', planIds)
            .order('created_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
      subjectIds.length > 0
        ? supabase
            .from('subjects')
            .select('id, name')
            .in('id', subjectIds)
        : Promise.resolve({ data: [] }),
    ])

    const subjectMap: Record<string, string> = {}
    for (const s of (subjectsRes.data ?? [])) {
      subjectMap[s.id] = s.name
    }

    const planMap: Record<string, { title: string; subject_id: string }> = {}
    for (const p of plans) {
      planMap[p.id] = { title: p.title, subject_id: p.subject_id }
    }

    const lessonRows: LessonRow[] = (contentRes.data ?? []).map((c: {
      id: string; lesson_plan_id: string; student_copy: string; created_at: string
    }) => ({
      id:           c.id,
      title:        planMap[c.lesson_plan_id]?.title ?? 'Lesson',
      subject_name: subjectMap[planMap[c.lesson_plan_id]?.subject_id ?? ''] ?? 'Subject',
      student_copy: c.student_copy ?? '',
      created_at:   c.created_at,
    }))

    // Twin greeting from last session
    const lastSession = (sessionsRes.data ?? [])[0]
    if (lastSession) {
      setTwinMsg(
        `Last time we worked on ${lastSession.task_type ?? 'a lesson'} together. Ready to continue, ${child.name.split(' ')[0]}?`
      )
    } else {
      setTwinMsg(`Welcome, ${child.name.split(' ')[0]}. The whole knowledge world is open. Where do we start?`)
    }

    setLessons(lessonRows)
    setStreaks(streaksRes.data ?? [])
    const rawBadges: BadgeRow[] = (badgesRes.data ?? []).map((b: Record<string, unknown>) => {
      const raw = b.badges
      const obj = Array.isArray(raw) ? (raw[0] ?? { name: '', icon: '' }) : (raw ?? { name: '', icon: '' })
      return {
        id:        b.id        as string,
        earned_at: b.earned_at as string,
        badges:    obj         as { name: string; icon: string },
      }
    })
    setBadges(rawBadges)
    setSessions(sessionsRes.data ?? [])
    setChildLoading(false)
  }

  // ── 3. Search ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return }
    const q = search.toLowerCase()
    setSearchResults(
      lessons.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.subject_name.toLowerCase().includes(q) ||
        l.student_copy.toLowerCase().includes(q)
      )
    )
  }, [search, lessons])

  // ── Derived stats ──────────────────────────────────────────────────────────
  const dailyStreak   = streaks.find(s => s.type === 'daily')?.current_count ?? 0
  const totalSessions = sessions.length
  const totalMins     = Math.round(
    sessions.reduce((acc, s) => acc + (Number(s.duration_seconds) || 0), 0) / 60
  )

  if (loading) {
    return (
      <div style={{ background: BG, minHeight: '100vh', padding: '20px 16px' }}>
        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        <Skeleton h={120} radius={20} />
        <div style={{ marginTop: 16 }}><Skeleton h={60} /></div>
        <div style={{ marginTop: 12 }}><Skeleton h={200} /></div>
        <div style={{ marginTop: 12 }}><Skeleton h={160} /></div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes glow{0%,100%{box-shadow:0 0 12px ${GREEN}}50%{box-shadow:0 0 24px ${GREEN}}}
        .strip-scroll::-webkit-scrollbar{display:none}
        .strip-scroll{-ms-overflow-style:none;scrollbar-width:none}
      `}</style>

      <div style={{ background: BG, paddingBottom: 100 }}>

        {/* ── Child switcher ── */}
        {children.length > 1 && (
          <div style={{ padding: '12px 16px 0' }}>
            <div className="strip-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
              {children.map(c => (
                <button
                  key={c.student_id}
                  onClick={() => setActiveChild(c)}
                  style={{
                    flexShrink: 0,
                    background: activeChild?.student_id === c.student_id ? GREEN : CARD,
                    color: activeChild?.student_id === c.student_id ? WHITE : MUTED,
                    border: 'none', borderRadius: 999,
                    padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {c.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Twin greeting card ── */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{
            background: SURFACE,
            borderRadius: 20,
            padding: '20px 18px',
            border: `1px solid rgba(16,185,129,0.2)`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -30, right: -30,
              width: 120, height: 120, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
            }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: 'radial-gradient(circle, #10b981 0%, #059669 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, animation: 'glow 3s ease-in-out infinite',
              }}>
                🧠
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: GREEN,
                  letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                  Twin
                </div>
                <div style={{ fontSize: 14, color: WHITE, lineHeight: 1.5, fontWeight: 500 }}>
                  {childLoading ? '...' : twinMsg}
                </div>
                <button style={{
                  marginTop: 12, background: GREEN, color: WHITE,
                  border: 'none', borderRadius: 10, padding: '8px 18px',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                  Open Twin
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Search ── */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 14, top: '50%',
              transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none',
            }}>🔍</div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search any concept, subject, lesson..."
              style={{
                width: '100%', boxSizing: 'border-box',
                background: CARD, border: `1px solid rgba(255,255,255,0.08)`,
                borderRadius: 14, padding: '13px 16px 13px 42px',
                fontSize: 13, color: WHITE, outline: 'none',
              }}
            />
          </div>

          {/* Search results */}
          {search.trim().length > 0 && (
            <div style={{ marginTop: 8 }}>
              {searchResults.length === 0 ? (
                <div style={{ color: MUTED, fontSize: 13, padding: '12px 4px' }}>
                  No lessons found for "{search}"
                </div>
              ) : (
                searchResults.map(r => (
                  <div key={r.id} style={{
                    background: CARD, borderRadius: 12, padding: '12px 14px',
                    marginBottom: 8, border: `1px solid rgba(255,255,255,0.06)`,
                  }}>
                    <div style={{ fontSize: 12, color: GREEN, fontWeight: 700, marginBottom: 4 }}>
                      {r.subject_name}
                    </div>
                    <div style={{ fontSize: 14, color: WHITE, fontWeight: 600 }}>{r.title}</div>
                    {r.student_copy && (
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 4, lineHeight: 1.4 }}>
                        {r.student_copy.slice(0, 100)}...
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '0 16px' }}>

          {/* ── Lesson Replay strip ── */}
          <SectionTitle>Lesson Replay</SectionTitle>
          {childLoading ? (
            <Skeleton h={130} radius={14} />
          ) : lessons.length === 0 ? (
            <div style={{
              background: CARD, borderRadius: 14, padding: '20px 16px',
              color: MUTED, fontSize: 13, textAlign: 'center',
            }}>
              No lessons available yet
            </div>
          ) : (
            <div className="strip-scroll" style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
              {lessons.map(l => (
                <div key={l.id} style={{
                  flexShrink: 0, width: 200,
                  background: CARD, borderRadius: 14, padding: '14px 14px',
                  border: `1px solid rgba(255,255,255,0.06)`,
                }}>
                  <div style={{
                    fontSize: 9, fontWeight: 800, color: GREEN,
                    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
                  }}>
                    {l.subject_name}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: WHITE,
                    lineHeight: 1.4, marginBottom: 10 }}>
                    {l.title}
                  </div>
                  <button style={{
                    background: 'rgba(16,185,129,0.15)', color: GREEN,
                    border: `1px solid rgba(16,185,129,0.3)`,
                    borderRadius: 8, padding: '6px 12px',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '100%',
                  }}>
                    Replay
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Self-directed: Trivia + My Exam ── */}
          <SectionTitle>Self-Directed</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{
              background: `linear-gradient(135deg, #92400e 0%, ${GOLD} 100%)`,
              borderRadius: 16, padding: '18px 14px',
            }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>⚡</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: WHITE, marginBottom: 4 }}>
                Trivia
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 14, lineHeight: 1.4 }}>
                Challenge yourself. Pick subject and difficulty.
              </div>
              <button style={{
                background: 'rgba(255,255,255,0.2)', color: WHITE,
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 8, padding: '7px 0',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '100%',
              }}>
                Start
              </button>
            </div>

            <div style={{
              background: `linear-gradient(135deg, ${DARK} 0%, #312e81 100%)`,
              borderRadius: 16, padding: '18px 14px',
            }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>📝</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: WHITE, marginBottom: 4 }}>
                My Exam
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 14, lineHeight: 1.4 }}>
                Test yourself. Twin builds a real exam.
              </div>
              <button style={{
                background: 'rgba(255,255,255,0.15)', color: WHITE,
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 8, padding: '7px 0',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '100%',
              }}>
                Start
              </button>
            </div>
          </div>

          {/* ── Badges strip ── */}
          {badges.length > 0 && (
            <>
              <SectionTitle>Badges Earned</SectionTitle>
              <div className="strip-scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
                {badges.map(b => (
                  <div key={b.id} style={{
                    flexShrink: 0, width: 80,
                    background: CARD, borderRadius: 14, padding: '12px 8px',
                    textAlign: 'center', border: `1px solid rgba(245,166,35,0.2)`,
                  }}>
                    <div style={{ fontSize: 26, marginBottom: 6 }}>{b.badges?.icon ?? '🏅'}</div>
                    <div style={{ fontSize: 9, color: GOLD, fontWeight: 700, lineHeight: 1.3 }}>
                      {b.badges?.name ?? 'Badge'}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Learning Biography ── */}
          <SectionTitle>Learning Biography</SectionTitle>
          <div style={{
            background: SURFACE, borderRadius: 20, padding: '20px 18px',
            border: `1px solid rgba(255,255,255,0.06)`,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Twin Sessions', value: String(totalSessions), icon: '🧠' },
                { label: 'Daily Streak',  value: `${dailyStreak} 🔥`,   icon: '🔥' },
                { label: 'Time Learned',  value: `${totalMins}m`,        icon: '⏱️' },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: CARD, borderRadius: 12, padding: '12px 8px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{stat.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: WHITE }}>{stat.value}</div>
                  <div style={{ fontSize: 9, color: MUTED, marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Growth line — session count by day */}
            {sessions.length > 1 && (() => {
              const byDay: Record<string, number> = {}
              sessions.forEach(s => {
                const day = s.created_at.slice(0, 10)
                byDay[day] = (byDay[day] ?? 0) + 1
              })
              const days  = Object.keys(byDay).sort().slice(-7)
              const vals  = days.map(d => byDay[d])
              const max   = Math.max(...vals, 1)
              return (
                <div>
                  <div style={{ fontSize: 10, color: MUTED, marginBottom: 8, fontWeight: 600 }}>
                    SESSIONS — LAST 7 DAYS
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 48 }}>
                    {days.map((d, i) => (
                      <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{
                          width: '100%',
                          height: `${Math.round((vals[i] / max) * 40)}px`,
                          minHeight: 4,
                          background: GREEN,
                          borderRadius: 4,
                          opacity: 0.85,
                        }} />
                        <div style={{ fontSize: 8, color: MUTED }}>
                          {new Date(d).toLocaleDateString('en', { weekday: 'short' }).slice(0, 1)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {sessions.length === 0 && (
              <div style={{ color: MUTED, fontSize: 12, textAlign: 'center', paddingTop: 8 }}>
                No Twin sessions yet. Start learning to build your biography.
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
