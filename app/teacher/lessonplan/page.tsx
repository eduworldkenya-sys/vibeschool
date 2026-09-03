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

type ReadinessState = 'ready' | 'needs_review' | 'no_plan'
type ReadinessFilter = 'all' | ReadinessState

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
  status: string | null
  curriculum_id: string | null
  strand_id: string | null
  classes: HistoryClassRow | HistoryClassRow[] | null
  curriculum: HistoryCurriculumRow | HistoryCurriculumRow[] | null
}

function firstJoin<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function historyStatus(value: string | null): HistoryRow['status'] {
  if (value === 'published' || value === 'shared_to_parents') return value
  return 'draft'
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
}

const READINESS_BADGE: Record<ReadinessState, { label: string; bg: string; color: string }> = {
  ready:        { label: 'Ready to Teach', bg: '#d1fae5', color: '#065f46' },
  needs_review: { label: 'Needs Review',   bg: '#fef3c7', color: '#92400e' },
  no_plan:      { label: 'No Plan',        bg: '#fee2e2', color: '#991b1b' },
}

function readinessState(plan: PlanRow | null): ReadinessState {
  if (!plan) return 'no_plan'
  return isLessonPlanReadyToTeach(plan.body) ? 'ready' : 'needs_review'
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
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>('all')
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
          id: h.id,
          title: h.title ?? '',
          topic: h.topic ?? '',
          created_at: h.created_at,
          status: historyStatus(h.status),
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

  const readyCount = items.filter(({ plan }) => readinessState(plan) === 'ready').length
  const needsReviewCount = items.filter(({ plan }) => readinessState(plan) === 'needs_review').length
  const noPlanCount = items.filter(({ plan }) => readinessState(plan) === 'no_plan').length
  const isThisWeek = weekStart === nairobiWeekStart()

  const visibleItems = items.filter(({ plan }) => {
    if (readinessFilter === 'all') return true
    return readinessState(plan) === readinessFilter
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
              { label: 'Ready to Teach', value: readyCount,       bg: 'rgba(16,185,129,0.25)' },
              { label: 'Needs Review',   value: needsReviewCount, bg: 'rgba(245,158,11,0.25)' },
              { label: 'No Plan',        value: noPlanCount,      bg: 'rgba(239,68,68,0.25)' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{s.label}</div>
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
          {readinessFilter !== 'all' && (
            <button
              onClick={() => setReadinessFilter('all')}
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
          <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: C.textMuted }}>No lessons match this readiness filter</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visibleItems.map(({ slot, plan }) => {
              const state = readinessState(plan)
              const badge = READINESS_BADGE[state]
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
                      {plan && (
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                          Plan status: {STATUS_BADGE[plan.status]?.label ?? 'Draft'}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: badge.bg, color: badge.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{badge.label}</span>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <Btn small variant="ghost" onClick={() => setActiveSlot(slot)}>
                      {state === 'no_plan' ? '✦ Create Plan' : state === 'needs_review' ? '📝 Review Plan' : '📝 Open Teaching Workspace'}
                    </Btn>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card>
        <SectionLabel>Plan Readiness</SectionLabel>
        {loadError ? (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: '#991b1b' }}>{loadError}</div>
        ) : (
          [
            {
              key: 'ready' as const,
              level: 'Ready to Teach',
              color: '#047857',
              bg: '#d1fae5',
              desc: 'The saved plan passes the teaching-readiness checks.',
              count: readyCount,
            },
            {
              key: 'needs_review' as const,
              level: 'Needs Review',
              color: '#92400e',
              bg: '#fef3c7',
              desc: 'A plan exists, but one or more teaching-readiness checks are incomplete.',
              count: needsReviewCount,
            },
            {
              key: 'no_plan' as const,
              level: 'No Plan',
              color: '#991b1b',
              bg: '#fee2e2',
              desc: 'No saved plan exists for this timetable occurrence.',
              count: noPlanCount,
            },
          ].map(d => (
            <div
              key={d.level}
              onClick={() => setReadinessFilter(f => f === d.key ? 'all' : d.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
                background: d.bg, marginBottom: 8, cursor: 'pointer',
                border: '2px solid ' + (readinessFilter === d.key ? d.color : 'transparent'),
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{d.count}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: d.color }}>{d.level}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{d.desc}</div>
              </div>
            </div>
          ))
        )}
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
              const badge = STATUS_BADGE[h.status ?? 'draft'] ?? STATUS_BADGE.draft
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