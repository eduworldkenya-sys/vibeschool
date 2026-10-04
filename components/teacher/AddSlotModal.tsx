"use client";

import { nairobiDayOfWeek } from '@/lib/time'
import { periodsForDay, teachingBlock, protectedBlockConflict, singleDateSchedule, type SchoolPeriod } from '@/lib/timetable/periods'
import type { SuggestedPlacement } from '@/lib/timetable/operations'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, C } from '@/components/teacher/ui'
import { updateTimetableSlot, expireTimetableSlot, deleteTimetableSlot, SlotRpcError } from '@/lib/teaching/slots'
import type { EditableSlot } from '@/lib/teaching/types'
import { previewTimetableConflicts, type TimetableConflict } from '@/lib/timetable/engine'

interface Props {
  initialPlacement?: {dayOfWeek:number;startTime:string;endTime:string}
  teacherId: string
  editSlot?: EditableSlot
  onClose:   () => void
  onSaved:   () => void
}

// One row = one real teaching obligation: teacher + school + class + subject.
interface AssignmentOption {
  teacherClassId: string
  schoolId:       string
  classId:        string
  subjectId:      string
  className:      string
  subjectName:    string
}

const DAYS = [
  { label: 'Monday',    value: 1 },
  { label: 'Tuesday',   value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday',  value: 4 },
  { label: 'Friday',    value: 5 },
  { label: 'Saturday',  value: 6 },
  { label: 'Sunday',    value: 7 },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: `1.5px solid ${C.border}`,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  background: C.surface,
  color: C.textPrimary,
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: C.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  marginBottom: 6,
  display: 'block',
}

// The create_timetable_slot RPC raises one of these stable codes as the
// exception message. Never show err.message from a raw table insert —
// only these codes, which are our own contract with the database function.
function toFriendlyError(err: { message?: string }): string {
  switch ((err.message ?? '').trim()) {
    case 'TEACHER_CONFLICT':
      return 'Teacher already has a lesson at this time.'
    case 'CLASS_CONFLICT':
      return 'This class already has a lesson at this time.'
    case 'ROOM_CONFLICT':
      return 'This room is already occupied.'
    case 'PROTECTED_SCHOOL_BLOCK':
      return 'This lesson overlaps a break, lunch or another protected activity.'
    case 'PERIOD_TIME_MISMATCH':
      return 'Use the start and end time of the selected school period.'
    case 'NON_TEACHING_PERIOD':
    case 'PERIOD_DAY_MISMATCH':
    case 'PERIOD_SCHOOL_MISMATCH':
      return 'Choose a teaching period for this school and day.'
    case 'INVALID_ASSIGNMENT':
      return 'You are not assigned to teach this subject for this class.'
    case 'SCHOOL_MISMATCH':
      return 'You are not assigned to teach this subject for this class.'
    case 'INVALID_DAY':
      return 'Choose a valid day.'
    case 'INVALID_TIME_RANGE':
      return 'End time must be after start time.'
    case 'INVALID_EFFECTIVE_RANGE':
      return 'Effective end date cannot be before the start date.'
    case 'UNAUTHENTICATED':
      return 'Your session expired. Please sign in again.'
    default:
      return 'Could not save the timetable slot. Try again.'
  }
}

// Today's date in Africa/Nairobi, as YYYY-MM-DD for a <input type="date">
// default value. Avoids ever submitting an ambiguous blank effective_from.
function nairobiTodayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

// The Fix 20 edit/delete/expire RPCs raise a different, stable error-code
// contract than create_timetable_slot — never reuse toFriendlyError for them.
function toFriendlyEditError(err: { message?: string }): string {
  switch ((err.message ?? '').trim()) {
    case 'TEACHER_CONFLICT':
      return 'You already have a lesson at this time.'
    case 'CLASS_CONFLICT':
      return 'This class already has a lesson at this time.'
    case 'ROOM_CONFLICT':
      return 'This room is already occupied.'
    case 'occurrence_history_exists':
      return 'This slot has taught lessons — day and time are locked. You can still change the room, or end the slot below.'
    case 'occurrence_outside_window':
      return 'That date range would cut off lessons already taught. Adjust the range and try again.'
    case 'occurrences_exist':
      return 'This slot has lesson history and cannot be deleted. Use "End Slot" instead.'
    case 'slot_not_owned':
      return 'This slot belongs to a different teacher.'
    case 'not_authenticated':
      return 'Your session expired. Please sign in again.'
    default:
      return 'Could not save the change. Try again.'
  }
}

export default function AddSlotModal({ teacherId, editSlot, initialPlacement, onClose, onSaved }: Props) {
  const isEdit = !!editSlot

  const [saving,            setSaving]            = useState(false)
  const [deleting,          setDeleting]          = useState(false)
  const [error,             setError]             = useState<string | null>(null)
  const [assignments,       setAssignments]       = useState<AssignmentOption[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(!isEdit)
  const [conflicts, setConflicts] = useState<TimetableConflict[]>([])
  const [checkingConflicts, setCheckingConflicts] = useState(false)

  const [teacherClassId, setTeacherClassId] = useState('')
  const [dayOfWeek,      setDayOfWeek]      = useState(editSlot ? String(editSlot.dayOfWeek) : String(initialPlacement?.dayOfWeek ?? 1))
  const [startTime,      setStartTime]      = useState(editSlot?.startTime ?? initialPlacement?.startTime ?? '08:00')
  const [endTime,        setEndTime]        = useState(editSlot?.endTime ?? initialPlacement?.endTime ?? '08:40')
  const [room,           setRoom]           = useState(editSlot?.room ?? '')
  const [effectiveFrom,  setEffectiveFrom]  = useState(editSlot?.effectiveFrom ?? nairobiTodayISO())
  const [effectiveUntil, setEffectiveUntil] = useState(editSlot?.effectiveUntil ?? '')
  const [recurrence, setRecurrence] = useState<'weekly' | 'once'>('weekly')
  useEffect(() => {
    if (isEdit) return
    if (recurrence === 'once' && effectiveFrom) {setDayOfWeek(String(nairobiDayOfWeek(new Date(`${effectiveFrom}T12:00:00Z`))));setEffectiveUntil(effectiveFrom)}
    else if (recurrence === 'weekly') setEffectiveUntil('')
  }, [recurrence,effectiveFrom,isEdit])
  const [allocationUnits, setAllocationUnits] = useState('1')

  const [periods, setPeriods] = useState<SchoolPeriod[]>([])
  const [periodsLoading, setPeriodsLoading] = useState(!isEdit)
  const [periodsError, setPeriodsError] = useState<string | null>(null)
  const [periodId, setPeriodId] = useState('')
  const [customTime, setCustomTime] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestedPlacement[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [preferredSession, setPreferredSession] = useState('any')
  const modalMounted = useRef(true)
  useEffect(() => {modalMounted.current=true;return () => {modalMounted.current=false}}, [])

  useEffect(() => {
    if (isEdit) return
    let cancelled = false
    async function loadPeriods() {
      try {
        const {data,error} = await supabase.rpc('get_my_school_day_blocks')
        if (error) throw error
        if (!cancelled) setPeriods((data ?? []) as SchoolPeriod[])
      } catch {
        if (!cancelled) setPeriodsError('School periods could not load. Close and reopen to retry.')
      } finally { if (!cancelled) setPeriodsLoading(false) }
    }
    loadPeriods()
    return () => {cancelled = true}
  }, [isEdit])

  // Synchronous guard against duplicate submission. `saving` (React state)
  // only disables the button on the *next* render — a fast double-tap can
  // fire two calls to save() before that re-render happens. This ref is
  // set/cleared synchronously inside save() itself, closing that gap.
  const submittingRef = useRef(false)

  function resetForm() {
    setTeacherClassId('')
    setDayOfWeek('1')
    setStartTime('08:00')
    setEndTime('09:00')
    setRoom('')
    setEffectiveFrom(nairobiTodayISO())
  }

  useEffect(() => {
    if (isEdit) { setAssignmentsLoading(false); return }
    async function loadAssignments() {
      // Use the same server-authoritative operating context as ClassHub,
      // SubjectHub, Scheme and Attendance. A direct nested teacher_classes
      // query can lose otherwise-valid assignments when joined class/subject
      // rows are hidden by independent RLS policies.
      const { data: contextData, error: contextError } = await supabase.rpc('teacher_get_operating_context')
      const context = contextData as {
        school_id?: string | null
        classes?: Array<{
          assignment_id: string
          class_id: string
          class_name: string
          stream?: string | null
          subject_id: string
          subject_name: string
        }>
      } | null
      const activeSchoolId = context?.school_id ?? null
      if (contextError || !activeSchoolId) {
        setError('Connect or select your active school before adding a lesson.')
        setAssignmentsLoading(false)
        return
      }

      const options: AssignmentOption[] = (context?.classes ?? [])
        .filter(r => r.assignment_id && r.class_id && r.subject_id && r.class_name && r.subject_name)
        .map(r => ({
          teacherClassId: r.assignment_id,
          schoolId:       activeSchoolId,
          classId:        r.class_id,
          subjectId:      r.subject_id,
          className:      r.stream ? `${r.class_name} ${r.stream}` : r.class_name,
          subjectName:    r.subject_name,
        }))
        .sort((a, b) => a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName))

      setAssignments(options)
      setAssignmentsLoading(false)
    }
    loadAssignments()
  }, [teacherId, isEdit])

  const selectedAssignment = assignments.find(a => a.teacherClassId === teacherClassId) ?? null

  const dayPeriods = selectedAssignment ? periodsForDay(periods, selectedAssignment.schoolId, Number(dayOfWeek)) : []
  const hasTeachingPeriods = dayPeriods.some(p => p.kind === 'lesson')
  const selectedBlock = teachingBlock(dayPeriods, periodId, Number(allocationUnits))
  useEffect(() => {
    const block = teachingBlock(selectedAssignment ? periodsForDay(periods, selectedAssignment.schoolId, Number(dayOfWeek)) : [], periodId, Number(allocationUnits))
    if (isEdit || customTime || !block) return
    setStartTime(block[0].start_time.slice(0,5))
    setEndTime(block[block.length-1].end_time.slice(0,5))
  }, [isEdit, customTime, periodId, allocationUnits, dayOfWeek, teacherClassId, periods, selectedAssignment])

  useEffect(() => {
    if (!initialPlacement || isEdit || periodId || !selectedAssignment) return
    const first = periodsForDay(periods, selectedAssignment.schoolId, Number(dayOfWeek)).find(p => p.kind === 'lesson' && p.start_time.slice(0,5) === initialPlacement.startTime)
    if (first) setPeriodId(first.id)
  }, [initialPlacement, isEdit, periodId, selectedAssignment, periods, dayOfWeek])

  const suggestionContext = useRef('')
  suggestionContext.current = [teacherClassId,effectiveFrom,effectiveUntil,allocationUnits,room,preferredSession,recurrence,dayOfWeek].join('|')
  useEffect(() => {setSuggestions([])}, [teacherClassId,effectiveFrom,effectiveUntil,allocationUnits,room,preferredSession,recurrence,dayOfWeek])

  async function suggestPeriods() {
    if (!selectedAssignment || suggesting) return
    setSuggesting(true); setError(null); setSuggestions([])
    const contextKey = suggestionContext.current
    try {
      const candidates = (recurrence === 'once' ? [Number(dayOfWeek)] : [1,2,3,4,5]).flatMap(day => {
        const dayBlocks = periodsForDay(periods,selectedAssignment.schoolId,day)
        return dayBlocks.filter(p => p.kind === 'lesson').flatMap(p => {
          const block = teachingBlock(dayBlocks,p.id,Number(allocationUnits))
          if (!block) return []
          return [{day_of_week:day,period_id:p.id,start_time:block[0].start_time,end_time:block.at(-1)!.end_time,score:0,explanation:'Consecutive teaching periods; no clash found.'}]
        })
      })
      candidates.sort((a,b) => {
        const preference=(c:SuggestedPlacement) => preferredSession === 'any' ? 0 : (preferredSession === 'morning' ? c.start_time < '12:00' : c.start_time >= '12:00') ? 0 : 1
        return preference(a)-preference(b) || a.start_time.localeCompare(b.start_time) || a.day_of_week-b.day_of_week
      })
      const free: SuggestedPlacement[] = []
      // Bound the preview work and stop as soon as five useful suggestions
      // exist. The same server-authoritative preview is available to teachers.
      for (const candidate of candidates.slice(0,30)) {
        if (!modalMounted.current || contextKey !== suggestionContext.current) return
        const conflicts = await previewTimetableConflicts({schoolId:selectedAssignment.schoolId,teacherId,
          classId:selectedAssignment.classId,dayOfWeek:candidate.day_of_week,startTime:candidate.start_time,
          endTime:candidate.end_time,room:room.trim() || null,effectiveFrom,effectiveUntil:effectiveUntil || null})
        if (!conflicts.length) free.push(candidate)
        if (free.length === 5) break
      }
      if (modalMounted.current && contextKey === suggestionContext.current) {setSuggestions(free);if(!free.length)setError('No free periods found in the checked teaching periods. Try another day or review existing lessons.')}
    } catch { if(modalMounted.current && contextKey === suggestionContext.current) setError('Suggestions could not load. You can still choose a period yourself.') }
    finally {if(modalMounted.current)setSuggesting(false)}
  }

  async function checkConflicts(schedule?: {dayOfWeek:number;effectiveFrom:string;effectiveUntil:string}): Promise<boolean> {
    if (!selectedAssignment || isEdit) return true
    setCheckingConflicts(true)
    try {
      const rows = await previewTimetableConflicts({
        schoolId: selectedAssignment.schoolId,
        teacherId,
        classId: selectedAssignment.classId,
        dayOfWeek: schedule?.dayOfWeek ?? (parseInt(dayOfWeek) || 1),
        startTime,
        endTime,
        room: room.trim() || null,
        effectiveFrom: schedule?.effectiveFrom ?? (effectiveFrom || null),
        effectiveUntil: schedule?.effectiveUntil ?? (effectiveUntil || null),
      })
      setConflicts(rows)
      return rows.length === 0
    } catch {
      // Preview is advisory. The transactional writer remains authoritative.
      setConflicts([])
      return true
    } finally {
      setCheckingConflicts(false)
    }
  }

  async function save() {
    // Synchronous re-entrancy guard — closes the double-tap gap that the
    // `saving` state alone can't catch (see submittingRef declaration above).
    if (submittingRef.current) return

    setError(null)
    const onceSchedule = !isEdit && recurrence === 'once' ? singleDateSchedule(effectiveFrom) : null
    if (!isEdit && recurrence === 'once' && !onceSchedule) {setError('Choose a valid date for this one-time lesson.');return}
    if (!isEdit) {
      if (periodsLoading || periodsError) {setError('Load school periods before saving.');return}
      const blocked = protectedBlockConflict(dayPeriods, startTime, endTime)
      if (blocked) {setError(`This lesson overlaps ${blocked.label}. Choose a teaching period.`);return}
      if (hasTeachingPeriods && !customTime && !selectedBlock) {setError('Choose consecutive teaching periods without crossing a break.');return}
      if (effectiveUntil && effectiveUntil < effectiveFrom) {setError('End date cannot be before start date.');return}
    }

    if (!startTime) { setError('Enter start time.'); return }
    if (!endTime)   { setError('Enter end time.');   return }
    if (startTime >= endTime) { setError('End time must be after start time.'); return }

    if (isEdit && editSlot) {
      submittingRef.current = true
      setSaving(true)
      try {
        await updateTimetableSlot(editSlot.id, {
          dayOfWeek: parseInt(dayOfWeek) || undefined,
          startTime,
          endTime,
          room: room.trim() || undefined,
          clearRoom: room.trim() === '',
          effectiveFrom: effectiveFrom || undefined,
          effectiveUntil: effectiveUntil || undefined,
          clearEffectiveUntil: effectiveUntil === '',
        })
        setSaving(false)
        submittingRef.current = false
        onSaved()
      } catch (e) {
        setSaving(false)
        submittingRef.current = false
        setError(toFriendlyEditError({ message: e instanceof SlotRpcError ? e.code : undefined }))
      }
      return
    }

    if (!selectedAssignment) { setError('Select a class and subject.'); return }
    const { classId, subjectId } = selectedAssignment
    if (!classId || !subjectId) { setError('This assignment is missing required data.'); return }

    submittingRef.current = true
    const clear = await checkConflicts(onceSchedule ?? undefined)
    if (!clear) {
      submittingRef.current = false
      setError('Resolve the timetable conflict before saving.')
      return
    }

    submittingRef.current = true
    setSaving(true)
    // All conflict/assignment/school checks happen inside this one DB
    // transaction (create_timetable_slot). school_id and teacher_id are
    // never sent from the client — the RPC derives both from the
    // caller's own auth identity and their teacher_classes assignment.
    try {
    const { error: err } = await supabase.rpc('create_timetable_slot_v2', {
      p_class_id:        classId,
      p_subject_id:      subjectId,
      p_day_of_week:     onceSchedule?.dayOfWeek ?? (parseInt(dayOfWeek) || 1),
      p_start_time:      startTime,
      p_end_time:        endTime,
      p_room:            room.trim() || undefined,
      p_effective_from:  onceSchedule?.effectiveFrom ?? (effectiveFrom || undefined),
      p_effective_until: onceSchedule?.effectiveUntil ?? (effectiveUntil || undefined),
      p_allocation_units: Number(allocationUnits) || 1,
      p_period_id: undefined,
    })

    setSaving(false)
    submittingRef.current = false

    if (err) {
      console.error('[Timetable] slot creation failed', err)
      // Form values are intentionally left untouched here so a recoverable
      // error (e.g. a conflict) doesn't force the teacher to re-enter
      // everything.
      setError(toFriendlyError(err))
      return
    }

    // Only reset on confirmed success — never on a recoverable error.
    resetForm()
    onSaved()
    } catch {
      setError('Could not save. Your entries are still here; retry when connected.')
    } finally {
      setSaving(false)
      submittingRef.current = false
    }
  }

  async function handleDelete() {
    if (!editSlot) return
    if (!confirm("Delete this slot? This can't be undone.")) return
    setDeleting(true)
    setError(null)
    try {
      await deleteTimetableSlot(editSlot.id)
      onSaved()
    } catch (e) {
      setError(toFriendlyEditError({ message: e instanceof SlotRpcError ? e.code : undefined }))
    } finally {
      setDeleting(false)
    }
  }

  async function handleEndSlot() {
    if (!editSlot) return
    setDeleting(true)
    setError(null)
    try {
      await expireTimetableSlot(editSlot.id)
      onSaved()
    } catch (e) {
      setError(toFriendlyEditError({ message: e instanceof SlotRpcError ? e.code : undefined }))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}
      onClick={() => {if (!submittingRef.current && !saving && !deleting) onClose()}}
    >
      <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit lesson time' : 'Add lesson to timetable'} style={{
        background: C.bg,
        borderRadius: '20px 20px 0 0',
        padding: '24px 20px 60px',
        width: '100%', maxWidth: 480,
        display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: '90vh', overflowY: 'auto',
      }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary }}>
            {isEdit ? 'Edit lesson time' : 'Add lesson to timetable'}
          </div>
          <button aria-label="Close lesson form" disabled={saving || deleting || checkingConflicts} onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.textMuted }}>✕</button>
        </div>

        {!isEdit && <p style={{fontSize:13,color:C.textMuted,margin:0}}>Choose your class and subject, then a teaching period. You can prepare the lesson plan later.</p>}
        {error && (
          <div role="alert" style={{ fontSize: 12, color: C.error, background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>
            {error}
          </div>
        )}
        {conflicts.length > 0 && (
          <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', padding: '10px 12px', borderRadius: 8 }}>
            <strong>Schedule conflict</strong>
            {conflicts.map(row => <div key={row.conflicting_slot_id} style={{ marginTop: 4 }}>{row.detail}</div>)}
          </div>
        )}

        <fieldset disabled={saving || deleting || checkingConflicts} style={{border:0,padding:0,margin:0,display:'flex',flexDirection:'column',gap:16,minWidth:0}}>
        {isEdit ? (
          <div>
            <label style={labelStyle}>Class &amp; Subject</label>
            <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>
              {editSlot!.className} — {editSlot!.subjectName}
            </div>
          </div>
        ) : (
          <div>
            <label style={labelStyle}>Class &amp; Subject *</label>
            {assignmentsLoading ? (
              <div style={{ fontSize: 13, color: C.textMuted }}>Loading your assignments…</div>
            ) : assignments.length === 0 ? (
              <div style={{ fontSize: 13, color: C.error }}>
                No teaching assignments yet. <a href="/teacher/onboarding/class">Set up class and subject</a>
              </div>
            ) : (
              <select value={teacherClassId} onChange={e => {setTeacherClassId(e.target.value);setPeriodId('');setSuggestions([])}} style={inputStyle}>
                <option value="">Select class &amp; subject</option>
                {assignments.map(a => (
                  <option key={a.teacherClassId} value={a.teacherClassId}>
                    {a.className} — {a.subjectName}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {!isEdit && <div>
          <label htmlFor="lesson-recurrence" style={labelStyle}>Repeat</label>
          <select id="lesson-recurrence" style={inputStyle} value={recurrence} onChange={e=>setRecurrence(e.target.value as 'weekly' | 'once')}>
            <option value="weekly">Every week</option><option value="once">One date only</option>
          </select>
        </div>}
        <div>
          <label style={labelStyle}>Day *</label>
          <select disabled={!isEdit && recurrence === 'once'} value={dayOfWeek} onChange={e => {setDayOfWeek(e.target.value);setPeriodId('')}} style={inputStyle}>
            {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        {!isEdit && <div>
          {periodsLoading ? <p>Loading school periods…</p> : periodsError ? <p role="alert">{periodsError}</p> : hasTeachingPeriods ? <>
            <label htmlFor="teaching-period" style={labelStyle}>Teaching period</label>
            <select id="teaching-period" style={inputStyle} value={periodId} onChange={e => {setPeriodId(e.target.value);setCustomTime(false)}}>
              <option value="">Choose a period</option>
              {dayPeriods.filter(p => p.kind === 'lesson').map(p => <option key={p.id} value={p.id}>{p.label} · {p.start_time.slice(0,5)}–{p.end_time.slice(0,5)}</option>)}
            </select>
            <label style={{display:'block',marginTop:10,fontSize:13}}><input type="checkbox" checked={customTime} onChange={e => setCustomTime(e.target.checked)} /> Use a custom school time</label>
            {customTime && <p style={{fontSize:12}}>Use this only for a genuine school exception. Breaks and clashes still apply.</p>}
          </> : <p style={{fontSize:13}}>No teaching periods are configured for this day. Enter your actual school times; do not assume a national lesson duration.</p>}
          <label htmlFor="preferred-session" style={labelStyle}>Preferred session (optional)</label>
          <select id="preferred-session" style={inputStyle} value={preferredSession} onChange={e=>setPreferredSession(e.target.value)}>
            <option value="any">Any teaching time</option><option value="morning">Morning first</option><option value="afternoon">Afternoon first</option>
          </select>
          <Btn variant="ghost" small disabled={!selectedAssignment || suggesting || periodsLoading || !!periodsError} onClick={suggestPeriods}>{suggesting ? 'Finding periods…' : 'Suggest available periods'}</Btn>
          {suggestions.slice(0,5).map((p,i) => <button type="button" key={`${p.period_id}-${p.day_of_week}-${i}`} style={{...inputStyle,marginTop:6,textAlign:'left'}} onClick={() => {setDayOfWeek(String(p.day_of_week));setPeriodId(p.period_id);setCustomTime(false);setStartTime(p.start_time.slice(0,5));setEndTime(p.end_time.slice(0,5))}}>{DAYS.find(d => d.value === p.day_of_week)?.label} · {p.start_time.slice(0,5)} — {p.explanation}</button>)}
        </div>}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Start Time *</label>
            <input disabled={!isEdit && hasTeachingPeriods && !customTime} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>End Time *</label>
            <input disabled={!isEdit && hasTeachingPeriods && !customTime} type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {!isEdit && (
          <div>
            <label style={labelStyle}>Lesson Units *</label>
            <select value={allocationUnits} onChange={e => setAllocationUnits(e.target.value)} style={inputStyle}>
              <option value="1">Single lesson</option>
              <option value="2">Double lesson / practical</option>
              <option value="3">Triple block</option>
            </select>
          </div>
        )}

        <div>
          <label style={labelStyle}>Room (optional)</label>
          <input value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Room 4B" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>{!isEdit && recurrence === 'once' ? 'Lesson date *' : 'Effective From (optional)'}</label>
          <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} style={inputStyle} />
        </div>

        {(
          <div>
            <label style={labelStyle}>End date (leave blank to repeat weekly)</label>
            <input disabled={!isEdit && recurrence === 'once'} type="date" value={effectiveUntil} onChange={e => setEffectiveUntil(e.target.value)} style={inputStyle} />
          </div>
        )}

        </fieldset>
        <Btn
          onClick={save}
          disabled={saving || deleting || checkingConflicts || (!isEdit && (assignmentsLoading || periodsLoading || !!periodsError || assignments.length === 0))}
        >
          {checkingConflicts ? 'Checking…' : saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save lesson'}
        </Btn>

        {isEdit && (
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" small onClick={handleEndSlot} disabled={saving || deleting}>
              {deleting ? 'Working…' : 'End Slot'}
            </Btn>
            <Btn variant="danger" small onClick={handleDelete} disabled={saving || deleting}>
              Delete
            </Btn>
          </div>
        )}
      </div>
    </div>
  )
}
