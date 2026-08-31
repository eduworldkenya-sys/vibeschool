"use client";
export const dynamic = "force-dynamic";
import { Card, SectionLabel, Btn, C, ReadinessChip } from '@/components/teacher/ui'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const dark   = C.dark
const accent = C.accent

const GRADES = [
  'PP1','PP2',
  'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
  'Grade 7','Grade 8','Grade 9',
  'Form 1','Form 2','Form 3','Form 4',
  'Grade 10','Grade 11','Grade 12',
]

const SUBJECTS = [
  'Mathematics','English','Kiswahili','Science and Technology',
  'Social Studies','Religious Education','Creative Arts and Sports',
  'Agriculture and Nutrition','Home Science','Indigenous Languages',
  'French','German','Arabic','Kenyan Sign Language',
  'Biology','Chemistry','Physics','History and Government','Geography',
  'Business Studies','Computer Studies','Christian Religious Education',
  'Islamic Religious Education','Hindu Religious Education','Music','Art and Design',
]

export default function ClassOnboardingPage() {
  const router  = useRouter()
  const [grade,   setGrade]   = useState('')
  const [stream,  setStream]  = useState('')
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleCreate() {
    setError('')
    if (!grade)   { setError('Select a grade.'); return }
    if (!subject) { setError('Select a subject.'); return }
    setLoading(true)

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) { setLoading(false); router.push('/'); return }

    // A teacher needs only the school relationship required to create the class.
    // Avoid probing profiles + teacher_profiles + school_members in parallel.
    let schoolId: string | null = null
    const { data: memberData } = await supabase
      .from('school_members')
      .select('school_id')
      .eq('profile_id', user.id)
      .maybeSingle()

    schoolId = memberData?.school_id ?? null

    if (!schoolId) {
      const { data: provisionalId, error: provisionalError } = await supabase.rpc('create_provisional_teacher_class', {
        p_grade: grade,
        p_stream: stream.trim(),
        p_subject: subject,
      })
      setLoading(false)
      if (provisionalError || !provisionalId) {
        setError('We could not save this provisional class. ' + (provisionalError?.message ?? 'Please retry.'))
        return
      }
      router.push('/teacher/provisional?class=saved')
      return
    }

    const { data: classId, error: fnErr } = await supabase.rpc('onboard_teacher_class', {
      p_school_id:  schoolId,
      p_teacher_id: user.id,
      p_grade:      grade,
      p_stream:     stream.trim(),
      p_subject:    subject,
    })
    if (fnErr || !classId) {
      setLoading(false)
      setError('Failed to create class: ' + (fnErr?.message ?? 'No class was returned'))
      return
    }

    setLoading(false)
    // Carry forward the authoritative result of the create operation.
    // The next step must not query teacher_classes just to rediscover it.
    router.push(`/teacher/onboarding/students?class_id=${encodeURIComponent(String(classId))}&school_id=${encodeURIComponent(schoolId)}`)
  }

  const inp: React.CSSProperties = { width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase' as const }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: dark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 12px' }}>📚</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: dark }}>Your Class</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Step 2 of 3</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {[1,2,3].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= 2 ? accent : C.border }} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Grade / Class</label>
            <select value={grade} onChange={e => setGrade(e.target.value)} disabled={loading} style={inp}>
              <option value="">Select grade</option>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Stream <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
            <input type="text" value={stream} onChange={e => setStream(e.target.value)} placeholder="e.g. East, Blue, A" disabled={loading} style={inp} />
          </div>
          <div>
            <label style={lbl}>Your Subject</label>
            <select value={subject} onChange={e => setSubject(e.target.value)} disabled={loading} style={inp}>
              <option value="">Select subject</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {error && <p style={{ color: C.error, fontSize: 13, fontWeight: 600 }}>{error}</p>}
          <button onClick={handleCreate} disabled={loading} style={{ padding: '13px 20px', borderRadius: 12, border: 'none', background: loading ? '#9ca3af' : accent, color: '#fff', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
            {loading ? 'Creating…' : 'Create Class →'}
          </button>
          <button onClick={() => router.push('/teacher/pulse')} disabled={loading} style={{ padding: '13px 20px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 4, width: '100%' }}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
