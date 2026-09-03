"use client";
import { nairobiDateAdd, nairobiWeekStart } from '@/lib/time'
import { loadTeacherTimetableForRange } from '@/lib/timetable/engine'
import type { CanonicalTimetableSlot } from '@/lib/timetable/engine'
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, SectionLabel, Btn, C } from '@/components/teacher/ui'
import LessonPlanModal from '@/components/teacher/LessonPlanModal'
import { isLessonPlanReadyToTeach } from '@/lib/teaching/lessonReadiness'
import type { TimetableSlot, PlanRow, HistoryRow } from '@/lib/types'

interface SlotWithPlan {
  slot: TimetableSlot
  plan: PlanRow | null
}

interface TeacherOperatingContext {
  school_id: string | null
}

interface SubjectLookupRow {
  id: string
  name: string
}

interface ClassLookupRow {
  id: string
  name: string
  stream: string | null
}

interface HistoryClassRow {
  name: string
  stream: string | null
}

interface HistoryCurriculumRow {
  week: number | null
  term: number | null
  strand: string | null
}

interface HistoryQueryRow {
  id: string
  title: string | null
  topic: string | null
  created_at: string
  status: HistoryRow['status']
  curriculum_id: string | null
  strand_id: string | null
  classes: HistoryClassRow | HistoryClassRow[] | null
  curriculum: HistoryCurriculumRow | HistoryCurriculumRow[] | null
}

function firstJoin<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
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

function hasDifferentiation(body: string): boolean {
  const m = body.match(/<differentiation>([\s\S]*?)<\/differentiation>/)
  return !!(m && m[1].trim().length > 0)
}

function weekStartForDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return nairobiWeekStart()

  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(parsed.getTime())) return nairobiWeekStart()

  const mondayOffset = (parsed.getUTCDay() + 6) % 7
  return nairobiDateAdd(date, -mondayOffset)
}

function LessonPlanInner() {
  const searchParams                  = useSearchParams()
  const router                        = useRouter()
  const urlClassId                    = searchParams.get('classId')
  const urlSubjectId                  = searchParams.get('subjectId')
  const urlTimetableSlotId            = searchParams.get('timetableSlotId')
  const urlOccurrenceDate             = searchParams.get('date')
  const urlSchemeId                   = searchParams.get('schemeId')
  const [weekStart,   setWeekStart]   = useState(() =>
    urlOccurrenceDate ? weekStartForDate(urlOccurrenceDate) : nairobiWeekStart()
  )
  const [items,       setItems]       = useState<SlotWithPlan[]>([])
  const [history,     setHistory]     = useState<HistoryRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [histLoading, setHistLoading] = useState(true)
  const [activeSlot,  setActiveSlot]  = useState<TimetableSlot | null>(null)
  const [toast,       setToast]       = useState('')
  const [loadError,   setLoadError]   = useState<string | null>(null)
  const [diffFilter,  setDiffFilter]  = useState<'all' | 'published' | 'draft' | 'missing'>('all')
  const [refreshNonce, setRefreshNonce] = useState(0)
  const autoOpenedKeyRef = useRef<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError(null)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoadError('Please sign in to view lesson plans.')
        setLoading(false)
        return
      }

      const { data: contextData, error: contextError } = await supabase.rpc(
        'teacher_get_operating_context',
        {},
      )
      if (contextError) {
        console.error('[LessonPlan] operating context failed:', contextError)
        setLoadError('Could not load your teaching context.')
        setLoading(false)
        return
      }

      const operatingContext = contextData as TeacherOperatingContext | null
      const resolvedSchoolId = operatingContext?.school_id ?? null

      const weekEnd = nairobiDateAdd(weekStart, 6)

      if (!resolvedSchoolId) {
        setLoadError('Choose or connect a school before opening lesson plans.')
        setLoading(false)
        return
      }

      if (urlSchemeId && (!urlClassId || !urlSubjectId)) {
        setLoadError(
          'This Scheme lesson is missing its class or subject identity.',
        )
        setItems([])
        setLoading(false)
        return
      }

      let timetableSlots: CanonicalTimetableSlot[]

      try {
        timetableSlots = await loadTeacherTimetableForRange({
          teacherId: user.id,
          schoolId: resolvedSchoolId,
          rangeStart: weekStart,
          rangeEnd: weekEnd,
        })
      } catch (error) {
        console.error('[LessonPlan] canonical timetable range failed:', error)
        setLoadError('Could not load lesson plans.')
        setLoading(false)
        return
      }

      const plansRes = await supabase
        .from('lesson_plans')
        .select('id,class_id,subject_id,timetable_slot_id,title,body,topic,day_of_week,week_start,status,curriculum_id,strand_id')
        .eq('teacher_id', user.id)
        .eq('school_id', resolvedSchoolId)
        .eq('week_start', weekStart)

      if (plansRes.error) {
        console.error('[LessonPlan] lesson_plans query failed:', plansRes.error)
        setLoadError('Could not load lesson plans.')
        setLoading(false)
        return
      }

      const planMap = new Map<string, PlanRow>()
      for (const p of plansRes.data ?? []) {
        if (!p.timetable_slot_id) continue
        planMap.set(p.timetable_slot_id, {
          id: p.id, classId: p.class_id, subjectId: p.subject_id,
          title: p.title ?? '', body: p.body ?? '', topic: p.topic ?? '',
          dayOfWeek: p.day_of_week, weekStart: p.week_start,
          status: (p.status ?? 'draft') as PlanRow['status'],
          curriculumId: p.curriculum_id ?? null,
          strandId: p.strand_id ?? null,
        })
      }

      const slots = timetableSlots.filter(slot => {
        const occurrenceDate = nairobiDateAdd(weekStart, Number(slot.day_of_week) - 1)
        return (
          slot.effective_from <= occurrenceDate &&
          (slot.effective_until === null || slot.effective_until >= occurrenceDate)
        )
      })
      const subjectIds = Array.from(
        new Set(slots.map(s => s.subject_id).filter(Boolean))
      )
      const classIds = Array.from(
        new Set(slots.map(s => s.class_id).filter(Boolean))
      )
      const [subjRes, clsRes] = await Promise.all([
        subjectIds.length > 0
          ? supabase.from('subjects').select('id,name').in('id', subjectIds)
          : Promise.resolve({ data: [] as SubjectLookupRow[], error: null }),
        classIds.length > 0
          ? supabase.from('classes').select('id,name,stream').in('id', classIds)
          : Promise.resolve({ data: [] as ClassLookupRow[], error: null }),
      ])

      if (subjRes.error || clsRes.error) {
        console.error('[LessonPlan] lookup query failed:', subjRes.error ?? clsRes.error)
        setLoadError('Could not load class and subject names.')
        setLoading(false)
        return
      }

      const subjectRows = (subjRes.data ?? []) as SubjectLookupRow[]
      const classRows = (clsRes.data ?? []) as ClassLookupRow[]
      const subjMap = Object.fromEntries(subjectRows.map(s => [s.id, s.name]))
      const clsMap = Object.fromEntries(
        classRows.map(c => [c.id, c.name + (c.stream ? ' ' + c.stream : '')]),
      )

      const mapped: SlotWithPlan[] = slots.map(s => {
        const occurrenceDate = nairobiDateAdd(
          weekStart,
          Number(s.day_of_week) - 1,
        )

        const slot: TimetableSlot = {
          id: s.id,
          subject: subjMap[s.subject_id] ?? 'Unknown',
          class: clsMap[s.class_id] ?? '',
          room: s.room ?? '',
          start: s.start_time,
          end: s.end_time,
          status: 'scheduled',
          planStatus: 'green',
          attendanceMarked: false,
          class_id: s.class_id,
          subject_id: s.subject_id,
          day_of_week: s.day_of_week,
          occurrenceDate,
        }

        return {
          slot,
          plan: planMap.get(s.id) ?? null,
        }
      })

      const selectableItems = urlSchemeId
        ? mapped.filter(({ slot }) =>
            slot.class_id === urlClassId &&
            slot.subject_id === urlSubjectId
          )
        : mapped

      setItems(selectableItems)

      if (urlTimetableSlotId && urlOccurrenceDate) {
        const target = selectableItems.find(({ slot }) =>
          slot.id === urlTimetableSlotId &&
          slot.occurrenceDate === urlOccurrenceDate &&
          (!urlClassId || slot.class_id === urlClassId) &&
          (!urlSubjectId || slot.subject_id === urlSubjectId)
        )

        if (target) {
          const autoOpenKey = `${urlTimetableSlotId}:${urlOccurrenceDate}`
          if (autoOpenedKeyRef.current !== autoOpenKey) {
            autoOpenedKeyRef.current = autoOpenKey
            setActiveSlot(target.slot)
          }
        } else {
          setLoadError('The selected timetable lesson is no longer available for this date.')
        }
      }

      setLoading(false)
    }
    void load()
  }, [
    weekStart,
    urlClassId,
    urlSubjectId,
    urlTimetableSlotId,
    urlOccurrenceDate,
    urlSchemeId,
    refreshNonce,
  ])

  useEffect(() => {
    async function loadHistory() {
      setHistLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setHistLoading(false)
        return
      }
      let q = supabase
        .from('lesson_plans')
        .select('id,title,topic,created_at,status,curriculum_id,strand_id,classes(name,stream),curriculum(week,term,strand)')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15)
      if (urlClassId) q = q.eq('class_id', urlClassId)
      const { data, error } = await q
      if (error) {
        console.error('[LessonPlan] history query failed:', error)
        setHistory([])
        setHistLoading(false)
        return
      }
      setHistory(((data ?? []) as HistoryQueryRow[]).map(h => {
        const curr = firstJoin(h.curriculum)
        const classRow = firstJoin(h.classes)
        return {
          id: h.id, title: h.title, topic: h.topic,
          created_at: h.created_at, status: h.status,
          class_name: classRow ? classRow.name + (classRow.stream ? ' ' + classRow.stream : '') : '',
          curriculumId: h.curriculum_id ?? null,
          strandId: h.strand_id ?? null,
          week: curr?.week ?? null,
          term: curr?.term ?? null,
          strand: curr?.strand ?? null,
        }
      }))
      setHistLoading(false)
    }
    void loadHistory()
  }, [urlClassId, activeSlot, refreshNonce])

  const readyCount = items.filter(i => i.plan && isLessonPlanReadyToTeach(i.plan.body)).length
  const missingCount = items.length - readyCount
  const isThisWeek   = weekStart === nairobiWeekStart()

  const visibleItems = items.filter(({ plan }) => {
    if (diffFilter === 'all')       return true
    if (diffFilter === 'missing')   return !plan || !isLessonPlanReadyToTeach(plan.body)
    if (diffFilter === 'draft')     return !!plan && plan.status === 'draft'
    if (diffFilter === 'published') return !!plan && (plan.status === 'published' || plan.status === 'shared_to_parents')
    return true
  })

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
          <button onClick={() => setWeekStart(w => nairobiDateAdd(w, -7))} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← Prev</button>
          <button onClick={() => setWeekStart(nairobiWeekStart())} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: isThisWeek ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Today</button>
          <button onClick={() => setWeekStart(w => nairobiDateAdd(w, 7))} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Next →</button>
        </div>
        {urlClassId && (
          <button onClick={() => router.push('/teacher/classhub/' + urlClassId)} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>← View Class</button>
        )}
        {!loading && !loadError && (
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionLabel>
            {urlSchemeId
              ? 'Choose Timetable Occurrence'
              : 'Today & Upcoming'}
          </SectionLabel>
          {diffFilter !== 'all' && (
            <button
              onClick={() => setDiffFilter('all')}
              style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}
            >
              ✕ Clear filter
            </button>
          )}
        </div>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1,2,3].map(i => <Skeleton key={i} />)}</div>
        ) : loadError ? (
          <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: '#991b1b' }}>{loadError}</div>
        ) : items.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '28px 0',
            fontSize: 13,
            color: C.textMuted,
          }}>
            {urlSchemeId
              ? 'No matching timetable occurrence exists for this Scheme lesson in the selected week.'
              : 'No classes scheduled'}
          </div>
        ) : visibleItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: C.textMuted }}>No slots match this filter</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visibleItems.map(({ slot, plan }) => {
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
                      {plan ? '📝 Open Teaching Workspace' : '✦ Create Plan'}
                    </Btn>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card>
        <SectionLabel>Differentiation Summary</SectionLabel>
        {loadError ? (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: '#991b1b' }}>{loadError}</div>
        ) : (() => {
          const publishedItems = items.filter(i => i.plan?.status === 'published' || i.plan?.status === 'shared_to_parents')
          const draftItems     = items.filter(i => i.plan?.status === 'draft')
          const noPlan         = items.filter(i => !i.plan).length
          const publishedDiff  = publishedItems.filter(i => i.plan && hasDifferentiation(i.plan.body)).length
          const draftDiff      = draftItems.filter(i => i.plan && hasDifferentiation(i.plan.body)).length
          return [
            { key: 'published' as const, level: 'Published', color: '#7c3aed', bg: '#ede9fe', desc: 'Published or shared plans', count: publishedItems.length, diff: publishedDiff },
            { key: 'draft'     as const, level: 'Draft',     color: C.accent,  bg: C.accentLight, desc: 'Plans saved as draft', count: draftItems.length, diff: draftDiff },
            { key: 'missing'   as const, level: 'Missing',   color: '#d97706', bg: '#fef3c7', desc: 'Slots with no plan yet',  count: noPlan, diff: null },
          ].map(d => (
            <div
              key={d.level}
              onClick={() => setDiffFilter(f => f === d.key ? 'all' : d.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
                background: d.bg, marginBottom: 8, cursor: 'pointer',
                border: '2px solid ' + (diffFilter === d.key ? d.color : 'transparent'),
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{d.count}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: d.color }}>{d.level}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{d.desc}</div>
                {d.diff !== null && d.count > 0 && (
                  <div style={{ fontSize: 11, color: d.color, fontWeight: 700, marginTop: 2 }}>⚡ {d.diff} of {d.count} have differentiated activities</div>
                )}
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
                      {h.week != null && (
                        <span style={{ marginLeft: 6, fontWeight: 700, color: '#4338ca' }}>· 📘 Wk {h.week}{h.term != null ? ' T' + h.term : ''}</span>
                      )}
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
        <LessonPlanModal
          slot={activeSlot}
          weekStart={weekStart}
          taughtDate={activeSlot.occurrenceDate!}
          requestedSchemeId={urlSchemeId}
          onClose={() => {
            setActiveSlot(null)
            setRefreshNonce(value => value + 1)
            showToast('Lesson workspace updated')
          }}
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
