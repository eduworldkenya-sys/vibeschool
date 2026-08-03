"use client";

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, C } from '@/components/teacher/ui'
import { updateTimetableSlot, expireTimetableSlot, deleteTimetableSlot, SlotRpcError } from '@/lib/teaching/slots'
import type { EditableSlot } from '@/lib/teaching/types'

interface Props {
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

// Shape returned by the Supabase nested select before flattening.
interface TeacherClassRow {
  id:         string
  school_id:  string
  class_id:   string
  subject_id: string
  classes:    { name: string; stream: string | null } | null
  subjects:   { name: string } | null
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

export default function AddSlotModal({ teacherId, editSlot, onClose, onSaved }: Props) {
  const isEdit = !!editSlot

  const [saving,            setSaving]            = useState(false)
  const [deleting,          setDeleting]          = useState(false)
  const [error,             setError]             = useState<string | null>(null)
  const [assignments,       setAssignments]       = useState<AssignmentOption[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(!isEdit)

  const [teacherClassId, setTeacherClassId] = useState('')
  const [dayOfWeek,      setDayOfWeek]      = useState(editSlot ? String(editSlot.dayOfWeek) : '1')
  const [startTime,      setStartTime]      = useState(editSlot?.startTime ?? '08:00')
  const [endTime,        setEndTime]        = useState(editSlot?.endTime ?? '09:00')
  const [room,           setRoom]           = useState(editSlot?.room ?? '')
  const [effectiveFrom,  setEffectiveFrom]  = useState(editSlot?.effectiveFrom ?? nairobiTodayISO())
  const [effectiveUntil, setEffectiveUntil] = useState(editSlot?.effectiveUntil ?? '')

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
      const { data, error: err } = await supabase
        .from('teacher_classes')
        .select(`
          id,
          school_id,
          class_id,
          subject_id,
          classes ( name, stream ),
          subjects ( name )
        `)
        .eq('teacher_id', teacherId)

      if (err) {
        console.error('[Timetable] failed to load teacher_classes', err)
        setError('Failed to load your assigned classes. Please close and try again.')
        setAssignmentsLoading(false)
        return
      }

      const rows = (data ?? []) as unknown as TeacherClassRow[]
      const options: AssignmentOption[] = rows
        .filter(r => r.classes && r.subjects) // drop rows with a broken/deleted join target
        .map(r => ({
          teacherClassId: r.id,
          schoolId:       r.school_id,
          classId:        r.class_id,
          subjectId:      r.subject_id,
          className:      r.classes!.stream ? `${r.classes!.name} ${r.classes!.stream}` : r.classes!.name,
          subjectName:    r.subjects!.name,
        }))
        .sort((a, b) => a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName))

      setAssignments(options)
      setAssignmentsLoading(false)
    }
    loadAssignments()
  }, [teacherId, isEdit])

  const selectedAssignment = assignments.find(a => a.teacherClassId === teacherClassId) ?? null

  async function save() {
    // Synchronous re-entrancy guard — closes the double-tap gap that the
    // `saving` state alone can't catch (see submittingRef declaration above).
    if (submittingRef.current) return

    setError(null)

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
    setSaving(true)
    // All conflict/assignment/school checks happen inside this one DB
    // transaction (create_timetable_slot). school_id and teacher_id are
    // never sent from the client — the RPC derives both from the
    // caller's own auth identity and their teacher_classes assignment.
    const { error: err } = await supabase.rpc('create_timetable_slot', {
      p_class_id:        classId,
      p_subject_id:      subjectId,
      p_day_of_week:     parseInt(dayOfWeek) || 1,
      p_start_time:      startTime,
      p_end_time:        endTime,
      p_room:            room.trim() || undefined,
      p_effective_from:  effectiveFrom || undefined,
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
      onClick={onClose}
    >
      <div style={{
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
            {isEdit ? 'Edit Timetable Slot' : 'Add Timetable Slot'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.textMuted }}>✕</button>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: C.error, background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>
            {error}
          </div>
        )}

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
                No class/subject assignments found. Ask an admin to assign you in ClassHub first.
              </div>
            ) : (
              <select value={teacherClassId} onChange={e => setTeacherClassId(e.target.value)} style={inputStyle}>
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

        <div>
          <label style={labelStyle}>Day *</label>
          <select value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)} style={inputStyle}>
            {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Start Time *</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>End Time *</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Room (optional)</label>
          <input value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Room 4B" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Effective From (optional)</label>
          <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} style={inputStyle} />
        </div>

        {isEdit && (
          <div>
            <label style={labelStyle}>Effective Until (optional)</label>
            <input type="date" value={effectiveUntil} onChange={e => setEffectiveUntil(e.target.value)} style={inputStyle} />
          </div>
        )}

        <Btn
          onClick={save}
          disabled={saving || deleting || (!isEdit && (assignmentsLoading || assignments.length === 0))}
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Slot'}
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
