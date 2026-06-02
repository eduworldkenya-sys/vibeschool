"use client";
import { Card, SectionLabel, Btn, C, ReadinessChip } from '@/components/teacher/ui'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const dark   = C.dark
const accent = C.accent

interface StudentRow {
  name:             string
  admission_number: string
}

export default function StudentsOnboardingPage() {
  const router = useRouter()

  const [students, setStudents] = useState<StudentRow[]>([
    { name: '', admission_number: '' },
  ])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  function addRow() {
    setStudents(s => [...s, { name: '', admission_number: '' }])
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
      router.push('/teacher')
      return
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=teacher'); return }

    const { data: tcData } = await supabase
      .from('teacher_classes')
      .select('class_id, school_id')
      .eq('teacher_id', user.id)
      .eq('is_class_teacher', true)
      .single()

    if (!tcData) {
      router.push('/teacher/onboarding/class')
      return
    }

    const { error: insertErr } = await supabase
      .from('students')
      .insert(valid.map(s => ({
        class_id:         tcData.class_id,
        name:             s.name.trim(),
        admission_number: s.admission_number.trim() || null,
      })))

    if (insertErr) {
      setLoading(false)
      setError(insertErr.message)
      return
    }

    setLoading(false)
    router.push('/teacher')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: dark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 12px' }}>👥</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: dark }}>Add Students</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Step 3 of 3 — you can add more later</div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: accent }} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {students.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder={`Student ${i + 1} name`}
                value={s.name}
                onChange={e => updateRow(i, 'name', e.target.value)}
                disabled={loading}
                style={{ flex: 2, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
              />
              <input
                type="text"
                placeholder="Adm. No."
                value={s.admission_number}
                onChange={e => updateRow(i, 'admission_number', e.target.value)}
                disabled={loading}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
              />
              {students.length > 1 && (
                <button onClick={() => removeRow(i)} disabled={loading}
                  style={{ background: 'none', border: 'none', color: C.error, fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
              )}
            </div>
          ))}
        </div>

        <button onClick={addRow} disabled={loading}
          style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1.5px dashed ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14 }}>
          + Add Another Student
        </button>

        {error && <p style={{ color: C.error, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => router.push('/teacher')} disabled={loading}
            style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'transparent', color: C.textMuted, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Skip for now
          </button>
          <button onClick={handleSave} disabled={loading}
            style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: accent, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Saving…' : "Done — Go to Dashboard →"}
          </button>
        </div>

      </div>
    </div>
  )
}
