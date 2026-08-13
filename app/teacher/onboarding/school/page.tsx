"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'
import { generateSchoolCode, codeToSubdomain } from '@/lib/schoolCode'

const dark = C.dark
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
type School = { id: string; name: string; county?: string | null; sub_county?: string | null }

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export default function SchoolOnboardingPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('choose')
  const [county, setCounty] = useState('')
  const [search, setSearch] = useState('')
  const [subCounties, setSubCounties] = useState<string[]>([])
  const [subCounty, setSubCounty] = useState('')
  const [schools, setSchools] = useState<School[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [manualName, setManualName] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSubs, setLoadingSubs] = useState(false)
  const [loadingSchools, setLoadingSchools] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)

  // School discovery is name-first: users should not have to know their county
  // or sub-county before they can search. Location filters remain optional.
  useEffect(() => {
    if (mode !== 'search') return
    const q = search.trim()
    if (q.length < 2) {
      setSchools([])
      setSelectedId('')
      setLoadingSchools(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoadingSchools(true)
      setError('')
      let query = supabase
        .from('schools_directory')
        .select('id, name, county, sub_county')
        .ilike('name', `%${q}%`)
        .order('name')
        .limit(30)

      if (county) query = query.eq('county', county)
      if (subCounty) query = query.eq('sub_county', subCounty)

      const { data, error: searchError } = await query
      if (cancelled) return
      setLoadingSchools(false)
      if (searchError) {
        setError('We could not search schools right now. Please try again.')
        return
      }
      setSchools((data ?? []) as School[])
      setSelectedId('')
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [search, county, subCounty, mode])

  // Optional location narrowing. It never blocks the primary name search.
  useEffect(() => {
    if (!county) {
      setSubCounties([])
      setSubCounty('')
      return
    }
    let cancelled = false
    setLoadingSubs(true)
    supabase
      .from('schools_directory')
      .select('sub_county')
      .eq('county', county)
      .then(({ data, error: subError }) => {
        if (cancelled) return
        setLoadingSubs(false)
        if (subError) return
        const unique = Array.from(new Set(
          (data ?? [])
            .map((r: { sub_county: string | null }) => r.sub_county)
            .filter(Boolean)
        )).sort() as string[]
        setSubCounties(unique)
      })
    return () => { cancelled = true }
  }, [county])

  const searchHint = useMemo(() => {
    if (search.trim().length === 0) return 'Start typing your school name. You do not need to know the county.'
    if (search.trim().length === 1) return 'Type one more letter to search.'
    if (loadingSchools) return 'Searching…'
    if (schools.length === 0) return 'No match yet. Try fewer words or use “My school is not listed”.'
    return `${schools.length}${schools.length === 30 ? '+' : ''} school${schools.length === 1 ? '' : 's'} found`
  }, [search, loadingSchools, schools.length])

  async function getUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) { router.push('/?role=teacher'); return null }
    return user
  }

  async function saveSchoolToProfile(userId: string, schoolId: string): Promise<boolean> {
    await supabase.auth.refreshSession()

    const { error: memberErr } = await supabase
      .from('school_members')
      .upsert(
        { school_id: schoolId, profile_id: userId, role: 'teacher' },
        { onConflict: 'school_id,profile_id', ignoreDuplicates: true }
      )
    if (memberErr) {
      setError('We could not add you to the school. Please try again.')
      return false
    }

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ school_id: schoolId })
      .eq('id', userId)
    if (profileErr) {
      setError('We could not save your school. Please try again.')
      return false
    }

    const { data: tp } = await supabase
      .from('teacher_profiles')
      .select('profile_id')
      .eq('profile_id', userId)
      .maybeSingle()

    if (!tp) {
      await supabase
        .from('teacher_profiles')
        .upsert(
          { profile_id: userId, school_id: schoolId },
          { onConflict: 'profile_id', ignoreDuplicates: true }
        )
    }

    return true
  }

  async function findOrCreateSchool(name: string, createdBy: string): Promise<string | null> {
    const { data: candidates } = await supabase
      .from('schools')
      .select('id, name')
      .ilike('name', name.trim())

    const existing = (candidates ?? []).find(
      (s: { id: string; name: string }) => normalize(s.name) === normalize(name)
    )
    if (existing) return existing.id

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
      setError('We could not register that school. Please try again.')
      return null
    }
    return created.id
  }

  async function handleSelectSchool() {
    if (!selectedId) { setError('Choose your school first.'); return }
    setError(''); setLoading(true)
    const user = await getUser()
    if (!user) { setLoading(false); return }

    const selected = schools.find(s => s.id === selectedId)
    if (!selected) { setLoading(false); setError('That school is no longer available. Search again.'); return }

    const schoolId = await findOrCreateSchool(selected.name, user.id)
    if (!schoolId) { setLoading(false); return }

    const saved = await saveSchoolToProfile(user.id, schoolId)
    setLoading(false)
    if (saved) router.push('/teacher/onboarding/class')
  }

  async function handleJoin() {
    if (!joinCode.trim()) { setError('Enter your school code.'); return }
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
      setError('We could not find that school. Check the code and try again.')
      return
    }
    if (school.status === 'suspended' || school.status === 'closed') {
      setLoading(false)
      setError('That school is no longer active.')
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
    width: '100%', padding: '13px 14px', borderRadius: 12,
    border: '1.5px solid #d1d5db', fontSize: 16, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box', background: '#fff',
    minHeight: 48,
  }
  const btn = (bg: string, color = '#fff'): React.CSSProperties => ({
    minHeight: 50, padding: '13px 18px', borderRadius: 12, border: 'none',
    background: bg, color, fontWeight: 750, fontSize: 16,
    cursor: 'pointer', fontFamily: 'inherit', width: '100%',
  })
  const secondary = (color = accent): React.CSSProperties => ({
    ...btn('#fff', color), border: `1.5px solid ${color}`,
  })

  return (
    <main style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <section style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: dark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 25, margin: '0 auto 12px' }}>🏫</div>
          <h1 style={{ fontSize: 22, lineHeight: 1.2, fontWeight: 800, color: dark, margin: 0 }}>Let’s find your school</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: C.textMuted, margin: '6px 0 0' }}>This should only take a moment.</p>
        </div>

        <div aria-label="Onboarding progress" style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {[1,2,3].map(i => <div key={i} style={{ flex: 1, height: 5, borderRadius: 5, background: i === 1 ? accent : C.border }} />)}
        </div>

        {mode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 15, lineHeight: 1.5, color: '#374151', textAlign: 'center', margin: '0 0 6px' }}>Choose the quickest way to connect your school.</p>
            <button onClick={() => setMode('search')} style={btn(dark)}>🔍 Find my school</button>
            <button onClick={() => setMode('join')} style={secondary(accent)}>🔗 I have a school code</button>
            <button onClick={() => setMode('manual')} style={secondary(C.textMuted)}>✏️ My school is not listed</button>
          </div>
        )}

        {mode === 'search' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button onClick={() => { setMode('choose'); setError('') }} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', textAlign: 'left', fontSize: 14, fontFamily: 'inherit', padding: 0, minHeight: 36 }}>← Back</button>

            <div>
              <label htmlFor="school-search" style={{ display: 'block', fontSize: 14, fontWeight: 700, color: dark, marginBottom: 7 }}>School name</label>
              <input
                id="school-search"
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Start typing your school name"
                autoFocus
                autoComplete="organization"
                style={inp}
                aria-describedby="school-search-hint"
              />
              <p id="school-search-hint" style={{ fontSize: 13, lineHeight: 1.4, color: C.textMuted, margin: '7px 2px 0' }}>{searchHint}</p>
            </div>

            {schools.length > 0 && (
              <div role="listbox" aria-label="Matching schools" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 330, overflowY: 'auto' }}>
                {schools.map(school => (
                  <button
                    key={school.id}
                    type="button"
                    onClick={() => setSelectedId(school.id)}
                    aria-selected={selectedId === school.id}
                    style={{
                      textAlign: 'left', padding: '13px 14px', borderRadius: 12,
                      border: selectedId === school.id ? `2px solid ${accent}` : '1px solid #e5e7eb',
                      background: selectedId === school.id ? '#f0fdf4' : '#fff',
                      cursor: 'pointer', fontFamily: 'inherit', minHeight: 62,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 750, color: dark }}>{school.name}</div>
                    {(school.county || school.sub_county) && (
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{[school.sub_county, school.county].filter(Boolean).join(' · ')}</div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {schools.length === 0 && search.trim().length >= 2 && !loadingSchools && (
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: 14 }}>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: '#374151', margin: 0 }}>Can’t find it?</p>
                <button onClick={() => setMode('manual')} style={{ background: 'none', border: 'none', padding: '8px 0 0', color: accent, fontWeight: 750, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>My school is not listed →</button>
              </div>
            )}

            {county && (
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={subCounty} onChange={e => setSubCounty(e.target.value)} disabled={loadingSubs} style={{ ...inp, flex: 1 }} aria-label="Optional sub-county filter">
                  <option value="">Any sub-county</option>
                  {subCounties.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            <details>
              <summary style={{ cursor: 'pointer', color: C.textMuted, fontSize: 13 }}>Need a more specific search?</summary>
              <div style={{ marginTop: 10 }}>
                <select value={county} onChange={e => { setCounty(e.target.value); setSubCounty('') }} disabled={loadingSubs} style={inp} aria-label="Optional county filter">
                  <option value="">Any county</option>
                  {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </details>

            {selectedId && (
              <p style={{ fontSize: 13, lineHeight: 1.4, color: '#166534', background: '#f0fdf4', padding: '10px 12px', borderRadius: 9, margin: 0 }}>✓ School selected. We’ll connect you to it.</p>
            )}
            {error && <p role="alert" style={{ color: C.error, fontSize: 14, lineHeight: 1.4, fontWeight: 650, margin: 0 }}>{error}</p>}
            <button onClick={handleSelectSchool} disabled={loading || !selectedId} style={btn(loading || !selectedId ? '#9ca3af' : accent)}>
              {loading ? 'Connecting…' : 'Continue →'}
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button onClick={() => { setMode('choose'); setError('') }} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', textAlign: 'left', fontSize: 14, fontFamily: 'inherit', padding: 0, minHeight: 36 }}>← Back</button>
            <div>
              <h2 style={{ fontSize: 18, margin: '0 0 6px', color: dark }}>Have a school code?</h2>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: C.textMuted, margin: 0 }}>Enter the code your school gave you.</p>
            </div>
            <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="e.g. stm-4821" autoFocus autoComplete="off" disabled={loading} style={inp} aria-label="School code" />
            {error && <p role="alert" style={{ color: C.error, fontSize: 14, fontWeight: 650, margin: 0 }}>{error}</p>}
            <button onClick={handleJoin} disabled={loading} style={btn(loading ? '#9ca3af' : accent)}>{loading ? 'Connecting…' : 'Connect to school →'}</button>
          </div>
        )}

        {mode === 'manual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button onClick={() => { setMode('choose'); setError(''); setConfirm(false) }} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', textAlign: 'left', fontSize: 14, fontFamily: 'inherit', padding: 0, minHeight: 36 }}>← Back</button>
            <div>
              <h2 style={{ fontSize: 18, margin: '0 0 6px', color: dark }}>Can’t find your school?</h2>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: C.textMuted, margin: 0 }}>Type its name. We’ll check for an existing school before creating anything new.</p>
            </div>
            <input type="text" value={manualName} onChange={e => { setManualName(e.target.value); setConfirm(false) }} placeholder="St. Mary's Academy" autoFocus autoComplete="organization" disabled={loading} style={inp} aria-label="School name" />
            {confirm && (
              <div style={{ fontSize: 13, lineHeight: 1.5, background: '#fef3c7', padding: '11px 12px', borderRadius: 9, color: '#92400e' }}>
                Please check the spelling. If this school is new to VibeSchool, we’ll register <strong>“{manualName}”</strong>.
              </div>
            )}
            {error && <p role="alert" style={{ color: C.error, fontSize: 14, fontWeight: 650, margin: 0 }}>{error}</p>}
            <button onClick={handleManual} disabled={loading} style={btn(loading ? '#9ca3af' : confirm ? '#b45309' : accent)}>{loading ? 'Saving…' : confirm ? 'Yes, use this school →' : 'Continue →'}</button>
          </div>
        )}
      </section>
    </main>
  )
}
