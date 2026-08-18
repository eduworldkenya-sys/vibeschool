'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Student {
  id: string
  name: string
  className: string
  attendanceRecords: number
  presentRecords: number
  hwStatus: string
  recentlyAbsent: boolean
}

function StatRow({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 800, color: accent ?? '#fff' }}>{value}</span>
  </div>
}

export default function SmartInsightSlides() {
  const router = useRouter()
  const isMounted = useRef(true)
  const slideRef = useRef<HTMLDivElement>(null)
  const autoTimer = useRef<NodeJS.Timeout | null>(null)
  const pauseTimer = useRef<NodeJS.Timeout | null>(null)
  const studentTimer = useRef<NodeJS.Timeout | null>(null)
  const userTouched = useRef(false)

  const [activeSlide, setActiveSlide] = useState(0)
  const [students, setStudents] = useState<Student[]>([])
  const [studentIndex, setStudentIndex] = useState(0)
  const [firstName, setFirstName] = useState('Teacher')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => () => { isMounted.current = false }, [])

  const loadStudents = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMounted.current) return

      const [profileRes, membershipRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
        supabase.from('school_members').select('school_id').eq('profile_id', user.id).eq('role', 'teacher').limit(1).maybeSingle(),
      ])
      if (profileRes.data?.full_name && isMounted.current) setFirstName(profileRes.data.full_name.split(' ')[0])
      const schoolId = membershipRes.data?.school_id
      if (!schoolId) return

      const { data: tcRows } = await supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('teacher_id', user.id)
        .eq('school_id', schoolId)

      const classIds = Array.from(new Set((tcRows ?? []).map((row: { class_id: string }) => row.class_id)))
      if (classIds.length === 0) return

      const { data: enrolments } = await supabase
        .from('student_classes')
        .select('student_id, class_id')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .in('class_id', classIds)

      const studentIds = Array.from(new Set((enrolments ?? []).map((row: { student_id: string }) => row.student_id)))
      if (studentIds.length === 0) return

      const [studentRes, attRes, hwRes, classRes] = await Promise.all([
        supabase.from('students').select('id, name').in('id', studentIds).is('deleted_at', null),
        supabase.from('attendance').select('student_id, status, date').eq('school_id', schoolId).in('student_id', studentIds).gte('date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).order('date', { ascending: false }),
        supabase.from('homework_submissions').select('student_id, status, created_at').in('student_id', studentIds).order('created_at', { ascending: false }),
        supabase.from('classes').select('id, name, stream').eq('school_id', schoolId).in('id', classIds),
      ])

      const classMap: Record<string, string> = {}
      ;(classRes.data ?? []).forEach((c: { id: string; name: string; stream: string | null }) => { classMap[c.id] = `${c.name}${c.stream ? ` ${c.stream}` : ''}` })
      const enrolmentMap: Record<string, string> = {}
      ;(enrolments ?? []).forEach((row: { student_id: string; class_id: string }) => { if (!enrolmentMap[row.student_id]) enrolmentMap[row.student_id] = row.class_id })

      const attMap: Record<string, { total: number; present: number; latest: string | null }> = {}
      ;(attRes.data ?? []).forEach((a: { student_id: string | null; status: string; date: string }) => {
        if (!a.student_id) return
        const current = attMap[a.student_id] ?? { total: 0, present: 0, latest: null }
        current.total += 1
        if (a.status === 'present') current.present += 1
        if (!current.latest || a.date > current.latest) current.latest = a.date
        attMap[a.student_id] = current
      })

      const hwMap: Record<string, string> = {}
      ;(hwRes.data ?? []).forEach((h: { student_id: string | null; status: string }) => { if (h.student_id && !hwMap[h.student_id]) hwMap[h.student_id] = h.status })

      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
      const mapped: Student[] = (studentRes.data ?? []).map((s: { id: string; name: string }) => {
        const attendance = attMap[s.id]
        const classId = enrolmentMap[s.id]
        return {
          id: s.id,
          name: s.name,
          className: classMap[classId] ?? '',
          attendanceRecords: attendance?.total ?? 0,
          presentRecords: attendance?.present ?? 0,
          hwStatus: hwMap[s.id] ?? 'none',
          recentlyAbsent: Boolean(attendance?.latest && attendance.latest < threeDaysAgo),
        }
      }).sort((a, b) => a.name.localeCompare(b.name))

      if (isMounted.current) setStudents(mapped)
    } catch {
      // The slide remains useful in evidence-principle mode when school data is unavailable.
    } finally {
      if (isMounted.current) setLoaded(true)
    }
  }, [])

  useEffect(() => { void loadStudents() }, [loadStudents])

  useEffect(() => {
    if (students.length === 0) return
    studentTimer.current = setInterval(() => {
      if (isMounted.current) setStudentIndex(index => (index + 1) % students.length)
    }, 20 * 60 * 1000)
    return () => { if (studentTimer.current) clearInterval(studentTimer.current) }
  }, [students])

  const startAuto = useCallback(() => {
    if (autoTimer.current) clearInterval(autoTimer.current)
    autoTimer.current = setInterval(() => {
      if (!isMounted.current || userTouched.current || !slideRef.current) return
      setActiveSlide(previous => {
        const next = (previous + 1) % 3
        slideRef.current?.scrollTo({ left: next * slideRef.current.offsetWidth, behavior: 'smooth' })
        return next
      })
    }, 5000)
  }, [])

  useEffect(() => {
    startAuto()
    return () => { if (autoTimer.current) clearInterval(autoTimer.current) }
  }, [startAuto])

  function onTouchStart() {
    userTouched.current = true
    if (pauseTimer.current) clearTimeout(pauseTimer.current)
    pauseTimer.current = setTimeout(() => { userTouched.current = false }, 8000)
  }

  function onScroll() {
    if (!slideRef.current) return
    setActiveSlide(Math.round(slideRef.current.scrollLeft / slideRef.current.offsetWidth))
  }

  const student = students[studentIndex] ?? null
  const needingCheckIn = students.filter(item => item.recentlyAbsent).length
  const withNoAttendanceEvidence = students.filter(item => item.attendanceRecords === 0).length
  const returnedHomework = students.filter(item => item.hwStatus === 'returned').length

  const slides = [
    <div key="learner" style={{ minWidth: '100%', padding: 20, boxSizing: 'border-box', background: 'linear-gradient(135deg,#1e3a5f 0%,#1a2a4a 100%)' }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#60c8f5', letterSpacing: .8, marginBottom: 14 }}>LEARNER EVIDENCE SNAPSHOT</div>
      {!loaded ? <div style={{ color: 'rgba(255,255,255,.55)' }}>Reading assigned-class evidence…</div> : !student ? <div style={{ color: 'rgba(255,255,255,.55)' }}>No current learner enrollment is available in your assigned classes.</div> : <>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{student.name}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', margin: '4px 0 14px' }}>{student.className}</div>
        <StatRow label="Attendance evidence (30d)" value={`${student.presentRecords}/${student.attendanceRecords} present`} accent={student.attendanceRecords > 0 ? '#34d399' : '#fbbf24'} />
        <StatRow label="Latest homework state" value={student.hwStatus === 'none' ? 'No submission record' : student.hwStatus} />
        {student.recentlyAbsent && <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(251,191,36,.12)', color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>Recent attendance evidence is stale. Check the learner or attendance record; do not assume why.</div>}
        <button onClick={() => router.push('/teacher/classhub')} style={{ marginTop: 14, padding: '10px 14px', borderRadius: 12, border: '1.5px solid rgba(96,200,245,.4)', background: 'rgba(96,200,245,.1)', color: '#60c8f5', fontWeight: 700, cursor: 'pointer' }}>Open Class Hub →</button>
      </>}
    </div>,
    <div key="priority" style={{ minWidth: '100%', padding: 20, boxSizing: 'border-box', background: 'linear-gradient(135deg,#1a2a1a 0%,#0f3d1f 50%,#0a2010 100%)' }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#4ade80', letterSpacing: .8, marginBottom: 14 }}>DETERMINISTIC CLASS SIGNALS</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 12 }}>{firstName}, evidence before inference.</div>
      <StatRow label="Assigned learners" value={students.length} />
      <StatRow label="Need attendance check-in" value={needingCheckIn} accent={needingCheckIn > 0 ? '#fbbf24' : '#34d399'} />
      <StatRow label="No recent attendance evidence" value={withNoAttendanceEvidence} accent={withNoAttendanceEvidence > 0 ? '#fbbf24' : '#34d399'} />
      <StatRow label="Returned homework" value={returnedHomework} accent={returnedHomework > 0 ? '#fbbf24' : '#34d399'} />
      <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,.7)' }}>These are workflow signals from VibeSchool records. They are not labels about a learner's ability, behaviour or circumstances.</div>
    </div>,
    <div key="principle" style={{ minWidth: '100%', padding: 20, boxSizing: 'border-box', background: 'linear-gradient(135deg,#2d1b4e 0%,#1e1b4b 100%)' }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#c4b5fd', letterSpacing: .8, marginBottom: 14 }}>TWIN EVIDENCE PRINCIPLE</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1.25, marginBottom: 14 }}>Missing data is not positive or negative evidence.</div>
      <div style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,.7)' }}>Twin should tell you what is recorded, what is missing, why an item matters, and the next safe action. It should not invent a story to fill the gap.</div>
      <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 12, background: 'rgba(196,181,253,.1)', color: '#ddd6fe', fontSize: 12, fontWeight: 700 }}>Deterministic · authorized school data · no AI</div>
    </div>,
  ]

  return <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden' }} onTouchStart={onTouchStart}>
    <div ref={slideRef} onScroll={onScroll} style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
      {slides.map((slide, index) => <div key={index} style={{ minWidth: '100%', scrollSnapAlign: 'start' }}>{slide}</div>)}
    </div>
    <div style={{ position: 'absolute', bottom: 10, right: 14, display: 'flex', gap: 5 }}>
      {[0, 1, 2].map(index => <span key={index} style={{ width: activeSlide === index ? 18 : 6, height: 6, borderRadius: 6, background: activeSlide === index ? '#fff' : 'rgba(255,255,255,.3)', transition: 'width .2s' }} />)}
    </div>
  </div>
}
