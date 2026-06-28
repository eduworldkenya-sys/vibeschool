"use client";
import { nairobiDateStr } from '@/lib/time'
export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, SectionLabel, Btn, C } from '@/components/teacher/ui'
import LessonPlanModal from '@/components/teacher/LessonPlanModal'
import type { TimetableSlot } from '@/lib/types'

type LPStatus = 'draft' | 'published' | 'shared_to_parents' | 'missing'

interface PlanRow {
  id: string
  classId: string
  subjectId: string
  title: string
  body: string
  topic: string
  dayOfWeek: number
  weekStart: string
  status: LPStatus
}

interface SlotWithPlan {
  slot: TimetableSlot
  plan: PlanRow | null
}

interface HistoryRow {
  id: string
  title: string
  topic: string
  created_at: string
  status: string
  class_name: string
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h % 12 || 12 + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM')
}

function getWeekStart() {
  const d = new Date()
  const day = d.getDay()
  const mon = new Date(d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)))
  return nairobiDateStr(mon)
}

function offsetWeek(start: string, days: number) {
  const d = new Date(start + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return nairobiDateStr(d)
}

function Skeleton({ h = 72 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  draft:             { label: 'Draft',             bg: '#f3f4f6', color: '#6b7280' },
  published:         { label: 'Published',         bg: '#d1fae5', color: '#065f46' },
  shared_to_parents: { label: 'Shared to Parents', bg: '#dbeafe', color: '#1e40af' },
  missing:           { label: 'No Plan',           bg: '#fee2e2', color: '#991b1b' },
}

function LessonPlanInner() {
  const [weekStart,   setWeekStart]   = useState(getWeekStart())
  const router                        = useRouter()
  const urlClassId                    = useSearchParams().get('classId')
  const [items,       setItems]       = useState<SlotWithPlan[]>([])
  const [history,     setHistory]     = useState<HistoryRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [histLoading, setHistLoading] = useState(true)
  const [activeSlot,  setActiveSlot]  = useState<TimetableSlot | null>(null)
  const [toast,       setToast]       = useState('')
  const [schoolId,    setSchoolId]    = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Resolve schoolId — same 3-source fallback used in Assessment/Pulse
      const [memberRes, teacherRes, profileRes] = await Promise.all([
        supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('teacher_profiles').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('profiles').select('school_id').eq('id', user.id).maybeSingle(),
      ])
      const resolvedSchoolId =
        memberRes.data?.school_id ??
        teacherRes.data?.school_id ??
        profileRes.data?.school_id ??
        null
      setSchoolId(resolvedSchoolId)

      const [slotsRes, plansRes] = await Promise.all([
        supabase.from('timetable_slots')
          .select('id,start_time,end_time,room,class_id,subject_id,day_of_week')
          .eq('teacher_id', user.id)
          .order('start_time', { ascending: true }),
        supabase.from('lesson_plans')
          .select('id,class_id,subject_id,title,body,topic,day_of_week,week_start,status')
          .eq('teacher_id', user.id)
          .eq('week_start', weekStart),
      ])

      const planMap = new Map<string, PlanRow>()
      for (const p of plansRes.data ?? []) {
        planMap.set(p.class_id + ':' + p.subject_id + ':' + p.day_of_week, {
          id: p.id, classId: p.class_id, subjectId: p.subject_id,
          title: p.title ?? '', body: p.body ?? '', topic: p.topic ?? '',
          dayOfWeek: p.day_of_week, weekStart: p.week_start,
          status: (p.status ?? 'draft') as LPStatus,
        })
      }

      const slots = slotsRes.data ?? []
      const subjectIds = Array.from(new Set(slots.map((s: any) => s.subject_id).filter(Boolean)))
      const classIds   = Array.from(new Set(slots.map((s: any) => s.class_id).filter(Boolean)))
      const [subjRes, clsRes] = await Promise.all([
        subjectIds.length > 0 ? supabase.from('subjects').select('id,name').in('id', subjectIds) : Promise.resolve({ data: [] }),
        classIds.length > 0   ? supabase.from('classes').select('id,name,stream').in('id', classIds) : Promise.resolve({ data: [] }),
      ])
      const subjMap = Object.fromEntries((subjRes.data ?? []).map((s: any) => [s.id, s.name]))
      const clsMap  = Object.fromEntries((clsRes.data ?? []).map((c: any) => [c.id, c.name + (c.stream ? ' ' + c.stream : '')]))

      const mapped: SlotWithPlan[] = slots.map((s: any) => {
        const slot: TimetableSlot = {
          id: s.id, subject: subjMap[s.subject_id] ?? 'Unknown',
          class: clsMap[s.class_id] ?? '',
          room: s.room ?? '', start: s.start_time, end: s.end_time,
          period: 0, status: 'scheduled', planStatus: 'green', attendanceMarked: false,
          class_id: s.class_id, subject_id: s.subject_id,
        }
        return { slot, plan: planMap.get(s.class_id + ':' + s.subject_id + ':' + s.day_of_week) ?? null }
      })

      setItems(mapped)
      setLoading(false)
    }
    load()
  }, [weekStart])

  useEffect(() => {
    async function loadHistory() {
      setHistLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      let q = supabase
        .from('lesson_plans')
        .select('id,title,topic,created_at,status,classes(name,stream)')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15)
      if (urlClassId) q = q.eq('class_id', urlClassId)
      const { data } = await q
      setHistory((data ?? []).map((h: any) => ({
        id: h.id, title: h.title, topic: h.topic,
        created_at: h.created_at, status: h.status,
        class_name: h.classes ? h.classes.name + (h.classes.stream ? ' ' + h.classes.stream : '') : '',
      })))
      setHistLoading(false)
    }
    loadHistory()
  }, [urlClassId, activeSlot])

  const readyCount   = items.filter(i => i.plan).length
  const missingCount = items.filter(i => !i.plan).length
  const isThisWeek   = weekStart === getWeekStart()

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          zIndex: 999, background: '#1e1b4b', color: '#fff',
          padding: '10px 20px', borderRadius: 20, fontSize: 13, fontWeight: 700,
          animation: 'fadeIn 0.2s ease', whiteSpace: 'nowrap',
        }}>{toast}</div>
      )}

      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        borderRadius: 20, padding: '20px', marginBottom: 14, color: '#fff',
      }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Lesson Plans</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{isThisWeek ? "Today's Plans" : 'Week of ' + weekStart}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>Week of {weekStart} · Linked to your timetable.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => setWeekStart(w => offsetWeek(w, -7))} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← Prev</button>
          <button onClick={() => setWeekStart(getWeekStart())} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: isThisWeek ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Today</button>
          <button onClick={() => setWeekStart(w => offsetWeek(w, 7))} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Next →</button>
        </div>
        {urlClassId && (
          <button onClick={() => router.push('/teacher/classhub/' + urlClassId)} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>← View Class</button>
        )}
        {!loading && (
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {[
              { label: 'Ready',   value: readyCount,   bg: 'rgba(16,185,129,0.25)' },
              { label: 'Missing', value: missingCount, bg: 'rgba(239,68,68,0.25)'  },
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

      <Card>
        <SectionLabel>Today &amp; Upcoming</SectionLabel>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1,2,3].map(i => <Skeleton key={i} />)}</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: C.textMuted }}>No classes scheduled</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map(({ slot, plan }) => {
              const badge = STATUS_BADGE[plan?.status ?? 'missing']
              return (
                <div key={slot.id} style={{ padding: '14px 0', borderBottom: '1px solid ' + C.border }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
                        {plan?.topic || plan?.title || slot.subject + ' — No plan yet'}
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                        {slot.class} · {formatTime(slot.start)}–{formatTime(slot.end)}{slot.room ? ' · ' + slot.room : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: badge.bg, color: badge.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{badge.label}</span>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <Btn small variant="ghost" onClick={() => setActiveSlot(slot)}>
                      {plan ? '📝 Open Plan' : '✦ Create Plan'}
                    </Btn>
                    {(plan?.status === 'published' || plan?.status === 'shared_to_parents') && (
                      <Btn small variant="ghost" onClick={() => router.push(`/teacher/lessonnotes?planId=${plan.id}&classId=${plan.classId}&subjectId=${plan.subjectId}`)}>
                        ✓ Mark as Taught
                      </Btn>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card>
        <SectionLabel>Differentiation Summary</SectionLabel>
        {(() => {
          const published  = items.filter(i => i.plan?.status === 'published' || i.plan?.status === 'shared_to_parents').length
          const draft      = items.filter(i => i.plan?.status === 'draft').length
          const noPlan     = items.filter(i => !i.plan).length
          return [
            { level: 'Published', color: '#7c3aed', bg: '#ede9fe', desc: 'Published or shared plans', count: published },
            { level: 'Draft',     color: C.accent,  bg: C.accentLight, desc: 'Plans saved as draft', count: draft },
            { level: 'Missing',   color: '#d97706', bg: '#fef3c7', desc: 'Slots with no plan yet',  count: noPlan },
          ].map(d => (
            <div key={d.level} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: d.bg, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{d.count}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: d.color }}>{d.level}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{d.desc}</div>
              </div>
            </div>
          ))
        })()}
      </Card>

      <Card>
        <SectionLabel>Plan History</SectionLabel>
        {histLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <Skeleton key={i} h={48} />)}</div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: C.textMuted }}>No past plans yet</div>
        ) : (
          <div>
            {history.map((h, i) => {
              const badge = STATUS_BADGE[h.status ?? 'draft']
              return (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid ' + C.border }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.topic || h.title || 'Untitled'}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {h.class_name} · {new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: badge.bg, color: badge.color, whiteSpace: 'nowrap', marginLeft: 8 }}>{badge.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {activeSlot && (
        <LessonPlanModal slot={activeSlot} onClose={() => setActiveSlot(null)} />
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
