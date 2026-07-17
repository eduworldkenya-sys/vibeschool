"use client";

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, C } from '@/components/teacher/ui'

interface Props {
  teacherId: string
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

// Maps a raw Supabase/Postgres error to a stable, teacher-facing message.
// Never show err.message or err.code directly in the UI.
function toFriendlyError(err: { code?: string; message?: string }): string {
  if (err.code === '23P01') {
    // GiST exclusion constraint violation (excl_teacher_overlap / excl_class_overlap)
    return 'This lesson is already scheduled.'
  }
  if (err.code === '42501' || /row-level security/i.test(err.message ?? '')) {
    return 'You are not assigned to this class and subject.'
  }
  if (err.code === '22007' || err.code === '22008' || /time/i.test(err.message ?? '')) {
    return 'The selected time is invalid.'
  }
  return 'Could not save the timetable slot. Try again.'
}

export default function AddSlotModal({ teacherId, onClose, onSaved }: Props) {
  const [saving,            setSaving]            = useState(false)
  const [error,             setError]             = useState<string | null>(null)
  const [assignments,       setAssignments]       = useState<AssignmentOption[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)

  const [teacherClassId, setTeacherClassId] = useState('')
  const [dayOfWeek,      setDayOfWeek]      = useState('1')
  const [startTime,      setStartTime]      = useState('08:00')
  const [endTime,        setEndTime]        = useState('09:00')
  const [room,           setRoom]           = useState('')
  const [effectiveFrom,  setEffectiveFrom]  = useState('')

  useEffect(() => {
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
  }, [teacherId])

  const selectedAssignment = assignments.find(a => a.teacherClassId === teacherClassId) ?? null

  async function save() {
    setError(null)

    if (!selectedAssignment) { setError('Select a class and subject.'); return }
    const { schoolId, classId, subjectId } = selectedAssignment
    if (!schoolId || !classId || !subjectId) { setError('This assignment is missing required data.'); return }
    if (!startTime) { setError('Enter start time.'); return }
    if (!endTime)   { setError('Enter end time.');   return }
    if (startTime >= endTime) { setError('The selected time is invalid.'); return }

    setSaving(true)
    const { error: err } = await supabase
      .from('timetable_slots')
      .insert({
        teacher_id:     teacherId,
        school_id:      schoolId,
        class_id:       classId,
        subject_id:     subjectId,
        day_of_week:    parseInt(dayOfWeek) || 1,
        start_time:     startTime,
        end_time:       endTime,
        room:           room.trim() || null,
        effective_from: effectiveFrom || null,
      })

    setSaving(false)
    if (err) {
      console.error('[Timetable] slot creation failed', err)
      setError(toFriendlyError(err))
      return
    }
    onSaved()
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
          <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary }}>Add Timetable Slot</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.textMuted }}>✕</button>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: C.error, background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>
            {error}
          </div>
        )}

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

        <Btn onClick={save} disabled={saving || assignmentsLoading || assignments.length === 0}>
          {saving ? 'Saving…' : 'Add Slot'}
        </Btn>
      </div>
    </div>
  )
}
