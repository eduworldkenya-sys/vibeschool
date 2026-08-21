"use client";

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const dark = '#1e1b4b'
const accent = '#10b981'
const MIN_CODE_LENGTH = 4
const MAX_CODE_LENGTH = 12

export default function LinkChildPage() {
  const router = useRouter()
  const [claimCode, setClaimCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const codeReady = claimCode.length >= MIN_CODE_LENGTH

  async function handleLink() {
    setError(''); setSuccess('')
    if (!codeReady) { setError('Enter the learner code from the school.'); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); router.push('/'); return }
      const { data: result, error: rpcErr } = await supabase.rpc('redeem_parent_claim', {
        p_code: claimCode.trim().toUpperCase(), p_user_id: user.id,
      })
      setLoading(false)
      if (rpcErr) { setError('We could not verify this learner code. Please try again.'); return }
      switch (result) {
        case 'success':
        case 'already_linked':
          setSuccess('Child linked successfully!')
          setTimeout(() => router.push('/parent'), 900)
          break
        case 'not_found': setError('Learner code not found. Check the full code and try again.'); break
        case 'replaced': setError('This learner code was replaced. Ask the teacher for the current code.'); break
        case 'expired': setError('This learner code has expired. Ask the teacher for a new code.'); break
        case 'already_claimed': setError('This parent claim has already been used. Ask the school for help if you should still have access.'); break
        case 'student_not_found': setError('Learner record not found. Contact the school.'); break
        case 'school_not_found': setError('This learner is not yet attached to a school. Ask the school to complete the learner record.'); break
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
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: dark }}>Link Your Child</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>Enter the learner code exactly as the school shared it.</div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1e40af', marginBottom: 8 }}>How to connect</div>
          <div style={{ fontSize: 11, color: '#1d4ed8', lineHeight: 1.6 }}>Ask the teacher for the learner code, enter the whole code below, and keep it private. Parent and learner can use the same current code for their separate setup steps.</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Learner code</label>
          <input type="text" value={claimCode} onChange={e => setClaimCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAX_CODE_LENGTH))} onKeyDown={e => { if (e.key === 'Enter' && codeReady) handleLink() }} placeholder="e.g. 9FFA0680" maxLength={MAX_CODE_LENGTH} autoCapitalize="characters" disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 20, fontWeight: 800, letterSpacing: 4, textAlign: 'center', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        {error && <div role="alert" style={{ color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
        {success && <p role="status" style={{ color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{success}</p>}
        <button onClick={handleLink} disabled={loading || !codeReady} style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: !codeReady ? '#e5e7eb' : accent, color: !codeReady ? '#9ca3af' : '#fff', fontWeight: 700, fontSize: 15, cursor: !codeReady ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{loading ? 'Linking…' : 'Link Child'}</button>
        <button onClick={() => router.push('/parent')} style={{ width: '100%', marginTop: 10, padding: '12px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Skip for now</button>
      </div>
    </div>
  )
}
