'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const dark   = '#1e1b4b'
const accent = '#10b981'

const GRADES = [
  'PP1','PP2',
  'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
  'Grade 7','Grade 8','Grade 9',
  'Form 1','Form 2','Form 3','Form 4',
]

export default function ClassOnboardingPage() {
  const router = useRouter()

  const [grade,   setGrade]   = useState('')
  const [stream,  setStream]  = useState('')
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleCreate() {
    setError('')
    if (!grade)         { setError('Select a grade.'); return }
    if (!subject.trim()) { setError('Subject is required.'); return }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=teacher'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .single()

    if (!profile?.school_id) {
      router.push('/teacher/onboarding/school')
      return
    }

    // Insert subject
    const { data: subjectData, error: subjectErr } = await supabase
      .from('subjects')
      .insert({ name: subject.trim() })
      .select('id')
      .single()

    if (subjectErr) {
      setLoading(false)
      setError(subjectErr.message)
      return
    }

    // Insert class
    const { data: classData, error: classErr } = await supabase
      .from('classes')
      .insert({
        teacher_id: user.id,
        school_id:  profile.school_id,
        name:       grade,
        stream:     stream.trim() || null,
        subject:    subject.trim(),
      })
      .select('id')
      .single()

    if (classErr) {
      setLoading(false)
      setError(classErr.message)
      return
    }

    // Link teacher to class
    const { error: tcErr } = await supabase
      .from('teacher_classes')
      .insert({
        school_id:        profile.school_id,
        teacher_id:       user.id,
        class_id:         classData.id,
        subject_id:       subjectData.id,
        is_class_teacher: true,
      })

    if (tcErr) {
      setLoading(false)
      setError(tcErr.message)
      return
    }

    setLoading(false)
    router.push('/teacher/onboarding/students')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: dark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 12px' }}>📚</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: dark }}>Your Class</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Step 2 of 3</div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= 2 ? accent : '#e5e7eb' }} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>Grade / Class</label>
            <select value={grade} onChange={e => setGrade(e.target.value)} disabled={loading}
              style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}>
              <option value="" disabled>Select grade</option>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>Stream <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
            <input type="text" value={stream} onChange={e => setStream(e.target.value)}
              placeholder="e.g. East, Blue, A" disabled={loading}
              style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>Your Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Mathematics, Science" disabled={loading}
              style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{error}</p>}

          <button onClick={handleCreate} disabled={loading}
            style={{ padding: '13px 20px', borderRadius: 12, border: 'none', background: accent, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
            {loading ? 'Creating…' : 'Create Class →'}
          </button>
        </div>
      </div>
    </div>
  )
}
