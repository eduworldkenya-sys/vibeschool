"use client";

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, SectionLabel, Btn, C } from '@/components/teacher/ui'
import { formatJoinCode } from '@/lib/schoolCode'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchoolInfo {
  name: string
  timezone: string
  country_code: string
  status: string
  subdomain: string
  motto: string | null
  vision: string | null
  knec_code: string | null
  nemis_code: string | null
  county: string | null
  sub_county: string | null
  ward: string | null
  postal_address: string | null
  phone: string | null
  school_type: string | null
  school_category: string | null
  established_year: number | null
  logo_url: string | null
}

interface StaffMember {
  profileId: string
  fullName: string
  role: string
  joinedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const PALETTES = [
  { bg: '#ede9fe', color: '#6d28d9' },
  { bg: '#dbeafe', color: '#1d4ed8' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: C.accentLight, color: '#065f46' },
  { bg: '#fce7f3', color: '#9d174d' },
]

function Avatar({ name, idx }: { name: string; idx: number }) {
  const p = PALETTES[idx % PALETTES.length]
  return (
    <div style={{
      width: 38, height: 38, borderRadius: '50%',
      background: p.bg, color: p.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, flexShrink: 0,
    }}>
      {initials(name)}
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

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '9px 0', borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, flexShrink: 0, marginRight: 12 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.textPrimary, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

// ─── Static content ───────────────────────────────────────────────────────────

const POLICIES = [
  { title: 'Child Safeguarding Policy',   updated: 'Jan 2025' },
  { title: 'Assessment & Grading Policy', updated: 'Aug 2024' },
  { title: 'Attendance Policy',           updated: 'Jan 2025' },
  { title: 'Code of Conduct',             updated: 'Jan 2025' },
]

const CALENDAR = [
  { event: 'Term 2 Ends',           date: 'Friday, 6 June 2025' },
  { event: 'Report Cards Released', date: 'Tuesday, 10 June 2025' },
  { event: 'Term 3 Begins',         date: 'Monday, 7 July 2025' },
  { event: 'National Examinations', date: 'October 2025' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchoolHubPage() {
  const [school, setSchool]   = useState<SchoolInfo | null>(null)
  const [staff, setStaff]     = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [copied, setCopied]   = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not signed in.'); setLoading(false); return }

      const [memberRes, profileRes] = await Promise.all([
        supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('profiles').select('school_id').eq('id', user.id).single(),
      ])

      const schoolId = memberRes.data?.school_id ?? profileRes.data?.school_id ?? null
      if (!schoolId) { setLoading(false); return }

      const [schoolRes, membersRes] = await Promise.all([
        supabase
          .from('schools')
          .select('name, timezone, country_code, status, subdomain, motto, vision, knec_code, nemis_code, county, sub_county, ward, postal_address, phone, school_type, school_category, established_year, logo_url')
          .eq('id', schoolId)
          .maybeSingle(),
        supabase
          .from('school_members')
          .select('profile_id, role, joined_at')
          .eq('school_id', schoolId),
      ])

      if (schoolRes.error)  { setError(schoolRes.error.message);  setLoading(false); return }
      if (membersRes.error) { setError(membersRes.error.message); setLoading(false); return }

      setSchool(schoolRes.data ?? null)

      const memberRows = membersRes.data ?? []
      const profileIds = Array.from(new Set(memberRows.map((r: { profile_id: string }) => r.profile_id)))

      if (profileIds.length === 0) { setLoading(false); return }

      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('id', profileIds)

      if (profileErr) { setError(profileErr.message); setLoading(false); return }

      const nameMap = new Map<string, { fullName: string; role: string }>(
        (profileData ?? []).map((p: { id: string; full_name: string; role: string }) => [
          p.id,
          { fullName: p.full_name ?? 'Unknown', role: p.role ?? 'staff' },
        ])
      )

      const staffList: StaffMember[] = memberRows.map((m: { profile_id: string; role: string; joined_at: string }) => ({
        profileId: m.profile_id,
        fullName:  nameMap.get(m.profile_id)?.fullName ?? 'Unknown',
        role:      m.role,
        joinedAt:  m.joined_at,
      }))

      setStaff(staffList)
      setLoading(false)
    }

    load()
  }, [])

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

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

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
          borderRadius: 20, padding: '20px', color: '#fff',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            SchoolHub
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
            {loading ? 'Loading…' : school?.name ?? 'Your School'}
          </div>
          {school?.motto && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.80)', marginTop: 4, fontStyle: 'italic' }}>
              {school.motto}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            School-wide admin, governance, and notices.
          </div>
          {school && (
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              {school.school_category && (
                <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                  {school.school_category}
                </div>
              )}
              {school.county && (
                <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                  {school.county}
                </div>
              )}
              {school.established_year && (
                <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                  Est. {school.established_year}
                </div>
              )}
              <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                {staff.length} {staff.length === 1 ? 'member' : 'members'}
              </div>
            </div>
          )}
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
            <Skeleton h={80} />
            <Skeleton h={160} />
            <Skeleton h={140} />
          </div>
        )}

        {/* Join Code */}
        {!loading && school?.subdomain && (
          <Card>
            <SectionLabel>School Join Code</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{
                  fontSize: 28, fontWeight: 900, letterSpacing: 4,
                  color: C.textPrimary, fontFamily: 'monospace',
                }}>
                  {formatJoinCode(school.subdomain)}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                  Share this code with your staff to join this school.
                </div>
              </div>
              <Btn
                small
                variant={copied ? 'primary' : 'ghost'}
                onClick={() => handleCopy(formatJoinCode(school.subdomain))}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </Btn>
            </div>
          </Card>
        )}

        {/* School Profile */}
        {!loading && school && (
          <Card>
            <SectionLabel>School Profile</SectionLabel>
            <InfoRow label="KNEC Code"   value={school.knec_code} />
            <InfoRow label="NEMIS Code"  value={school.nemis_code} />
            <InfoRow label="Type"        value={school.school_type} />
            <InfoRow label="County"      value={school.county} />
            <InfoRow label="Sub-County"  value={school.sub_county} />
            <InfoRow label="Ward"        value={school.ward} />
            <InfoRow label="Phone"       value={school.phone} />
            <InfoRow label="Address"     value={school.postal_address} />
            <InfoRow label="Timezone"    value={school.timezone} />
            {!school.knec_code && !school.county && !school.phone && (
              <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: C.textMuted }}>
                No profile details added yet.
              </div>
            )}
          </Card>
        )}

        {/* Notices */}
        {!loading && (
          <Card>
            <SectionLabel>Pinned Notices</SectionLabel>
            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: C.textMuted }}>
              School notices coming soon.
            </div>
          </Card>
        )}

        {/* Staff directory */}
        {!loading && (
          <Card>
            <SectionLabel>Staff Directory</SectionLabel>
            {staff.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: C.textMuted }}>
                No staff members found.
              </div>
            ) : (
              staff.map((s, idx) => (
                <div
                  key={s.profileId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 0',
                    borderBottom: idx < staff.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <Avatar name={s.fullName} idx={idx} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{s.fullName}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'capitalize' }}>{s.role}</div>
                  </div>
                </div>
              ))
            )}
          </Card>
        )}

        {/* School policies */}
        {!loading && (
          <Card>
            <SectionLabel>School Policies</SectionLabel>
            {POLICIES.map((p, idx) => (
              <div
                key={p.title}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 0',
                  borderBottom: idx < POLICIES.length - 1 ? `1px solid ${C.border}` : 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>Updated {p.updated}</div>
                </div>
                <Btn small variant="muted">PDF</Btn>
              </div>
            ))}
          </Card>
        )}

        {/* Calendar */}
        {!loading && (
          <Card>
            <SectionLabel>School Calendar</SectionLabel>
            {CALENDAR.map((e, idx) => (
              <div
                key={e.event}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: idx < CALENDAR.length - 1 ? `1px solid ${C.border}` : 'none',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{e.event}</span>
                <span style={{ fontSize: 12, color: C.textMuted }}>{e.date}</span>
              </div>
            ))}
          </Card>
        )}

      </div>
    </>
  )
}
