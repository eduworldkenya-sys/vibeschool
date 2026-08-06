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

        if (studentRes.error || !studentRes.data) {
          setPageError('Failed to load your student record. Please refresh.')
          setLoading(false)
          return
        }

        const profileData = profileRes.data
        const studentData = studentRes.data

        setProfile({
          full_name: profileData?.full_name ?? '',
          date_of_birth: profileData?.date_of_birth ?? '',
          gender: profileData?.gender ?? '',
          avatar_url: profileData?.avatar_url ?? '',
        })

        let className = ''
        if (studentData.class_id) {
          const { data: classRow } = await supabase.from('classes').select('name').eq('id', studentData.class_id).maybeSingle()
          className = classRow?.name ?? ''
        }

        setStudent({
          name: studentData.name ?? '',
          admission_number: studentData.admission_number ?? '',
          class_name: className,
        })

        const { data: guardianLink } = await supabase
          .from('student_guardians')
          .select('guardian_id, relationship')
          .eq('student_id', studentData.id)
          .limit(1)
          .maybeSingle()

        if (guardianLink?.guardian_id) {
          const { data: guardianRow } = await supabase
            .from('guardians')
            .select('full_name, phone')
            .eq('id', guardianLink.guardian_id)
            .maybeSingle()
          if (guardianRow) {
            setGuardian({
              full_name: guardianRow.full_name ?? '',
              phone: guardianRow.phone ?? '',
              relationship: guardianLink.relationship ?? '',
            })
          }
        }
      } catch {
        setPageError('Something went wrong loading your profile.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--vs-text)' }}>Profile</h1>
        <p style={{ marginTop: 5, color: 'var(--vs-muted)', fontSize: 13 }}>Your account and learning preferences.</p>
      </div>

      {pageError && (
        <div style={{ padding: 14, borderRadius: 12, background: '#FEF2F2', color: C.error, marginBottom: 16, fontSize: 13 }}>
          {pageError}
        </div>
      )}

      <section style={{ background: 'var(--vs-card)', border: '1px solid var(--vs-border)', borderRadius: 18, padding: 18, marginBottom: 16 }}>
        {loading ? <Skeleton h={90} /> : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: 'var(--vs-accent-soft)', display: 'grid', placeItems: 'center', color: 'var(--vs-accent)', fontWeight: 900, fontSize: 22 }}>
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (student.name || profile.full_name || 'S').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ color: 'var(--vs-text)', fontSize: 17, fontWeight: 800 }}>{student.name || profile.full_name || 'Student'}</div>
              <div style={{ color: 'var(--vs-muted)', fontSize: 12, marginTop: 3 }}>{student.class_name || 'Student'}{student.admission_number ? ` · ${student.admission_number}` : ''}</div>
            </div>
          </div>
        )}
      </section>

      <section style={{ background: 'var(--vs-card)', border: '1px solid var(--vs-border)', borderRadius: 18, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--vs-text)', marginBottom: 14 }}>Appearance</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {(['light', 'dark', 'auto'] as const).map(option => (
            <button key={option} onClick={() => setTheme(option)} style={{ minHeight: 44, borderRadius: 12, border: theme === option ? '2px solid var(--vs-accent)' : '1px solid var(--vs-border)', background: theme === option ? 'var(--vs-accent-soft)' : 'var(--vs-surface)', color: 'var(--vs-text)', fontWeight: 750, textTransform: 'capitalize', cursor: 'pointer' }}>{option}</button>
          ))}
        </div>
      </section>

      <section style={{ background: 'var(--vs-card)', border: '1px solid var(--vs-border)', borderRadius: 18, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--vs-text)', marginBottom: 12 }}>Guardian</div>
        {loading ? <Skeleton h={54} /> : guardian ? (
          <div>
            <div style={{ color: 'var(--vs-text)', fontSize: 14, fontWeight: 700 }}>{guardian.full_name}</div>
            <div style={{ color: 'var(--vs-muted)', fontSize: 12, marginTop: 4 }}>{guardian.relationship || 'Guardian'}{guardian.phone ? ` · ${guardian.phone}` : ''}</div>
          </div>
        ) : <div style={{ color: 'var(--vs-muted)', fontSize: 12 }}>No guardian details available.</div>}
      </section>

      <button onClick={() => void handleSignOut()} style={{ width: '100%', minHeight: 48, border: '1px solid #FCA5A5', borderRadius: 14, background: '#FEF2F2', color: '#B91C1C', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Sign out</button>
    </div>
  )
}
