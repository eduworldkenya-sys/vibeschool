"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const dark   = '#1e1b4b'
const accent = '#6366f1'

interface DashData {
  studentName:    string
  className:      string
  schoolName:     string
  admissionNo:    string
  attendancePct:  number
  totalPresent:   number
  totalDays:      number
  todaySlots:     { subject: string; start: string; end: string; room: string }[]
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function Skeleton({ w = '100%', h = 16, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: radius, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', flexShrink: 0 }} />
  )
}

export default function StudentHomePage() {
  const router = useRouter()
  const [data,    setData]    = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      // Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, school_id')
        .eq('id', user.id)
        .single()

      const name = profile?.full_name ?? ''
      setFirstName(name.split(' ')[0] || 'Student')

      // Student row
      const { data: student } = await supabase
        .from('students')
        .select('id, name, admission_number, class_id')
        .eq('profile_id', user.id)
        .single()

      if (!student) {
        router.push('/student/claim')
        return
      }

      // Class — null-safe
      const cls = student.class_id ? (await supabase
        .from('classes')
        .select('id, name, stream, school_id')
        .eq('id', student.class_id)
        .single()).data : null

      // School — null-safe
      const school = cls?.school_id ? (await supabase
        .from('schools')
        .select('name')
        .eq('id', cls.school_id)
        .single()).data : null

      // Attendance — by student_id not class_id
      const { data: att } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', student.id)

      const totalDays    = att?.length ?? 0
      const totalPresent = att?.filter(a => a.status === 'present').length ?? 0
      const attendancePct = totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : 0

      // Today timetable
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
      const today = days[new Date().getDay()]

      const { data: slots } = await supabase
        .from('timetable_slots')
        .select('start_time, end_time, room, subject_id')
        .eq('class_id', student.class_id)
        .eq('day_of_week', today)
        .order('start_time', { ascending: true })

      // Get subject names
      const subjectIds = Array.from(new Set((slots ?? []).map(s => s.subject_id).filter(Boolean))) as string[]
      let subjectMap: Record<string, string> = {}

      if (subjectIds.length > 0) {
        const { data: subjects } = await supabase
          .from('subjects')
          .select('id, name')
          .in('id', subjectIds)
        subjectMap = Object.fromEntries((subjects ?? []).map(s => [s.id, s.name]))
      }

      const todaySlots = (slots ?? []).map(s => ({
        subject: subjectMap[s.subject_id] ?? 'Lesson',
        start:   s.start_time?.slice(0, 5) ?? '',
        end:     s.end_time?.slice(0, 5)   ?? '',
        room:    s.room ?? '',
      }))

      setData({
        studentName:   student.name,
        className:     cls ? cls.name + (cls.stream ? ' ' + cls.stream : '') : '—',
        schoolName:    school?.name ?? '—',
        admissionNo:   student.admission_number ?? '',
        attendancePct,
        totalPresent,
        totalDays,
        todaySlots,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: `linear-gradient(135deg,${dark} 0%,#312e81 100%)`, borderRadius: 20, padding: 14, marginBottom: 12 }}>
        <Skeleton w={120} h={10} />
        <div style={{ marginTop: 6 }}><Skeleton w={160} h={15} /></div>
      </div>
      <Skeleton h={100} radius={16} />
      <div style={{ marginTop: 12 }}><Skeleton h={160} radius={16} /></div>
    </div>
  )

  if (!data) return null

  return (
    <div style={{ animation: 'slideIn 0.22s ease' }}>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg,${dark} 0%,#312e81 100%)`, borderRadius: 20, padding: '12px 14px', marginBottom: 14, color: '#fff' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 1 }}>
          {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{greeting()}, {firstName} 👋</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
          {data.className} · {data.schoolName}
        </div>
        {data.admissionNo && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
            Adm: {data.admissionNo}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[
          {
            label: 'Attendance',
            value: `${data.attendancePct}%`,
            sub:   `${data.totalPresent}/${data.totalDays} days`,
            color: data.attendancePct >= 80 ? '#d1fae5' : '#fef3c7',
            text:  data.attendancePct >= 80 ? '#065f46' : '#92400e',
          },
          {
            label: 'Marks',
            value: '—',
            sub:   'No results yet',
            color: '#ede9fe',
            text:  '#4c1d95',
          },
          {
            label: 'Homework',
            value: '—',
            sub:   'None due',
            color: '#e0f2fe',
            text:  '#075985',
          },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: s.color, borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.text }}>{s.value}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: s.text, marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: 9, color: s.text, opacity: 0.7, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Today timetable */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: dark, marginBottom: 12 }}>
          📅 Today
        </div>
        {data.todaySlots.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
            No lessons scheduled today
          </div>
        ) : (
          data.todaySlots.map((slot, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < data.todaySlots.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ minWidth: 52, fontSize: 11, fontWeight: 700, color: accent, textAlign: 'center' }}>
                {slot.start}<br />
                <span style={{ color: '#9ca3af', fontWeight: 500 }}>{slot.end}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{slot.subject}</div>
                {slot.room && <div style={{ fontSize: 11, color: '#6b7280' }}>Room {slot.room}</div>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {[
          { label: 'My Marks',    icon: '📝', href: '/student/learn'     },
          { label: 'Resources',   icon: '📚', href: '/student/resources'  },
          { label: 'Timetable',   icon: '🗓', href: null                  },
          { label: 'My Profile',  icon: '👤', href: '/student/profile'     },
        ].map(q => (
          <button key={q.label} onClick={() => q.href ? router.push(q.href) : null}
            style={{ opacity: q.href ? 1 : 0.45, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: 22 }}>{q.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: dark }}>{q.label}</span>
          </button>
        ))}
      </div>

    </div>
  )
}
