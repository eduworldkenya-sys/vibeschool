'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { LinkedChild } from '@/lib/types'

// ── Colour constants ───────────────────────────────────────────────────────────
const dark      = "#1e1b4b"
const deepspace = "#0a0a14"
const accent    = "#10b981"
const amber     = "#f59e0b"
const violet    = "#8b5cf6"
const bg        = "#f0f2f5"
const red       = "#ef4444"

// ── Subjects ──────────────────────────────────────────────────────────────────
const SUBJECTS = [
  { id: 'all',     label: 'All',           emoji: '⚡', color: accent  },
  { id: 'maths',   label: 'Maths',         emoji: '📐', color: '#3b82f6' },
  { id: 'science', label: 'Science',       emoji: '🔬', color: '#10b981' },
  { id: 'english', label: 'English',       emoji: '📖', color: '#f59e0b' },
  { id: 'social',  label: 'Social Studies',emoji: '🌍', color: '#ef4444' },
  { id: 'coding',  label: 'Coding',        emoji: '💻', color: '#8b5cf6' },
  { id: 'art',     label: 'Art',           emoji: '🎨', color: '#ec4899' },
  { id: 'kisw',    label: 'Kiswahili',     emoji: '🌐', color: '#f97316' },
  { id: 'history', label: 'History',       emoji: '📜', color: '#84cc16' },
]

// ── Content per subject ────────────────────────────────────────────────────────
const CONTENT: Record<string, { emoji: string; title: string; desc: string; type: string; points: number }[]> = {
  all: [
    { emoji: '⚡', title: 'Daily Trivia Blitz',     desc: '10 questions. 60 seconds. Beat your score.', type: 'trivia',   points: 50  },
    { emoji: '📖', title: 'Read & Earn',             desc: 'Read a story. Earn points. Level up.',       type: 'read',     points: 30  },
    { emoji: '🔬', title: 'Science Fact Drop',       desc: 'One wild fact that will blow your mind.',    type: 'fact',     points: 10  },
    { emoji: '🏆', title: 'Build Your Own Exam',     desc: 'Pick a topic. Claude builds your quiz.',     type: 'forge',    points: 100 },
    { emoji: '🌍', title: 'Explore the World',       desc: 'Safe internet. Curated just for you.',       type: 'explore',  points: 20  },
    { emoji: '🎯', title: 'Daily Challenge',         desc: 'One challenge. Massive points. Do it.',      type: 'challenge',points: 75  },
  ],
  maths: [
    { emoji: '📐', title: 'Maths Trivia Blitz',      desc: '10 maths questions. Timer on. Go.',          type: 'trivia',   points: 50  },
    { emoji: '🔢', title: 'Number Facts',             desc: 'Wild maths facts that break your brain.',    type: 'fact',     points: 10  },
    { emoji: '🏆', title: 'Maths Exam Builder',      desc: 'Build your own maths test with Claude.',     type: 'forge',    points: 100 },
    { emoji: '🌐', title: 'Khan Academy Maths',      desc: 'Best maths videos on the planet.',           type: 'explore',  points: 20  },
  ],
  science: [
    { emoji: '🔬', title: 'Science Trivia Blitz',    desc: '10 science questions. Can you ace it?',      type: 'trivia',   points: 50  },
    { emoji: '🧪', title: 'Experiment of the Day',   desc: 'One experiment you can do at home.',         type: 'fact',     points: 10  },
    { emoji: '🚀', title: 'NASA Kids Explorer',      desc: 'Space facts straight from NASA.',            type: 'explore',  points: 20  },
    { emoji: '🏆', title: 'Science Exam Builder',    desc: 'Build your own science test.',               type: 'forge',    points: 100 },
  ],
  english: [
    { emoji: '📖', title: 'Story of the Day',        desc: 'A short story. Read it. Earn points.',       type: 'read',     points: 30  },
    { emoji: '✍️', title: 'English Trivia',          desc: '10 English questions. Vocabulary king.',     type: 'trivia',   points: 50  },
    { emoji: '📚', title: 'Free Books Library',      desc: 'Thousands of free books. Start reading.',    type: 'explore',  points: 20  },
    { emoji: '🏆', title: 'English Exam Builder',    desc: 'Build your own English test.',               type: 'forge',    points: 100 },
  ],
  social: [
    { emoji: '🌍', title: 'Geography Trivia',        desc: 'Countries, capitals, flags. Do you know?',   type: 'trivia',   points: 50  },
    { emoji: '🗺️', title: 'World Explorer',         desc: 'Explore countries safely online.',           type: 'explore',  points: 20  },
    { emoji: '🏆', title: 'Social Studies Builder',  desc: 'Build your own social studies test.',        type: 'forge',    points: 100 },
  ],
  coding: [
    { emoji: '💻', title: 'Coding Trivia',           desc: '10 coding questions. Future engineer.',      type: 'trivia',   points: 50  },
    { emoji: '🎮', title: 'Code.org Adventure',      desc: 'Learn coding through games.',                type: 'explore',  points: 20  },
    { emoji: '🏆', title: 'Coding Exam Builder',     desc: 'Build your own coding quiz.',                type: 'forge',    points: 100 },
  ],
  art: [
    { emoji: '🎨', title: 'Art History Trivia',      desc: '10 art questions. Artist in you.',           type: 'trivia',   points: 50  },
    { emoji: '🖌️', title: 'Art Explorer',           desc: 'Explore famous art from around the world.',  type: 'explore',  points: 20  },
    { emoji: '🏆', title: 'Art Exam Builder',        desc: 'Build your own art quiz.',                   type: 'forge',    points: 100 },
  ],
  kisw: [
    { emoji: '🌐', title: 'Kiswahili Trivia',        desc: 'Maneno ya Kiswahili. Je, unajua?',           type: 'trivia',   points: 50  },
    { emoji: '📖', title: 'Hadithi ya Leo',          desc: 'Soma hadithi. Pata pointi.',                 type: 'read',     points: 30  },
    { emoji: '🏆', title: 'Kiswahili Exam Builder',  desc: 'Jenga mtihani wako wa Kiswahili.',           type: 'forge',    points: 100 },
  ],
  history: [
    { emoji: '📜', title: 'History Trivia Blitz',    desc: '10 history questions. Time traveller.',      type: 'trivia',   points: 50  },
    { emoji: '🌍', title: 'Kenya History Deep Dive', desc: 'Explore Kenyan history safely online.',      type: 'explore',  points: 20  },
    { emoji: '🏆', title: 'History Exam Builder',    desc: 'Build your own history test.',               type: 'forge',    points: 100 },
  ],
}

// ── Rank logic ─────────────────────────────────────────────────────────────────
function getRank(points: number, streak: number): { label: string; emoji: string; color: string } {
  if (points >= 50000)                         return { label: 'Legend',      emoji: '👑', color: amber  }
  if (points >= 15000)                         return { label: 'Vibe Master', emoji: '🌌', color: violet }
  if (points >= 5000)                          return { label: 'Scholar',     emoji: '💎', color: '#3b82f6' }
  if (points >= 2000 && streak >= 30)          return { label: 'Blazer',      emoji: '🔥', color: red    }
  if (points >= 500  && streak >= 7)           return { label: 'Spark',       emoji: '⚡', color: amber  }
  return                                              { label: 'Seedling',    emoji: '🌱', color: accent }
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function Skeleton({ h = 56, radius = 12 }: { h?: number; radius?: number }) {
  return (
    <div style={{
      height: h, borderRadius: radius,
      background: 'linear-gradient(90deg,#1a1a2e 25%,#16213e 50%,#1a1a2e 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ── Content Card ──────────────────────────────────────────────────────────────
function ContentCard({
  item,
  childName,
  onAction,
}: {
  item: { emoji: string; title: string; desc: string; type: string; points: number }
  childName: string
  onAction: (type: string) => void
}) {
  const typeColors: Record<string, string> = {
    trivia:    accent,
    read:      '#3b82f6',
    fact:      amber,
    forge:     violet,
    explore:   '#ec4899',
    challenge: red,
  }
  const color = typeColors[item.type] || accent

  return (
    <div
      onClick={() => onAction(item.type)}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid rgba(255,255,255,0.08)`,
        borderRadius: 16,
        padding: 16,
        cursor: 'pointer',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'transform 0.15s ease, border-color 0.15s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${color}, transparent)`,
      }} />
      <div style={{ fontSize: 28 }}>{item.emoji}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>
        {item.title}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
        {item.desc}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginTop: 4,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: color, fontFamily: 'monospace',
        }}>
          +{item.points} pts
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700,
          background: color + '22', color: color,
          padding: '3px 8px', borderRadius: 999,
        }}>
          {item.type.toUpperCase()}
        </span>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function VibeLearnPage() {
  const router = useRouter()

  const [loading,        setLoading]        = useState(true)
  const [children,       setChildren]       = useState<LinkedChild[]>([])
  const [activeChild,    setActiveChild]    = useState<LinkedChild | null>(null)
  const [activeSubject,  setActiveSubject]  = useState('all')
  const [streak,         setStreak]         = useState(0)
  const [points,         setPoints]         = useState(0)
  const [toast,          setToast]          = useState('')
  const [scrolled,       setScrolled]       = useState(false)

  // ── Scroll detection ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = document.getElementById('vl-scroll')
    if (!el) return
    const handler = () => setScrolled(el.scrollTop > 160)
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [])

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }, [])

  // ── Fetch children ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      // Check localStorage cache first
      const cached = localStorage.getItem('vl_children')
      const cachedAt = localStorage.getItem('vl_children_at')
      if (cached && cachedAt && Date.now() - Number(cachedAt) < 5 * 60 * 1000) {
        const kids = JSON.parse(cached) as LinkedChild[]
        setChildren(kids)
        const saved = localStorage.getItem('vl_active_child')
        setActiveChild(saved ? JSON.parse(saved) : kids[0] ?? null)
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: links } = await supabase
        .from('parent_student_links')
        .select(`
          student_id,
          students (
            id,
            name,
            classes (
              name,
              stream,
              schools ( name )
            )
          )
        `)
        .eq('parent_id', user.id)

      if (!links || links.length === 0) { setLoading(false); return }

      const kids: LinkedChild[] = links.map((l: any) => {
        const s = l.students
        const cls = s?.classes
        const school = cls?.schools
        return {
          student_id:     s?.id ?? '',
          name:           s?.name ?? 'Child',
          class_name:     cls ? cls.name + (cls.stream ? ' ' + cls.stream : '') : '—',
          attendance_pct: 0,
          school_name:    school?.name ?? '—',
        }
      })

      localStorage.setItem('vl_children', JSON.stringify(kids))
      localStorage.setItem('vl_children_at', String(Date.now()))

      setChildren(kids)
      const saved = localStorage.getItem('vl_active_child')
      const active = saved ? JSON.parse(saved) : kids[0] ?? null
      setActiveChild(active)
      setLoading(false)
    }
    load()
  }, [])

  // ── Fetch streak + points for active child ─────────────────────────────────
  useEffect(() => {
    if (!activeChild) return
    async function loadStats() {
      const sid = activeChild!.student_id

      // Points
      const { data: pts } = await supabase
        .from('vibelearn_points')
        .select('amount')
        .eq('student_id', sid)
      const total = (pts ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0)
      setPoints(total)

      // Streak
      const { data: st } = await supabase
        .from('child_streaks')
        .select('current_streak')
        .eq('student_id', sid)
        .single()
      setStreak(st?.current_streak ?? 0)
    }
    loadStats()
  }, [activeChild])

  // ── Switch child ───────────────────────────────────────────────────────────
  function switchChild(child: LinkedChild) {
    setActiveChild(child)
    setPoints(0)
    setStreak(0)
    localStorage.setItem('vl_active_child', JSON.stringify(child))
  }

  // ── Handle content tap ────────────────────────────────────────────────────
  function handleAction(type: string) {
    if (!activeChild) return
    const id = activeChild.student_id
    if (type === 'trivia')    showToast("Trivia coming soon ⚡")
    if (type === 'read')      showToast("Reading coming soon 📖")
    if (type === 'fact')      showToast("Fact drop coming soon 🔬")
    if (type === 'explore')   showToast("Explorer coming soon 🌍")
    if (type === 'challenge') showToast("Challenges coming soon 🏆")
    if (type === 'forge')     showToast("Forge coming soon 🛠️")
  }

  const rank    = getRank(points, streak)
  const content = CONTENT[activeSubject] ?? CONTENT['all']
  const first   = activeChild?.name?.split(' ')[0] ?? 'Learner'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0 }
          100% { background-position: -200% 0 }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px) }
          to   { opacity: 1; transform: translateY(0)   }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50%       { opacity: 0.6 }
        }
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0 }
          to   { transform: translateY(0);    opacity: 1 }
        }
        .sub-scroll::-webkit-scrollbar { display: none }
        .sub-scroll { -ms-overflow-style: none; scrollbar-width: none }
        .card-tap:active { transform: scale(0.97) }
      `}</style>

      <div
        id="vl-scroll"
        style={{
          background: deepspace,
          minHeight: '100vh',
          overflowY: 'auto',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          paddingBottom: 100,
        }}
      >

        {/* ── PROFILE SWITCHER ── */}
        <div style={{
          padding: '16px 16px 0',
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: 1.5, marginBottom: 10,
            textTransform: 'uppercase',
          }}>
            Who is learning today?
          </div>

          {loading ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <Skeleton h={56} radius={16} />
              <Skeleton h={56} radius={16} />
            </div>
          ) : children.length === 0 ? (
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 14, padding: 16,
              color: 'rgba(255,255,255,0.4)',
              fontSize: 13, textAlign: 'center',
            }}>
              No children linked yet
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}
              className="sub-scroll">
              {children.map((child) => {
                const active = activeChild?.student_id === child.student_id
                const initial = child.name[0].toUpperCase()
                return (
                  <button
                    key={child.student_id}
                    onClick={() => switchChild(child)}
                    style={{
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: active
                        ? `linear-gradient(135deg, ${accent}22, ${accent}11)`
                        : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${active ? accent : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 14, padding: '10px 14px',
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: active ? accent : 'rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16, fontWeight: 900, color: '#fff',
                      flexShrink: 0,
                      boxShadow: active ? `0 0 12px ${accent}66` : 'none',
                    }}>
                      {initial}
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{
                        fontSize: 13, fontWeight: 800,
                        color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                      }}>
                        {child.name.split(' ')[0]}
                      </div>
                      <div style={{
                        fontSize: 10,
                        color: active ? accent : 'rgba(255,255,255,0.3)',
                        fontWeight: 600,
                      }}>
                        {child.class_name}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── HERO ── */}
        {activeChild && (
          <div style={{
            margin: '16px 16px 0',
            background: `linear-gradient(135deg, ${dark} 0%, #1a1040 100%)`,
            borderRadius: 20, padding: '20px',
            border: '1px solid rgba(255,255,255,0.07)',
            animation: 'fadeIn 0.4s ease',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 140, height: 140, borderRadius: '50%',
              background: `radial-gradient(circle, ${accent}15, transparent)`,
            }} />
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: 1, marginBottom: 6,
              textTransform: 'uppercase',
            }}>
              {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{
              fontSize: 22, fontWeight: 900,
              color: '#fff', lineHeight: 1.2, marginBottom: 4,
            }}>
              {"What are we conquering today,"}
            </div>
            <div style={{
              fontSize: 26, fontWeight: 900,
              color: accent, marginBottom: 16,
            }}>
              {first}? 🚀
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 10 }}>
              {/* Flame */}
              <div style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '10px 12px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{
                  fontSize: 18,
                  animation: streak > 0 ? 'pulse 2s infinite' : 'none',
                }}>🔥</div>
                <div style={{
                  fontSize: 18, fontWeight: 900,
                  color: amber, fontFamily: 'monospace',
                }}>
                  {streak}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                  DAY STREAK
                </div>
              </div>

              {/* Points */}
              <div style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '10px 12px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ fontSize: 18 }}>⚡</div>
                <div style={{
                  fontSize: 18, fontWeight: 900,
                  color: accent, fontFamily: 'monospace',
                }}>
                  {points.toLocaleString()}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                  POINTS
                </div>
              </div>

              {/* Rank */}
              <div style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '10px 12px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ fontSize: 18 }}>{rank.emoji}</div>
                <div style={{
                  fontSize: 13, fontWeight: 900,
                  color: rank.color,
                }}>
                  {rank.label}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                  RANK
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STICKY SUBJECT TABS ── */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: scrolled ? deepspace : 'transparent',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
          transition: 'background 0.25s ease, border-color 0.25s ease',
          padding: '12px 0 8px',
        }}>
          {scrolled && (
            <div style={{
              padding: '0 16px 8px',
              fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.5)',
            }}>
              {first} — {rank.emoji} {rank.label}
            </div>
          )}
          <div
            className="sub-scroll"
            style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px' }}
          >
            {SUBJECTS.map((sub) => {
              const active = activeSubject === sub.id
              return (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubject(sub.id)}
                  style={{
                    flexShrink: 0,
                    background: active ? sub.color : 'rgba(255,255,255,0.05)',
                    color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                    border: `1.5px solid ${active ? sub.color : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 999,
                    padding: '7px 14px',
                    fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s ease',
                    boxShadow: active ? `0 0 12px ${sub.color}44` : 'none',
                  }}
                >
                  {sub.emoji} {sub.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── CONTENT GRID ── */}
        <div style={{ padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: 1.5, marginBottom: 12,
            textTransform: 'uppercase',
          }}>
            {activeSubject === 'all' ? "Today's Universe" : SUBJECTS.find(s => s.id === activeSubject)?.label + " World"}
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[1,2,3,4].map(i => <Skeleton key={i} h={160} radius={16} />)}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {content.map((item, i) => (
                <div key={i} className="card-tap">
                  <ContentCard
                    item={item}
                    childName={first}
                    onAction={handleAction}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── EMPTY STATE ── */}
        {!loading && !activeChild && (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            animation: 'fadeIn 0.3s ease',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              No learner selected
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
              Link a child to get started
            </div>
            <button
              onClick={() => router.push('/parent/link-child')}
              style={{
                background: accent, color: '#fff',
                border: 'none', borderRadius: 12,
                padding: '12px 24px',
                fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Link a Child →
            </button>
          </div>
        )}

      </div>

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%',
          transform: 'translateX(-50%)',
          background: dark, color: '#fff',
          padding: '12px 24px', borderRadius: 40,
          fontSize: 13, fontWeight: 600,
          zIndex: 9999, whiteSpace: 'nowrap',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          animation: 'slideUp 0.25s ease',
        }}>
          {toast}
        </div>
      )}
    </>
  )
}
