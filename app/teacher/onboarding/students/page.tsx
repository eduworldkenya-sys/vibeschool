"use client";
export const dynamic = "force-dynamic";
import { C } from '@/components/teacher/ui'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const dark   = C.dark
const accent = C.accent

interface StudentRow {
  name: string
  admission_number: string
  request_id: string
  saved_id?: string
}

function newStudentRow(): StudentRow {
  return { name: '', admission_number: '', request_id: crypto.randomUUID() }
}

export default function StudentsOnboardingPage() {
  const router = useRouter()
  const [students, setStudents] = useState<StudentRow[]>([
    newStudentRow(),
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function addRow() {
    setStudents(s => [...s, newStudentRow()])
  }

  function removeRow(i: number) {
    setStudents(s => s.filter((_, idx) => idx !== i))
  }

  function updateRow(i: number, field: keyof StudentRow, value: string) {
    setStudents(s => s.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  async function handleSave() {
    setError('')
    const valid = students.filter(s => s.name.trim())
    if (valid.length === 0) {
      router.replace('/teacher/pulse')
      return
    }

    if (loading) return
    setLoading(true)
    let confirmed = 0
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Sign in again before adding learners.')
      const params = new URLSearchParams(window.location.search)
      const classId = params.get('class_id')
      const schoolId = params.get('school_id')
      if (!classId || !schoolId) throw new Error('Open the class you manage before adding learners.')
      const { data: context, error: contextError } = await supabase.rpc('teacher_get_operating_context', { p_requested_school_id: schoolId })
      const ctx = context as { school_id?: string; classes?: Array<{ class_id: string; is_class_teacher: boolean }> } | null
      if (contextError || ctx?.school_id !== schoolId || !ctx.classes?.some(c => c.class_id === classId && c.is_class_teacher)) {
        throw new Error('Only the verified class teacher can add learners to this class.')
      }
      const addedStudentIds: string[] = []
      for (const s of valid) {
        if (s.saved_id) { confirmed += 1; addedStudentIds.push(s.saved_id); continue }
        const { data: studentId, error: insertErr } = await supabase.rpc('teacher_add_student_v2', {
          p_name: s.name.trim(), p_admission_number: s.admission_number.trim() || null,
          p_class_id: classId, p_school_id: schoolId, p_request_id: s.request_id,
        })
        if (insertErr || typeof studentId !== 'string' || !studentId) {
          throw new Error(insertErr?.message.includes('admission_identifier_conflict')
            ? 'That admission number is already in use. Check the existing learner.'
            : 'The next learner could not be confirmed. Retry to finish saving.')
        }
        confirmed += 1
        setStudents(rows => rows.map(row => row.request_id === s.request_id ? { ...row, saved_id: studentId } : row))
        addedStudentIds.push(studentId)
      }
      router.replace(`/teacher/classhub/${classId}/student/${addedStudentIds[0]}?tab=about&setup=1`)
    } catch (saveError) {
      setError(`${confirmed ? `${confirmed} learner${confirmed === 1 ? '' : 's'} confirmed. ` : ''}${saveError instanceof Error ? saveError.message : 'Saving failed. Please retry.'} Your entries are retained; retrying uses the same save requests.`)
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 20, padding: 20, border: '1px solid #e5e7eb', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, color: dark, margin: 0 }}>Add learners</h1>
          <p style={{ fontSize: 13, color: C.textMuted }}>Enter names and optional admission numbers. You can add more later.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {students.map((s, i) => (
            <div key={s.request_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }}>
              {s.saved_id && <span role="status">Learner saved</span>}
              <input type="text" aria-label={`Learner ${i + 1} name`} placeholder={`Learner ${i + 1} name`} value={s.name} onChange={e => updateRow(i, 'name', e.target.value)} disabled={loading || Boolean(s.saved_id)}
                style={{ flex: 2, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              <input type="text" aria-label={`Student ${i + 1} admission number (optional)`} placeholder="Adm. No. (optional)" value={s.admission_number} onChange={e => updateRow(i, 'admission_number', e.target.value)} disabled={loading || Boolean(s.saved_id)}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              {students.length > 1 && (
                <button aria-label={`Remove learner ${i + 1}`} onClick={() => removeRow(i)} disabled={loading} style={{ background: 'none', border: 'none', color: C.error, minHeight: 44, fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
              )}
            </div>
          ))}
        </div>

        <button onClick={addRow} disabled={loading} style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1.5px dashed ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14 }}>
          + Add Another Student
        </button>

        {error && <p role="alert" style={{ color: C.error, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => router.push('/teacher')} disabled={loading} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'transparent', color: C.textMuted, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Skip for now
          </button>
          <button onClick={handleSave} disabled={loading} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: accent, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Saving…' : "Add learners →"}
          </button>
        </div>
      </div>
    </div>
  )
}
