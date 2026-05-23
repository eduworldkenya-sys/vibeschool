'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, C } from '@/components/teacher/ui'

interface Props {
  teacherId: string
  schoolId:  string | null
  onClose:   () => void
  onSaved:   () => void
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

const GRADES = [
  'PP1','PP2',
  'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
  'Grade 7','Grade 8','Grade 9',
]

const SUBJECTS = [
  'Mathematics','English','Kiswahili','Science and Technology',
  'Social Studies','Religious Education','Creative Arts and Sports',
  'Agriculture and Nutrition','Home Science','Indigenous Languages',
  'French','German','Arabic','Kenyan Sign Language',
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
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const [className,  setClassName]  = useState('')
  const [subject,    setSubject]    = useState('')
  const [dayOfWeek,  setDayOfWeek]  = useState('1')
  const [startTime,  setStartTime]  = useState('08:00')
  const [endTime,    setEndTime]    = useState('09:00')
  const [room,       setRoom]       = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')

  async function save() {
    setError(null)
    if (!className)  { setError('Select a class.');   return }
    if (!subject)    { setError('Select a subject.'); return }
    if (!startTime)  { setError('Enter start time.'); return }
    if (!endTime)    { setError('Enter end time.');   return }
    if (startTime >= endTime) { setError('End time must be after start time.'); return }

    setSaving(true)

    // Find or create class record
    let classId: string | null = null

    const { data: existingClass } = await supabase
      .from('classes')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('name', className)
      .maybeSingle()

    if (existingClass) {
      classId = existingClass.id
    } else {
      const { data: newClass, error: classErr } = await supabase
        .from('classes')
        .insert({ teacher_id: teacherId, school_id: schoolId, name: className, subject })
        .select('id')
        .single()
      if (classErr || !newClass) { setError('Failed to create class: ' + classErr?.message); setSaving(false); return }
      classId = newClass.id
    }

    // Find or create subject record
    let subjectId: string | null = null

    if (schoolId) {
      const { data: existingSubject } = await supabase
        .from('subjects')
        .select('id')
        .eq('school_id', schoolId)
        .eq('name', subject)
        .maybeSingle()

      if (existingSubject) {
        subjectId = existingSubject.id
      } else {
        const { data: newSubject } = await supabase
          .from('subjects')
          .insert({ school_id: schoolId, name: subject })
          .select('id')
          .single()
        subjectId = newSubject?.id ?? null
      }
    }

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
    if (err) { setError(err.message); return }
    onSaved()
  }

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
          <select value={className} onChange={e => setClassName(e.target.value)} style={inputStyle}>
            <option value="">Select grade</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Subject *</label>
          <select value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle}>
            <option value="">Select subject</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
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

        <Btn onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Add Slot'}
        </Btn>
      </div>
    </div>
  )
}
