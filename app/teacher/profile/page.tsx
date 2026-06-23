"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'

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
  designation:     string
}

interface SubjectOption { id: string; name: string }
interface ClassOption   { id: string; name: string; stream: string | null }

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

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{title}</h2>
      <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{sub}</p>
      <div style={{ marginTop: 16, height: 1, background: `linear-gradient(to right, ${C.accentLight}, ${C.border})` }} />
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 10, background: '#fef2f2',
      border: '1px solid #fecaca', color: C.error, fontSize: 13, marginBottom: 20,
    }}>
      {msg}
    </div>
  )
}

function AvatarUpload({
  userId, avatarUrl, onUploaded,
}: {
  userId: string
  avatarUrl: string
  onUploaded: (url: string) => void
}) {
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setUploadError('Please select an image file.'); return }
    if (file.size > 2 * 1024 * 1024)    { setUploadError('Image must be under 2MB.');      return }

    setUploading(true)
    setUploadError(null)

    const ext  = file.name.split('.').pop()
    const path = `avatars/${userId}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      setUploading(false)
      setUploadError('Upload failed: ' + uploadErr.message)
      return
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    onUploaded(urlData.publicUrl)
    setUploading(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: C.accentLight, border: `2px solid ${C.accent}`,
        overflow: 'hidden', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
      }}>
        {avatarUrl
          ? <img src={avatarUrl} alt="Profile photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
        {uploadError && <p style={{ fontSize: 11, color: C.error, marginTop: 2 }}>{uploadError}</p>}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>
    </div>
  )
}

export default function TeacherProfilePage() {
  const [activeSection, setActiveSection] = useState(0)
  return (
    <div style={{ background: C.bg, minHeight: '100%' }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @media (min-width: 768px) {
          #profile-sidebar { display: block !important; }
          #profile-grid    { grid-template-columns: repeat(2, 1fr) !important; }
          #proinfo-grid    { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div style={{
        overflowX: 'auto', display: 'flex', gap: 8,
        padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
        scrollbarWidth: 'none',
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
        <aside id="profile-sidebar" style={{
          width: 220, flexShrink: 0, borderRight: `1px solid ${C.border}`,
          padding: 16, position: 'sticky', top: 0,
          height: 'calc(100vh - 57px)', overflowY: 'auto', display: 'none',
        }}>
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

        <div style={{ flex: 1, padding: 20, minWidth: 0, maxWidth: 720 }}>
          <ProfileSection index={activeSection} />
        </div>
      </div>
    </div>
  )
}

function ProfileSection({ index }: { index: number }) {
  const sections = [
    <PersonalInfoSection    key="Personal Information" />,
    <ProfessionalInfoSection key="Professional Info" />,
    <QualificationsSection key="Qualifications" />,
    <ProfessionalDevSection key="Professional Development" />,
    <TeachingStyleSection key="Teaching Style & Twin" />,
    <AttendanceLeaveSection key="Attendance & Leave" />,
    <PerformanceAppraisalSection key="Performance & Appraisal" />,
    <MessagesSection key="Messages" />,
    <DocumentsSection key="Documents" />,
    <FinanceReferenceSection key="Finance Reference" />,
  ]
  return sections[index] ?? null
}

// ─── Shared load hook ─────────────────────────────────────────────────────────

function useTeacherData() {
  const [userId,   setUserId]   = useState<string | null>(null)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [profile,  setProfile]  = useState<ProfileForm>({
    full_name: '', phone: '', date_of_birth: '', country_code: 'KE',
    gender: '', bio: '', avatar_url: '',
  })
  const [teacher, setTeacher] = useState<TeacherForm>({
    tsc_number: '', employment_type: '', nationality: 'Kenyan', designation: '',
  })
  const [loading,   setLoading]   = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

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
            'tsc_number,employment_type,nationality,designation,school_id'
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
          designation:     t?.designation     ?? '',
        })
      } catch {
        setPageError('Unexpected error. Please refresh.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { userId, schoolId, profile, setProfile, teacher, setTeacher, loading, pageError }
}

// ─── Personal Info ────────────────────────────────────────────────────────────

function PersonalInfoSection() {
  const { userId, schoolId, profile, setProfile, teacher, setTeacher, loading, pageError } = useTeacherData()
  const router = useRouter()
  const [subjects,           setSubjects]           = useState<SubjectOption[]>([])
  const [classes,            setClasses]            = useState<ClassOption[]>([])
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([])
  const [selectedClassId,    setSelectedClassId]    = useState<string>('')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userId || !schoolId) return
    async function loadExtras() {
      try {
        const [subjectsRes, classesRes, tcRes] = await Promise.all([
          supabase.from('subjects').select('id,name')
            .or(`school_id.eq.${schoolId},school_id.is.null`)
            .order('name'),
          supabase.from('classes').select('id,name,stream')
            .eq('school_id', schoolId)
            .order('name'),
          supabase.from('teacher_classes').select('class_id,subject_id')
            .eq('teacher_id', userId),
        ])
        setSubjects(subjectsRes.data ?? [])
        setClasses(classesRes.data ?? [])
        const tcRows = tcRes.data ?? []
        const subIds = Array.from(
          new Set(tcRows.map((r: { subject_id: string }) => r.subject_id).filter(Boolean))
        ) as string[]
        setSelectedSubjectIds(subIds)
        setSelectedClassId(tcRows[0]?.class_id ?? '')
      } catch {
        // non-critical, don't block the form
      }
    }
    loadExtras()
  }, [userId, schoolId])

  function normalisePhone(raw: string): string {
    const v = raw.trim().replace(/\s/g, '')
    if ((v.startsWith('07') || v.startsWith('01')) && v.length === 10) return '+254' + v.slice(1)
    if (v.startsWith('254') && !v.startsWith('+')) return '+' + v
    return v
  }

  function validate(): string | null {
    if (!profile.full_name.trim()) return 'Full name is required.'
    if (profile.date_of_birth && new Date(profile.date_of_birth) >= new Date())
      return 'Date of birth must be in the past.'
    return null
  }

  async function handleSave() {
    if (!userId) return
    const normalisedPhone = normalisePhone(profile.phone)
    const err = validate()
    if (err) { setSaveError(err); return }

    setSaving(true)
    setSaveError(null)

    // upsert so new profiles are created if row missing
    const { error: profileError } = await supabase.from('profiles').upsert({
      id:            userId,
      full_name:     profile.full_name.trim(),
      phone:         normalisedPhone        || null,
      date_of_birth: profile.date_of_birth  || null,
      country_code:  profile.country_code   || null,
      gender:        profile.gender         || null,
      bio:           profile.bio            || null,
      avatar_url:    profile.avatar_url     || null,
    }, { onConflict: 'id' })

    if (profileError) {
      setSaving(false)
      setSaveError('Failed to save profile. ' + profileError.message)
      return
    }

    const { error: teacherError } = await supabase.from('teacher_profiles').upsert({
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
      const { error: deleteError } = await supabase.from('teacher_classes')
        .delete()
        .eq('teacher_id', userId)
        .eq('class_id', selectedClassId)

      if (deleteError) {
        setSaving(false)
        setSaveError('Saved profile but failed to update class assignments.')
        return
      }

      const rows = selectedSubjectIds.map((subId) => ({
        teacher_id: userId, class_id: selectedClassId,
        subject_id: subId,  school_id: schoolId, is_class_teacher: false,
      }))

      const { error: insertError } = await supabase.from('teacher_classes').insert(rows)
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

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: C.bg,
    border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '10px 14px', color: C.textPrimary, fontSize: 14, outline: 'none',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, color: C.textMuted, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 6, display: 'block', fontWeight: 600,
  }

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3,4,5,6].map(i => <Skeleton key={i} />)}</div>
  if (pageError) return <ErrorBox msg={pageError} />

  return (
    <div>
      <SectionHeader title="Personal Information" sub="Your basic details — visible across VibeSchool" />

      {userId && (
        <AvatarUpload
          userId={userId}
          avatarUrl={profile.avatar_url}
          onUploaded={url => setProfile(p => ({ ...p, avatar_url: url }))}
        />
      )}

      {saveError && <ErrorBox msg={saveError} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }} id="profile-grid">

        <div>
          <label htmlFor="full_name" style={lbl}>Full Name *</label>
          <input id="full_name" style={inp} value={profile.full_name}
            onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
            placeholder="e.g. Janet Chebet" />
        </div>

        <div>
          <label htmlFor="phone" style={lbl}>Phone</label>
          <input id="phone" style={inp} value={profile.phone}
            onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
            placeholder="e.g. 0712 345 678" />
        </div>

        <div>
          <label htmlFor="date_of_birth" style={lbl}>Date of Birth</label>
          <input id="date_of_birth" style={inp} type="date"
            value={profile.date_of_birth}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => setProfile(p => ({ ...p, date_of_birth: e.target.value }))} />
        </div>

        <div>
          <label htmlFor="gender" style={lbl}>Gender</label>
          <select id="gender" style={inp} value={profile.gender}
            onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}>
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>

        <div>
          <label htmlFor="nationality" style={lbl}>Nationality</label>
          <input id="nationality" style={inp} value={teacher.nationality}
            onChange={e => setTeacher(t => ({ ...t, nationality: e.target.value }))}
            placeholder="e.g. Kenyan" />
        </div>

        <div>
          <label htmlFor="country_code" style={lbl}>Country</label>
          <select id="country_code" style={inp} value={profile.country_code}
            onChange={e => setProfile(p => ({ ...p, country_code: e.target.value }))}>
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
          <textarea id="bio" style={{ ...inp, minHeight: 80, resize: 'vertical' }}
            value={profile.bio}
            onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
            placeholder="A short bio about yourself..." />
        </div>

        <div>
          <label htmlFor="tsc_number" style={lbl}>TSC Number</label>
          <input id="tsc_number" style={inp} value={teacher.tsc_number}
            onChange={e => setTeacher(t => ({ ...t, tsc_number: e.target.value }))}
            placeholder="e.g. TSC-0041-8821" />
        </div>



        <div>
          <label htmlFor="class_select" style={lbl}>My Class</label>
          <select id="class_select" style={inp} value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}>
            <option value="">Select your class</option>
            {classes.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}{cl.stream ? ' · ' + cl.stream : ''}
              </option>
            ))}
          </select>
          {!schoolId && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, color: C.warning, margin: '0 0 8px' }}>No school linked yet.</p>
              <button
                onClick={() => router.push('/teacher/onboarding/school')}
                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                🏫 Link School
              </button>
            </div>
          )}
          {schoolId && classes.length === 0 && <p style={{ fontSize: 11, color: C.warning, marginTop: 4 }}>No classes found. Ask your admin to add classes.</p>}
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={lbl}>Subjects Taught</label>
          {!schoolId ? (
            <p style={{ fontSize: 12, color: C.warning }}>No school linked. Subjects will appear once your school is set up.</p>
          ) : subjects.length === 0 ? (
            <p style={{ fontSize: 12, color: C.warning }}>No subjects found. Ask your admin to add subjects.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 10, background: C.bg }}>
              {subjects.map((s) => {
                const checked = selectedSubjectIds.includes(s.id)
                return (
                  <label key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13,
                    color: checked ? C.accent : C.textPrimary, fontWeight: checked ? 600 : 400,
                    padding: '4px 10px', borderRadius: 99,
                    background: checked ? C.accentLight : C.surface,
                    border: `1px solid ${checked ? C.accent : C.border}`, transition: 'all 0.15s',
                  }}>
                    <input type="checkbox" checked={checked}
                      onChange={() => setSelectedSubjectIds(prev =>
                        checked ? prev.filter(id => id !== s.id) : [...prev, s.id]
                      )}
                      style={{ width: 14, height: 14, accentColor: C.accent, cursor: 'pointer' }} />
                    {s.name}
                  </label>
                )
              })}
            </div>
          )}
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Select all subjects you teach</p>
        </div>

      </div>

      <button onClick={handleSave} disabled={saving} style={{
        marginTop: 28, padding: '12px 28px', borderRadius: 12,
        background: saved ? C.accentLight : C.accent,
        color: saved ? C.accent : C.bg, fontWeight: 700, fontSize: 14,
        border: `1px solid ${saved ? C.accent : 'transparent'}`,
        cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s', width: '100%',
      }}>
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Profile'}
      </button>
    </div>
  )
}

// ─── Professional Info ────────────────────────────────────────────────────────

function ProfessionalInfoSection() {
  const { userId, schoolId, teacher, setTeacher, loading, pageError } = useTeacherData()
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function validate(): string | null {
    if (!teacher.designation.trim())     return 'Designation is required.'
    if (!teacher.employment_type.trim()) return 'Employment type is required.'
    return null
  }

  async function handleSave() {
    if (!userId) return
    const err = validate()
    if (err) { setSaveError(err); return }

    setSaving(true)
    setSaveError(null)

    const { error } = await supabase.from('teacher_profiles').upsert({
      profile_id:      userId,
      school_id:       schoolId,
      designation:     teacher.designation     || null,
      employment_type: teacher.employment_type || null,
      tsc_number:      teacher.tsc_number      || null,
      nationality:     teacher.nationality     || null,
    }, { onConflict: 'profile_id' })

    if (error) {
      setSaving(false)
      setSaveError('Failed to save. ' + error.message)
      return
    }

    setSaving(false)
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2500)
  }

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: C.bg,
    border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '10px 14px', color: C.textPrimary, fontSize: 14, outline: 'none',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, color: C.textMuted, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 6, display: 'block', fontWeight: 600,
  }

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3,4].map(i => <Skeleton key={i} />)}</div>
  if (pageError) return <ErrorBox msg={pageError} />

  return (
    <div>
      <SectionHeader title="Professional Information" sub="Your role, designation, and employment details" />

      {saveError && <ErrorBox msg={saveError} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }} id="proinfo-grid">

        <div>
          <label htmlFor="designation" style={lbl}>Designation *</label>
          <select id="designation" style={inp} value={teacher.designation}
            onChange={e => setTeacher(t => ({ ...t, designation: e.target.value }))}>
            <option value="">Select designation</option>
            <option value="class_teacher">Class Teacher</option>
            <option value="subject_teacher">Subject Teacher</option>
            <option value="head_teacher">Head Teacher</option>
            <option value="deputy_head">Deputy Head Teacher</option>
            <option value="senior_teacher">Senior Teacher</option>
            <option value="special_needs">Special Needs Teacher</option>
            <option value="intern">Teaching Intern</option>
          </select>
        </div>

        <div>
          <label htmlFor="pro_employment_type" style={lbl}>Employment Type *</label>
          <select id="pro_employment_type" style={inp} value={teacher.employment_type}
            onChange={e => setTeacher(t => ({ ...t, employment_type: e.target.value }))}>
            <option value="">Select type</option>
            <option value="government">Government (TSC)</option>
            <option value="private">Private</option>
            <option value="volunteer">Volunteer</option>
            <option value="trainee">Trainee</option>
          </select>
        </div>

        <div>
          <label htmlFor="pro_tsc_number" style={lbl}>TSC Number</label>
          <input id="pro_tsc_number" style={inp} value={teacher.tsc_number}
            onChange={e => setTeacher(t => ({ ...t, tsc_number: e.target.value }))}
            placeholder="e.g. TSC-0041-8821" />
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
            Required for government-employed teachers
          </p>
        </div>

        <div>
          <label htmlFor="pro_nationality" style={lbl}>Nationality</label>
          <input id="pro_nationality" style={inp} value={teacher.nationality}
            onChange={e => setTeacher(t => ({ ...t, nationality: e.target.value }))}
            placeholder="e.g. Kenyan" />
        </div>

      </div>

      {!schoolId && (
        <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', color: C.warning, fontSize: 13 }}>
          No school linked to your account. Some fields may not save correctly. Contact your admin.
        </div>
      )}

      <button onClick={handleSave} disabled={saving} style={{
        marginTop: 28, padding: '12px 28px', borderRadius: 12,
        background: saved ? C.accentLight : C.accent,
        color: saved ? C.accent : C.bg, fontWeight: 700, fontSize: 14,
        border: `1px solid ${saved ? C.accent : 'transparent'}`,
        cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s', width: '100%',
      }}>
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Professional Info'}
      </button>
    </div>
  )
}

// ─── Qualifications ───────────────────────────────────────────────────────────

interface Qualification {
  id:         string
  level:      string
  field:      string
  institution: string
  year:       string
}

function QualificationsSection() {
  const { userId, schoolId, loading, pageError } = useTeacherData()
  const [quals,     setQuals]     = useState<Qualification[]>([])
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userId) return
    async function loadQuals() {
      const { data } = await supabase
        .from('teacher_profiles')
        .select('qualifications')
        .eq('profile_id', userId)
        .single()
      if (data?.qualifications) setQuals(data.qualifications as Qualification[])
    }
    loadQuals()
  }, [userId])

  function addRow() {
    setQuals(q => [...q, { id: Date.now().toString(), level: '', field: '', institution: '', year: '' }])
  }

  function updateRow(id: string, key: keyof Qualification, value: string) {
    setQuals(q => q.map(r => r.id === id ? { ...r, [key]: value } : r))
  }

  function removeRow(id: string) {
    setQuals(q => q.filter(r => r.id !== id))
  }

  function validate(): string | null {
    for (const q of quals) {
      if (!q.level.trim())       return 'All entries need a qualification level.'
      if (!q.institution.trim()) return 'All entries need an institution name.'
      if (!q.year.trim())        return 'All entries need a year.'
      if (!/^\d{4}$/.test(q.year.trim())) return 'Year must be 4 digits e.g. 2018.'
    }
    return null
  }

  async function handleSave() {
    if (!userId) return
    const err = validate()
    if (err) { setSaveError(err); return }

    setSaving(true)
    setSaveError(null)

    const { error } = await supabase.from('teacher_profiles').upsert({
      profile_id:     userId,
      school_id:      schoolId,
      qualifications: quals,
    }, { onConflict: 'profile_id' })

    if (error) {
      setSaving(false)
      setSaveError('Failed to save. ' + error.message)
      return
    }

    setSaving(false)
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2500)
  }

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: C.bg,
    border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '10px 14px', color: C.textPrimary, fontSize: 14, outline: 'none',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, color: C.textMuted, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 6, display: 'block', fontWeight: 600,
  }

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3].map(i => <Skeleton key={i} />)}</div>
  if (pageError) return <ErrorBox msg={pageError} />

  return (
    <div>
      <SectionHeader title="Qualifications" sub="Your academic qualifications and certificates" />

      {saveError && <ErrorBox msg={saveError} />}

      {quals.length === 0 && (
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
          No qualifications added yet. Click below to add one.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {quals.map((q, idx) => (
          <div key={q.id} style={{
            padding: 16, borderRadius: 12, border: `1px solid ${C.border}`,
            background: C.surface, position: 'relative',
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              Qualification {idx + 1}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Level</label>
                <select style={inp} value={q.level} onChange={e => updateRow(q.id, 'level', e.target.value)}>
                  <option value="">Select level</option>
                  <option value="certificate">Certificate</option>
                  <option value="diploma">Diploma</option>
                  <option value="degree">Bachelor's Degree</option>
                  <option value="pgde">PGDE</option>
                  <option value="masters">Master's Degree</option>
                  <option value="phd">PhD</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Field of Study</label>
                <input style={inp} value={q.field}
                  onChange={e => updateRow(q.id, 'field', e.target.value)}
                  placeholder="e.g. Education, Mathematics" />
              </div>
              <div>
                <label style={lbl}>Institution</label>
                <input style={inp} value={q.institution}
                  onChange={e => updateRow(q.id, 'institution', e.target.value)}
                  placeholder="e.g. University of Nairobi" />
              </div>
              <div>
                <label style={lbl}>Year Completed</label>
                <input style={inp} value={q.year}
                  onChange={e => updateRow(q.id, 'year', e.target.value)}
                  placeholder="e.g. 2018" maxLength={4} />
              </div>
            </div>

            <button onClick={() => removeRow(q.id)} style={{
              position: 'absolute', top: 12, right: 12,
              background: '#fef2f2', border: '1px solid #fecaca',
              color: C.error, borderRadius: 8, padding: '4px 10px',
              fontSize: 12, cursor: 'pointer', fontWeight: 600,
            }}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <button onClick={addRow} style={{
        marginTop: 16, padding: '10px 20px', borderRadius: 10,
        background: C.surface, border: `1px dashed ${C.accent}`,
        color: C.accent, fontWeight: 600, fontSize: 13,
        cursor: 'pointer', width: '100%',
      }}>
        + Add Qualification
      </button>

      <button onClick={handleSave} disabled={saving} style={{
        marginTop: 12, padding: '12px 28px', borderRadius: 12,
        background: saved ? C.accentLight : C.accent,
        color: saved ? C.accent : C.bg, fontWeight: 700, fontSize: 14,
        border: `1px solid ${saved ? C.accent : 'transparent'}`,
        cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s', width: '100%',
      }}>
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Qualifications'}
      </button>
    </div>
  )
}

// ─── Professional Development ─────────────────────────────────────────────────

interface PDEntry {
  id:          string
  name:        string
  provider:    string
  date:        string
  hours:       string
  certificate: boolean
}

function ProfessionalDevSection() {
  const { userId, schoolId, loading, pageError } = useTeacherData()
  const [entries,   setEntries]   = useState<PDEntry[]>([])
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userId) return
    async function load() {
      const { data } = await supabase
        .from('teacher_profiles')
        .select('professional_dev')
        .eq('profile_id', userId)
        .single()
      if (data?.professional_dev) setEntries(data.professional_dev as PDEntry[])
    }
    load()
  }, [userId])

  function addRow() {
    setEntries(e => [...e, { id: Date.now().toString(), name: '', provider: '', date: '', hours: '', certificate: false }])
  }

  function updateRow(id: string, key: keyof PDEntry, value: string | boolean) {
    setEntries(e => e.map(r => r.id === id ? { ...r, [key]: value } : r))
  }

  function removeRow(id: string) {
    setEntries(e => e.filter(r => r.id !== id))
  }

  function validate(): string | null {
    for (const e of entries) {
      if (!e.name.trim())     return 'All entries need a training name.'
      if (!e.provider.trim()) return 'All entries need a provider.'
      if (!e.date.trim())     return 'All entries need a date.'
      if (e.hours && isNaN(Number(e.hours))) return 'Hours must be a number.'
    }
    return null
  }

  async function handleSave() {
    if (!userId) return
    const err = validate()
    if (err) { setSaveError(err); return }

    setSaving(true)
    setSaveError(null)

    const { error } = await supabase.from('teacher_profiles').upsert({
      profile_id:       userId,
      school_id:        schoolId,
      professional_dev: entries,
    }, { onConflict: 'profile_id' })

    if (error) {
      setSaving(false)
      setSaveError('Failed to save. ' + error.message)
      return
    }

    setSaving(false)
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2500)
  }

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: C.bg,
    border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '10px 14px', color: C.textPrimary, fontSize: 14, outline: 'none',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, color: C.textMuted, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 6, display: 'block', fontWeight: 600,
  }

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3].map(i => <Skeleton key={i} />)}</div>
  if (pageError) return <ErrorBox msg={pageError} />

  return (
    <div>
      <SectionHeader title="Professional Development" sub="Training, workshops, and PD hours attended" />

      {saveError && <ErrorBox msg={saveError} />}

      {entries.length === 0 && (
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
          No training records added yet. Click below to add one.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {entries.map((e, idx) => (
          <div key={e.id} style={{
            padding: 16, borderRadius: 12, border: `1px solid ${C.border}`,
            background: C.surface, position: 'relative',
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              Training {idx + 1}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Training / Workshop Name</label>
                <input style={inp} value={e.name}
                  onChange={ev => updateRow(e.id, 'name', ev.target.value)}
                  placeholder="e.g. CBC Implementation Workshop" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Provider / Organiser</label>
                <input style={inp} value={e.provider}
                  onChange={ev => updateRow(e.id, 'provider', ev.target.value)}
                  placeholder="e.g. Kenya Institute of Curriculum Development" />
              </div>
              <div>
                <label style={lbl}>Date Attended</label>
                <input style={inp} type="date" value={e.date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={ev => updateRow(e.id, 'date', ev.target.value)} />
              </div>
              <div>
                <label style={lbl}>Hours / CPD Points</label>
                <input style={inp} value={e.hours}
                  onChange={ev => updateRow(e.id, 'hours', ev.target.value)}
                  placeholder="e.g. 8" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', fontSize: 13, color: C.textPrimary,
                }}>
                  <input
                    type="checkbox"
                    checked={e.certificate}
                    onChange={ev => updateRow(e.id, 'certificate', ev.target.checked)}
                    style={{ width: 16, height: 16, accentColor: C.accent, cursor: 'pointer' }}
                  />
                  Certificate received
                </label>
              </div>
            </div>

            <button onClick={() => removeRow(e.id)} style={{
              position: 'absolute', top: 12, right: 12,
              background: '#fef2f2', border: '1px solid #fecaca',
              color: C.error, borderRadius: 8, padding: '4px 10px',
              fontSize: 12, cursor: 'pointer', fontWeight: 600,
            }}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <button onClick={addRow} style={{
        marginTop: 16, padding: '10px 20px', borderRadius: 10,
        background: C.surface, border: `1px dashed ${C.accent}`,
        color: C.accent, fontWeight: 600, fontSize: 13,
        cursor: 'pointer', width: '100%',
      }}>
        + Add Training Record
      </button>

      <button onClick={handleSave} disabled={saving} style={{
        marginTop: 12, padding: '12px 28px', borderRadius: 12,
        background: saved ? C.accentLight : C.accent,
        color: saved ? C.accent : C.bg, fontWeight: 700, fontSize: 14,
        border: `1px solid ${saved ? C.accent : 'transparent'}`,
        cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s', width: '100%',
      }}>
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save PD Records'}
      </button>
    </div>
  )
}

// ─── Teaching Style & Twin ────────────────────────────────────────────────────

const CBC_ACTIVITIES = [
  'Project-Based Learning',
  'Group Discussions',
  'Role Play',
  'Field Trips',
  'Story Telling',
  'Experiments',
  'Art & Craft',
  'Music & Movement',
  'Digital Learning',
  'Peer Teaching',
]

interface TeachingStyleForm {
  teaching_style: string
  approach:       string
  activities:     string[]
  twin_notes:     string
}

function TeachingStyleSection() {
  const { userId, schoolId, loading, pageError } = useTeacherData()
  const [form,      setForm]      = useState<TeachingStyleForm>({
    teaching_style: '', approach: '', activities: [], twin_notes: '',
  })
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userId) return
    async function load() {
      const { data } = await supabase
        .from('teacher_profiles')
        .select('teaching_style,twin_notes')
        .eq('profile_id', userId)
        .single()
      if (!data) return
      try {
        const parsed = data.teaching_style ? JSON.parse(data.teaching_style) : {}
        setForm({
          teaching_style: parsed.teaching_style ?? '',
          approach:       parsed.approach       ?? '',
          activities:     parsed.activities     ?? [],
          twin_notes:     data.twin_notes       ?? '',
        })
      } catch {
        setForm(f => ({ ...f, twin_notes: data.twin_notes ?? '' }))
      }
    }
    load()
  }, [userId])

  function toggleActivity(a: string) {
    setForm(f => ({
      ...f,
      activities: f.activities.includes(a)
        ? f.activities.filter(x => x !== a)
        : [...f.activities, a],
    }))
  }

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    setSaveError(null)

    const stylePayload = JSON.stringify({
      teaching_style: form.teaching_style,
      approach:       form.approach,
      activities:     form.activities,
    })

    const { error } = await supabase.from('teacher_profiles').upsert({
      profile_id:     userId,
      school_id:      schoolId,
      teaching_style: stylePayload,
    }, { onConflict: 'profile_id' })

    if (error) {
      setSaving(false)
      setSaveError('Failed to save. ' + error.message)
      return
    }

    setSaving(false)
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2500)
  }

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: C.bg,
    border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '10px 14px', color: C.textPrimary, fontSize: 14, outline: 'none',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, color: C.textMuted, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 6, display: 'block', fontWeight: 600,
  }

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3].map(i => <Skeleton key={i} />)}</div>
  if (pageError) return <ErrorBox msg={pageError} />

  return (
    <div>
      <SectionHeader title="Teaching Style & Twin" sub="Your preferences and Twin observations" />

      {saveError && <ErrorBox msg={saveError} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <label htmlFor="teaching_style" style={lbl}>Teaching Style</label>
          <select id="teaching_style" style={inp} value={form.teaching_style}
            onChange={e => setForm(f => ({ ...f, teaching_style: e.target.value }))}>
            <option value="">Select your style</option>
            <option value="visual">Visual — diagrams, charts, demonstrations</option>
            <option value="auditory">Auditory — discussions, lectures, audio</option>
            <option value="kinesthetic">Kinesthetic — hands-on, movement, experiments</option>
            <option value="mixed">Mixed — combination of styles</option>
          </select>
        </div>

        <div>
          <label htmlFor="approach" style={lbl}>Classroom Approach</label>
          <select id="approach" style={inp} value={form.approach}
            onChange={e => setForm(f => ({ ...f, approach: e.target.value }))}>
            <option value="">Select approach</option>
            <option value="teacher_led">Teacher-Led</option>
            <option value="learner_centred">Learner-Centred</option>
            <option value="collaborative">Collaborative</option>
            <option value="inquiry_based">Inquiry-Based</option>
          </select>
        </div>

        <div>
          <label style={lbl}>Favourite CBC Learning Activities</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CBC_ACTIVITIES.map(a => {
              const checked = form.activities.includes(a)
              return (
                <button
                  key={a}
                  onClick={() => toggleActivity(a)}
                  style={{
                    padding: '6px 14px', borderRadius: 99, fontSize: 13,
                    fontWeight: checked ? 600 : 400,
                    color: checked ? C.accent : C.textMuted,
                    background: checked ? C.accentLight : C.surface,
                    border: `1px solid ${checked ? C.accent : C.border}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {a}
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
            Select all that apply
          </p>
        </div>

        <div style={{
          padding: 16, borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: C.surface,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
              Twin Observations
            </p>
            <span style={{
              fontSize: 10, fontWeight: 600, color: C.accent,
              background: C.accentLight, padding: '2px 8px', borderRadius: 99,
              border: `1px solid ${C.accent}`,
            }}>
              AI Generated
            </span>
          </div>
          {form.twin_notes ? (
            <p style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.6, margin: 0 }}>
              {form.twin_notes}
            </p>
          ) : (
            <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
              No Twin observations yet. Twin will add notes as it learns your teaching patterns.
            </p>
          )}
        </div>

      </div>

      <button onClick={handleSave} disabled={saving} style={{
        marginTop: 28, padding: '12px 28px', borderRadius: 12,
        background: saved ? C.accentLight : C.accent,
        color: saved ? C.accent : C.bg, fontWeight: 700, fontSize: 14,
        border: `1px solid ${saved ? C.accent : 'transparent'}`,
        cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s', width: '100%',
      }}>
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Teaching Style'}
      </button>
    </div>
  )
}

// ─── Attendance & Leave ───────────────────────────────────────────────────────

function AttendanceLeaveSection() {
  const { userId, loading, pageError } = useTeacherData()
  const [leaveBalance, setLeaveBalance] = useState<number | null>(null)
  const [loadingLeave, setLoadingLeave] = useState(true)

  useEffect(() => {
    if (!userId) return
    async function load() {
      const { data } = await supabase
        .from('teacher_profiles')
        .select('leave_balance')
        .eq('profile_id', userId)
        .single()
      setLeaveBalance(data?.leave_balance ?? null)
      setLoadingLeave(false)
    }
    load()
  }, [userId])

  if (loading || loadingLeave) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3].map(i => <Skeleton key={i} />)}</div>
  if (pageError) return <ErrorBox msg={pageError} />

  return (
    <div>
      <SectionHeader title="Attendance & Leave" sub="Your leave balance and attendance overview" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ padding: 20, borderRadius: 12, background: C.accentLight, border: `1px solid ${C.accent}`, textAlign: 'center' }}>
          <p style={{ fontSize: 32, fontWeight: 800, color: C.accent, margin: 0 }}>
            {leaveBalance ?? '—'}
          </p>
          <p style={{ fontSize: 12, color: C.accent, marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            Leave Days Remaining
          </p>
        </div>
        <div style={{ padding: 20, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, textAlign: 'center' }}>
          <p style={{ fontSize: 32, fontWeight: 800, color: C.textPrimary, margin: 0 }}>—</p>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            Days Attended
          </p>
        </div>
      </div>

      <div style={{
        padding: 16, borderRadius: 12, border: `1.5px dashed ${C.border}`,
        background: C.surface, textAlign: 'center',
      }}>
        <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
          Full attendance history and leave requests will be available in the Attendance module.
        </p>
      </div>
    </div>
  )
}

// ─── Performance & Appraisal ──────────────────────────────────────────────────

function PerformanceAppraisalSection() {
  const { userId, loading, pageError } = useTeacherData()
  const [appraisal, setAppraisal] = useState<{ score: number | null; notes: string }>({ score: null, notes: '' })
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!userId) return
    async function load() {
      const { data } = await supabase
        .from('teacher_profiles')
        .select('appraisal_score,appraisal_notes')
        .eq('profile_id', userId)
        .single()
      setAppraisal({
        score: data?.appraisal_score ?? null,
        notes: data?.appraisal_notes ?? '',
      })
      setLoadingData(false)
    }
    load()
  }, [userId])

  if (loading || loadingData) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3].map(i => <Skeleton key={i} />)}</div>
  if (pageError) return <ErrorBox msg={pageError} />

  const score = appraisal.score
  const scoreColor = score === null ? C.textMuted : score >= 80 ? C.accent : score >= 60 ? C.warning : C.error

  return (
    <div>
      <SectionHeader title="Performance & Appraisal" sub="TSC appraisal cycle and performance signals" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ padding: 20, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, textAlign: 'center' }}>
          <p style={{ fontSize: 40, fontWeight: 800, color: scoreColor, margin: 0 }}>
            {score !== null ? score + '%' : '—'}
          </p>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            Appraisal Score
          </p>
        </div>
        <div style={{ padding: 20, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, textAlign: 'center' }}>
          <p style={{ fontSize: 32, fontWeight: 800, color: C.textPrimary, margin: 0 }}>—</p>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            TSC Cycle
          </p>
        </div>
      </div>

      {appraisal.notes ? (
        <div style={{ padding: 16, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Appraisal Notes
          </p>
          <p style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.6, margin: 0 }}>
            {appraisal.notes}
          </p>
        </div>
      ) : null}

      <div style={{ padding: 16, borderRadius: 12, border: `1.5px dashed ${C.border}`, background: C.surface, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
          Appraisal scores and TSC cycle details are managed by your school admin.
        </p>
      </div>
    </div>
  )
}

// ─── Messages ─────────────────────────────────────────────────────────────────

function MessagesSection() {
  const { loading, pageError } = useTeacherData()

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2].map(i => <Skeleton key={i} />)}</div>
  if (pageError) return <ErrorBox msg={pageError} />

  return (
    <div>
      <SectionHeader title="Messages" sub="Communication via VibeConnect" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: 20, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>💬</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, margin: 0 }}>Parent Messages</p>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Message parents directly via VibeConnect</p>
          </div>
        </div>

        <div style={{ padding: 20, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📢</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, margin: 0 }}>Announcements</p>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Send class-wide announcements to parents</p>
          </div>
        </div>

        <div style={{ padding: 16, borderRadius: 12, border: `1.5px dashed ${C.border}`, background: C.surface, textAlign: 'center', marginTop: 8 }}>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
            Full messaging will be available when VibeConnect module launches.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Documents ────────────────────────────────────────────────────────────────

interface TeacherDocument {
  id:         string
  name:       string
  url:        string
  uploaded_at: string
}

function DocumentsSection() {
  const { userId, loading, pageError } = useTeacherData()
  const [docs,        setDocs]        = useState<TeacherDocument[]>([])
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userId) return
    async function load() {
      const { data } = await supabase
        .from('teacher_profiles')
        .select('documents')
        .eq('profile_id', userId)
        .single()
      if (data?.documents) setDocs(data.documents as TeacherDocument[])
    }
    load()
  }, [userId])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (file.size > 5 * 1024 * 1024) { setUploadError('File must be under 5MB.'); return }

    setUploading(true)
    setUploadError(null)

    const path = `documents/${userId}/${Date.now()}_${file.name}`
    const { error: uploadErr } = await supabase.storage
      .from('teacher-docs')
      .upload(path, file, { upsert: false })

    if (uploadErr) {
      setUploading(false)
      setUploadError('Upload failed: ' + uploadErr.message)
      return
    }

    const { data: urlData } = supabase.storage.from('teacher-docs').getPublicUrl(path)

    const newDoc: TeacherDocument = {
      id:          Date.now().toString(),
      name:        file.name,
      url:         urlData.publicUrl,
      uploaded_at: new Date().toISOString(),
    }

    const updatedDocs = [...docs, newDoc]
    setDocs(updatedDocs)
    setUploading(false)

    setSaving(true)
    const { error } = await supabase.from('teacher_profiles').upsert({
      profile_id: userId,
      documents:  updatedDocs,
    }, { onConflict: 'profile_id' })

    setSaving(false)
    if (error) { setUploadError('Uploaded but failed to save record. ' + error.message); return }

    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2500)
  }

  async function removeDoc(id: string) {
    if (!userId) return
    const updatedDocs = docs.filter(d => d.id !== id)
    setDocs(updatedDocs)
    await supabase.from('teacher_profiles').upsert({
      profile_id: userId,
      documents:  updatedDocs,
    }, { onConflict: 'profile_id' })
  }

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3].map(i => <Skeleton key={i} />)}</div>
  if (pageError) return <ErrorBox msg={pageError} />

  return (
    <div>
      <SectionHeader title="Documents" sub="Upload and track your required documents" />

      {uploadError && <ErrorBox msg={uploadError} />}

      {docs.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
          No documents uploaded yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {docs.map(d => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderRadius: 10,
              background: C.surface, border: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 20 }}>📄</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</p>
                <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                  {new Date(d.uploaded_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent, fontWeight: 600, textDecoration: 'none' }}>View</a>
              <button onClick={() => removeDoc(d.id)} style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                color: C.error, borderRadius: 8, padding: '4px 10px',
                fontSize: 12, cursor: 'pointer', fontWeight: 600,
              }}>Remove</button>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => fileRef.current?.click()} disabled={uploading || saving} style={{
        padding: '10px 20px', borderRadius: 10, width: '100%',
        background: C.surface, border: `1px dashed ${C.accent}`,
        color: C.accent, fontWeight: 600, fontSize: 13, cursor: 'pointer',
      }}>
        {uploading ? 'Uploading...' : saving ? 'Saving...' : saved ? '✓ Saved' : '+ Upload Document'}
      </button>
      <p style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>PDF, JPG, PNG — max 5MB</p>
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

// ─── Finance Reference ────────────────────────────────────────────────────────

function FinanceReferenceSection() {
  const { userId, loading, pageError } = useTeacherData()
  const [financeRef,   setFinanceRef]   = useState<string>('')
  const [loadingData,  setLoadingData]  = useState(true)

  useEffect(() => {
    if (!userId) return
    async function load() {
      const { data } = await supabase
        .from('teacher_profiles')
        .select('finance_ref')
        .eq('profile_id', userId)
        .single()
      setFinanceRef(data?.finance_ref ?? '')
      setLoadingData(false)
    }
    load()
  }, [userId])

  if (loading || loadingData) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2].map(i => <Skeleton key={i} />)}</div>
  if (pageError) return <ErrorBox msg={pageError} />

  return (
    <div>
      <SectionHeader title="Finance Reference" sub="Payroll reference — managed by your school admin" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: 20, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Payroll Reference Number
          </p>
          <p style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, margin: 0 }}>
            {financeRef || '—'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ padding: 16, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, textAlign: 'center' }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary, margin: 0 }}>—</p>
            <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Bank Name</p>
          </div>
          <div style={{ padding: 16, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, textAlign: 'center' }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary, margin: 0 }}>—</p>
            <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Account Number</p>
          </div>
        </div>

        <div style={{ padding: 16, borderRadius: 12, border: `1.5px dashed ${C.border}`, background: C.surface, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
            Finance details are managed by your school admin in the Finance module. Contact your admin to update payroll information.
          </p>
        </div>
      </div>
    </div>
  )
}
