"use client";
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatJoinCode } from '@/lib/schoolCode'

const C = {
  hero:      '#0a1628',
  emerald:   '#10b981',
  border:    '#e2e8f0',
  textMuted: '#64748b',
  error:     '#ef4444',
  success:   '#10b981',
}

const COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo Marakwet','Embu','Garissa',
  'Homa Bay','Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi',
  'Kirinyaga','Kisii','Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos',
  'Makueni','Mandera','Marsabit','Meru','Migori','Mombasa',"Murang'a",
  'Nairobi','Nakuru','Nandi','Narok','Nyamira','Nyandarua','Nyeri','Samburu',
  'Siaya','Taita Taveta','Tana River','Tharaka Nithi','Trans Nzoia','Turkana',
  'Uasin Gishu','Vihiga','Wajir','West Pokot',
]

const SCHOOL_TYPES      = ['private', 'public', 'mission', 'special_needs']
const SCHOOL_CATEGORIES = ['primary', 'secondary', 'ecde', 'combined']

interface FormData {
  name:             string
  motto:            string
  vision:           string
  knec_code:        string
  nemis_code:       string
  county:           string
  sub_county:       string
  ward:             string
  phone:            string
  postal_address:   string
  school_type:      string
  school_category:  string
  established_year: string
}

const EMPTY: FormData = {
  name: '', motto: '', vision: '', knec_code: '', nemis_code: '',
  county: '', sub_county: '', ward: '', phone: '', postal_address: '',
  school_type: 'private', school_category: 'primary', established_year: '',
}

export default function SchoolProfileSettingsPage() {
  const router = useRouter()

  const [form,      setForm]      = useState<FormData>(EMPTY)
  const [schoolId,  setSchoolId]  = useState<string | null>(null)
  const [subdomain, setSubdomain] = useState<string>('')
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [saved,     setSaved]     = useState(false)
  const [copied,    setCopied]    = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

      if (!profile?.school_id) { setLoading(false); return }
      setSchoolId(profile.school_id)

      const { data: school, error: schoolErr } = await supabase
        .from('schools')
        .select('name, subdomain, motto, vision, knec_code, nemis_code, county, sub_county, ward, phone, postal_address, school_type, school_category, established_year')
        .eq('id', profile.school_id)
        .single()

      if (schoolErr || !school) { setLoading(false); return }

      setSubdomain(school.subdomain ?? '')
      setForm({
        name:             school.name             ?? '',
        motto:            school.motto            ?? '',
        vision:           school.vision           ?? '',
        knec_code:        school.knec_code        ?? '',
        nemis_code:       school.nemis_code       ?? '',
        county:           school.county           ?? '',
        sub_county:       school.sub_county       ?? '',
        ward:             school.ward             ?? '',
        phone:            school.phone            ?? '',
        postal_address:   school.postal_address   ?? '',
        school_type:      school.school_type      ?? 'private',
        school_category:  school.school_category  ?? 'primary',
        established_year: school.established_year ? String(school.established_year) : '',
      })
      setLoading(false)
    }
    load()
  }, [router])

  function set(key: keyof FormData, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    setSaved(false)
  }

  function handleCopy() {
    const code = formatJoinCode(subdomain)
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleSave() {
    if (!schoolId) return
    if (!form.name.trim()) { setError('School name is required.'); return }
    setError(null); setSaving(true)

    const payload = {
      name:             form.name.trim(),
      motto:            form.motto.trim()          || null,
      vision:           form.vision.trim()         || null,
      knec_code:        form.knec_code.trim()      || null,
      nemis_code:       form.nemis_code.trim()     || null,
      county:           form.county                || null,
      sub_county:       form.sub_county.trim()     || null,
      ward:             form.ward.trim()           || null,
      phone:            form.phone.trim()          || null,
      postal_address:   form.postal_address.trim() || null,
      school_type:      form.school_type           || null,
      school_category:  form.school_category       || null,
      established_year: form.established_year ? parseInt(form.established_year) : null,
      name_normalized:  form.name.trim().toLowerCase().replace(/[^a-z0-9]/g, ''),
      updated_at:       new Date().toISOString(),
    }

    const { error: saveErr } = await supabase
      .from('schools')
      .update(payload)
      .eq('id', schoolId)

    if (saveErr) { setError(saveErr.message); setSaving(false); return }
    setSaved(true)
    setSaving(false)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: `1.5px solid ${C.border}`, fontSize: 14,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    background: '#fff', color: '#0f172a',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.textMuted,
    letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 4,
  }
  const section: React.CSSProperties = {
    background: '#fff', borderRadius: 14, padding: '18px',
    border: `1px solid ${C.border}`, marginBottom: 14,
  }
  const sectionTitle: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, color: C.textMuted,
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 14,
  }
  const row: React.CSSProperties = { marginBottom: 14 }

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: C.textMuted, fontSize: 14 }}>
      Loading…
    </div>
  )

  return (
    <div style={{ padding: '16px 16px 100px', maxWidth: 600, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: '0 0 8px' }}>
          ← Back
        </button>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>School Profile</div>
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>
          This information appears on SchoolHub and official documents.
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fef2f2', color: C.error, fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Saved */}
      {saved && (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: '#f0fdf4', color: C.success, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
          ✓ School profile saved successfully.
        </div>
      )}

      {/* Join Code */}
      {subdomain && (
        <div style={{
          background: C.hero, borderRadius: 14, padding: '18px',
          marginBottom: 14, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 }}>
              School Join Code
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 4, color: '#fff', fontFamily: 'monospace' }}>
              {formatJoinCode(subdomain)}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              Share with staff to join this school
            </div>
          </div>
          <button
            onClick={handleCopy}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 'none',
              background: copied ? C.emerald : 'rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              transition: 'background 0.2s',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      )}

      {/* Identity */}
      <div style={section}>
        <div style={sectionTitle}>Identity</div>
        <div style={row}>
          <label style={lbl}>School Name *</label>
          <input style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. St. Mary's Academy" />
        </div>
        <div style={row}>
          <label style={lbl}>Motto</label>
          <input style={inp} value={form.motto} onChange={e => set('motto', e.target.value)} placeholder="e.g. Excellence in All We Do" />
        </div>
        <div style={row}>
          <label style={lbl}>Vision</label>
          <input style={inp} value={form.vision} onChange={e => set('vision', e.target.value)} placeholder="e.g. To nurture holistic learners" />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Type</label>
            <select style={inp} value={form.school_type} onChange={e => set('school_type', e.target.value)}>
              {SCHOOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Category</label>
            <select style={inp} value={form.school_category} onChange={e => set('school_category', e.target.value)}>
              {SCHOOL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Codes */}
      <div style={section}>
        <div style={sectionTitle}>Official Codes</div>
        <div style={row}>
          <label style={lbl}>KNEC Code</label>
          <input style={inp} value={form.knec_code} onChange={e => set('knec_code', e.target.value)} placeholder="e.g. 12345" />
        </div>
        <div style={row}>
          <label style={lbl}>NEMIS Code</label>
          <input style={inp} value={form.nemis_code} onChange={e => set('nemis_code', e.target.value)} placeholder="e.g. 987654321" />
        </div>
        <div style={row}>
          <label style={lbl}>Year Established</label>
          <input style={inp} type="number" value={form.established_year} onChange={e => set('established_year', e.target.value)} placeholder="e.g. 1998" min={1800} max={new Date().getFullYear()} />
        </div>
      </div>

      {/* Location */}
      <div style={section}>
        <div style={sectionTitle}>Location</div>
        <div style={row}>
          <label style={lbl}>County</label>
          <select style={inp} value={form.county} onChange={e => set('county', e.target.value)}>
            <option value="">Select county</option>
            {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={row}>
          <label style={lbl}>Sub-County</label>
          <input style={inp} value={form.sub_county} onChange={e => set('sub_county', e.target.value)} placeholder="e.g. Westlands" />
        </div>
        <div style={row}>
          <label style={lbl}>Ward</label>
          <input style={inp} value={form.ward} onChange={e => set('ward', e.target.value)} placeholder="e.g. Parklands" />
        </div>
      </div>

      {/* Contacts */}
      <div style={section}>
        <div style={sectionTitle}>Contacts</div>
        <div style={row}>
          <label style={lbl}>Phone</label>
          <input style={inp} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="e.g. 0712 345 678" />
        </div>
        <div style={row}>
          <label style={lbl}>Postal Address</label>
          <input style={inp} value={form.postal_address} onChange={e => set('postal_address', e.target.value)} placeholder="e.g. P.O. Box 1234-00100, Nairobi" />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%', padding: '14px', borderRadius: 12, border: 'none',
          background: saving ? '#9ca3af' : C.hero,
          color: '#fff', fontSize: 15, fontWeight: 700,
          cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}
      >
        {saving ? 'Saving…' : 'Save School Profile'}
      </button>

    </div>
  )
}
