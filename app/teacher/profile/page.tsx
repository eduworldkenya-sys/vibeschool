'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'

// ─── Constants ───────────────────────────────────────────────────────────────

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProfileForm {
  full_name:     string
  phone:         string
  date_of_birth: string
  country_code:  string
  gender:        string
  bio:           string
  avatar_url:    string
}

interface TeacherForm {
  tsc_number:      string
  employment_type: string
  nationality:     string
}

interface SubjectOption { id: string; name: string }
interface ClassOption   { id: string; name: string; stream: string | null }

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ h = 44 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 10,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ─── Coming Soon ─────────────────────────────────────────────────────────────

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
        }}>🚧</div>
        <p style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, margin: 0 }}>Coming soon</p>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 6, maxWidth: 260 }}>
          This section will be available when the {title} module is built.
        </p>
      </div>
    </div>
  )
}

// ─── Avatar Upload ────────────────────────────────────────────────────────────

function AvatarUpload({
  userId,
  avatarUrl,
  onUploaded,
}: {
  userId: string
  avatarUrl: string
  onUploaded: (url: string) => void
}) {
  const [uploading,    setUploading]    = useState(false)
  const [uploadError,  setUploadError]  = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image must be under 2MB.')
      return
    }

    setUploading(true)
    setUploadError(null)

    const ext  = file.name.split('.').pop()
    const path = `avatars/${userId}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('profiles')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      setUploading(false)
      setUploadError('Upload failed. Try again.')
      return
    }

    const { data: urlData } = supabase.storage
      .from('profiles')
      .getPublicUrl(path)

    onUploaded(urlData.publicUrl)
    setUploading(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: C.accentLight, border: `2px solid ${C.accent}`,
        overflow: 'hidden', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28,
      }}>
        {avatarUrl
          ? <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : '👤'
        }
      </div>
      <div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: C.accentLight, color: C.accent,
            border: `1px solid ${C.accent}`, cursor: uploading ? 'not-allowed' : 'pointer',
          }}
        >
          {uploading ? 'Uploading...' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
        </button>
        <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>JPG or PNG, max 2MB</p>
        {uploadError && (
          <p style={{ fontSize: 11, color: C.error, marginTop: 2 }}>{uploadError}</p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeacherProfilePage() {
  const [activeSection, setActiveSection] = useState(0)

  return (
    <div style={{ background: C.bg, minHeight: '100%' }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
        @media (min-width: 768px) {
          #profile-sidebar { display: block !important; }
          #profile-grid    { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div style={{
        overflowX: 'auto', display: 'flex', gap: 8,
        padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
        scrollbarWidth: 'none',
      }}>
        {SECTIONS.map((s, i) => (
          <button
            key={s}
            onClick={() => setActiveSection(i)}
            style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 99,
              fontSize: 12, fontWeight: activeSection === i ? 600 : 400,
              color: activeSection === i ? C.accent : C.textMuted,
              background: activeSection === i ? C.accentLight : 'transparent',
              border: `1px solid ${activeSection === i ? C.accent : C.border}`,
              whiteSpace: 'nowrap', cursor: 'pointer',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex' }}>
        <aside
          id="profile-sidebar"
          style={{
            width: 220, flexShrink: 0, borderRight: `1px solid ${C.border}`,
            padding: 16, position: 'sticky', top: 0,
            height: 'calc(100vh - 57px)', overflowY: 'auto',
            display: 'none',
          }}
        >
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SECTIONS.map((s, i) => (
              <button
                key={s}
                onClick={() => setActiveSection(i)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 12px',
                  borderRadius: 8, fontSize: 13,
                  fontWeight: activeSection === i ? 600 : 400,
                  color: activeSection === i ? C.accent : C.textMuted,
                  background: activeSection === i ? C.accentLight : 'transparent',
                  border: `1px solid ${activeSection === i ? C.accent : 'transparent'}`,
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: C.border, fontSize: 11, marginRight: 8 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s}
              </button>
            ))}
          </nav>
        </aside>

        <div style={{ flex: 1, padding: 20, minWidth: 0, maxWidth: 720 }}>
          <ProfileSection index={activeSection} />
        </div>
      </div>
    </div>
  )
}

// ─── Section Router ───────────────────────────────────────────────────────────

function ProfileSection({ index }: { index: number }) {
  const sections = [
    <PersonalInfoSection key="Personal Information" />,
    <ComingSoon key="Professional Info"        title="Professional Information" sub="Employment type, designation, and roles" />,
    <ComingSoon key="Qualifications"           title="Qualifications"           sub="Academic qualifications and certificates" />,
    <ComingSoon key="Professional Development" title="Professional Development" sub="Training history and PD hours" />,
    <ComingSoon key="Teaching Style & Twin"    title="Teaching Style & Twin"    sub="Your preferences and Twin observations" />,
    <ComingSoon key="Attendance & Leave"       title="Attendance & Leave"       sub="Daily attendance and leave balances" />,
    <ComingSoon key="Performance & Appraisal"  title="Performance & Appraisal"  sub="TSC appraisal cycle and performance signals" />,
    <ComingSoon key="Messages"                 title="Messages"                 sub="Linked to VibeConnect module" />,
    <ComingSoon key="Documents"                title="Documents"                sub="Upload and track required documents" />,
    <ComingSoon key="Finance Reference"        title="Finance Reference"        sub="Payroll reference — managed in Finance module" />,
  ]
  return sections[index] ?? null
}

// ─── Personal Info Section ────────────────────────────────────────────────────

function PersonalInfoSection() {
  const [userId,             setUserId]             = useState<string | null>(null)
  const [schoolId,           setSchoolId]           = useState<string | null>(null)
  const [loading,            setLoading]            = useState(true)
  const [saving,             setSaving]             = useState(false)
  const [saved,              setSaved]              = useState(false)
  const [pageError,          setPageError]          = useState<string | null>(null)
  const [saveError,          setSaveError]          = useState<string | null>(null)
  const [subjects,           setSubjects]           = useState<SubjectOption[]>([])
  const [classes,            setClasses]            = useState<ClassOption[]>([])
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([])
  const [selectedClassId,    setSelectedClassId]    = useState<string>('')
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [profile, setProfile] = useState<ProfileForm>({
    full_name: '', phone: '', date_of_birth: '', country_code: 'KE',
    gender: '', bio: '', avatar_url: '',
  })

  const [teacher, setTeacher] = useState<TeacherForm>({
    tsc_number: '', employment_type: '', nationality: 'Kenyan',
  })

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError || !authData.user) {
          setPageError('Could not load your session. Please refresh.')
          setLoading(false)
          return
        }

        const uid = authData.user.id
        setUserId(uid)

        const [profileRes, memberRes, teacherRes] = await Promise.all([
          supabase.from('profiles').select(
            'full_name,phone,date_of_birth,country_code,gender,bio,avatar_url,school_id'
          ).eq('id', uid).single(),
          supabase.from('school_members').select('school_id').eq('profile_id', uid).maybeSingle(),
          supabase.from('teacher_profiles').select(
            'tsc_number,employment_type,nationality,school_id'
          ).eq('profile_id', uid).maybeSingle(),
        ])

        if (profileRes.error) {
          setPageError('Failed to load your profile. Please refresh.')
          setLoading(false)
          return
        }

        const sid =
          memberRes.data?.school_id  ??
          teacherRes.data?.school_id ??
          profileRes.data?.school_id ??
          null

        setSchoolId(sid)

        const [subjectsRes, classesRes, tcRes] = await Promise.all([
          sid
            ? supabase.from('subjects').select('id,name')
                .or(`school_id.eq.${sid},school_id.is.null`)
                .order('name')
            : Promise.resolve({ data: [], error: null }),
          sid
            ? supabase.from('classes').select('id,name,stream')
                .eq('school_id', sid)
                .order('name')
            : Promise.resolve({ data: [], error: null }),
          supabase.from('teacher_classes')
            .select('class_id,subject_id')
            .eq('teacher_id', uid),
        ])

        setSubjects(subjectsRes.data ?? [])
        setClasses(classesRes.data ?? [])

        const tcRows = tcRes.data ?? []
        const subIds = Array.from(
          new Set(tcRows.map((r: { subject_id: string }) => r.subject_id).filter(Boolean))
        ) as string[]
        setSelectedSubjectIds(subIds)
        setSelectedClassId(tcRows[0]?.class_id ?? '')

        const p = profileRes.data
        const t = teacherRes.data

        setProfile({
          full_name:     p?.full_name     ?? '',
          phone:         p?.phone         ?? '',
          date_of_birth: p?.date_of_birth ?? '',
          country_code:  p?.country_code  ?? 'KE',
          gender:        p?.gender        ?? '',
          bio:           p?.bio           ?? '',
          avatar_url:    p?.avatar_url    ?? '',
        })

        setTeacher({
          tsc_number:      t?.tsc_number      ?? '',
          employment_type: t?.employment_type ?? '',
          nationality:     t?.nationality     ?? 'Kenyan',
        })

      } catch {
        setPageError('Unexpected error loading profile. Please refresh.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function normalisePhone(raw: string): string {
    const v = raw.trim()
    if ((v.startsWith('07') || v.startsWith('01')) && v.length === 10) {
      return '+254' + v.slice(1)
    }
    return v
  }

  function validate(): string | null {
    if (!profile.full_name.trim()) return 'Full name is required.'
    if (profile.date_of_birth) {
      if (new Date(profile.date_of_birth) >= new Date()) {
        return 'Date of birth must be in the past.'
      }
    }
    return null
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!userId) return

    const normalisedPhone = normalisePhone(profile.phone)
    const validationError = validate()
    if (validationError) {
      setSaveError(validationError)
      return
    }

    setSaving(true)
    setSaveError(null)

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name:     profile.full_name.trim(),
        phone:         normalisedPhone        || null,
        date_of_birth: profile.date_of_birth  || null,
        country_code:  profile.country_code   || null,
        gender:        profile.gender         || null,
        bio:           profile.bio            || null,
        avatar_url:    profile.avatar_url     || null,
      })
      .eq('id', userId)

    if (profileError) {
      setSaving(false)
      setSaveError('Failed to save profile. ' + profileError.message)
      return
    }

    const { error: teacherError } = await supabase
      .from('teacher_profiles')
      .upsert({
        profile_id:      userId,
        school_id:       schoolId,
        tsc_number:      teacher.tsc_number      || null,
        employment_type: teacher.employment_type || null,
        nationality:     teacher.nationality     || null,
      }, { onConflict: 'profile_id' })

    if (teacherError) {
      setSaving(false)
      setSaveError('Saved profile but failed to update teacher details. ' + teacherError.message)
      return
    }

    if (schoolId && selectedClassId && selectedSubjectIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('teacher_classes')
        .delete()
        .eq('teacher_id', userId)
        .eq('class_id', selectedClassId)

      if (deleteError) {
        setSaving(false)
        setSaveError('Saved profile but failed to update class assignments.')
        return
      }

      const rows = selectedSubjectIds.map((subId) => ({
        teacher_id:       userId,
        class_id:         selectedClassId,
        subject_id:       subId,
        school_id:        schoolId,
        is_class_teacher: false,
      }))

      const { error: insertError } = await supabase
        .from('teacher_classes')
        .insert(rows)

      if (insertError) {
        setSaving(false)
        setSaveError('Saved profile but failed to insert class assignments.')
        return
      }
    }

    setSaving(false)
    setSaved(true)
    setProfile(p => ({ ...p, phone: normalisedPhone }))
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2500)
  }

  // ── Styles ────────────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} />)}
      </div>
    )
  }

  if (pageError) {
    return (
      <div style={{
        padding: '16px', borderRadius: 10, background: '#fef2f2',
        border: '1px solid #fecaca', color: C.error, fontSize: 14,
      }}>
        {pageError}
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
          Personal Information
        </h2>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
          Your basic details — visible across VibeSchool
        </p>
        <div style={{ marginTop: 16, height: 1, background: `linear-gradient(to right, ${C.accentLight}, ${C.border})` }} />
      </div>

      {userId && (
        <AvatarUpload
          userId={userId}
          avatarUrl={profile.avatar_url}
          onUploaded={url => setProfile(p => ({ ...p, avatar_url: url }))}
        />
      )}

      {saveError && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, background: '#fef2f2',
          border: '1px solid #fecaca', color: C.error, fontSize: 13, marginBottom: 20,
        }}>
          {saveError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }} id="profile-grid">

        <div>
          <label htmlFor="full_name" style={lbl}>Full Name *</label>
          <input
            id="full_name" style={inp}
            value={profile.full_name}
            onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
            placeholder="e.g. Janet Chebet"
          />
        </div>

        <div>
          <label htmlFor="phone" style={lbl}>Phone</label>
          <input
            id="phone" style={inp}
            value={profile.phone}
            onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
            placeholder="e.g. 0712 345 678"
          />
        </div>

        <div>
          <label htmlFor="date_of_birth" style={lbl}>Date of Birth</label>
          <input
            id="date_of_birth" style={inp} type="date"
            value={profile.date_of_birth}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => setProfile(p => ({ ...p, date_of_birth: e.target.value }))}
          />
        </div>

        <div>
          <label htmlFor="gender" style={lbl}>Gender</label>
          <select
            id="gender" style={inp}
            value={profile.gender}
            onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>

        <div>
          <label htmlFor="nationality" style={lbl}>Nationality</label>
          <input
            id="nationality" style={inp}
            value={teacher.nationality}
            onChange={e => setTeacher(t => ({ ...t, nationality: e.target.value }))}
            placeholder="e.g. Kenyan"
          />
        </div>

        <div>
          <label htmlFor="country_code" style={lbl}>Country</label>
          <select
            id="country_code" style={inp}
            value={profile.country_code}
            onChange={e => setProfile(p => ({ ...p, country_code: e.target.value }))}
          >
            <option value="KE">Kenya</option>
            <option value="UG">Uganda</option>
            <option value="TZ">Tanzania</option>
            <option value="RW">Rwanda</option>
            <option value="ET">Ethiopia</option>
            <option value="NG">Nigeria</option>
            <option value="GH">Ghana</option>
            <option value="ZA">South Africa</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="bio" style={lbl}>Bio</label>
          <textarea
            id="bio"
            style={{ ...inp, minHeight: 80, resize: 'vertical' }}
            value={profile.bio}
            onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
            placeholder="A short bio about yourself..."
          />
        </div>

        <div>
          <label htmlFor="tsc_number" style={lbl}>TSC Number</label>
          <input
            id="tsc_number" style={inp}
            value={teacher.tsc_number}
            onChange={e => setTeacher(t => ({ ...t, tsc_number: e.target.value }))}
            placeholder="e.g. TSC-0041-8821"
          />
        </div>

        <div>
          <label htmlFor="employment_type" style={lbl}>Employment Type</label>
          <select
            id="employment_type" style={inp}
            value={teacher.employment_type}
            onChange={e => setTeacher(t => ({ ...t, employment_type: e.target.value }))}
          >
            <option value="">Select type</option>
            <option value="government">Government</option>
            <option value="private">Private</option>
            <option value="volunteer">Volunteer</option>
            <option value="trainee">Trainee</option>
          </select>
        </div>

        <div>
          <label htmlFor="class_select" style={lbl}>My Class</label>
          <select
            id="class_select" style={inp}
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
          >
            <option value="">Select your class</option>
            {classes.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}{cl.stream ? ' · ' + cl.stream : ''}
              </option>
            ))}
          </select>
          {!schoolId && (
            <p style={{ fontSize: 11, color: C.warning, marginTop: 4 }}>
              No school linked to your account. Contact your admin.
            </p>
          )}
          {schoolId && classes.length === 0 && (
            <p style={{ fontSize: 11, color: C.warning, marginTop: 4 }}>
              No classes found. Ask your admin to add classes.
            </p>
          )}
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={lbl}>Subjects Taught</label>
          {!schoolId ? (
            <p style={{ fontSize: 12, color: C.warning }}>
              No school linked. Subjects will appear once your school is set up.
            </p>
          ) : subjects.length === 0 ? (
            <p style={{ fontSize: 12, color: C.warning }}>
              No subjects found. Ask your admin to add subjects.
            </p>
          ) : (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8,
              padding: '10px 14px', border: `1px solid ${C.border}`,
              borderRadius: 10, background: C.bg,
            }}>
              {subjects.map((s) => {
                const checked = selectedSubjectIds.includes(s.id)
                return (
                  <label
                    key={s.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      cursor: 'pointer', fontSize: 13,
                      color: checked ? C.accent : C.textPrimary,
                      fontWeight: checked ? 600 : 400,
                      padding: '4px 10px', borderRadius: 99,
                      background: checked ? C.accentLight : C.surface,
                      border: `1px solid ${checked ? C.accent : C.border}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedSubjectIds(prev =>
                          checked ? prev.filter(id => id !== s.id) : [...prev, s.id]
                        )
                      }
                      style={{ width: 14, height: 14, accentColor: C.accent, cursor: 'pointer' }}
                    />
                    {s.name}
                  </label>
                )
              })}
            </div>
          )}
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
            Select all subjects you teach
          </p>
        </div>

      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          marginTop: 28, padding: '12px 28px', borderRadius: 12,
          background: saved ? C.accentLight : C.accent,
          color: saved ? C.accent : C.bg,
          fontWeight: 700, fontSize: 14,
          border: `1px solid ${saved ? C.accent : 'transparent'}`,
          cursor: saving ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s', width: '100%',
        }}
      >
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Profile'}
      </button>
    </div>
  )
}
