'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'
import { type TeacherClassRole } from '@/lib/teacher/classOptions'

type Props = { schoolId: string; mode: 'onboarding' | 'add' }
type LevelAuthority = { state?: 'ready' | 'needs_resolution'; levels?: string[] }
type SubjectAuthority = { state?: 'ready' | 'needs_resolution'; subjects?: string[] }

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
  const [levels, setLevels] = useState<string[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [authorityLoading, setAuthorityLoading] = useState(true)
  const [subjectsLoading, setSubjectsLoading] = useState(false)
  const [authorityState, setAuthorityState] = useState<'ready' | 'needs_resolution' | 'error'>('ready')
  const [role, setRole] = useState<TeacherClassRole>('subject_teacher')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setGrade('')
    setSubject('')
    setSubjects([])
    setLevels([])
    setAuthorityLoading(true)
    setAuthorityState('ready')
    setError('')
    void (async () => {
      try {
        const result = await supabase.rpc('get_allowed_teaching_levels' as never, { p_school_id: schoolId } as never)
        const data = result.data as LevelAuthority | null
        const rpcError = result.error
        if (cancelled) return
        if (rpcError) {
          setAuthorityState('error')
          setError('School teaching levels could not be resolved. Retry or change school.')
          return
        }
        const authority = (data ?? {}) as LevelAuthority
        if (authority.state !== 'ready' || !(authority.levels ?? []).length) {
          setAuthorityState('needs_resolution')
          setError('This school has no verified teaching-level authority yet. Choose another verified school or resolve the school level before adding a class.')
          return
        }
        setLevels(authority.levels ?? [])
      } catch {
        if (!cancelled) {
          setAuthorityState('error')
          setError('School teaching levels could not be resolved. Retry or change school.')
        }
      } finally {
        if (!cancelled) setAuthorityLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [schoolId, retryNonce])

  useEffect(() => {
    let cancelled = false
    setSubject('')
    setSubjects([])
    setSubjectsLoading(false)
    if (!grade || authorityState !== 'ready') return () => { cancelled = true }
    setError('')
    setSubjectsLoading(true)
    void (async () => {
      try {
        const result = await supabase.rpc('get_allowed_teaching_subjects' as never, { p_school_id: schoolId, p_grade: grade } as never)
        const data = result.data as SubjectAuthority | null
        const rpcError = result.error
        if (cancelled) return
        if (rpcError) {
          setError('Subjects could not be resolved for this level. Choose another level or retry.')
          return
        }
        const authority = (data ?? {}) as SubjectAuthority
        setSubjects(authority.state === 'ready' ? (authority.subjects ?? []) : [])
        if (authority.state !== 'ready') setError('Subjects are unavailable until the school level authority is resolved.')
      } catch {
        if (!cancelled) setError('Subjects could not be resolved for this level. Choose another level or retry.')
      } finally {
        if (!cancelled) setSubjectsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [authorityState, grade, schoolId])

  async function submit() {
    setError('')
    if (!grade || !levels.includes(grade)) { setError('Select a valid level for this school.'); return }
    if (!subject || !subjects.includes(subject)) { setError('Select a subject valid for this level.'); return }
    if (!schoolId || loading) return

    setLoading(true)
    try {
    const { data: classId, error: rpcError } = await supabase.rpc('create_teacher_class_assignment' as never, {
      p_school_id: schoolId,
      p_grade: grade,
      p_stream: stream.trim(),
      p_subject: subject,
      p_is_class_teacher: role === 'class_teacher',
    } as never) as { data: string | null; error: { message: string } | null }

    if (rpcError || !classId) {
      const message = rpcError?.message ?? 'No class was returned.'
      if (message.includes('teacher_school_membership_required')) setError('Your school access must be verified before you add a class.')
      else if (message.includes('school_level_authority_unresolved')) setError('This school must have its teaching levels resolved before classes can be added.')
      else if (message.includes('invalid_class_level_for_school')) setError('That level is not valid for this school.')
      else if (message.includes('invalid_subject_for_level')) setError('That subject is not valid for the selected level.')
      else if (message.includes('invalid_subject')) setError('Choose a canonical subject.')
      else setError('The class could not be added. Please retry.')
      return
    }

    if (mode === 'onboarding' && role === 'class_teacher') {
      router.push(`/teacher/onboarding/students?class_id=${encodeURIComponent(String(classId))}&school_id=${encodeURIComponent(schoolId)}`)
    } else {
      router.push('/teacher/classhub?added=1')
      router.refresh()
    }
    } catch {
      setError('The class could not be added. Your choices are still here. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  const disabled = loading || authorityLoading || authorityState !== 'ready'

  return (
    <div style={{ display: 'grid', gap: 15 }}>
      <label style={{ fontSize: 12, fontWeight: 800, color: C.textMuted }}>Grade / Form
        <select value={grade} onChange={event => setGrade(event.target.value)} disabled={disabled} style={inputStyle}>
          <option value="">{authorityLoading ? 'Loading valid levels…' : authorityState === 'ready' ? 'Choose level' : 'Level authority unavailable'}</option>
          {levels.map(level => <option key={level} value={level}>{level}</option>)}
        </select>
      </label>
      <label style={{ fontSize: 12, fontWeight: 800, color: C.textMuted }}>Stream <span style={{ fontWeight: 500 }}>(optional)</span>
        <input value={stream} onChange={event => setStream(event.target.value)} maxLength={40} placeholder="East, Blue or A" disabled={disabled} style={inputStyle} />
      </label>
      <label style={{ fontSize: 12, fontWeight: 800, color: C.textMuted }}>Subject
        <select value={subject} onChange={event => setSubject(event.target.value)} disabled={disabled || !grade || subjectsLoading} style={inputStyle}>
          <option value="">{!grade ? 'Choose level first' : subjectsLoading ? 'Loading valid subjects…' : 'Choose subject'}</option>
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
            <input type="radio" name="teacher-class-role" value={value} checked={role === value} onChange={() => setRole(value)} disabled={disabled} />
            <span><strong style={{ display: 'block', fontSize: 13 }}>{label}</strong><span style={{ color: C.textMuted, fontSize: 12 }}>{help}</span></span>
          </label>
        ))}
      </fieldset>
      {error && <div role="alert" style={{ color: C.error, background: '#fef2f2', borderRadius: 10, padding: 11, fontSize: 13, fontWeight: 650 }}>{error}{authorityState === 'error' && <button type="button" onClick={() => setRetryNonce(n => n + 1)} style={{ display: 'block', marginTop: 8, minHeight: 44 }}>Retry class setup</button>}</div>}
      <button type="button" onClick={() => void submit()} disabled={disabled || subjectsLoading || !grade || !subject} style={{ padding: 13, border: 0, borderRadius: 12, background: disabled || subjectsLoading || !grade || !subject ? '#9ca3af' : C.accent, color: '#fff', fontWeight: 800, fontSize: 15, cursor: loading ? 'wait' : 'pointer' }}>
        {loading ? 'Adding class…' : mode === 'onboarding' ? 'Create or join class →' : 'Add or join class'}
      </button>
      <p style={{ margin: 0, color: C.textMuted, fontSize: 12, lineHeight: 1.5 }}>If this class already exists at your school, VibeSchool reuses it and adds only your subject assignment.</p>
    </div>
  )
}
