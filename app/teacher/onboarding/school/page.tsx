'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Mode = 'choose' | 'create' | 'join'

const dark   = '#1e1b4b'
const accent = '#10b981'

export default function SchoolOnboardingPage() {
  const router = useRouter()
  const [mode,        setMode]        = useState<Mode>('choose')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [schoolName,  setSchoolName]  = useState('')
  const [subdomain,   setSubdomain]   = useState('')
  const [timezone,    setTimezone]    = useState('Africa/Nairobi')
  const [countryCode, setCountryCode] = useState('KE')
  const [joinCode,    setJoinCode]    = useState('')

  async function handleCreate() {
    setError('')
    if (!schoolName.trim()) { setError('School name is required.'); return }
    if (!subdomain.trim())  { setError('School code is required.'); return }
    if (!/^[a-z0-9-]+$/.test(subdomain.trim())) {
      setError('Code must be lowercase letters, numbers or hyphens only.')
      return
    }
    setLoading(true)
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      setLoading(false)
      router.push('/academy/signin?role=teacher')
      return
    }
    const { data: existing } = await supabase
      .from('schools')
      .select('id')
      .eq('subdomain', subdomain.trim())
      .maybeSingle()
    if (existing) {
      setLoading(false)
      setError('That school code is already taken. Try another.')
      return
    }
    const { data: school, error: schoolErr } = await supabase
      .from('schools')
      .insert({
        name:                   schoolName.trim(),
        subdomain:              subdomain.trim(),
        timezone,
        country_code:           countryCode,
        status:                 'active',
        created_by:             user.id,
        requires_dual_approval: false,
      })
      .select('id')
      .single()
    if (schoolErr || !school) {
      setLoading(false)
      setError(schoolErr?.message ?? 'Failed to create school. Please try again.')
      return
    }
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ school_id: school.id })
      .eq('id', user.id)
    if (profileErr) {
      setLoading(false)
      setError('School created but failed to link to your profile. Error: ' + profileErr.message)
      return
    }
    setLoading(false)
    router.push('/teacher/onboarding/class')
  }

  async function handleJoin() {
    setError('')
    if (!joinCode.trim()) { setError('Enter a school code.'); return }
    setLoading(true)
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      setLoading(false)
      router.push('/academy/signin?role=teacher')
      return
    }
    const { data: school, error: schoolErr } = await supabase
      .from('schools')
      .select('id, name, status')
      .eq('subdomain', joinCode.trim().toLowerCase())
      .single()
    if (schoolErr || !school) {
      setLoading(false)
      setError('School not found. Check the code and try again.')
      return
    }
    if (school.status === 'suspended' || school.status === 'closed') {
      setLoading(false)
      setError('This school is no longer active.')
      return
    }
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ school_id: school.id })
      .eq('id', user.id)
    if (profileErr) {
      setLoading(false)
      setError('Failed to link school to your profile. Error: ' + profileErr.message)
      return
    }
    setLoading(false)
    router.push('/teacher/onboarding/class')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: dark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 12px' }}>🏫</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: dark }}>School Setup</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Step 1 of 3</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i === 1 ? accent : '#e5e7eb' }} />
          ))}
        </div>
        {mode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 14, color: '#374151', textAlign: 'center', marginBottom: 8 }}>
              Are you setting up a new school or joining an existing one?
            </p>
            <button onClick={() => setMode('create')} style={{ padding: '14px 20px', borderRadius: 12, border: '2px solid ' + dark, background: dark, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
              🏫 Create a School
            </button>
            <button onClick={() => setMode('join')} style={{ padding: '14px 20px', borderRadius: 12, border: '2px solid ' + accent, background: 'transparent', color: accent, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
              🔗 Join with a Code
            </button>
          </div>
        )}
        {mode === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button onClick={() => { setMode('choose'); setError('') }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontFamily: 'inherit', padding: 0, marginBottom: 4 }}>← Back</button>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>School Name</label>
              <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="St. Mary's Academy" disabled={loading} style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>School Code (unique join code)</label>
              <input type="text" value={subdomain} onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="st-marys-nairobi" disabled={loading} style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>Country</label>
              <select value={countryCode} onChange={e => setCountryCode(e.target.value)} disabled={loading} style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}>
                <option value="KE">Kenya</option>
                <option value="UG">Uganda</option>
                <option value="TZ">Tanzania</option>
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
              </select>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{error}</p>}
            <button onClick={handleCreate} disabled={loading} style={{ padding: '13px 20px', borderRadius: 12, border: 'none', background: loading ? '#9ca3af' : accent, color: '#fff', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
              {loading ? 'Creating…' : 'Create School →'}
            </button>
          </div>
        )}
        {mode === 'join' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button onClick={() => { setMode('choose'); setError('') }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontFamily: 'inherit', padding: 0, marginBottom: 4 }}>← Back</button>
            <p style={{ fontSize: 14, color: '#374151' }}>Ask your school admin for the school code and enter it below.</p>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>School Code</label>
              <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="st-marys-nairobi" disabled={loading} style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{error}</p>}
            <button onClick={handleJoin} disabled={loading} style={{ padding: '13px 20px', borderRadius: 12, border: 'none', background: loading ? '#9ca3af' : accent, color: '#fff', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
              {loading ? 'Joining…' : 'Join School →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
