"use client";

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const dark   = '#1e1b4b'
const accent = '#6366f1'

export default function StudentClaimPage() {
  const router = useRouter()

  const [claimCode, setClaimCode] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')

  async function handleClaim() {
    setError('')
    setSuccess('')
    if (!claimCode.trim()) { setError('Enter a claim code.'); return }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=student'); return }

    const code = claimCode.trim().toUpperCase()

    const { data: codeRow } = await supabase
      .from('student_claim_codes')
      .select('id, student_id, claimed, expires_at, role')
      .eq('code', code)
          .eq('role', 'student')
      .single()

    if (!codeRow) {
      setLoading(false)
      setError('Claim code not found. Check with your teacher.')
      return
    }

    if (codeRow.claimed) {
      setLoading(false)
      setError('This claim code has already been used.')
      return
    }

    if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
      setLoading(false)
      setError('This claim code has expired. Ask your teacher to regenerate it.')
      return
    }

    const { data: student } = await supabase
      .from('students')
      .select('id, class_id, admission_number')
      .eq('id', codeRow.student_id)
      .single()

    if (!student) {
      setLoading(false)
      setError('Student record not found. Contact your teacher.')
      return
    }

    // Null-safe class fetch
    const schoolId = student.class_id
      ? ((await supabase
          .from('classes')
          .select('school_id')
          .eq('id', student.class_id)
          .single()).data?.school_id ?? null)
      : null

    // 1. Update student profile_id
    const { error: stuErr } = await supabase
      .from('students')
      .update({ profile_id: user.id })
      .eq('id', student.id)

    if (stuErr) {
      setLoading(false)
      setError('Failed to link account. Please try again.')
      return
    }

    // 2. Upsert student_profiles — safe on retry
    const { error: spErr } = await supabase
      .from('student_profiles')
      .upsert({
        profile_id:   user.id,
        school_id:    schoolId,
        admission_no: student.admission_number ?? '',
        gender:       null,
      }, { onConflict: 'profile_id' })

    if (spErr) {
      setLoading(false)
      setError('Failed to create student profile. Please try again.')
      return
    }

    // 3. Update profiles.school_id if available
    if (schoolId) {
      await supabase
        .from('profiles')
        .update({ school_id: schoolId })
        .eq('id', user.id)
    }

    // 4. Mark claimed only after all writes succeed
    await supabase
      .from('student_claim_codes')
      .update({ claimed: true, claimed_by: user.id })
      .eq('id', codeRow.id)

    setLoading(false)
    setSuccess('Account linked! Taking you to your dashboard…')
    setTimeout(() => router.push('/student'), 1500)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎒</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: dark }}>Enter Your Claim Code</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>
            Get the code from your class teacher to activate your student account.
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
            Claim Code
          </label>
          <input
            type="text"
            value={claimCode}
            onChange={e => setClaimCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="e.g. A1B2C3"
            maxLength={6}
            disabled={loading}
            style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 20, fontWeight: 800, letterSpacing: 4, textAlign: 'center', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {error   && <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</p>}
        {success && <p style={{ color: accent,    fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{success}</p>}

        <button
          onClick={handleClaim}
          disabled={loading || claimCode.length < 6}
          style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: claimCode.length < 6 ? '#e5e7eb' : accent, color: claimCode.length < 6 ? '#9ca3af' : '#fff', fontWeight: 700, fontSize: 15, cursor: claimCode.length < 6 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
        >
          {loading ? 'Linking…' : 'Activate Account'}
        </button>

      </div>
    </div>
  )
}
