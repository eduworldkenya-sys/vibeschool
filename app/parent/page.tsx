"use client";
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ParentTwinDrawer from '@/components/parent/TwinDrawer'
import { useRouter } from 'next/navigation'

interface ChildData {
  id:               string
  name:             string
  admission_number: string | null
  className:        string
  school:           string
  attendancePct:    number
  recentMarks:      number | null
  pendingApproval:  boolean
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function Skeleton({ w = '100%', h = 16, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: radius, background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', flexShrink: 0 }} />
  )
}

export default function ParentHomePage() {
  const router  = useRouter()
  const [firstName, setFirstName] = useState('')
  const [children,  setChildren]  = useState<ChildData[]>([])
  const [loading,   setLoading]   = useState(true)
  const [noChild,   setNoChild]   = useState(false)
  const [twinOpen,   setTwinOpen]  = useState(false)

  const dark   = '#1e1b4b'
  const accent = '#10b981'

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/academy/signin?role=parent'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const name = profile?.full_name ?? ''
      setFirstName(name.split(' ')[0] || 'Parent')

      const { data: links } = await supabase
        .from('parent_student_links')
        .select('student_id')
        .eq('parent_id', user.id)

      if (!links || links.length === 0) {
        setNoChild(true)
        setLoading(false)
        return
      }

      const studentIds = links.map(l => l.student_id)

      const { data: students } = await supabase
        .from('students')
        .select('id, name, admission_number, class_id')
        .in('id', studentIds)

      if (!students || students.length === 0) {
        setNoChild(true)
        setChildren([])
        setLoading(false)
        return
      }

      // Null-safe classIds
      const classIds = students.map(s => s.class_id).filter(Boolean) as string[]

      const { data: classes } = classIds.length > 0 ? await supabase
        .from('classes')
        .select('id, name, stream, school_id')
        .in('id', classIds)
        : { data: [] }

      const schoolIds = Array.from(new Set((classes ?? []).map(c => c.school_id).filter(Boolean))) as string[]

      const { data: schools } = schoolIds.length > 0 ? await supabase
        .from('schools')
        .select('id, name')
        .in('id', schoolIds)
        : { data: [] }

      // Single attendance query for all students
      const { data: allAtt } = await supabase
        .from('attendance')
        .select('student_id, status')
        .in('student_id', studentIds)

      // Pending join requests
      const { data: pendingReqs } = await supabase
        .from('class_join_requests')
        .select('student_id')
        .in('student_id', studentIds)
        .eq('status', 'pending')

      const pendingSet = new Set((pendingReqs ?? []).map(r => r.student_id))

      const childData: ChildData[] = students.map(s => {
        const cls    = (classes ?? []).find(c => c.id === s.class_id)
        const school = (schools ?? []).find(sc => sc.id === cls?.school_id)
        const rows    = (allAtt ?? []).filter(a => a.student_id === s.id)
        const total   = rows.length
        const present = rows.filter(a => a.status === 'present').length
        const attPct  = total > 0 ? Math.round((present / total) * 100) : 0
        const className = cls ? cls.name + (cls.stream ? ' ' + cls.stream : '') : '—'

        return {
          id:               s.id,
          name:             s.name,
          admission_number: s.admission_number,
          className,
          school:           school?.name ?? '—',
          attendancePct:    attPct,
          recentMarks:      null,
          pendingApproval:  pendingSet.has(s.id) && !s.class_id,
        }
      })

      setChildren(childData)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`, borderRadius: 20, padding: '14px', marginBottom: 12 }}>
        <Skeleton w={120} h={10} />
        <div style={{ marginTop: 6 }}><Skeleton w={160} h={15} /></div>
      </div>
      <Skeleton h={120} radius={16} />
    </div>
  )

  return (
    <div style={{ animation: 'slideIn 0.22s ease' }}>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`, borderRadius: 20, padding: '12px 14px', marginBottom: 14, color: '#fff' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 1 }}>
          {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{greeting()}, {firstName} 👋</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
          {children.length > 0 ? `Tracking ${children.length} ${children.length === 1 ? 'child' : 'children'}` : 'No children linked yet'}
        </div>
      </div>

      {/* No child linked */}
      {noChild && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center', border: '1px solid #e5e7eb', marginBottom: 12 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>👨‍👩‍👧</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 6 }}>No child linked yet</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Link an existing student with a claim code, or add your child to a class directly.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => router.push('/parent/link-child')}
              style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: accent, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              🔗 Link with Claim Code
            </button>
            <button
              onClick={() => router.push('/parent/create-child')}
              style={{ padding: '12px 24px', borderRadius: 12, border: `1.5px solid ${dark}`, background: 'transparent', color: dark, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + Add Child to Class
            </button>
          </div>
        </div>
      )}

      {/* Children cards */}
      {children.map(child => (
        <div key={child.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: dark, flexShrink: 0 }}>
              {child.name[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{child.name}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{child.className} · {child.school}</div>
              {child.admission_number && <div style={{ fontSize: 11, color: '#9ca3af' }}>{child.admission_number}</div>}
              {child.pendingApproval && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 20, padding: '2px 10px' }}>
                  <span style={{ fontSize: 10 }}>⏳</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e' }}>Waiting for teacher approval</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Attendance', value: `${child.attendancePct}%`, color: child.attendancePct >= 80 ? '#d1fae5' : '#fef3c7', textColor: child.attendancePct >= 80 ? '#065f46' : '#92400e' },
              { label: 'Marks',      value: child.recentMarks !== null ? `${child.recentMarks}%` : '—', color: '#e0f2fe', textColor: '#075985' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: s.color, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.textColor }}>{s.value}</div>
                <div style={{ fontSize: 10, color: s.textColor, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => router.push('/parent/child/' + child.id)}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: dark, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              View Details
            </button>
            <button
              onClick={() => router.push('/parent/messages?studentId=' + child.id)}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #10b981', background: 'transparent', color: '#10b981', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Message Teacher
            </button>
          </div>
        </div>
      ))}

      {/* Add another child button — shown when children exist */}
      {children.length > 0 && (
        <button
          onClick={() => router.push('/parent/create-child')}
          style={{ width: '100%', padding: '13px', borderRadius: 14, border: '1.5px dashed #d1d5db', background: 'transparent', color: '#6b7280', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}
        >
          + Add Another Child
        </button>
      )}

      {/* ── Parent Twin ──────────────────────────────────────────────── */}
      <button
        onClick={() => setTwinOpen(true)}
        style={{
          position:       "fixed",
          bottom:         90,
          right:          20,
          zIndex:         750,
          width:          52,
          height:         52,
          borderRadius:   "50%",
          background:     "linear-gradient(135deg, #1e1b4b 0%, #064e3b 100%)",
          border:         "1.5px solid rgba(16,185,129,0.5)",
          color:          "#10b981",
          fontSize:       20,
          cursor:         "pointer",
          boxShadow:      "0 4px 24px rgba(16,185,129,0.35)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
        }}
      >
        ✦
      </button>
      <ParentTwinDrawer
        open={twinOpen}
        onClose={() => setTwinOpen(false)}
      />
    </div>
  )
}
