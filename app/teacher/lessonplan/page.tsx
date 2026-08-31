"use client";
import { nairobiDateStr, nairobiDateAdd, nairobiWeekStart } from '@/lib/time'
import { loadTeacherTimetableForRange } from '@/lib/timetable/engine'
import type { CanonicalTimetableSlot } from '@/lib/timetable/engine'
export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from 'react'
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

// The AI generator writes a <differentiation>...</differentiation> block into
// plan.body (support/core/extension activities). A plan can exist but still
// have no real differentiation content — this checks for that directly
// instead of inferring it from status.
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
  const [schoolId,    setSchoolId]    = useState<string | null>(null)
  const [loadError,   setLoadError]   = useState<string | null>(null)
  const [diffFilter,  setDiffFilter]  = useState<'all' | 'published' | 'draft' | 'missing'>('all')

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

      // Filter by overlap with the *selected* week, not "today" — this page
      // navigates across weeks via weekStart/nairobiDateAdd, so a slot whose
      // effective range covers a future or past week must still show up
      // when that week is selected, even though it isn't active today.
      const weekEnd = nairobiDateAdd(weekStart, 6)

      if (!resolvedSchoolId) {
        setLoadError('Your teacher profile is not connected to a school.')
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

      // The SQL query above only confirms the slot's effective range overlaps
      // the selected week somewhere — not that this slot's specific weekday
      // occurrence in this week falls inside that range (e.g. a Monday slot
      // effective from Wednesday shouldn't show for that week's Monday).
      // day_of_week convention: Monday = 1 ... Sunday = 7.
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
        subjectIds.length > 0 ? supabase.from('subjects').select('id,name').in('id', subjectIds) : Promise.resolve({ data: [] }),
        classIds.length > 0   ? supabase.from('classes').select('id,name,stream').in('id', classIds) : Promise.resolve({ data: [] }),
      ])
      const subjMap = Object.fromEntries((subjRes.data ?? []).map((s: any) => [s.id, s.name]))
      const clsMap  = Object.fromEntries((clsRes.data ?? []).map((c: any) => [c.id, c.name + (c.stream ? ' ' + c.stream : '')]))

      const mapped: SlotWithPlan[] = slots.map(s => {
        // Fix 14C: carry the browsed occurrence forward on the slot itself —
        // day_of_week and occurrenceDate must survive into activeSlot, or the
        // modal has no way to know which real-world date it's saving to.
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

      // FND-002C3: Scheme entry is source-scoped. The teacher may choose any
      // valid occurrence for the selected week, but never an unrelated class
      // or subject. Normal timetable/lesson-plan entry remains unfiltered.
      const selectableItems = urlSchemeId
        ? mapped.filter(({ slot }) =>
            slot.class_id === urlClassId &&
            slot.subject_id === urlSubjectId
          )
        : mapped

      setItems(selectableItems)

      // TOS-001: a timetable CTA must open the selected occurrence directly,
      // not merely land on the weekly lesson-plan index. The exact pair is
      // the same identity used by LessonPlanModal and lesson_plans:
      // (timetable_slot_id, taught_date).
      if (urlTimetableSlotId && urlOccurrenceDate) {
        const target = selectableItems.find(({ slot }) =>
          slot.id === urlTimetableSlotId &&
          slot.occurrenceDate === urlOccurrenceDate &&
          (!urlClassId || slot.class_id === urlClassId) &&
          (!urlSubjectId || slot.subject_id === urlSubjectId)
        )

        if (target) {
          setActiveSlot(target.slot)
        } else {
          setLoadError('The selected timetable lesson is no longer available for this date.')
        }
      }

      setLoading(false)
    }
    load()
  }, [
    weekStart,
    urlClassId,
    urlSubjectId,
    urlTimetableSlotId,
    urlOccurrenceDate,
    urlSchemeId,
  ])

  useEffect(() => {
    async function loadHistory() {
      setHistLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      let q = supabase
        .from('lesson_plans')
        .select('id,title,topic,created_at,status,curriculum_id,strand_id,classes(name,stream),curriculum(week,term,strand)')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15)
      if (urlClassId) q = q.eq('class_id', urlClassId)
      const { data } = await q
      setHistory((data ?? []).map((h: any) => {
        const curr = Array.isArray(h.curriculum) ? h.curriculum[0] : h.curriculum
        return {
          id: h.id, title: h.title, topic: h.topic,
          created_at: h.created_at, status: h.status,
          class_name: h.classes ? h.classes.name + (h.classes.stream ? ' ' + h.classes.stream : '') : '',
          curriculumId: h.curriculum_id ?? null,
          strandId: h.strand_id ?? null,
          week: curr?.week ?? null,
          term: curr?.term ?? null,
          strand: curr?.strand ?? null,
        }
      }))
      setHistLoading(false)
    }
    loadHistory()
  }, [urlClassId, activeSlot])

  const readyCount = items.filter(i => i.plan && isLessonPlanReadyToTeach(i.plan.body)).length
  const missingCount = items.length - readyCount
  const isThisWeek   = weekStart === nairobiWeekStart()

  // Drives the "Today & Upcoming" list below when a Differentiation Summary
  // row is tapped. 'all' means no filter is active.
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
                      {plan ? '📝 Open Plan' : '✦ Create Plan'}
                    </Btn>
                    {(plan?.status === 'published' || plan?.status === 'shared_to_parents') && (
                      <Btn small variant="ghost" onClick={() => router.push(`/teacher/progress?planId=${plan.id}&classId=${plan.classId}&subjectId=${plan.subjectId}`)}>
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
          // Fix 14C: occurrenceDate is always set in the `mapped` builder
          // above — asserted rather than optional-chained so a future
          // regression there fails loudly (as a save error) instead of
          // silently writing to the wrong date.
          taughtDate={activeSlot.occurrenceDate!}
          requestedSchemeId={urlSchemeId}
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
