'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const SECTIONS = [
  'Personal Information',
  'Professional Info',
  'Qualifications',
  'Professional Development',
  'Teaching Style & Twin',
  'Attendance & Leave',
  'Performance & Appraisal',
  'Messages',
  'Documents',
  'Finance Reference',
]

const C = {
  accent:      '#10b981',
  accentLight: '#d1fae5',
  textPrimary: '#111827',
  textMuted:   '#6b7280',
  surface:     '#f8f9fa',
  border:      '#e5e7eb',
  bg:          '#ffffff',
  error:       '#ef4444',
}

// ─── SKELETON ────────────────────────────────────────────────────────────────

function Skeleton({ h = 44 }: { h?: number }) {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
      <div style={{
        height: h, borderRadius: 10,
        background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }} />
    </>
  )
}

// ─── COMING SOON ─────────────────────────────────────────────────────────────

function ComingSoon({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{title}</h2>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{sub}</p>
        <div style={{ marginTop: 16, height: 1, background: `linear-gradient(to right, ${C.accentLight}, ${C.border})` }} />
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '48px 24px', borderRadius: 16,
        border: `1.5px dashed ${C.border}`, background: C.surface, textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: C.accentLight,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, marginBottom: 16,
        }}>🔒</div>
        <p style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, margin: 0 }}>Coming soon</p>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 6, maxWidth: 260 }}>
          This section will be available when the {title} module is built.
        </p>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function TeacherProfilePage() {
  const [activeSection, setActiveSection] = useState(0)

  return (
    <div style={{ background: C.bg, minHeight: '100%' }}>

      {/* Mobile horizontal tabs */}
      <div style={{
        overflowX: 'auto', display: 'flex', gap: 8,
        padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
        WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
        scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
      }}>
        {SECTIONS.map((s, i) => (
          <button key={s} onClick={() => setActiveSection(i)} style={{
            flexShrink: 0, padding: '6px 14px', borderRadius: 99,
            fontSize: 12, fontWeight: activeSection === i ? 600 : 400,
            color: activeSection === i ? C.accent : C.textMuted,
            background: activeSection === i ? C.accentLight : 'transparent',
            border: `1px solid ${activeSection === i ? C.accent : C.border}`,
            whiteSpace: 'nowrap', cursor: 'pointer',
          }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex' }}>

        {/* Desktop sidebar */}
        <aside style={{
          width: 220, flexShrink: 0, borderRight: `1px solid ${C.border}`,
          padding: 16, position: 'sticky', top: 0,
          height: 'calc(100vh - 57px)', overflowY: 'auto',
          display: 'none',
        }} id="profile-sidebar">
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SECTIONS.map((s, i) => (
              <button key={s} onClick={() => setActiveSection(i)} style={{
                width: '100%', textAlign: 'left', padding: '10px 12px',
                borderRadius: 8, fontSize: 13,
                fontWeight: activeSection === i ? 600 : 400,
                color: activeSection === i ? C.accent : C.textMuted,
                background: activeSection === i ? C.accentLight : 'transparent',
                border: `1px solid ${activeSection === i ? C.accent : 'transparent'}`,
                cursor: 'pointer',
              }}>
                <span style={{ color: C.border, fontSize: 11, marginRight: 8 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div style={{ flex: 1, padding: 20, minWidth: 0, maxWidth: 720 }}>
          <ProfileSection index={activeSection} />
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          #profile-sidebar { display: block !important; }
        }
      `}</style>
    </div>
  )
}

// ─── SECTION ROUTER ───────────────────────────────────────────────────────────

function ProfileSection({ index }: { index: number }) {
  const sections = [
    <PersonalInfoSection key="1" />,
    <ComingSoon key="2" title="Professional Information" sub="Employment type, designation, and roles" />,
    <ComingSoon key="3" title="Qualifications" sub="Academic qualifications and certificates" />,
    <ComingSoon key="4" title="Professional Development" sub="Training history and PD hours" />,
    <ComingSoon key="5" title="Teaching Style & Twin" sub="Your preferences and Twin observations" />,
    <ComingSoon key="6" title="Attendance & Leave" sub="Daily attendance and leave balances" />,
    <ComingSoon key="7" title="Performance & Appraisal" sub="TSC appraisal cycle and performance signals" />,
    <ComingSoon key="8" title="Messages" sub="Linked to VibeConnect module" />,
    <ComingSoon key="9" title="Documents" sub="Upload and track required documents" />,
    <ComingSoon key="10" title="Finance Reference" sub="Payroll reference — managed in Finance module" />,
  ]
  return sections[index] ?? null
}

// ─── SECTION 1 — PERSONAL INFORMATION ────────────────────────────────────────

interface ProfileForm {
  full_name: string
  phone: string
  date_of_birth: string
  country_code: string
  gender: string
  bio: string
  tsc_number: string
  employment_type: string
  subjects_taught: string
}

function PersonalInfoSection() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ProfileForm>({
    full_name: '', phone: '', date_of_birth: '', country_code: '',
    gender: '', bio: '', tsc_number: '', employment_type: '', subjects_taught: '',
  })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return }
      setUserId(data.user.id)

      const [profileRes, teacherRes] = await Promise.all([
        supabase.from('profiles').select('full_name,phone,date_of_birth,country_code,gender,bio').eq('id', data.user.id).single(),
        supabase.from('teacher_profiles').select('tsc_number,employment_type,subjects_taught').eq('profile_id', data.user.id).single(),
      ])

      const p = profileRes.data
      const t = teacherRes.data
      setForm({
        full_name:       p?.full_name       ?? '',
        phone:           p?.phone           ?? '',
        date_of_birth:   p?.date_of_birth   ?? '',
        country_code:    p?.country_code    ?? '',
        gender:          p?.gender          ?? '',
        bio:             p?.bio             ?? '',
        tsc_number:      t?.tsc_number      ?? '',
        employment_type: t?.employment_type ?? '',
        subjects_taught: Array.isArray(t?.subjects_taught) ? t.subjects_taught.join(', ') : '',
      })
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    setError(null)

    const subjectsArray = form.subjects_taught
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const [pRes, tRes] = await Promise.all([
      supabase.from('profiles').update({
        full_name:     form.full_name     || null,
        phone:         form.phone         || null,
        date_of_birth: form.date_of_birth || null,
        country_code:  form.country_code  || null,
        gender:        form.gender        || null,
        bio:           form.bio           || null,
      }).eq('id', userId),
      supabase.from('teacher_profiles').upsert({
        tsc_number:      form.tsc_number      || null,
        employment_type: form.employment_type || null,
        subjects_taught: subjectsArray.length ? subjectsArray : null,
        profile_id: userId,
      }, { onConflict: 'profile_id' }),
    ])

    setSaving(false)
    if (pRes.error || tRes.error) {
      setError('Save failed. Please try again.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '10px 14px',
    color: C.textPrimary, fontSize: 14, outline: 'none',
  }

  const lbl: React.CSSProperties = {
    fontSize: 11, color: C.textMuted, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 6, display: 'block', fontWeight: 600,
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1,2,3,4,5,6].map(i => <Skeleton key={i} />)}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, margin: 0 }}>Personal Information</h2>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Your basic details — visible across VibeSchool</p>
        <div style={{ marginTop: 16, height: 1, background: `linear-gradient(to right, ${C.accentLight}, ${C.border})` }} />
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, background: '#fef2f2',
          border: `1px solid #fecaca`, color: C.error, fontSize: 13, marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }} id="profile-grid">
        <div>
          <label style={lbl}>Full Name</label>
          <input style={inp} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Janet Chebet" />
        </div>
        <div>
          <label style={lbl}>Phone</label>
          <input style={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. +254 712 345 678" />
        </div>
        <div>
          <label style={lbl}>Date of Birth</label>
          <input style={inp} type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
        </div>
        <div>
          <label style={lbl}>Country Code</label>
          <input style={inp} value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value }))} placeholder="e.g. KE" maxLength={2} />
        </div>
        <div>
          <label style={lbl}>Gender</label>
          <select style={inp} value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Bio</label>
          <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="A short bio about yourself..." />
        </div>
        <div>
          <label style={lbl}>TSC Number</label>
          <input style={inp} value={form.tsc_number} onChange={e => setForm(f => ({ ...f, tsc_number: e.target.value }))} placeholder="e.g. TSC-0041-8821" />
        </div>
        <div>
          <label style={lbl}>Employment Type</label>
          <select style={inp} value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))}>
            <option value="">Select type</option>
            <option value="government">Government</option>
            <option value="private">Private</option>
            <option value="volunteer">Volunteer</option>
            <option value="trainee">Trainee</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Subjects Taught</label>
          <input style={inp} value={form.subjects_taught} onChange={e => setForm(f => ({ ...f, subjects_taught: e.target.value }))} placeholder="e.g. Mathematics, Science" />
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Separate multiple subjects with commas</p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          marginTop: 28, padding: '12px 28px', borderRadius: 12,
          background: saved ? C.accentLight : C.accent,
          color: saved ? C.accent : '#ffffff',
          fontWeight: 700, fontSize: 14,
          border: `1px solid ${saved ? C.accent : 'transparent'}`,
          cursor: saving ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s', width: '100%',
        }}
      >
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Profile'}
      </button>

      <style>{`
        @media (min-width: 540px) {
          #profile-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}