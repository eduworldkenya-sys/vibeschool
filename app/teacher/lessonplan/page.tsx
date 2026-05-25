'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, SectionLabel, Btn, C, ReadinessChip } from '@/components/teacher/ui'
import LessonPlanModal from '@/components/teacher/LessonPlanModal'
import type { TimetableSlot, PlanStatus } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────────────────
interface PlanRow {
  id:         string
  classId:    string
  subjectId:  string
  title:      string
  body:       string
  dayOfWeek:  number
  weekStart:  string
}

interface SlotWithPlan {
  slot:    TimetableSlot
  plan:    PlanRow | null
  status:  PlanStatus
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function getWeekStart() {
  const d    = new Date()
  const day  = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon  = new Date(d.setDate(diff))
  return mon.toISOString().split('T')[0]
}

function offsetWeek(start: string, days: number) {
  const d = new Date(start + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function Skeleton({ h = 72 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
function LessonPlanInner() {

  const [weekStart, setWeekStart] = useState(getWeekStart())
  const router       = useRouter()
  const searchParams = useSearchParams()
  const urlClassId   = searchParams.get('classId')

  const [items,       setItems]       = useState<SlotWithPlan[]>([])
  const [loading,     setLoading]     = useState(true)
  const [activeSlot,  setActiveSlot]  = useState<TimetableSlot | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [slotsRes, plansRes] = await Promise.all([
        supabase
          .from('timetable_slots')
          .select(`
            id, start_time, end_time, room, class_id, subject_id, day_of_week,
            subjects ( name ),
            classes  ( name, stream )
          `)
          .eq('teacher_id', user.id)
          .order('start_time', { ascending: true }),

        supabase
          .from('lesson_plans')
          .select('id, class_id, subject_id, title, body, day_of_week, week_start')
          .eq('teacher_id', user.id)
          .eq('week_start', weekStart),
      ])

      // Index plans by class_id+day_of_week for O(1) lookup
      const planMap = new Map<string, PlanRow>()
      ;(plansRes.data ?? []).forEach(p => {
        const key = `${p.class_id}:${p.day_of_week}`
        planMap.set(key, {
          id:        p.id,
          classId:   p.class_id,
          subjectId: p.subject_id,
          title:     p.title ?? '',
          body:      p.body  ?? '',
          dayOfWeek: p.day_of_week,
          weekStart: p.week_start,
        })
      })

      const mapped: SlotWithPlan[] = (slotsRes.data ?? []).map(s => {
        const sub = (s.subjects as unknown as { name: string } | null)?.name ?? 'Unknown'
        const cls = s.classes as unknown as { name: string; stream: string | null } | null
        const className = cls ? cls.name + (cls.stream ? ` ${cls.stream}` : '') : ''

        const slot: TimetableSlot = {
          id:               s.id,
          subject:          sub,
          class:            className,
          room:             s.room ?? '',
          start:            s.start_time,
          end:              s.end_time,
          period:           0,
          status:           'scheduled',
          planStatus:       'green',
          attendanceMarked: false,
          class_id:         s.class_id,
          subject_id:       s.subject_id,

        }

        const plan   = planMap.get(`${s.class_id}:${s.day_of_week}`) ?? null
        const status: PlanStatus = plan ? 'green' : 'red'

        return { slot, plan, status }
      })

      setItems(mapped)
      setLoading(false)
    }

    load()
  }, [weekStart])

  const readyCount   = items.filter(i => i.status === 'green').length
  const missingCount = items.filter(i => i.status === 'red').length

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      {/* Hero */}
      <div style={{
        background:   'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        borderRadius: 20,
        padding:      '20px',
        marginBottom: 14,
        color:        '#fff',
      }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
          Lesson Plans
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
          Today's Plans
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
          Week of {weekStart} · Linked to your timetable.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <button onClick={() => setWeekStart(w => offsetWeek(w, -7))} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← Prev</button>
          <button onClick={() => setWeekStart(getWeekStart())} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Today</button>
          <button onClick={() => setWeekStart(w => offsetWeek(w, 7))} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Next →</button>
        </div>
        <div style={{ display: 'none' }}>
        </div>
        {urlClassId && (
          <button
            onClick={() => router.push('/teacher/classhub/' + urlClassId)}
            style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ← View Class
          </button>
        )}

        {/* Summary strip */}
        {!loading && items.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {[
              { label: 'Ready',   value: readyCount,   bg: 'rgba(16,185,129,0.25)'  },
              { label: 'Missing', value: missingCount, bg: 'rgba(239,68,68,0.25)'   },
              { label: 'Total',   value: items.length, bg: 'rgba(255,255,255,0.12)' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's slots */}
      <Card>
        <SectionLabel>Today & Upcoming</SectionLabel>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: C.textMuted }}>
            No classes scheduled today
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map(({ slot, plan, status }) => (
              <div
                key={slot.id}
                style={{
                  display:       'flex',
                  alignItems:    'center',
                  gap:           12,
                  padding:       '13px 0',
                  borderBottom:  `1px solid ${C.border}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
                    {plan?.title || `${slot.subject} — No plan yet`}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                    {slot.class} · {formatTime(slot.start)}–{formatTime(slot.end)}
                    {slot.room ? ` · ${slot.room}` : ''}
                  </div>
                  {plan?.body ? (
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {plan.body}
                    </div>
                  ) : null}
                </div>
                <ReadinessChip status={status} />
                <Btn
                  small
                  variant="ghost"
                  onClick={() => setActiveSlot(slot)}
                >
                  View
                </Btn>
                {plan && (
                  <Btn small onClick={async () => {
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user) return
                    await supabase.from('teacher_content').insert({
                      teacher_id:   user.id,
                      class_id:     slot.class_id,
                      subject_id:   slot.subject_id,
                      type:         'notes',
                      title:        plan.title,
                      body:         plan.body,
                      published:    true,
                      published_at: new Date().toISOString(),
                    })
                  }}>📤 Publish</Btn>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Differentiation summary */}
      <Card>
        <SectionLabel>Differentiation Summary</SectionLabel>
        {[
          { level: 'Higher',   color: '#7c3aed', bg: '#ede9fe', desc: "Multi-step and extension tasks"     },
          { level: 'On Track', color: C.accent,  bg: C.accentLight, desc: "Core curriculum delivery"           },
          { level: 'Support',  color: C.warning, bg: '#fef3c7', desc: "Scaffolded and visual methods"      },
        ].map(d => (
          <div
            key={d.level}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          12,
              padding:      '10px 12px',
              borderRadius: 10,
              background:   d.bg,
              marginBottom: 8,
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: d.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0,
            }}>
              {items.filter(i => i.status === 'green').length}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: d.color }}>{d.level}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{d.desc}</div>
            </div>
          </div>
        ))}
      </Card>

      {/* Lesson plan modal */}
      {activeSlot && (
        <LessonPlanModal
          slot={activeSlot}
          onClose={() => setActiveSlot(null)}
        />
      )}
    </>
  )
}
export default function LessonPlanPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontSize: 13, color: C.textMuted }}>Loading…</div>}>
      <LessonPlanInner />
    </Suspense>
  )
}
