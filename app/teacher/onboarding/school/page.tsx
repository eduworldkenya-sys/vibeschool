"use client";
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'
import { generateSchoolCode, codeToSubdomain } from '@/lib/schoolCode'

const dark   = C.dark
const accent = C.accent

const COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo Marakwet','Embu','Garissa',
  'Homa Bay','Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi',
  'Kirinyaga','Kisii','Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos',
  'Makueni','Mandera','Marsabit','Meru','Migori','Mombasa',"Murang'a",
  'Nairobi','Nakuru','Nandi','Narok','Nyamira','Nyandarua','Nyeri','Samburu',
  'Siaya','Taita Taveta','Tana River','Tharaka Nithi','Trans Nzoia','Turkana',
  'Uasin Gishu','Vihiga','Wajir','West Pokot',
]

type Mode = 'choose' | 'search' | 'join' | 'manual'

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export default function SchoolOnboardingPage() {
  const router = useRouter()
  const [mode,           setMode]           = useState<Mode>('choose')
  const [county,         setCounty]         = useState('')
  const [subCounties,    setSubCounties]    = useState<string[]>([])
  const [subCounty,      setSubCounty]      = useState('')
  const [schools,        setSchools]        = useState<{id:string,name:string}[]>([])
  const [selectedId,     setSelectedId]     = useState('')
  const [joinCode,       setJoinCode]       = useState('')
  const [manualName,     setManualName]     = useState('')
  const [loading,        setLoading]        = useState(false)
  const [loadingSubs,    setLoadingSubs]    = useState(false)
  const [loadingSchools, setLoadingSchools] = useState(false)
  const [error,          setError]          = useState('')
  const [confirm,        setConfirm]        = useState(false)

  useEffect(() => {
    if (!county) return
    setSubCounty(''); setSchools([]); setSelectedId('')
    setLoadingSubs(true)
    setSubCounties([])
    supabase
      .from('schools_directory')
      .select('sub_county')
      .eq('county', county)
      .then(({ data }) => {
        const unique = Array.from(new Set(
          (data ?? []).map((r: {sub_county:string}) => r.sub_county).filter(Boolean)
        )).sort() as string[]
        setSubCounties(unique)
        setLoadingSubs(false)
      })
  }, [county])

  useEffect(() => {
    if (!county || !subCounty) return
    setSchools([]); setSelectedId('')
    setLoadingSchools(true)
    supabase
      .from('schools_directory')
      .select('id, name')
      .eq('county', county)
      .eq('sub_county', subCounty)
      .order('name')
      .then(({ data }) => {
        setSchools(data ?? [])
        setLoadingSchools(false)
      })
  }, [county, subCounty])

  async function getUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) { router.push('/global/signin'); return null }
    return user
  }

  async function saveSchoolToProfile(userId: string, schoolId: string): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({ school_id: schoolId })
      .eq('id', userId)
    if (error) {
      setError('Failed to save your school. Please try again.')
      return false
    }
    return true
  }

  async function findOrCreateSchool(name: string, createdBy: string): Promise<string | null> {
    // Query only schools with similar name — let DB filter first
    const { data: candidates } = await supabase
      .from('schools')
      .select('id, name')
      .ilike('name', name.trim())

    // Normalize locally to catch punctuation differences
    const existing = (candidates ?? []).find(
      (s: {id:string, name:string}) => normalize(s.name) === normalize(name)
    )
    if (existing) return existing.id

    // No match — create new school
    const subdomain = codeToSubdomain(generateSchoolCode(name))
    const { data: created, error: createErr } = await supabase
      .from('schools')
      .insert({
        name: name.trim(),
        subdomain,
        timezone: 'Africa/Nairobi',
        country_code: 'KE',
        status: 'active',
        created_by: createdBy,
        requires_dual_approval: false,
      })
      .select('id')
      .single()

    if (createErr || !created) {
      setError(createErr?.message ?? 'Failed to create school.')
      return null
    }
    return created.id
  }

  async function handleSelectSchool() {
    if (!selectedId) { setError('Select a school.'); return }
    setError(''); setLoading(true)
    const user = await getUser()
    if (!user) { setLoading(false); return }

    const selected = schools.find(s => s.id === selectedId)
    if (!selected) { setLoading(false); setError('School not found.'); return }

    const schoolId = await findOrCreateSchool(selected.name, user.id)
    if (!schoolId) { setLoading(false); return }

    const saved = await saveSchoolToProfile(user.id, schoolId)
    setLoading(false)
    if (saved) router.push('/teacher/onboarding/class')
  }

  async function handleJoin() {
    if (!joinCode.trim()) { setError('Enter a school code.'); return }
    setError(''); setLoading(true)
    const user = await getUser()
    if (!user) { setLoading(false); return }

    const { data: school, error: schoolErr } = await supabase
      .from('schools')
      .select('id, status')
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

    const saved = await saveSchoolToProfile(user.id, school.id)
    setLoading(false)
    if (saved) router.push('/teacher/onboarding/class')
  }

  async function handleManual() {
    if (!manualName.trim()) { setError('Enter your school name.'); return }
    if (!confirm) { setConfirm(true); return }
    setError(''); setLoading(true)
    const user = await getUser()
    if (!user) { setLoading(false); return }

    const schoolId = await findOrCreateSchool(manualName.trim(), user.id)
    if (!schoolId) { setLoading(false); return }

    const saved = await saveSchoolToProfile(user.id, schoolId)
    setLoading(false)
    if (saved) router.push('/teacher/onboarding/class')
  }

  const inp: React.CSSProperties = {
    width: '100%', marginTop: 4, padding: '10px 12px',
    borderRadius: 10, border: '1.5px solid #e5e7eb',
    fontSize: 14, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', background: '#fff',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.textMuted,
    letterSpacing: 1, textTransform: 'uppercase' as const,
  }
  const btn = (bg: string, color = '#fff'): React.CSSProperties => ({
    padding: '13px 20px', borderRadius: 12, border: 'none',
    background: bg, color, fontWeight: 700, fontSize: 15,
    cursor: 'pointer', fontFamily: 'inherit', width: '100%',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: dark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 12px' }}>🏫</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: dark }}>Your School</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Step 1 of 3</div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i === 1 ? accent : C.border }} />
          ))}
        </div>

        {mode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 14, color: '#374151', textAlign: 'center', marginBottom: 8 }}>
              How do you want to find your school?
            </p>
            <button onClick={() => setMode('search')} style={btn(dark)}>🔍 Find My School</button>
            <button onClick={() => setMode('join')} style={{ ...btn('transparent', accent), border: '2px solid ' + accent }}>
              🔗 Join with a Code
            </button>
            <button onClick={() => setMode('manual')} style={{ ...btn('transparent', C.textMuted), border: '1.5px solid #e5e7eb', fontSize: 13 }}>
              ✏️ Type school name manually
            </button>
          </div>
        )}

        {mode === 'search' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button onClick={() => { setMode('choose'); setError('') }} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', textAlign: 'left', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>← Back</button>

            <div>
              <label style={lbl}>County</label>
              <select
                value={county}
                onChange={e => setCounty(e.target.value)}
                disabled={loadingSubs}
                style={inp}
              >
                <option value="">Select county</option>
                {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {county && (
              <div>
                <label style={lbl}>Sub-county</label>
                <select value={subCounty} onChange={e => setSubCounty(e.target.value)} disabled={loadingSubs} style={inp}>
                  <option value="">{loadingSubs ? 'Loading…' : 'Select sub-county'}</option>
                  {subCounties.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {subCounty && (
              <div>
                <label style={lbl}>School</label>
                {!loadingSchools && schools.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.textMuted, background: '#fef3c7', padding: '8px 12px', borderRadius: 8 }}>
                    No schools found. <span onClick={() => setMode('manual')} style={{ color: accent, cursor: 'pointer', fontWeight: 600 }}>Type your school name instead</span>
                  </p>
                ) : (
                  <select value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={loadingSchools} style={inp}>
                    <option value="">{loadingSchools ? 'Loading…' : 'Select school'}</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {selectedId && (
              <p style={{ fontSize: 13, color: C.textMuted, background: '#f0fdf4', padding: '8px 12px', borderRadius: 8 }}>
                Not your school? <span onClick={() => setMode('manual')} style={{ color: accent, cursor: 'pointer', fontWeight: 600 }}>Type it manually</span>
              </p>
            )}

            {error && <p style={{ color: C.error, fontSize: 13, fontWeight: 600 }}>{error}</p>}
            <button onClick={handleSelectSchool} disabled={loading || !selectedId} style={btn(loading || !selectedId ? '#9ca3af' : accent)}>
              {loading ? 'Saving…' : 'Continue →'}
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button onClick={() => { setMode('choose'); setError('') }} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', textAlign: 'left', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>← Back</button>
            <p style={{ fontSize: 14, color: '#374151' }}>Ask your school admin for the school code.</p>
            <div>
              <label style={lbl}>School Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="e.g. STM-4821"
                disabled={loading}
                style={inp}
              />
            </div>
            {error && <p style={{ color: C.error, fontSize: 13, fontWeight: 600 }}>{error}</p>}
            <button onClick={handleJoin} disabled={loading} style={btn(loading ? '#9ca3af' : accent)}>
              {loading ? 'Joining…' : 'Join School →'}
            </button>
          </div>
        )}

        {mode === 'manual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button onClick={() => { setMode('choose'); setError(''); setConfirm(false) }} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', textAlign: 'left', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>← Back</button>
            <p style={{ fontSize: 14, color: '#374151' }}>Type your school name exactly as it appears on the gate.</p>
            <div>
              <label style={lbl}>School Name</label>
              <input
                type="text"
                value={manualName}
                onChange={e => { setManualName(e.target.value); setConfirm(false) }}
                placeholder="St. Mary's Academy"
                disabled={loading}
                style={inp}
              />
            </div>

            {confirm && (
              <div style={{ fontSize: 13, background: '#fef3c7', padding: '10px 12px', borderRadius: 8, color: '#92400e' }}>
                ⚠️ You are about to register <strong>"{manualName}"</strong> as a new school. Make sure the name is correct — this cannot be easily changed.
              </div>
            )}

            {error && <p style={{ color: C.error, fontSize: 13, fontWeight: 600 }}>{error}</p>}
            <button onClick={handleManual} disabled={loading} style={btn(loading ? '#9ca3af' : confirm ? '#b45309' : accent)}>
              {loading ? 'Saving…' : confirm ? 'Yes, Register This School →' : 'Continue →'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
