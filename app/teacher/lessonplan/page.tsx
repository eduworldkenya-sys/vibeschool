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
import nextDynamic from 'next/dynamic'
const LessonPlanModal = nextDynamic(() => import('@/components/teacher/LessonPlanModal'), { loading: () => <p role="status">Opening lesson workspace…</p> })
import { isLessonPlanReadyToTeach } from '@/lib/teaching/lessonReadiness'
import type { TimetableSlot, PlanRow, HistoryRow } from '@/lib/types'

interface SlotWithPlan {
  slot: TimetableSlot
  plan: PlanRow | null
  curriculumLinked: boolean
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
  ready:        { label: 'Ready', bg: '#d1fae5', color: '#065f46' },
  needs_review: { label: 'Needs review',   bg: '#fef3c7', color: '#92400e' },
  no_plan:      { label: 'No plan',        bg: '#fee2e2', color: '#991b1b' },
}

function readinessState(plan: PlanRow | null, curriculumLinked: boolean): ReadinessState {
  if (!plan) return 'no_plan'
  return curriculumLinked && isLessonPlanReadyToTeach(plan.body) ? 'ready' : 'needs_review'
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
  const [showHistory, setShowHistory] = useState(false)
  const [activeSlot,  setActiveSlot]  = useState<TimetableSlot | null>(null)
  const [toast,       setToast]       = useState('')
  const [loadError,   setLoadError]   = useState<string | null>(null)
  const [sourceCheckError, setSourceCheckError] = useState<string | null>(null)
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
      setSourceCheckError(null)
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
        .select('id,class_id,subject_id,timetable_slot_id,title,body,topic,day_of_week,week_start,status,curriculum_id,strand_id,scheme_id,curriculum_outcome_id')
        .eq('teacher_id', user.id)
        .eq('school_id', resolvedSchoolId)
        .eq('week_start', weekStart)

      if (plansRes.error) {
        console.error('[LessonPlan] lesson_plans query failed:', plansRes.error)
        setLoadError('Could not load lesson plans.')
        setLoading(false)
        return
      }

      const authoredPlans = plansRes.data ?? []
      const candidatePlans = authoredPlans.filter(p => Boolean(p.scheme_id && p.curriculum_outcome_id))
      const schemeIds = [...new Set(candidatePlans.map(p => p.scheme_id).filter((id): id is string => Boolean(id)))]
      const outcomeIds = [...new Set(candidatePlans.map(p => p.curriculum_outcome_id).filter((id): id is string => Boolean(id)))]
      const verifiedOutcomes = new Set<string>()
      const canonicalSchemes = new Map<string, {
        school_id: string
        teacher_id: string | null
        class_id: string | null
        subject_id: string
        curriculum_outcome_id: string | null
      }>()
      if (schemeIds.length && outcomeIds.length) {
        const [verified, schemes] = await Promise.all([
          supabase.from('curriculum_learning_outcomes')
            .select('id').in('id', outcomeIds).eq('status', 'verified'),
          supabase.from('scheme_of_work')
            .select('id,school_id,teacher_id,class_id,subject_id,curriculum_outcome_id')
            .in('id', schemeIds),
        ])
        if (verified.error || schemes.error) {
          setSourceCheckError('Curriculum verification is temporarily unavailable. Lesson readiness cannot be confirmed.')
        } else {
          setSourceCheckError(null)
          for (const outcome of verified.data ?? []) verifiedOutcomes.add(outcome.id)
          for (const scheme of schemes.data ?? []) canonicalSchemes.set(scheme.id, scheme)
        }
      } else {
        setSourceCheckError(null)
      }

      const planMap = new Map<string, PlanRow>()
      const outcomeBySlot = new Map<string, boolean>()
      for (const p of authoredPlans) {
        if (!p.timetable_slot_id) continue
        const scheme = p.scheme_id ? canonicalSchemes.get(p.scheme_id) : null
        const outcomeValid = Boolean(scheme
          && p.curriculum_outcome_id
          && verifiedOutcomes.has(p.curriculum_outcome_id)
          && scheme.curriculum_outcome_id === p.curriculum_outcome_id
          && scheme.school_id === resolvedSchoolId
          && scheme.teacher_id === user.id
          && scheme.class_id === p.class_id
          && scheme.subject_id === p.subject_id)
        outcomeBySlot.set(p.timetable_slot_id, outcomeValid)
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
          curriculumLinked: outcomeBySlot.get(s.id) ?? false,
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
      if (!showHistory) return
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
  }, [urlClassId, activeSlot, refreshNonce, showHistory])

  const readyCount = items.filter(({ plan, curriculumLinked }) => readinessState(plan, curriculumLinked) === 'ready').length
  const needsReviewCount = items.filter(({ plan, curriculumLinked }) => readinessState(plan, curriculumLinked) === 'needs_review').length
  const noPlanCount = items.filter(({ plan, curriculumLinked }) => readinessState(plan, curriculumLinked) === 'no_plan').length
  const isThisWeek = weekStart === nairobiWeekStart()

  const visibleItems = items.filter(({ plan, curriculumLinked }) => {
    if (readinessFilter === 'all') return true
    return readinessState(plan, curriculumLinked) === readinessFilter
  })

  return (
    <section className="vs-teacher-workspace">
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .vs-teacher-workspace{--lp-green:#087255;--lp-ink:#152720;--lp-line:#dfe8e2;max-width:1100px;margin:0 auto;padding:12px 16px 100px}
        .teacher-plans-header{margin:4px 0 17px}
        .teacher-plans-header .vs-teacher-workspace__header{display:flex;align-items:center;gap:12px;justify-content:space-between;margin-bottom:12px}
        .teacher-plans-header .vs-teacher-workspace__title{font-size:27px;letter-spacing:-.035em;color:var(--lp-ink);margin:3px 0}
        .teacher-plans-header .teacher-btn:not(.teacher-btn--secondary){background:var(--lp-green);border-color:var(--lp-green);color:white;font-weight:750;border-radius:11px;min-height:41px;padding:8px 13px}
        .teacher-plans-week{display:flex;align-items:center;gap:8px;margin-bottom:14px}
        .teacher-plans-week .teacher-icon-button{border-radius:10px;border:1px solid var(--lp-line);background:white;min-width:38px;min-height:38px}
        .teacher-plans-week .teacher-btn{border:1px solid var(--lp-line);border-radius:10px;background:white;color:var(--lp-green);min-height:38px;padding:7px 12px;font-weight:700}
        .teacher-plans-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--lp-line);border-radius:14px;background:white;overflow:hidden;margin-top:8px;gap:0}
        .teacher-plans-metrics button{appearance:none;text-align:left;display:flex;flex-direction:column;gap:1px;padding:10px 13px;border:0;border-right:1px solid var(--lp-line);background:white;cursor:pointer}
        .teacher-plans-metrics button:last-child{border-right:0}
        .teacher-plans-metrics button[aria-pressed=true]{background:#e9f5ef;box-shadow:inset 0 -3px 0 var(--lp-green)}
        .teacher-plans-metrics button strong{font-size:19px;letter-spacing:-.02em;color:var(--lp-ink)}
        .teacher-plans-metrics button span{font-size:11px;color:#66796d;font-weight:650}
        .studio-lesson-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,310px),1fr));gap:9px}
        .studio-lesson-card{background:#fff;border:1px solid var(--lp-line);border-radius:14px;padding:13px 14px}
        .lp-outcome-needed{font-size:11px;color:#92591f;background:#fff7e9;padding:6px 8px;border-radius:8px;margin-top:7px;width:fit-content}
        .lp-history-disclosure{background:white;border:1px solid var(--lp-line);border-radius:15px;padding:12px 14px;margin:14px 0}
        .lp-history-disclosure>summary{cursor:pointer;font-weight:760;font-size:13px;color:var(--lp-ink);display:flex;justify-content:space-between;align-items:center}
        .lp-history-disclosure>summary span{color:#64796b;font-size:11px;font-weight:550}
        .lp-history-disclosure .teacher-card{box-shadow:none;border:0;margin:8px 0 0;padding:0}
        @media(max-width:650px){.vs-teacher-workspace{padding:10px 14px 112px}.teacher-plans-header .vs-teacher-workspace__title{font-size:25px}.teacher-plans-header .teacher-btn:not(.teacher-btn--secondary){font-size:12px;padding:8px 11px}.studio-lesson-grid{grid-template-columns:1fr}.studio-lesson-card{padding:12px 13px}}
      `}</style>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          zIndex: 999, background: "var(--teacher-ink, #1c2923)", color: '#fff',
          padding: '10px 20px', borderRadius: 20, fontSize: 13, fontWeight: 700,
          animation: 'fadeIn 0.2s ease', whiteSpace: 'nowrap',
        }}>{toast}</div>
      )}

      {sourceCheckError && <div role="status" style={{background:'#fff6e9',border:'1px solid #e9d8b6',color:'#815923',padding:12,borderRadius:10,fontSize:12,marginBottom:12}}>{sourceCheckError}</div>}
      <header className="teacher-plans-header">
        <div className="vs-teacher-workspace__header"><div><p className="teacher-eyebrow">Week of {new Date(weekStart + 'T12:00:00+03:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' })}</p><h1 className="vs-teacher-workspace__title">Lesson plans</h1></div><button type="button" className="teacher-btn" onClick={()=>router.push('/teacher/lessonplan/prepare')}>Prepare ahead</button></div>
        <div className="teacher-plans-week"><button type="button" className="teacher-icon-button" aria-label="Previous week" onClick={()=>setWeekStart(w=>nairobiDateAdd(w,-7))}>←</button><button type="button" className="teacher-btn teacher-btn--secondary" aria-pressed={isThisWeek} onClick={()=>setWeekStart(nairobiWeekStart())}>{isThisWeek?'This week':'Back to this week'}</button><button type="button" className="teacher-icon-button" aria-label="Next week" onClick={()=>setWeekStart(w=>nairobiDateAdd(w,7))}>→</button></div>
        {urlClassId&&<button type="button" className="teacher-btn teacher-btn--secondary" onClick={()=>router.push('/teacher/classhub/'+urlClassId)}>View class</button>}
        {!loading&&!loadError&&<div className="teacher-plans-metrics">{[{key:'ready' as const,label:'Ready',value:readyCount,state:'ready'},{key:'needs_review' as const,label:'Review',value:needsReviewCount,state:'warning'},{key:'no_plan' as const,label:'No plan',value:noPlanCount,state:'missing'}].map(item=><button type="button" key={item.key} data-state={item.state} aria-pressed={readinessFilter===item.key} onClick={()=>setReadinessFilter(f=>f===item.key?'all':item.key)}><strong>{item.value}</strong><span>{item.label}</span></button>)}</div>}
      </header>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionLabel>
            {urlSchemeId
              ? 'Choose scheduled lesson'
              : 'Scheduled lessons'}
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
          <div className="studio-lesson-grid">
            {visibleItems.map(({ slot, plan, curriculumLinked }) => {
              const state = readinessState(plan, curriculumLinked)
              const badge = READINESS_BADGE[state]
              return (
                <div key={slot.id} className="studio-lesson-card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
                        {plan?.topic || plan?.title || slot.subject + ' — No plan yet'}
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                        {slot.class} · {formatTime(slot.start)}–{formatTime(slot.end)}{slot.room ? ' · ' + slot.room : ''}
                      </div>
                      {plan && !curriculumLinked && <div className="lp-outcome-needed">Scheme outcome needs verification</div>}
                      {plan && (
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                          Plan status: {STATUS_BADGE[plan.status]?.label ?? 'Draft'}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: badge.bg, color: badge.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{badge.label}</span>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <Btn small variant="ghost" ariaLabel={state === 'no_plan' ? 'Create plan' : state === 'needs_review' ? 'Review plan' : 'Open Teaching Workspace'} onClick={() => setActiveSlot(slot)}>
                      {state === 'no_plan' ? 'Create plan' : state === 'needs_review' ? 'Review plan' : 'Open lesson'}
                    </Btn>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <details className="lp-history-disclosure" open={showHistory} onToggle={event=>setShowHistory(event.currentTarget.open)}>
        <summary>Past lesson plans <span>{history.length > 0 ? history.length + ' recent' : 'View history'}</span></summary>
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
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: badge.bg, color: badge.color, whiteSpace: 'nowrap', marginLeft: 8 }}>{badge.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      </details>

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
    </section>
  )
}

export default function LessonPlanPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontSize: 13, color: C.textMuted }}>Loading…</div>}>
      <LessonPlanInner />
    </Suspense>
  )
}
