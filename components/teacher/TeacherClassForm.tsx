'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'
import { CLASS_LEVEL_GROUPS, type TeacherClassRole } from '@/lib/teacher/classOptions'

type Props = { schoolId: string; mode: 'onboarding' | 'add' }
type SubjectOption = { name: string }

const inputStyle: React.CSSProperties = {
  width: '100%', marginTop: 5, padding: '11px 12px', borderRadius: 10,
  border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit',
  boxSizing: 'border-box', background: '#fff',
}

export default function TeacherClassForm({ schoolId, mode }: Props) {
  const router = useRouter()
  const [grade, setGrade] = useState('')
  const [stream, setStream] = useState('')
  const [subject, setSubject] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [subjectsLoading, setSubjectsLoading] = useState(true)
  const [role, setRole] = useState<TeacherClassRole>('subject_teacher')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadSubjects() {
      setSubjectsLoading(true)
      const result = await supabase.from('subjects').select('name').is('school_id', null).order('name')
      if (cancelled) return
      if (result.error) {
        setSubjects([])
        setError('Subjects could not be loaded. Please retry.')
      } else {
        const names = Array.from(new Set(((result.data ?? []) as SubjectOption[]).map(row => row.name?.trim()).filter(Boolean)))
        setSubjects(names)
      }
      setSubjectsLoading(false)
    }
    void loadSubjects()
    return () => { cancelled = true }
  }, [])

  async function submit() {
    setError('')
    if (!grade) { setError('Select a grade or form.'); return }
    if (!subject || !subjects.includes(subject)) { setError('Select a canonical subject.'); return }
    if (!schoolId || loading) return

    setLoading(true)
    const { data: classId, error: rpcError } = await supabase.rpc('create_teacher_class_assignment' as never, {
      p_school_id: schoolId,
      p_grade: grade,
      p_stream: stream.trim(),
      p_subject: subject,
      p_is_class_teacher: role === 'class_teacher',
    } as never) as { data: string | null; error: { message: string } | null }
    setLoading(false)

    if (rpcError || !classId) {
      const message = rpcError?.message ?? 'No class was returned.'
      if (message.includes('teacher_school_membership_required')) setError('Your school access must be verified before you add a class.')
      else if (message.includes('invalid_class_level')) setError('Choose a supported Kenyan class level.')
      else if (message.includes('invalid_subject')) setError('Choose a subject from the canonical subject list.')
      else setError('The class could not be added. Please retry.')
      return
    }

    if (mode === 'onboarding') {
      router.push(`/teacher/onboarding/students?class_id=${encodeURIComponent(String(classId))}&school_id=${encodeURIComponent(schoolId)}`)
    } else {
      router.push('/teacher/classhub?added=1')
      router.refresh()
    }
  }

  return (
    <div style={{ display: 'grid', gap: 15 }}>
      <label style={{ fontSize: 12, fontWeight: 800, color: C.textMuted }}>Grade / Form
        <select value={grade} onChange={event => setGrade(event.target.value)} disabled={loading} style={inputStyle}>
          <option value="">Choose level</option>
          {CLASS_LEVEL_GROUPS.map(group => <optgroup key={group.label} label={group.label}>{group.levels.map(level => <option key={level} value={level}>{level}</option>)}</optgroup>)}
        </select>
      </label>
      <label style={{ fontSize: 12, fontWeight: 800, color: C.textMuted }}>Stream <span style={{ fontWeight: 500 }}>(optional)</span>
        <input value={stream} onChange={event => setStream(event.target.value)} maxLength={40} placeholder="East, Blue or A" disabled={loading} style={inputStyle} />
      </label>
      <label style={{ fontSize: 12, fontWeight: 800, color: C.textMuted }}>Subject
        <select value={subject} onChange={event => setSubject(event.target.value)} disabled={loading || subjectsLoading} style={inputStyle}>
          <option value="">{subjectsLoading ? 'Loading subjects…' : 'Choose subject'}</option>
          {subjects.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        <legend style={{ fontSize: 12, fontWeight: 800, color: C.textMuted, marginBottom: 7 }}>Your role</legend>
        {([
          ['subject_teacher', 'Subject teacher', 'Teach this subject in the selected class.'],
          ['class_teacher', 'Class teacher', 'Teach this subject and manage the class.'],
        ] as const).map(([value, label, help]) => (
          <label key={value} style={{ display: 'flex', gap: 10, padding: 11, border: `1px solid ${role === value ? C.accent : C.border}`, borderRadius: 11, cursor: 'pointer' }}>
            <input type="radio" name="teacher-class-role" value={value} checked={role === value} onChange={() => setRole(value)} disabled={loading} />
            <span><strong style={{ display: 'block', fontSize: 13 }}>{label}</strong><span style={{ color: C.textMuted, fontSize: 12 }}>{help}</span></span>
          </label>
        ))}
      </fieldset>
      {error && <div role="alert" style={{ color: C.error, background: '#fef2f2', borderRadius: 10, padding: 11, fontSize: 13, fontWeight: 650 }}>{error}</div>}
      <button type="button" onClick={() => void submit()} disabled={loading || subjectsLoading || !grade || !subject} style={{ padding: 13, border: 0, borderRadius: 12, background: loading || subjectsLoading || !grade || !subject ? '#9ca3af' : C.accent, color: '#fff', fontWeight: 800, fontSize: 15, cursor: loading ? 'wait' : 'pointer' }}>
        {loading ? 'Adding class…' : mode === 'onboarding' ? 'Create or join class →' : 'Add or join class'}
      </button>
      <p style={{ margin: 0, color: C.textMuted, fontSize: 12, lineHeight: 1.5 }}>If this class already exists at your school, VibeSchool reuses it and adds only your subject assignment.</p>
    </div>
  )
}
