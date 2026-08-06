"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/student/StudentUiContext'

const C = {
  bg: '#f0f2f5', surface: '#ffffff', border: '#e5e7eb',
  textPrimary: '#111827', textMuted: '#6b7280',
  accent: '#6366f1', accentLight: '#eef2ff', error: '#ef4444',
}

interface ProfileData {
  full_name:     string
  date_of_birth: string
  gender:        string
  avatar_url:    string
}

interface StudentData {
  name:             string
  admission_number: string
  class_name:       string
}

interface GuardianData {
  full_name:    string
  phone:        string
  relationship: string
}

function Skeleton({ h = 44 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 10,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function StudentProfilePage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [loading,   setLoading]   = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [profile,   setProfile]   = useState<ProfileData>({
    full_name: '', date_of_birth: '', gender: '', avatar_url: '',
  })
  const [student,  setStudent]  = useState<StudentData>({
    name: '', admission_number: '', class_name: '',
  })
  const [guardian, setGuardian] = useState<GuardianData | null>(null)

  async function handleSignOut() {
    await supabase.auth.signOut()
    document.cookie = 'vibe_role=; path=/; max-age=0'
    router.push('/')
  }

  useEffect(() => {
    async function load() {
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser()
        if (authErr || !authData.user) {
          setPageError('Could not load your session. Please refresh.')
          setLoading(false)
          return
        }
        const uid = authData.user.id

        const [profileRes, studentRes] = await Promise.all([
          supabase.from('profiles').select('full_name, date_of_birth, gender, avatar_url').eq('id', uid).single(),
          supabase.from('students').select('name, admission_number, class_id').eq('profile_id', uid).single(),
        ])

        if (profileRes.error) {
          setPageError('Failed to load your profile. Please refresh.')
          setLoading(false)
          return
        }

        const p = profileRes.data
        setProfile({
          full_name:     p?.full_name     ?? '',
          date_of_birth: p?.date_of_birth ?? '',
          gender:        p?.gender        ?? '',
          avatar_url:    p?.avatar_url    ?? '',
        })

        const s = studentRes.data
        let className = ''
        if (s?.class_id) {
          const { data: cls } = await supabase.from('classes').select('name, stream').eq('id', s.class_id).single()
          if (cls) className = cls.name + (cls.stream ? ' ' + cls.stream : '')
        }

        setStudent({
          name:             s?.name             ?? '',
          admission_number: s?.admission_number ?? '',
          class_name:       className,
        })

        const { data: studentRow } = await supabase.from('students').select('id').eq('profile_id', uid).single()
        if (studentRow?.id) {
          const { data: link } = await supabase
            .from('parent_student_links').select('parent_id')
            .eq('student_id', studentRow.id).maybeSingle()
          if (link?.parent_id) {
            const [parentProfileRes, parentExtraRes] = await Promise.all([
              supabase.from('profiles').select('full_name, phone').eq('id', link.parent_id).single(),
              supabase.from('parent_profiles').select('relationship').eq('profile_id', link.parent_id).maybeSingle(),
            ])
            setGuardian({
              full_name:    parentProfileRes.data?.full_name ?? '',
              phone:        parentProfileRes.data?.phone     ?? '',
              relationship: parentExtraRes.data?.relationship ?? '',
            })
          }
        }
      } catch {
        setPageError('Unexpected error. Please refresh.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div style={{ background: C.bg, minHeight: '100%', padding: 16 }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>

      <button
        onClick={() => router.push('/student')}
        style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
      >
        ← Back
      </button>

      <h1 style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary, margin: '0 0 16px' }}>My Profile</h1>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} h={56} />)}
        </div>
      ) : pageError ? (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: C.error, fontSize: 13 }}>
          {pageError}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: C.accentLight, border: `2px solid ${C.accent}`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="Profile photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : '👤'
              }
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary }}>
                {student.name || profile.full_name || 'Student'}
              </div>
              <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>
                {student.class_name || 'No class assigned'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Admission Number', value: student.admission_number || '—' },
              { label: 'Class',            value: student.class_name || '—' },
              { label: 'Date of Birth',    value: profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
              { label: 'Gender',           value: profile.gender || '—' },
            ].map(row => (
              <div key={row.label} style={{ background: C.surface, borderRadius: 12, padding: '12px 16px', border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{row.label}</span>
                <span style={{ fontSize: 13, color: C.textPrimary, fontWeight: 700 }}>{row.value}</span>
              </div>
            ))}
          </div>

          {guardian && (
            <>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, margin: '24px 0 10px' }}>Guardian</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Name',         value: guardian.full_name    || '—' },
                  { label: 'Relationship', value: guardian.relationship || '—' },
                  { label: 'Phone',        value: guardian.phone        || '—' },
                ].map(row => (
                  <div key={row.label} style={{ background: C.surface, borderRadius: 12, padding: '12px 16px', border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{row.label}</span>
                    <span style={{ fontSize: 13, color: C.textPrimary, fontWeight: 700 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, margin: '24px 0 10px' }}>Display Theme</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['light', 'dark', 'auto'] as const).map(t => (
              <button key={t} onClick={() => setTheme(t)} style={{
                flex: 1, padding: '10px 4px', borderRadius: 12, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                background: theme === t ? C.accent : C.surface,
                color:      theme === t ? '#fff'   : C.textMuted,
              }}>
                {t === 'light' ? '☀️ Light' : t === 'dark' ? '🌙 Dark' : '⚙️ Auto'}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 12, border: `1.5px dashed ${C.border}`, background: C.surface, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>
              Need to update your details? Ask your class teacher or school admin.
            </p>
          </div>

          <button
            onClick={() => router.push('/student/workspace')}
            style={{
              width: '100%', marginTop: 20, padding: '14px 0',
              borderRadius: 14, border: `1px solid ${C.border}`,
              background: C.surface, color: C.textPrimary,
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            📚 My Study Workspace
          </button>

          <button
            onClick={handleSignOut}
            style={{
              width: '100%', marginTop: 20, padding: '14px 0', borderRadius: 14,
              border: `2px solid ${C.error}`, background: 'transparent',
              color: C.error, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Sign Out
          </button>
        </>
      )}
    </div>
  )
}
