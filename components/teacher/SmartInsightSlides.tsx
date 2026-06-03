"use client";
'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Student {
  id:             string
  name:           string
  className:      string
  attendanceDays: number
  hwStatus:       string
  recentlyAbsent: boolean
}

function StatRow({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: accent ?? '#fff' }}>{value}</span>
    </div>
  )
}

export default function SmartInsightSlides() {
  const router        = useRouter()
  const isMounted     = useRef(true)
  const slideRef      = useRef<HTMLDivElement>(null)
  const autoTimer     = useRef<NodeJS.Timeout | null>(null)
  const pauseTimer    = useRef<NodeJS.Timeout | null>(null)
  const studentTimer  = useRef<NodeJS.Timeout | null>(null)
  const userTouched   = useRef(false)

  useEffect(() => { return () => { isMounted.current = false } }, [])

  const [activeSlide,    setActiveSlide]    = useState(0)
  const [students,       setStudents]       = useState<Student[]>([])
  const [studentIndex,   setStudentIndex]   = useState(0)
  const [story,          setStory]          = useState<string>('')
  const [fact,           setFact]           = useState<string>('')
  const [storyLoading,   setStoryLoading]   = useState(true)
  const [factLoading,    setFactLoading]    = useState(true)
  const [firstName,      setFirstName]      = useState('Teacher')

  // ── Load students ──────────────────────────────────────────────
  const loadStudents = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMounted.current) return

      const today = new Date().toISOString().split('T')[0]

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      if (profile?.full_name && isMounted.current) {
        setFirstName(profile.full_name.split(' ')[0])
      }

      const { data: tcRows } = await supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('teacher_id', user.id)

      if (!tcRows || tcRows.length === 0) return

      const classIds = tcRows.map((r: { class_id: string }) => r.class_id)

      const { data: studentRows } = await supabase
        .from('students')
        .select('id, name, class_id')
        .in('class_id', classIds)

      if (!studentRows || !isMounted.current) return

      const studentIds = studentRows.map((s: { id: string }) => s.id)

      const [attRes, hwRes, classRes] = await Promise.all([
        supabase.from('attendance').select('student_id, status, date').in('student_id', studentIds).order('date', { ascending: false }),
        supabase.from('homework_submissions').select('student_id, status').in('student_id', studentIds).order('created_at', { ascending: false }),
        supabase.from('classes').select('id, name, stream').in('id', classIds),
      ])

      const classMap: Record<string, string> = {}
      ;(classRes.data ?? []).forEach((c: { id: string; name: string; stream: string | null }) => {
        classMap[c.id] = c.name + (c.stream ? ` ${c.stream}` : '')
      })

      const attMap: Record<string, { count: number; lastDate: string }> = {}
      ;(attRes.data ?? []).forEach((a: { student_id: string; status: string; date: string }) => {
        if (a.status === 'present') {
          if (!attMap[a.student_id]) attMap[a.student_id] = { count: 0, lastDate: a.date }
          attMap[a.student_id].count++
        }
      })

      const hwMap: Record<string, string> = {}
      ;(hwRes.data ?? []).forEach((h: { student_id: string; status: string }) => {
        if (!hwMap[h.student_id]) hwMap[h.student_id] = h.status
      })

      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

      const mapped: Student[] = studentRows.map((s: { id: string; name: string; class_id: string }) => {
        const att          = attMap[s.id]
        const lastDate     = att?.lastDate ? new Date(att.lastDate) : null
        const recentAbsent = !lastDate || lastDate < threeDaysAgo
        return {
          id:             s.id,
          name:           s.name,
          className:      classMap[s.class_id] ?? '',
          attendanceDays: att?.count ?? 0,
          hwStatus:       hwMap[s.id] ?? 'none',
          recentlyAbsent: recentAbsent,
        }
      })

      // Shuffle for variety
      const shuffled = [...mapped].sort(() => Math.random() - 0.5)
      if (isMounted.current) setStudents(shuffled)

    } catch {}
  }, [])

  // ── Call twin-chat ─────────────────────────────────────────────
  const callTwin = useCallback(async (prompt: string): Promise<string> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return ''

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/twin-chat`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages:  [{ role: 'user', content: prompt }],
            context:   'You are generating content for a teacher dashboard slide.',
            firstName,
          }),
        }
      )
      const data = await res.json()
      return data.reply ?? data.message ?? ''
    } catch {
      return ''
    }
  }, [firstName])

  // ── Load story ─────────────────────────────────────────────────
  const loadStory = useCallback(async () => {
    setStoryLoading(true)
    const result = await callTwin(
      'Tell me one short inspiring true story about a teacher or student in Africa — someone who overcame something real. 3 sentences max. No intro, no title, just the story. Make it feel human and emotional.'
    )
    if (isMounted.current) {
      setStory(result || "Every child who walks into your classroom carries a story you haven't heard yet. That's why you show up.")
      setStoryLoading(false)
    }
  }, [callTwin])

  // ── Load fact ──────────────────────────────────────────────────
  const loadFact = useCallback(async () => {
    setFactLoading(true)
    const result = await callTwin(
      'Give me one surprising fact a teacher would love to know — about the brain, learning, memory, students, or education in Africa. One or two sentences. Start directly with the fact, no intro. Make it feel like something they would screenshot and share.'
    )
    if (isMounted.current) {
      setFact(result || "Students who are greeted by name at the classroom door score 20% higher on engagement tests.")
      setFactLoading(false)
    }
  }, [callTwin])

  useEffect(() => {
    loadStudents()
    loadStory()
    loadFact()
  }, [loadStudents, loadStory, loadFact])

  // ── Rotate student every 20 minutes ───────────────────────────
  useEffect(() => {
    if (students.length === 0) return
    studentTimer.current = setInterval(() => {
      if (!isMounted.current) return
      setStudentIndex(i => (i + 1) % students.length)
    }, 20 * 60 * 1000)
    return () => { if (studentTimer.current) clearInterval(studentTimer.current) }
  }, [students])

  // ── Auto-scroll every 5s, pause on touch ──────────────────────
  const startAuto = useCallback(() => {
    if (autoTimer.current) clearInterval(autoTimer.current)
    autoTimer.current = setInterval(() => {
      if (!isMounted.current || userTouched.current) return
      if (!slideRef.current) return
      const total = 3
      setActiveSlide(prev => {
        const next = (prev + 1) % total
        slideRef.current?.scrollTo({ left: next * slideRef.current.offsetWidth, behavior: 'smooth' })
        return next
      })
    }, 5000)
  }, [])

  useEffect(() => {
    startAuto()
    return () => { if (autoTimer.current) clearInterval(autoTimer.current) }
  }, [startAuto])

  function onTouchStart() {
    userTouched.current = true
    if (pauseTimer.current) clearTimeout(pauseTimer.current)
    pauseTimer.current = setTimeout(() => {
      userTouched.current = false
    }, 8000)
  }

  function onScroll() {
    if (!slideRef.current) return
    setActiveSlide(Math.round(slideRef.current.scrollLeft / slideRef.current.offsetWidth))
  }

  const student = students[studentIndex] ?? null

  const slides = [
    // ── Slide 1: Student of the Moment ──
    {
      gradient:  'linear-gradient(135deg, #1e3a5f 0%, #1a2a4a 100%)',
      accent:    '#60c8f5',
      accentDim: 'rgba(96,200,245,0.12)',
      content: () => (
        <>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 20, background: 'rgba(96,200,245,0.12)', border: '1px solid rgba(96,200,245,0.2)', marginBottom: 14 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#60c8f5', letterSpacing: 0.8 }}>👤 Student of the Moment</span>
          </div>

          {!student ? (
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', padding: '20px 0' }}>No students assigned yet</div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{student.name}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{student.className}</div>
              </div>

              <StatRow
                label="Attendance days"
                value={student.attendanceDays > 0 ? `${student.attendanceDays} days 🔥` : 'No records yet'}
                accent={student.attendanceDays >= 5 ? '#34d399' : '#fbbf24'}
              />
              <StatRow
                label="Last homework"
                value={student.hwStatus === 'submitted' ? 'Submitted ✓' : student.hwStatus === 'late' ? 'Late ⚠' : student.hwStatus === 'missing' ? 'Missing ✗' : 'No record'}
                accent={student.hwStatus === 'submitted' ? '#34d399' : student.hwStatus === 'missing' ? '#f87171' : '#fbbf24'}
              />
              {student.recentlyAbsent && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}>
                  <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>⚠ Haven't seen them recently — check in today</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  onClick={() => router.push('/teacher/students')}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1.5px solid rgba(96,200,245,0.4)', background: 'rgba(96,200,245,0.1)', color: '#60c8f5', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  View Profile →
                </button>
                <button
                  onClick={() => setStudentIndex(i => (i + 1) % students.length)}
                  style={{ padding: '10px 14px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Next ↻
                </button>
              </div>
            </>
          )}
        </>
      ),
    },

    // ── Slide 2: VibeLearn Story ──
    {
      gradient:  'linear-gradient(135deg, #1a2a1a 0%, #0f3d1f 50%, #0a2010 100%)',
      accent:    '#4ade80',
      accentDim: 'rgba(74,222,128,0.12)',
      content: () => (
        <>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 20, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.2)', marginBottom: 14 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#4ade80', letterSpacing: 0.8 }}>📖 VibeLearn Story</span>
          </div>

          {storyLoading ? (
            <div style={{ padding: '20px 0' }}>
              <div style={{ height: 14, borderRadius: 8, background: 'rgba(255,255,255,0.08)', marginBottom: 10 }} />
              <div style={{ height: 14, borderRadius: 8, background: 'rgba(255,255,255,0.06)', marginBottom: 10, width: '85%' }} />
              <div style={{ height: 14, borderRadius: 8, background: 'rgba(255,255,255,0.04)', width: '70%' }} />
            </div>
          ) : (
            <>
              <div style={{ fontSize: 15, color: '#fff', lineHeight: 1.7, fontWeight: 400, marginBottom: 20, fontStyle: 'italic' }}>
                "{story}"
              </div>
              <button
                onClick={loadStory}
                style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: '1.5px solid rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Another Story ↻
              </button>
            </>
          )}
        </>
      ),
    },

    // ── Slide 3: Knowledge Reel ──
    {
      gradient:  'linear-gradient(135deg, #2d1b4e 0%, #3b1f6b 50%, #1a0f2e 100%)',
      accent:    '#a78bfa',
      accentDim: 'rgba(167,139,250,0.12)',
      content: () => (
        <>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 20, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)', marginBottom: 14 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', letterSpacing: 0.8 }}>⚡ Did You Know</span>
          </div>

          {factLoading ? (
            <div style={{ padding: '20px 0' }}>
              <div style={{ height: 14, borderRadius: 8, background: 'rgba(255,255,255,0.08)', marginBottom: 10 }} />
              <div style={{ height: 14, borderRadius: 8, background: 'rgba(255,255,255,0.06)', width: '80%' }} />
            </div>
          ) : (
            <>
              <div style={{ fontSize: 17, color: '#fff', lineHeight: 1.65, fontWeight: 700, marginBottom: 20 }}>
                {fact}
              </div>
              <button
                onClick={loadFact}
                style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: '1.5px solid rgba(167,139,250,0.4)', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Next Fact ↻
              </button>
            </>
          )}
        </>
      ),
    },
  ]

  return (
    <div style={{ marginBottom: 24 }}>
      <style>{`
        .insight-hook::-webkit-scrollbar { display: none; }
        .insight-hook { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>

      <div
        ref={slideRef}
        className="insight-hook"
        onScroll={onScroll}
        onTouchStart={onTouchStart}
        style={{
          display:                 'flex',
          overflowX:               'auto',
          scrollSnapType:          'x mandatory',
          WebkitOverflowScrolling: 'touch',
          gap:                     0,
        }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            style={{
              scrollSnapAlign: 'start',
              flexShrink:      0,
              width:           '100%',
              background:      slide.gradient,
              borderRadius:    20,
              padding:         '22px 20px 20px',
              boxShadow:       '0 8px 32px rgba(0,0,0,0.2)',
              position:        'relative',
              overflow:        'hidden',
            }}
          >
            <div style={{ position: 'absolute', bottom: -50, right: -30, width: 160, height: 160, borderRadius: '50%', background: slide.accentDim, pointerEvents: 'none' }} />
            {slide.content()}
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {slides.map((_, i) => (
          <div
            key={i}
            onClick={() => {
              slideRef.current?.scrollTo({ left: i * (slideRef.current.offsetWidth), behavior: 'smooth' })
              setActiveSlide(i)
            }}
            style={{
              width:        i === activeSlide ? 20 : 6,
              height:       6,
              borderRadius: 3,
              background:   i === activeSlide ? '#1e1b4b' : '#e5e7eb',
              transition:   'all 0.25s ease',
              cursor:       'pointer',
            }}
          />
        ))}
      </div>
    </div>
  )
}
