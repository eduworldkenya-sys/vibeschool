"use client";
export const dynamic = "force-dynamic";

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const dark   = '#1e1b4b'
const accent = '#6366f1'

type StudentClaimResult = { status?: string }

export default function StudentClaimPage() {
  const router = useRouter()
  const [claimCode, setClaimCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleClaim() {
    setError(''); setSuccess('')
    if (!claimCode.trim()) { setError('Enter a claim code.'); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/?role=student'); setLoading(false); return }
      const { data: result, error: rpcErr } = await supabase.rpc('redeem_student_claim', {
        p_code: claimCode.trim().toUpperCase(), p_user_id: user.id,
      })
      setLoading(false)
      if (rpcErr) { setError(rpcErr.message || 'Something went wrong. Please try again.'); return }
      const status = (result as StudentClaimResult | null)?.status
      switch (status) {
        case 'success':
          setSuccess('Account linked! Taking you to your dashboard…')
          setTimeout(() => router.push('/student'), 1500)
          break
        case 'below_grade_requires_parent_opt_in':
          setError('Your account needs parent permission before you can activate it. Ask your parent to enable student self-use, then try this code again.')
          break
        case 'not_found': setError('Claim code not found. Check with your teacher.'); break
        case 'already_claimed': setError('This claim code has already been used.'); break
        case 'expired': setError('This claim code has expired. Ask your teacher to regenerate it.'); break
        case 'student_not_found': setError('Student record not found. Contact your teacher.'); break
        default: setError('Something went wrong. Please try again.')
      }
    } catch {
      setLoading(false)
      setError('Network error. Please check your connection and try again.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎒</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: dark }}>Enter Your Claim Code</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>Get the code from your class teacher to activate your student account.</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Claim Code</label>
          <input type="text" value={claimCode} onChange={e => setClaimCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="e.g. A1B2C3" maxLength={6} disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 20, fontWeight: 800, letterSpacing: 4, textAlign: 'center', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        {error && <div role="alert" style={{ color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, marginBottom: 12, lineHeight: 1.5 }}>{error}</div>}
        {success && <p role="status" style={{ color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{success}</p>}
        <button onClick={handleClaim} disabled={loading || claimCode.length < 6} style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: claimCode.length < 6 ? '#e5e7eb' : accent, color: claimCode.length < 6 ? '#9ca3af' : '#fff', fontWeight: 700, fontSize: 15, cursor: claimCode.length < 6 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{loading ? 'Linking…' : 'Activate Account'}</button>
      </div>
    </div>
  )
}
