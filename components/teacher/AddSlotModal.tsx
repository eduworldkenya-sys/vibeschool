'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, C } from '@/components/teacher/ui'

interface Props {
  teacherId: string
  schoolId:  string | null
  onClose:   () => void
  onSaved:   () => void
}

interface ClassOption {
  id:      string
  name:    string
  stream:  string | null
  subject: string | null
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

export default function AddSlotModal({ teacherId, schoolId, onClose, onSaved }: Props) {
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [classes,        setClasses]        = useState<ClassOption[]>([])
  const [classesLoading, setClassesLoading] = useState(true)

  const [classId,       setClassId]       = useState('')
  const [subjectId,     setSubjectId]     = useState<string | null>(null)
  const [dayOfWeek,     setDayOfWeek]     = useState('1')
  const [startTime,     setStartTime]     = useState('08:00')
  const [endTime,       setEndTime]       = useState('09:00')
  const [room,          setRoom]          = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')

  useEffect(() => {
    async function loadClasses() {
      const { data } = await supabase
        .from('classes')
        .select('id, name, stream, subject')
        .eq('teacher_id', teacherId)
        .order('name', { ascending: true })
      setClasses(data ?? [])
      setClassesLoading(false)
    }
    loadClasses()
  }, [teacherId])

  async function handleClassChange(id: string) {
    setClassId(id)
    const selected = classes.find(c => c.id === id)
    if (!selected?.subject) return
    let query = supabase.from('subjects').select('id').eq('name', selected.subject)
    if (schoolId) query = query.eq('school_id', schoolId)
    const { data } = await query.maybeSingle()
    setSubjectId(data?.id ?? null)
  }

  async function save() {
    setError(null)
    if (!classId)  { setError('Select a class.');   return }
    if (!startTime){ setError('Enter start time.'); return }
    if (!endTime)  { setError('Enter end time.');   return }
    if (startTime >= endTime) { setError('End time must be after start time.'); return }

    setSaving(true)
    const { error: err } = await supabase
      .from('timetable_slots')
      .insert({
        school_id:      schoolId,
        teacher_id:     teacherId,
        class_id:       classId,
        subject_id:     subjectId,
        day_of_week:    parseInt(dayOfWeek),
        start_time:     startTime,
        end_time:       endTime,
        room:           room.trim() || null,
        effective_from: effectiveFrom || null,
      })

    setSaving(false)
    if (err) { setError(err.message.includes("overlap") ? "This time slot overlaps with an existing class. Choose a different time." : "Failed to add slot. Please try again."); return }
    onSaved()
  }

  const selectedClass = classes.find(c => c.id === classId)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: C.bg,
        borderRadius: '20px 20px 0 0',
        padding: '24px 20px 60px',
        width: '100%', maxWidth: 480,
        display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
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
          <label style={labelStyle}>Class *</label>
          {classesLoading ? (
            <div style={{ fontSize: 13, color: C.textMuted }}>Loading classes…</div>
          ) : classes.length === 0 ? (
            <div style={{ fontSize: 13, color: C.error }}>
              No classes found. Please create a class in ClassHub first.
            </div>
          ) : (
            <select value={classId} onChange={e => handleClassChange(e.target.value)} style={inputStyle}>
              <option value="">Select class</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.stream ? ` ${c.stream}` : ''}{c.subject ? ` — ${c.subject}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedClass && (
          <div style={{ fontSize: 12, color: C.textMuted, background: C.surface, padding: '8px 12px', borderRadius: 8 }}>
            Subject: <strong>{selectedClass.subject ?? '—'}</strong>
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

        <Btn onClick={save} disabled={saving || classesLoading || classes.length === 0}>
          {saving ? 'Saving…' : 'Add Slot'}
        </Btn>
      </div>
    </div>
  )
}
