'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const dark   = '#1e1b4b'
const accent = '#10b981'

export default function LinkChildPage() {
  const router = useRouter()

  const [claimCode, setClaimCode] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')

  async function handleLink() {
    setError('')
    setSuccess('')

    if (!claimCode.trim()) { setError('Enter a claim code.'); return }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=parent'); return }

    const { data: codeRow } = await supabase
      .from('student_claim_codes')
      .select('id, student_id, claimed')
      .eq('code', claimCode.trim().toUpperCase())
      .single()

    if (!codeRow) {
      setLoading(false)
      setError('Invalid claim code. Check the code and try again.')
      return
    }

    if (codeRow.claimed) {
      setLoading(false)
      setError('This claim code has already been used.')
      return
    }

    // 1. Fetch student first
    const { data: student } = await supabase
      .from('students')
      .select('class_id, name')
      .eq('id', codeRow.student_id)
      .single()

    if (!student) {
      setLoading(false)
      setError('Student record not found. Contact the school.')
      return
    }

    // 2. Fetch school_id only if class exists
    const schoolId = student.class_id
      ? ((await supabase
          .from('classes')
          .select('school_id')
          .eq('id', student.class_id)
          .single()).data?.school_id ?? null)
      : null

    // 3. Transfer ownership
    const { error: stuErr } = await supabase
      .from('students')
      .update({ profile_id: user.id })
      .eq('id', codeRow.student_id)

    if (stuErr) {
      setLoading(false)
      setError('Failed to link child. Please try again.')
      return
    }

    // 4. Link parent — check for existing link first
    const { data: existing } = await supabase
      .from('parent_student_links')
      .select('id')
      .eq('parent_id', user.id)
      .eq('student_id', codeRow.student_id)
      .single()

    if (!existing) {
      const { error: linkErr } = await supabase.from('parent_student_links').insert({
        parent_id:       user.id,
        student_id:      codeRow.student_id,
        school_id:       schoolId,
        relationship:    'parent',
        is_primary:      true,
        can_pickup:      true,
        receives_alerts: true,
      })
      if (linkErr) {
        setLoading(false)
        setError('Failed to link child. Please try again.')
        return
      }
    }

    // 5. Mark claimed only after all writes succeed
    await supabase
      .from('student_claim_codes')
      .update({ claimed: true, claimed_by: user.id })
      .eq('id', codeRow.id)

    setLoading(false)
    setSuccess(`${student.name} linked successfully!`)
    setTimeout(() => router.push('/parent'), 1500)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: dark }}>Link Your Child</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>
            Ask your child's class teacher for the 6-character claim code
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
        {success && <p style={{ color: '#10b981', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{success}</p>}

        <button
          onClick={handleLink}
          disabled={loading || claimCode.length < 6}
          style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: claimCode.length < 6 ? '#e5e7eb' : accent, color: claimCode.length < 6 ? '#9ca3af' : '#fff', fontWeight: 700, fontSize: 15, cursor: claimCode.length < 6 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
        >
          {loading ? 'Linking…' : 'Link Child'}
        </button>

        <button
          onClick={() => router.push('/parent')}
          style={{ width: '100%', marginTop: 10, padding: '12px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Skip for now
        </button>

      </div>
    </div>
  )
}
