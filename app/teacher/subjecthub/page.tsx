'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, SectionLabel, Btn, C } from '@/components/teacher/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubjectOption {
  id: string
  name: string
}

interface Teammate {
  profileId: string
  fullName: string
  initials: string
  isYou: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

const AVATAR_PALETTES = [
  { bg: '#ede9fe', color: '#6d28d9' },
  { bg: '#d1fae5', color: '#065f46' },
  { bg: '#dbeafe', color: '#1d4ed8' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: '#fce7f3', color: '#9d174d' },
  { bg: '#e0f2fe', color: '#0369a1' },
]

function Avatar({ initials, idx }: { initials: string; idx: number }) {
  const p = AVATAR_PALETTES[idx % AVATAR_PALETTES.length]
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      background: p.bg, color: p.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function Skeleton({ h = 56 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubjectHubPage() {
  const [subjects, setSubjects]       = useState<SubjectOption[]>([])
  const [activeIdx, setActiveIdx]     = useState(0)
  const [teammates, setTeammates]     = useState<Teammate[]>([])
  const [currentId, setCurrentId]     = useState<string | null>(null)
  const [schoolId, setSchoolId]       = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [teamLoading, setTeamLoading] = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // ── Initial load: get teacher's subjects ──────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not signed in.'); setLoading(false); return }

      setCurrentId(user.id)

      const [tcRes, memberRes] = await Promise.all([
        supabase
          .from('teacher_classes')
          .select('subject_id')
          .eq('teacher_id', user.id),
        supabase
          .from('school_members')
          .select('school_id')
          .eq('profile_id', user.id)
          .maybeSingle(),
      ])

      if (tcRes.error)     { setError(tcRes.error.message);     setLoading(false); return }
      if (memberRes.error) { setError(memberRes.error.message); setLoading(false); return }

      const sid = memberRes.data?.school_id ?? null
      setSchoolId(sid)

      const subjectIds = Array.from(new Set(
        (tcRes.data ?? []).map((r: { subject_id: string }) => r.subject_id)
      ))

      if (subjectIds.length === 0) {
        setSubjects([])
        setLoading(false)
        return
      }

      const { data: subData, error: subErr } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds)

      if (subErr) { setError(subErr.message); setLoading(false); return }

      setSubjects(subData ?? [])
      setLoading(false)
    }

    load()
  }, [])

  // ── Load teammates when active subject changes ────────────────────────────
  useEffect(() => {
    if (subjects.length === 0 || !schoolId) return

    async function loadTeam() {
      setTeamLoading(true)
      const subjectId = subjects[activeIdx]?.id
      if (!subjectId) { setTeamLoading(false); return }

      // Get all teacher_ids for this subject in this school
      const { data: tcData, error: tcErr } = await supabase
        .from('teacher_classes')
        .select('teacher_id')
        .eq('subject_id', subjectId)
        .eq('school_id', schoolId ?? '')

      if (tcErr || !tcData || tcData.length === 0) {
        setTeammates([])
        setTeamLoading(false)
        return
      }

      const teacherIds = Array.from(new Set(
        tcData.map((r: { teacher_id: string }) => r.teacher_id)
      ))

      const { data: profileData, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teacherIds)

      if (profErr) {
        setTeammates([])
        setTeamLoading(false)
        return
      }

      const team: Teammate[] = (profileData ?? []).map((p: { id: string; full_name: string }) => ({
        profileId: p.id,
        fullName:  p.full_name ?? 'Unknown',
        initials:  getInitials(p.full_name ?? '?'),
        isYou:     p.id === currentId,
      }))

      // Put "you" first
      team.sort((a, b) => (a.isYou ? -1 : b.isYou ? 1 : 0))

      setTeammates(team)
      setTeamLoading(false)
    }

    loadTeam()
  }, [subjects, activeIdx, schoolId, currentId])

  const activeSubject = subjects[activeIdx] ?? null

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header banner */}
        <div style={{
          background: 'linear-gradient(135deg, #075985 0%, #0ea5e9 100%)',
          borderRadius: 20,
          padding: '20px',
          color: '#fff',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            SubjectHub
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
            {loading ? 'Loading…' : activeSubject ? `${activeSubject.name} Department` : 'No subjects assigned'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            Shared resources, team, and curriculum alignment.
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fef2f2', color: C.error, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton h={48} />
            <Skeleton h={180} />
          </div>
        )}

        {/* No subjects */}
        {!loading && !error && subjects.length === 0 && (
          <Card>
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.textMuted, fontSize: 13 }}>
              No subjects assigned yet. Contact your school admin to get set up.
            </div>
          </Card>
        )}

        {/* Subject tabs */}
        {!loading && subjects.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {subjects.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActiveIdx(i)}
                style={{
                  padding: '7px 16px',
                  borderRadius: 20,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  background: i === activeIdx ? C.accent : C.surface,
                  color:      i === activeIdx ? '#fff'    : C.textMuted,
                  transition: 'background 0.15s',
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* Department team */}
        {!loading && activeSubject && (
          <Card>
            <SectionLabel>Department Team</SectionLabel>

            {teamLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => <Skeleton key={i} h={52} />)}
              </div>
            )}

            {!teamLoading && teammates.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: C.textMuted }}>
                No teammates found for this subject.
              </div>
            )}

            {!teamLoading && teammates.map((t, idx) => (
              <div
                key={t.profileId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 0',
                  borderBottom: idx < teammates.length - 1 ? `1px solid ${C.border}` : 'none',
                }}
              >
                <Avatar initials={t.initials} idx={idx} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
                    {t.fullName}{t.isYou ? ' (You)' : ''}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{activeSubject.name}</div>
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* Shared resources — table doesn't exist yet, UI placeholder only */}
        {!loading && activeSubject && (
          <Card>
            <SectionLabel>Shared Resources</SectionLabel>
            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: C.textMuted }}>
              Resource sharing coming soon.
            </div>
            <div style={{ marginTop: 8 }}>
              <Btn variant="ghost">+ Upload Resource</Btn>
            </div>
          </Card>
        )}

      </div>
    </>
  )
}