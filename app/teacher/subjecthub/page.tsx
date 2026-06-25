"use client";
import { nairobiDateStr } from '@/lib/time'
export const dynamic = "force-dynamic";
import { Card, C } from '@/components/teacher/ui'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const CBC_SUBJECTS = [
  'Mathematics', 'English', 'Kiswahili', 'Science and Technology',
  'Social Studies', 'Agriculture', 'Home Science', 'Religious Education',
  'Creative Arts', 'Physical Education', 'Health Education',
  'Pre-Technical Studies', 'Business Studies',
]

interface SubjectOption {
  id:   string
  name: string
}

interface ClassForSubject {
  id:         string
  name:       string
  stream:     string
  studentCount: number
  perfPct:    number | null
}

interface Teammate {
  profileId: string
  fullName:  string
  initials:  string
  isYou:     boolean
}

const PALETTES = [
  { bg: '#ede9fe', color: '#6d28d9' },
  { bg: C.accentLight, color: '#065f46' },
  { bg: '#dbeafe', color: '#1d4ed8' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: '#fce7f3', color: '#9d174d' },
  { bg: '#e0f2fe', color: '#0369a1' },
]

function getInitials(name: string) {
  return name.trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function Skeleton({ h = 56, w = '100%' }: { h?: number; w?: string }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      flexShrink: 0,
    }} />
  )
}

function HeroSkeleton() {
  return (
    <div style={{
      background: 'linear-gradient(90deg,rgba(255,255,255,0.12) 25%,rgba(255,255,255,0.22) 50%,rgba(255,255,255,0.12) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      height: 16, borderRadius: 8,
    }} />
  )
}

export default function SubjectHubPage() {
  const router = useRouter()

  const [subjects,       setSubjects]       = useState<SubjectOption[]>([])
  const [activeIdx,      setActiveIdx]      = useState(0)
  const [classes,        setClasses]        = useState<ClassForSubject[]>([])
  const [teammates,      setTeammates]      = useState<Teammate[]>([])
  const [schoolId,       setSchoolId]       = useState<string | null>(null)
  const [currentId,      setCurrentId]      = useState<string | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [classLoading,   setClassLoading]   = useState(false)
  const [teamLoading,    setTeamLoading]    = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [pickerAction,   setPickerAction]   = useState<{ id: string; label: string; icon: string; bg: string; route: string } | null>(null)
  const [showAddSubject,    setShowAddSubject]    = useState(false)
  const [newSubjectName,    setNewSubjectName]    = useState('')
  const [useOtherSubject,  setUseOtherSubject]  = useState(false)
  const [newSubjectClassId, setNewSubjectClassId] = useState('')
  const [addingSubject,     setAddingSubject]     = useState(false)
  const [addSubjectError,   setAddSubjectError]   = useState<string | null>(null)
  const [allClasses,        setAllClasses]        = useState<{id: string; name: string; stream: string | null; school_id: string | null}[]>([])
  const [impactScore,      setImpactScore]      = useState<number>(0)
  const [streak,           setStreak]           = useState<number>(0)
  const [lessonCount,      setLessonCount]      = useState<number>(0)
  const [assessCount,      setAssessCount]      = useState<number>(0)
  const [attCount,         setAttCount]         = useState<number>(0)
  const [nextSlot,         setNextSlot]         = useState<{subject: string; class: string; start: string} | null>(null)
  const [aiSuggestion,     setAiSuggestion]     = useState<string | null>(null)
  const [dailyFact,        setDailyFact]        = useState<string | null>(null)
  const [resourceCount,    setResourceCount]    = useState<number>(0)
  const [suggLoading,      setSuggLoading]      = useState(false)
  const [weakStrand,       setWeakStrand]       = useState<{ name: string; pct: number } | null>(null)
  const [curriculumPct,    setCurriculumPct]    = useState<number | null>(null)
  const [removeConfirmId,  setRemoveConfirmId]  = useState<string | null>(null)
  // Task 2A — attendance rate per class for this subject this term
  const [attRateByClass,   setAttRateByClass]   = useState<Record<string, number>>({})

  useEffect(() => { init() }, [])

  async function init() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/?role=teacher'); return }
      setCurrentId(user.id)

      const [tcRes, teacherRes, memberRes, profileRes] = await Promise.all([
        supabase.from('teacher_classes').select('subject_id').eq('teacher_id', user.id),
        supabase.from('teacher_profiles').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('profiles').select('school_id').eq('id', user.id).single(),
      ])

      const sid = memberRes.data?.school_id ?? teacherRes.data?.school_id ?? profileRes.data?.school_id ?? null
      setSchoolId(sid)

      const subjectIds = Array.from(new Set(
        (tcRes.data ?? []).map((r: { subject_id: string }) => r.subject_id).filter(Boolean)
      ))

      const { data: tcRows } = await supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('teacher_id', user.id)
      const classIds = Array.from(new Set(
        (tcRows ?? []).map((r: { class_id: string }) => r.class_id).filter(Boolean)
      ))
      if (classIds.length > 0) {
        const { data: classRows } = await supabase
          .from('classes')
          .select('id, name, stream, school_id')
          .in('id', classIds)
        setAllClasses(classRows ?? [])
      } else {
        setAllClasses([])
      }

      if (subjectIds.length === 0) { setLoading(false); return }

      const subjectQuery = supabase
        .from('subjects').select('id, name').in('id', subjectIds).order('name')
      const scopedQuery = sid
        ? subjectQuery.or(`school_id.eq.${sid},school_id.is.null`)
        : subjectQuery.is('school_id', null)
      const { data: subData } = await scopedQuery

      setSubjects(subData ?? [])
    } catch {
      setError('Failed to load. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (subjects.length === 0) return
    if (!currentId) return
    loadClassesForSubject(subjects[activeIdx]?.id)
    loadTeamForSubject(subjects[activeIdx]?.id)
    loadGrowthData(subjects[activeIdx]?.id)
  }, [subjects, activeIdx, schoolId, currentId])

  async function loadClassesForSubject(subjectId: string) {
    if (!subjectId || !currentId) { setClassLoading(false); return }
    setClassLoading(true)

    const { data: tcData } = await supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', currentId)
      .eq('subject_id', subjectId)

    const classIds = (tcData ?? []).map((r: { class_id: string }) => r.class_id).filter(Boolean)

    if (classIds.length === 0) { setClasses([]); setAttRateByClass({}); setClassLoading(false); return }

    const termStart = nairobiDateStr(new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 4) * 4, 1))

    const [classRes, studentRes, perfRes, attRes] = await Promise.all([
      supabase.from('classes').select('id, name, stream').in('id', classIds),
      supabase.from('students').select('class_id').in('class_id', classIds),
      supabase.from('cbc_assessments').select('class_id, performance').eq('subject_id', subjectId).in('class_id', classIds),
      supabase.from('attendance').select('class_id, student_id, status').in('class_id', classIds).eq('teacher_id', currentId).gte('date', termStart),
    ])

    const counts: Record<string, number> = {}
    for (const s of studentRes.data ?? []) {
      counts[s.class_id] = (counts[s.class_id] ?? 0) + 1
    }

    const PERF_SCORE: Record<string, number> = {
      exceeds_expectation: 4,
      meets_expectation: 3,
      approaches_expectation: 2,
      below_expectation: 1,
    }
    const classPerfTotals: Record<string, { sum: number; count: number }> = {}
    for (const row of (perfRes.data ?? []) as { class_id: string | null; performance: string }[]) {
      if (!row.class_id) continue
      const score = PERF_SCORE[row.performance] ?? 0
      if (score === 0) continue
      const prev = classPerfTotals[row.class_id] ?? { sum: 0, count: 0 }
      classPerfTotals[row.class_id] = { sum: prev.sum + score, count: prev.count + 1 }
    }

    const mapped: ClassForSubject[] = (classRes.data ?? []).map((c: { id: string; name: string; stream: string }) => {
      const perf = classPerfTotals[c.id]
      return {
        id:           c.id,
        name:         c.name,
        stream:       c.stream,
        studentCount: counts[c.id] ?? 0,
        perfPct:      perf ? Math.round((perf.sum / (perf.count * 4)) * 100) : null,
      }
    })

    setClasses(mapped)

    // Task 2A — compute per-class attendance rate
    const classTotals: Record<string, { present: number; total: number }> = {}
    for (const row of (attRes.data ?? []) as { class_id: string; student_id: string; status: string }[]) {
      if (!row.class_id) continue
      const prev = classTotals[row.class_id] ?? { present: 0, total: 0 }
      classTotals[row.class_id] = {
        present: prev.present + (['present', 'late'].includes(row.status) ? 1 : 0),
        total: prev.total + 1,
      }
    }
    const rates: Record<string, number> = {}
    for (const [cid, { present, total }] of Object.entries(classTotals)) {
      rates[cid] = total > 0 ? Math.round((present / total) * 100) : 0
    }
    setAttRateByClass(rates)

    setClassLoading(false)
  }

  async function loadTeamForSubject(subjectId: string) {
    if (!subjectId) { setTeammates([]); setTeamLoading(false); return }
    if (!schoolId) { setTeammates([]); setTeamLoading(false); return }
    setTeamLoading(true)

    const { data: tcData } = await supabase
      .from('teacher_classes')
      .select('teacher_id')
      .eq('subject_id', subjectId)
      .eq('school_id', schoolId)

    const teacherIds = Array.from(new Set(
      (tcData ?? []).map((r: { teacher_id: string }) => r.teacher_id)
    ))

    if (teacherIds.length === 0) { setTeammates([]); setTeamLoading(false); return }

    const { data: profileData } = await supabase
      .from('profiles').select('id, full_name').in('id', teacherIds)

    const team: Teammate[] = (profileData ?? []).map((p: { id: string; full_name: string }) => ({
      profileId: p.id,
      fullName:  p.full_name ?? 'Unknown',
      initials:  getInitials(p.full_name ?? '?'),
      isYou:     p.id === currentId,
    }))
    team.sort((a, b) => (a.isYou ? -1 : b.isYou ? 1 : 0))
    setTeammates(team)
    setTeamLoading(false)
  }

  useEffect(() => {
    if (showAddSubject) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [showAddSubject])

  function openAddSubject() {
    setNewSubjectName('')
    setNewSubjectClassId('')
    setAddSubjectError(null)
    setAddingSubject(false)
    setShowAddSubject(true)
  }

  function closeAddSubject() {
    setShowAddSubject(false)
    setNewSubjectName('')
    setNewSubjectClassId('')
    setAddSubjectError(null)
    setAddingSubject(false)
    setUseOtherSubject(false)
  }

  async function removeSubject(subjectId: string) {
    if (!currentId) return
    const { error: delErr } = await supabase
      .from('teacher_classes')
      .delete()
      .eq('teacher_id', currentId)
      .eq('subject_id', subjectId)
    if (delErr) { setError('Failed to remove subject. Please try again.'); return }
    const nextSubjects = subjects.filter(s => s.id !== subjectId)
    setSubjects(nextSubjects)
    const nextIdx = Math.max(0, Math.min(activeIdx, nextSubjects.length - 1))
    setActiveIdx(nextIdx)
    setClasses([])
    setTeammates([])
    if (nextSubjects.length > 0) loadGrowthData(nextSubjects[nextIdx].id)
  }

  async function loadGrowthData(subjectId: string) {
    if (!subjectId || !currentId) return
    setSuggLoading(true)

    const today = nairobiDateStr()
    const weekAgo = nairobiDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const termStart = nairobiDateStr(new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 4) * 4, 1))
    const activeTerm = Math.floor(new Date().getMonth() / 4) + 1
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()

    const [lpRes, assRes, attRes, slotRes, resRes, strandPerfRes, strandNameRes, allStrandsRes, progressRes] = await Promise.all([
      supabase.from('lesson_plans').select('id, status, created_at').eq('subject_id', subjectId).eq('teacher_id', currentId).gte('created_at', termStart),
      supabase.from('cbc_assessments').select('id, created_at').eq('subject_id', subjectId).eq('teacher_id', currentId).gte('created_at', termStart),
      supabase.from('cbc_assessments').select('strand_id, performance').eq('subject_id', subjectId).eq('teacher_id', currentId).gte('created_at', termStart),
      supabase.from('strands').select('id, name').eq('subject_id', subjectId),
      schoolId ? supabase.from('strands').select('id').eq('subject_id', subjectId).eq('school_id', schoolId) : Promise.resolve({ data: [] }),
      schoolId ? supabase.from('strand_progress').select('strand_id, status').eq('teacher_id', currentId).eq('subject_id', subjectId).eq('school_id', schoolId).eq('term', activeTerm) : Promise.resolve({ data: [] }),
      supabase.from('attendance').select('id, date').eq('teacher_id', currentId).eq('subject_id', subjectId).gte('date', weekAgo),
      supabase.from('timetable_slots').select('id, start_time, end_time, day_of_week, subject_id, class_id, subjects(name), classes(name, stream)').eq('subject_id', subjectId).eq('teacher_id', currentId),
      Promise.resolve({ data: [] }), // resources table not yet created
    ])

    const lCount = lpRes.data?.length ?? 0
    const aCount = assRes.data?.length ?? 0
    const atCount = attRes.data?.length ?? 0
    const rCount = resRes.data?.length ?? 0

    setLessonCount(lCount)
    setAssessCount(aCount)
    setAttCount(atCount)
    setResourceCount(rCount)

    const PERF_SCORE: Record<string, number> = {
      exceeds_expectation: 4,
      meets_expectation: 3,
      approaches_expectation: 2,
      below_expectation: 1,
    }
    const strandNames = new Map<string, string>(
      (strandNameRes.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name])
    )
    const strandTotals = new Map<string, { sum: number; count: number }>()
    for (const row of (strandPerfRes.data ?? []) as { strand_id: string | null; performance: string }[]) {
      if (!row.strand_id) continue
      const score = PERF_SCORE[row.performance] ?? 0
      if (score === 0) continue
      const prev = strandTotals.get(row.strand_id) ?? { sum: 0, count: 0 }
      strandTotals.set(row.strand_id, { sum: prev.sum + score, count: prev.count + 1 })
    }
    let weakest: { name: string; pct: number } | null = null
    Array.from(strandTotals.entries()).forEach(([strandId, { sum, count }]) => {
      const avgPct = Math.round((sum / (count * 4)) * 100)
      if (weakest === null || avgPct < weakest.pct) {
        weakest = { name: strandNames.get(strandId) ?? 'Unnamed strand', pct: avgPct }
      }
    })
    setWeakStrand(weakest)

    const totalStrands = (allStrandsRes.data ?? []).length
    if (totalStrands > 0) {
      const doneStrandIds = new Set(
        ((progressRes.data ?? []) as { strand_id: string; status: string }[])
          .filter(p => p.status === 'done')
          .map(p => p.strand_id)
      )
      setCurriculumPct(Math.round((doneStrandIds.size / totalStrands) * 100))
    } else {
      setCurriculumPct(null)
    }

    const score = (lCount * 15) + (aCount * 8) + (atCount * 5) + (rCount * 20)
    setImpactScore(score)

    const activityDates = new Set([
      ...(lpRes.data ?? []).map((r: {created_at: string}) => r.created_at.split('T')[0]),
      ...(assRes.data ?? []).map((r: {created_at: string}) => r.created_at.split('T')[0]),
      ...(attRes.data ?? []).map((r: {date: string}) => r.date),
    ])
    let s = 0
    const check = new Date()
    while (true) {
      const d = nairobiDateStr(check)
      if (activityDates.has(d)) { s++; check.setDate(check.getDate() - 1) }
      else break
    }
    setStreak(s)

    const todayDow = now.getDay()
    const todaySlots = (slotRes.data ?? []).filter((sl: {day_of_week?: number; start_time: string; end_time: string}) => {
      const slDow = (sl as {day_of_week?: number}).day_of_week
      if (slDow !== undefined && slDow !== todayDow) return false
      const [h, m] = sl.start_time.split(':').map(Number)
      return (h * 60 + m) > nowMin
    })
    if (todaySlots.length > 0) {
      const next = todaySlots[0] as {start_time: string; subjects?: {name: string}; classes?: {name: string; stream: string}}
      setNextSlot({
        subject: (next.subjects as {name: string})?.name ?? '',
        class: (next.classes as {name: string; stream: string})?.name + (((next.classes as {name: string; stream: string})?.stream) ? ' · ' + (next.classes as {name: string; stream: string}).stream : ''),
        start: next.start_time,
      })
    } else {
      setNextSlot(null)
    }

    const subjectName = activeSubject?.name ?? 'your subject'
    if (lCount > 0 || aCount > 0 || atCount > 0 || rCount > 0) {
      try {
        const insightRes = await fetch('/api/subject-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectName, lCount, aCount, atCount, rCount }),
        })
        if (insightRes.ok) {
          const { fact, suggestion } = await insightRes.json()
          setDailyFact(fact ?? null)
          setAiSuggestion(suggestion ?? null)
        } else {
          setDailyFact(null)
          setAiSuggestion(null)
        }
      } catch {
        setDailyFact(null)
        setAiSuggestion(null)
      }
    } else {
      setDailyFact(null)
      setAiSuggestion(null)
    }

    setSuggLoading(false)
  }

  async function addSubject() {
    if (addingSubject) return
    if (!newSubjectName.trim()) { setAddSubjectError('Enter a subject name'); return }
    if (!currentId) { setAddSubjectError('Not signed in'); return }
    setAddingSubject(true)
    setAddSubjectError(null)

    const selectedClass = allClasses.find(c => c.id === newSubjectClassId) ?? null
    const classSchoolId = selectedClass?.school_id ?? schoolId ?? null

    let dedupQuery = supabase.from('subjects').select('id').eq('name', newSubjectName.trim())
    if (classSchoolId) {
      dedupQuery = dedupQuery.eq('school_id', classSchoolId) as typeof dedupQuery
    } else {
      dedupQuery = dedupQuery.is('school_id', null) as typeof dedupQuery
    }
    const { data: existing } = await dedupQuery.maybeSingle()

    let subjectId: string
    if (existing) {
      subjectId = existing.id
    } else {
      const insertPayload: { name: string; school_id?: string } = { name: newSubjectName.trim() }
      if (classSchoolId) insertPayload.school_id = classSchoolId
      const { data: newSub, error: subErr } = await supabase
        .from('subjects')
        .insert(insertPayload)
        .select('id')
        .single()
      if (subErr || !newSub) { setAddSubjectError('Failed to create subject'); setAddingSubject(false); return }
      subjectId = newSub.id
    }

    const tcRow: Record<string, unknown> = {
      teacher_id:       currentId,
      subject_id:       subjectId,
      school_id:        classSchoolId,
      is_class_teacher: false,
    }
    if (newSubjectClassId) tcRow.class_id = newSubjectClassId
    const { error: tcErr } = await supabase.from('teacher_classes').insert(tcRow)
    if (tcErr) { console.error('teacher_classes insert error:', tcErr); setAddSubjectError('Failed to link subject: ' + (tcErr.message ?? tcErr.code ?? 'unknown')); setAddingSubject(false); return }

    const newEntry = { id: subjectId, name: newSubjectName.trim() }
    setSubjects(prev => {
      const next = [...prev, newEntry]
      const newIdx = next.length - 1
      setTimeout(() => { setActiveIdx(newIdx); loadGrowthData(subjectId) }, 100)
      return next
    })
    closeAddSubject()
  }

  const activeSubject = subjects[activeIdx] ?? null

  const readiness: { label: string; bg: string; color: string } = (() => {
    if (lessonCount > 0 && assessCount > 0) return { label: 'Ready',     bg: '#d1fae5', color: '#065f46' }
    if (lessonCount > 0 || assessCount > 0) return { label: 'Partial',   bg: '#fef3c7', color: '#92400e' }
    return                                          { label: 'Not Ready', bg: '#fee2e2', color: '#991b1b' }
  })()

  // Task 2B — expanded SUBJECT_ACTIONS (7 items, 3-col grid)
  const SUBJECT_ACTIONS = [
    { id: 'attendance', label: 'Attendance',   icon: '✅', bg: '#065f46', route: '/teacher/attendance' },
    { id: 'lessonplan', label: 'Lesson Plans', icon: '📖', bg: '#6d28d9', route: '/teacher/lessonplan' },
    { id: 'assessment', label: 'Assessment',   icon: '📊', bg: '#92400e', route: '/teacher/assessment' },
    { id: 'scheme',     label: 'Scheme',       icon: '📋', bg: '#075985', route: '/teacher/scheme'     },
    { id: 'resources',  label: 'Resources',    icon: '🌍', bg: '#0f766e', route: '/teacher/resources'  },
    { id: 'tpad',       label: 'TPAD',         icon: '🏅', bg: '#1e1b4b', route: '/teacher/tpad'       },
    { id: 'timetable',  label: 'Timetable',    icon: '🗓️', bg: '#374151', route: '/teacher/timetable'  },
  ]

  // Task 1 — derived values for Subject Intelligence card
  const termTag = `Term ${Math.floor(new Date().getMonth() / 4) + 1}`
  const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0)
  const perfClasses = classes.filter(c => c.perfPct !== null)
  const avgPerfPct = perfClasses.length > 0
    ? Math.round(perfClasses.reduce((sum, c) => sum + (c.perfPct ?? 0), 0) / perfClasses.length)
    : null

  function barColor(pct: number) {
    return pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 60, background: C.surface, minHeight: '100%' }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* ── HERO ── */}
      <div style={{
        background: 'linear-gradient(135deg, #075985 0%, #0ea5e9 80%, #10b981 150%)',
        padding: '14px 16px 18px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.4, textTransform: 'uppercase' }}>SubjectHub</div>
          <button onClick={() => router.push('/teacher/settings')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}>🔔</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <HeroSkeleton />
            <div style={{ marginTop: 4 }}><HeroSkeleton /></div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(8px)',
                border: '2px solid rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, flexShrink: 0,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}>🔬</div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                  {activeSubject ? activeSubject.name : 'No Subjects'}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {activeSubject && !suggLoading && (
                    <button
                      onClick={() => {
                        const missing: string[] = []
                        if (lessonCount === 0) missing.push('Add a lesson plan')
                        if (assessCount === 0) missing.push('Record an assessment')
                        if (missing.length === 0) alert('You are fully ready! Keep it up.')
                        else alert("To become Ready:\n• " + missing.join('\n• '))
                      }}
                      style={{
                        fontSize: 10, fontWeight: 800, borderRadius: 20,
                        padding: '3px 9px', background: readiness.bg, color: readiness.color,
                        letterSpacing: 0.5, whiteSpace: 'nowrap',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      {readiness.label} {readiness.label !== 'Ready' ? 'ℹ️' : '✅'}
                    </button>
                  )}
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                    {subjects.length > 1 ? `${subjects.length} subjects` : 'Subject Teacher'}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'My Classes',  value: classes.length,   route: '/teacher/classhub' },
                ...(schoolId ? [{ label: 'Teammates', value: teammates.length, route: '/teacher/profile' }] : []),
                { label: 'Subjects',    value: subjects.length,  route: null },
              ].map(s => (
                <button
                  key={s.label}
                  onClick={() => s.route ? router.push(s.route) : null}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.12)',
                    borderRadius: 16, padding: '10px 8px', textAlign: 'center',
                    border: 'none', cursor: s.route ? 'pointer' : 'default',
                    backdropFilter: 'blur(4px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    fontFamily: 'inherit',
                  }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── SUBJECT TABS ── */}
      {!loading && subjects.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px 0' }}>
          <button
            onClick={openAddSubject}
            style={{ padding: '7px 16px', borderRadius: 10, background: C.accent, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Add Subject
          </button>
        </div>
      )}

      {!loading && subjects.length > 0 && (
        <div style={{ padding: '14px 16px 0', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {subjects.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
              {removeConfirmId === s.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fee2e2', borderRadius: 20, padding: '4px 10px' }}>
                  <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 700 }}>Unlink {s.name} from all classes?</span>
                  <button onClick={() => { removeSubject(s.id); setRemoveConfirmId(null) }}
                    style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 12, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>Yes</button>
                  <button onClick={() => setRemoveConfirmId(null)}
                    style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', background: '#fff', border: 'none', borderRadius: 12, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>No</button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveIdx(i)}
                  style={{
                    padding: '7px 12px 7px 16px', borderRadius: 20, border: 'none',
                    cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                    background: i === activeIdx ? '#075985' : '#fff',
                    color:      i === activeIdx ? '#fff'    : C.textMuted,
                    boxShadow: i === activeIdx ? '0 2px 8px rgba(7,89,133,0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {s.name}
                  <span
                    onClick={e => { e.stopPropagation(); setRemoveConfirmId(s.id) }}
                    title="Remove subject"
                    style={{
                      fontSize: 14, lineHeight: 1, color: i === activeIdx ? 'rgba(255,255,255,0.6)' : '#9ca3af',
                      cursor: 'pointer', padding: '0 2px',
                    }}
                  >×</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TASK 1: SUBJECT INTELLIGENCE CARD ── */}
      {!loading && activeSubject && (
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase' }}>Subject Intelligence</span>
            <span style={{ fontSize: 10, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', borderRadius: 20, padding: '3px 9px' }}>{termTag}</span>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.textPrimary }}>{classes.length}</div>
              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>Classes</div>
            </div>
            <div style={{ width: 1, background: C.border }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.textPrimary }}>{totalStudents}</div>
              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>Students</div>
            </div>
          </div>

          {curriculumPct !== null && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>Curriculum</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: barColor(curriculumPct) }}>{curriculumPct}%</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 6, background: C.surface, overflow: 'hidden' }}>
                <div style={{ width: `${curriculumPct}%`, height: '100%', borderRadius: 6, background: barColor(curriculumPct), transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}

          {avgPerfPct !== null ? (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>Avg Perf</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: barColor(avgPerfPct) }}>{avgPerfPct}%</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 6, background: C.surface, overflow: 'hidden' }}>
                <div style={{ width: `${avgPerfPct}%`, height: '100%', borderRadius: 6, background: barColor(avgPerfPct), transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10 }}>Avg Perf — No data yet</div>
          )}

          {weakStrand && (
            <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 700, marginBottom: 6 }}>
              ⚠️ Weak Area: {weakStrand.name} ({weakStrand.pct}%)
            </div>
          )}
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={{ fontSize: 11, color: C.textMuted }}>📖 {lessonCount} lesson{lessonCount !== 1 ? 's' : ''} this term</span>
            <span style={{ fontSize: 11, color: C.textMuted }}>📊 {assessCount} assessment{assessCount !== 1 ? 's' : ''} this term</span>
          </div>
        </div>
      )}

      {/* ── QUICK ACTIONS ── */}
      {!loading && activeSubject && (
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', margin: '0 0 12px' }}>Subject Tools</p>
          {/* Task 2B — 3-col grid, 7 actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {SUBJECT_ACTIONS.map(a => (
              <button
                key={a.id}
                onClick={() => {
                  if (a.id === 'timetable' || a.id === 'tpad') { router.push(a.route); return }
                  if (a.id === 'resources') { router.push(a.route); return }
                  if (classes.length === 0) { router.push(a.route + '?subjectId=' + activeSubject.id); return }
                  if (classes.length === 1) { router.push(a.route + '?subjectId=' + activeSubject.id + '&classId=' + classes[0].id); return }
                  setPickerAction(a)
                }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '14px 4px', borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: a.bg, fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 22 }}>{a.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: 1.3 }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── GROWTH ENGINE ── */}
      {!loading && activeSubject && (
        <div style={{ margin: '14px 16px 0' }}>

          {/* Impact Score + Streak */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, background: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)', borderRadius: 16, padding: '12px', boxShadow: '0 4px 12px rgba(67,56,202,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{impactScore}</div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, textTransform: 'uppercase' }}>Impact</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>pts this term</div>
              </div>
            </div>
            <div style={{ flex: 1, background: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)', borderRadius: 16, padding: '12px', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{streak}🔥</div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, textTransform: 'uppercase' }}>Streak</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{streak === 0 ? 'Start today' : 'days active'}</div>
              </div>
            </div>
          </div>

          {/* Curriculum Completion */}
          {curriculumPct !== null && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Curriculum Completion</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: curriculumPct >= 70 ? '#065f46' : curriculumPct >= 40 ? '#92400e' : '#991b1b' }}>{curriculumPct}%</div>
              </div>
              <div style={{ width: '100%', height: 8, borderRadius: 8, background: C.surface, overflow: 'hidden' }}>
                <div style={{
                  width: `${curriculumPct}%`, height: '100%', borderRadius: 8,
                  background: curriculumPct >= 70 ? '#10b981' : curriculumPct >= 40 ? '#f59e0b' : '#ef4444',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          )}

          {/* Weakest Strand */}
          {weakStrand && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24 }}>⚠️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Weakest Strand This Term</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#991b1b', marginTop: 2 }}>{weakStrand.name}</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#991b1b' }}>{weakStrand.pct}%</div>
            </div>
          )}

          {/* Cumulative Stats */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>Your Growth This Term</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'Lessons Planned', value: lessonCount, icon: '📖', color: '#6d28d9' },
                { label: 'Students Assessed', value: assessCount, icon: '📊', color: '#075985' },
                { label: 'Resources Published', value: resourceCount, icon: '🌍', color: '#065f46' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12, background: C.surface }}>
                  <div style={{ fontSize: 20 }}>{s.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1.1, marginTop: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, marginTop: 3, lineHeight: 1.3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Task 3 — TPAD Evidence Card */}
          {(lessonCount > 0 || assessCount > 0 || attCount > 0) && (
            <div style={{
              background: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%)',
              borderRadius: 20, padding: '16px', marginBottom: 10,
              boxShadow: '0 4px 16px rgba(30,27,75,0.35)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>🏅</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>TPAD EVIDENCE READY</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>Your activity this term qualifies as TSC evidence.</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: '12px 0' }}>
                {lessonCount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{lessonCount} lesson plan{lessonCount !== 1 ? 's' : ''}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.15)', color: '#c7d2fe', borderRadius: 8, padding: '2px 8px' }}>Standard 1</span>
                  </div>
                )}
                {attCount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{attCount} attendance log{attCount !== 1 ? 's' : ''}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.15)', color: '#c7d2fe', borderRadius: 8, padding: '2px 8px' }}>Standard 2</span>
                  </div>
                )}
                {assessCount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{assessCount} assessment{assessCount !== 1 ? 's' : ''}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.15)', color: '#c7d2fe', borderRadius: 8, padding: '2px 8px' }}>Standard 4</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => router.push('/teacher/tpad')}
                style={{
                  width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                  background: '#fff', color: '#1e1b4b', fontSize: 13, fontWeight: 800,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                Generate TPAD Evidence
              </button>
            </div>
          )}

          {/* Next Class */}
          {nextSlot && (
            <div style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #075985 100%)', borderRadius: 20, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 12px rgba(14,165,233,0.25)' }}>
              <div style={{ fontSize: 28 }}>⏰</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.2, textTransform: 'uppercase' }}>Next Class Today</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 2 }}>{nextSlot.class} · {nextSlot.start.slice(0,5)}</div>
              </div>
            </div>
          )}

          {/* Daily Fact */}
          {suggLoading && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '16px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ height: 12, borderRadius: 6, background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', marginBottom: 8 }} />
              <div style={{ height: 12, borderRadius: 6, width: '70%', background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
            </div>
          )}

          {dailyFact && !suggLoading && (
            <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)', borderRadius: 20, padding: '16px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#92400e', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>💡 Did You Know?</div>
              <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6, fontWeight: 500 }}>{dailyFact}</div>
            </div>
          )}

          {aiSuggestion && !suggLoading && (
            <div style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)', borderRadius: 20, padding: '16px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '4px solid #7c3aed' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#5b21b6', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>🚀 Your Next Move</div>
              <div style={{ fontSize: 13, color: '#4c1d95', lineHeight: 1.6, fontWeight: 500 }}>{aiSuggestion}</div>
            </div>
          )}

        </div>
      )}

      {/* ── MY CLASSES FOR THIS SUBJECT ── */}
      {!loading && activeSubject && (
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', margin: 0 }}>My Classes</p>
            <p style={{ fontSize: 12, color: C.textMuted, margin: '3px 0 0' }}>Classes you teach {activeSubject.name} in</p>
          </div>

          {classLoading && (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2].map(i => <Skeleton key={i} h={64} />)}
            </div>
          )}

          {!classLoading && classes.length === 0 && (
            <div style={{ padding: '28px 16px', textAlign: 'center' }}>
              <span style={{ fontSize: 28 }}>📚</span>
              <p style={{ fontSize: 13, color: C.textMuted, marginTop: 8, marginBottom: 12 }}>No classes linked to this subject yet.</p>
              <button
                onClick={openAddSubject}
                style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                + Link a Class
              </button>
            </div>
          )}

          {!classLoading && classes.map((cls, i) => (
            <div
              key={cls.id}
              onClick={() => router.push('/teacher/classhub/' + cls.id + '?mode=subject&subjectId=' + activeSubject.id)}
              style={{
                width: '100%', padding: '14px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderTop: i === 0 ? 'none' : '1px solid #f3f4f6',
                background: 'transparent',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: PALETTES[i % PALETTES.length].bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏫</div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, margin: 0 }}>
                    {cls.name}{cls.stream ? ' · ' + cls.stream : ''}
                  </p>
                  <p style={{ fontSize: 12, color: C.textMuted, margin: '2px 0 0' }}>{cls.studentCount} {cls.studentCount === 1 ? 'student' : 'students'}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Task 2A — attendance rate pill */}
                {attRateByClass[cls.id] !== undefined && (
                  <div style={{
                    fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 20,
                    background: '#dbeafe', color: '#1d4ed8',
                  }}>
                    {attRateByClass[cls.id]}% att
                  </div>
                )}
                {cls.perfPct !== null && (
                  <div style={{
                    fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 20,
                    background: cls.perfPct >= 70 ? '#d1fae5' : cls.perfPct >= 40 ? '#fef3c7' : '#fee2e2',
                    color:      cls.perfPct >= 70 ? '#065f46' : cls.perfPct >= 40 ? '#92400e' : '#991b1b',
                  }}>
                    {cls.perfPct}%
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push('/teacher/assessment?classId=' + cls.id + '&subjectId=' + activeSubject.id)
                  }}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: 'none',
                    background: '#92400e', color: '#fff',
                    fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                >
                  Assess
                </button>
                <span style={{ fontSize: 18, color: '#9ca3af' }}>›</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── DEPARTMENT TEAM ── */}
      {!loading && activeSubject && (
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', margin: 0 }}>Department Team</p>
            <p style={{ fontSize: 12, color: C.textMuted, margin: '3px 0 0' }}>Teachers in {activeSubject.name}</p>
          </div>

          {teamLoading && (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2].map(i => <Skeleton key={i} h={52} />)}
            </div>
          )}

          {!teamLoading && teammates.length === 0 && (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🌱</div>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
                {schoolId ? 'You are the sole guardian of this subject.' : 'You own this subject solo.'}
              </p>
              <p style={{ fontSize: 12, color: C.textMuted, margin: '4px 0 0', lineHeight: 1.5 }}>
                {schoolId ? 'Invite a colleague to share the load and build a department.' : 'Join a school to collaborate with fellow teachers.'}
              </p>
            </div>
          )}

          {!teamLoading && teammates.map((t, idx) => (
            <div
              key={t.profileId}
              style={{
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                borderTop: idx === 0 ? 'none' : '1px solid #f3f4f6',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: PALETTES[idx % PALETTES.length].bg,
                color: PALETTES[idx % PALETTES.length].color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
              }}>
                {t.initials}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
                  {t.fullName}{t.isYou ? ' (You)' : ''}
                </p>
                <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>{activeSubject.name}</p>
              </div>
              {t.isYou && (
                <div style={{ background: C.accentLight, borderRadius: 20, padding: '3px 10px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#065f46' }}>You</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── EMPTY STATE (no subjects) ── */}
      {!loading && subjects.length === 0 && (
        <div style={{ padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 40 }}>🔬</span>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, margin: 0, textAlign: 'center' }}>No subjects assigned yet</p>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0, textAlign: 'center' }}>Claim your subject and join thousands of professionals growing their impact on VibeSchool.</p>
          <button
            onClick={openAddSubject}
            style={{ marginTop: 8, padding: '14px 32px', borderRadius: 14, background: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(67,56,202,0.35)' }}>
            + Claim Your Subject
          </button>
        </div>
      )}

      {showAddSubject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 64 }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, maxHeight: 'calc(90vh - 64px)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <div style={{ overflowY: 'auto', padding: '24px 24px 8px', flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginBottom: 16 }}>Add Subject</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>SUBJECT NAME</div>
              <select
                value={useOtherSubject ? 'Other' : newSubjectName}
                onChange={e => {
                  const v = e.target.value
                  if (v === 'Other') { setUseOtherSubject(true); setNewSubjectName('') }
                  else { setUseOtherSubject(false); setNewSubjectName(v) }
                }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', marginBottom: useOtherSubject ? 10 : 14, background: '#fff' }}
              >
                <option value="">Select a subject…</option>
                {CBC_SUBJECTS.filter(s => !subjects.map(x => x.name.toLowerCase()).includes(s.toLowerCase())).map(s => <option key={s} value={s}>{s}</option>)}
                <option value="Other">Other (type manually)</option>
              </select>
              {useOtherSubject && (
                <input
                  value={newSubjectName}
                  onChange={e => setNewSubjectName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addSubject() }}
                  placeholder="Type subject name"
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', marginBottom: 14, outline: 'none' }}
                />
              )}
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>
                CLASS <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span>
              </div>
              {allClasses.length === 0 ? (
                <div style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, color: C.textMuted, background: C.surface, marginBottom: 6 }}>
                  No classes yet — <a href="/teacher/onboarding/class" style={{ color: C.accent, fontWeight: 700, textDecoration: 'none' }}>create a class</a> or skip and add subject only.
                </div>
              ) : (
                <select
                  value={newSubjectClassId}
                  onChange={e => setNewSubjectClassId(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', background: '#fff' }}>
                  <option value="">Select a class…</option>
                  {allClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.stream ? ' ' + c.stream : ''}</option>
                  ))}
                </select>
              )}
              <p style={{ fontSize: 11, color: C.textMuted, margin: '4px 0 8px', lineHeight: 1.5 }}>
                Linking a class is optional — you can add the same subject to more classes anytime.
              </p>
              {addSubjectError && <div style={{ fontSize: 13, color: C.error, marginBottom: 8, marginTop: 4 }}>{addSubjectError}</div>}
            </div>
            <div style={{ padding: '12px 24px 32px', paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, background: '#fff' }}>
              <button
                onClick={closeAddSubject}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: C.textMuted }}>
                Cancel
              </button>
              <button
                onClick={addSubject}
                disabled={addingSubject}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: C.accent, fontSize: 14, fontWeight: 700, cursor: addingSubject ? 'not-allowed' : 'pointer', fontFamily: 'inherit', color: '#fff', opacity: addingSubject ? 0.7 : 1 }}>
                {addingSubject ? 'Saving…' : 'Add Subject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ margin: '14px 16px', padding: '12px 14px', borderRadius: 12, background: '#fef2f2', color: C.error, fontSize: 13 }}>
          {error}
        </div>
      )}

      {pickerAction && activeSubject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setPickerAction(null)}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 480 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginBottom: 4 }}>
              {pickerAction.icon} {pickerAction.label}
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>Choose a class to open</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => {
                    router.push(pickerAction.route + '?subjectId=' + activeSubject.id + '&classId=' + cls.id)
                    setPickerAction(null)
                  }}
                  style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, fontSize: 14, fontWeight: 700, color: C.textPrimary, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                >
                  {cls.name}{cls.stream ? ' · ' + cls.stream : ''}
                  <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, marginLeft: 8 }}>{cls.studentCount} students</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setPickerAction(null)}
              style={{ width: '100%', marginTop: 12, padding: '12px', borderRadius: 12, border: `1px solid ${C.border}`, background: '#fff', fontSize: 14, fontWeight: 600, color: C.textMuted, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
