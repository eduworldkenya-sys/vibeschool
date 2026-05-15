'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, SectionLabel, C } from '@/components/teacher/ui'

// ─── Local types ──────────────────────────────────────────────────────────────

interface Strand {
  id: string
  name: string
  subject_id: string
}

interface SubjectRow {
  id: string
  name: string
}

interface SubjectGroup {
  subjectId: string
  subjectName: string
  strands: Strand[]
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ h = 56 }: { h?: number }) {
  return (
    <div style={{
      height: h,
      borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchemePage() {
  const [groups, setGroups]   = useState<SubjectGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      // 1. Get current teacher profile
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); setError('Not signed in.'); return }

      // 2. Parallel — teacher_classes rows + all subjects for this school
      const [tcRes, profileRes] = await Promise.all([
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

      if (tcRes.error)      { setError(tcRes.error.message);      setLoading(false); return }
      if (profileRes.error) { setError(profileRes.error.message); setLoading(false); return }

      const schoolId   = profileRes.data?.school_id ?? null
      const subjectIds = [...new Set((tcRes.data ?? []).map((r: { subject_id: string }) => r.subject_id))]

      if (subjectIds.length === 0) {
        setGroups([])
        setLoading(false)
        return
      }

      // 3. Parallel — fetch subjects + strands for those subject IDs
      const [subjectsRes, strandsRes] = await Promise.all([
        supabase
          .from('subjects')
          .select('id, name')
          .in('id', subjectIds),
        supabase
          .from('strands')
          .select('id, name, subject_id')
          .in('subject_id', subjectIds)
          .eq('school_id', schoolId ?? ''),
      ])

      if (subjectsRes.error) { setError(subjectsRes.error.message); setLoading(false); return }
      if (strandsRes.error)  { setError(strandsRes.error.message);  setLoading(false); return }

      const subjects: SubjectRow[] = subjectsRes.data ?? []
      const strands:  Strand[]     = strandsRes.data  ?? []

      // 4. Group strands by subject
      const grouped: SubjectGroup[] = subjects.map(s => ({
        subjectId:   s.id,
        subjectName: s.name,
        strands:     strands.filter(st => st.subject_id === s.id),
      }))

      setGroups(grouped)
      setLoading(false)
    }

    load()
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary }}>Scheme of Work</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>
            Curriculum strands by subject
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: '#fef2f2',
            color: C.error,
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} h={120} />)}
          </div>
        )}

        {/* No subjects assigned */}
        {!loading && !error && groups.length === 0 && (
          <Card>
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.textMuted, fontSize: 13 }}>
              No subjects assigned yet. Contact your school admin to get set up.
            </div>
          </Card>
        )}

        {/* Subject groups */}
        {!loading && !error && groups.map(group => (
          <div key={group.subjectId}>
            <SectionLabel>{group.subjectName}</SectionLabel>

            <Card>
              {group.strands.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '20px 0',
                  fontSize: 13,
                  color: C.textMuted,
                }}>
                  No strands added for this subject yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {group.strands.map((strand, idx) => (
                    <div
                      key={strand.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 0',
                        borderBottom: idx < group.strands.length - 1
                          ? `1px solid ${C.border}`
                          : 'none',
                      }}
                    >
                      {/* Strand colour dot */}
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: C.accent,
                        flexShrink: 0,
                      }} />

                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>
                          {strand.name}
                        </div>
                      </div>

                      {/* Placeholder chip — assessment integration comes later */}
                      <div style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.textMuted,
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 20,
                        padding: '3px 10px',
                      }}>
                        Strand
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ))}

      </div>
    </>
  )
}