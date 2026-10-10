"use client";
import { nairobiDateStr, nairobiDayOfWeek } from '@/lib/time'
import {
  getActiveTerm,
} from '@/lib/academicTerm'
import type {
  ActiveTerm,
} from '@/lib/academicTerm'
import { loadActiveTeacherTimetable, timetableSlotsForDay, type CanonicalTimetableSlot } from '@/lib/timetable/engine'
export const dynamic = "force-dynamic";
import { Card, C, Modal as SharedModal } from '@/components/teacher/ui'
import SubjectCompanion from '@/components/teacher/SubjectCompanion'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  loadSubjectClassLibrary,
} from '@/lib/content-engine/subjectClassLibrary'
import type {
  SubjectClassLibraryItem,
} from '@/lib/content-engine/subjectClassLibrary'
import { useRouter } from 'next/navigation'

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
  const [activeAcademicTerm, setActiveAcademicTerm] =
    useState<ActiveTerm | null>(null)
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
  const [allowedSubjectNames, setAllowedSubjectNames] = useState<string[]>([])
  const [addingSubject,     setAddingSubject]     = useState(false)
  const [addSubjectError,   setAddSubjectError]   = useState<string | null>(null)
  const [allClasses,        setAllClasses]        = useState<{id: string; name: string; stream: string | null; school_id: string | null}[]>([])
  const [streak,           setStreak]           = useState<number>(0)
  const [lessonCount,      setLessonCount]      = useState<number>(0)
  const [assessCount,      setAssessCount]      = useState<number>(0)
  const [attCount,         setAttCount]         = useState<number>(0)
  const [nextSlot,         setNextSlot]         = useState<{subject: string; class: string; start: string} | null>(null)
  const [aiSuggestion,     setAiSuggestion]     = useState<string | null>(null)
  const [dailyFact,        setDailyFact]        = useState<string | null>(null)
  const [resourceCount,    setResourceCount]    = useState<number>(0)
  const [subjectLibraryItems, setSubjectLibraryItems] =
    useState<SubjectClassLibraryItem[]>([])
  const [subjectLibraryLoading, setSubjectLibraryLoading] =
    useState(false)
  const [subjectLibraryError, setSubjectLibraryError] =
    useState<string | null>(null)
  const [suggLoading,      setSuggLoading]      = useState(false)
  const [weakStrand,       setWeakStrand]       = useState<{ name: string; pct: number } | null>(null)
  const [curriculumPct,    setCurriculumPct]    = useState<number | null>(null)
  // Task 2A — attendance rate per class for this subject this term
  const [attRateByClass,   setAttRateByClass]   = useState<Record<string, number>>({})
  const [outcomesByStrand, setOutcomesByStrand] = useState<{strand: string; count: number}[]>([])
  const [coveragePct,    setCoveragePct]    = useState<number | null>(null)
  const [assessedPct,    setAssessedPct]    = useState<number | null>(null)
  const [masteredPct,    setMasteredPct]    = useState<number | null>(null)

  useEffect(() => { init() }, [])

  async function init() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/?role=teacher'); return }
      setCurrentId(user.id)

      const { data: operatingContext, error: contextError } =
        await supabase.rpc('teacher_get_operating_context')
      if (contextError) throw contextError

      const sid = (operatingContext as { school_id?: string | null } | null)?.school_id ?? null
      setSchoolId(sid)

      if (!sid) {
        setActiveAcademicTerm(null)
        setSubjects([])
        setAllClasses([])
        setError('Connect or select your school before opening subjects.')
        return
      }

      try {
        setActiveAcademicTerm(await getActiveTerm(sid))
      } catch (termError) {
        console.error('[SubjectHub] active term load failed', termError)
        setActiveAcademicTerm(null)
      }

      const contextClasses = Array.isArray((operatingContext as { classes?: unknown[] } | null)?.classes)
        ? ((operatingContext as { classes: Array<{ class_id: string; class_name: string; stream: string | null; subject_id: string; subject_name: string }> }).classes)
        : []

      const subjectMap = new Map<string, string>()
      const classMap = new Map<string, { id: string; name: string; stream: string | null; school_id: string | null }>()
      for (const assignment of contextClasses) {
        if (assignment.subject_id && assignment.subject_name) subjectMap.set(assignment.subject_id, assignment.subject_name)
        if (assignment.class_id) classMap.set(assignment.class_id, {
          id: assignment.class_id,
          name: assignment.class_name,
          stream: assignment.stream ?? null,
          school_id: sid,
        })
      }
      const subjectIds = Array.from(subjectMap.keys())
      setAllClasses(Array.from(classMap.values()))
      setSubjects(Array.from(subjectMap, ([id, name]) => ({ id, name })).sort((x, y) => x.name.localeCompare(y.name)))

      if (subjectIds.length === 0) { setLoading(false); return }


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
  }, [
    subjects,
    activeIdx,
    schoolId,
    currentId,
    activeAcademicTerm,
  ])

  async function loadClassesForSubject(subjectId: string) {
    if (!subjectId || !currentId || !schoolId) {
      setClassLoading(false)
      return
    }
    setClassLoading(true)

    const { data: tcData } = await supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', currentId)
      .eq('school_id', schoolId)
      .eq('subject_id', subjectId)

    const classIds: string[] = (tcData ?? [])
      .map(row => row.class_id)
      .filter(
        (id): id is string =>
          typeof id === 'string' && id.length > 0
      )

    if (classIds.length === 0) { setClasses([]); setAttRateByClass({}); setClassLoading(false); return }

    const termStart =
      activeAcademicTerm?.start_date ??
      nairobiDateStr()

    const activeTermNumber =
      activeAcademicTerm?.term ?? null

    const activeAcademicYear =
      activeAcademicTerm?.academic_year ?? null

    const classAssessmentPromise =
      activeTermNumber && activeAcademicYear
        ? supabase
            .from('cbc_assessments')
            .select('class_id, performance')
            .eq('teacher_id', currentId)
            .eq('school_id', schoolId)
            .eq('subject_id', subjectId)
            .eq('term', activeTermNumber)
            .eq(
              'academic_year',
              activeAcademicYear,
            )
            .in('class_id', classIds)
        : Promise.resolve({
            data: [] as {
              class_id: string
              performance: string
            }[],
            error: null,
          })

    const [classRes, studentRes, perfRes, attRes] = await Promise.all([
      supabase
        .from('classes')
        .select('id, name, stream')
        .eq('school_id', schoolId)
        .in('id', classIds),
      supabase
        .from('student_classes')
        .select('class_id,student_id')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .in('class_id', classIds),
      classAssessmentPromise,
      supabase
        .from('attendance')
        .select(
          'class_id,student_id,status,timetable_slot_id,timetable_slots!inner(subject_id)'
        )
        .eq('teacher_id', currentId)
        .eq('school_id', schoolId)
        .in('class_id', classIds)
        .gte('date', termStart)
        .eq('timetable_slots.subject_id', subjectId),
    ])

    const learnersByClass = new Map<string, Set<string>>()
    for (const enrollment of studentRes.data ?? []) {
      if (!enrollment.class_id || !enrollment.student_id) continue
      const learners = learnersByClass.get(enrollment.class_id) ?? new Set<string>()
      learners.add(enrollment.student_id)
      learnersByClass.set(enrollment.class_id, learners)
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

    const mapped: ClassForSubject[] =
      (classRes.data ?? []).map(classRow => {
        const perf = classPerfTotals[classRow.id]

        return {
          id:           classRow.id,
          name:         classRow.name,
          stream:       classRow.stream ?? '',
          studentCount: learnersByClass.get(classRow.id)?.size ?? 0,
          perfPct:      perf
            ? Math.round(
                (perf.sum / (perf.count * 4)) * 100
              )
            : null,
        }
      })

    setClasses(mapped)

    // Task 2A — compute per-class attendance rate
    const classTotals: Record<string, { present: number; total: number }> = {}
    for (const row of (attRes.data ?? []) as {
      class_id: string
      student_id: string
      status: string
      timetable_slot_id: string
    }[]) {
      if (!row.class_id || !row.timetable_slot_id) continue
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
    let cancelled = false
    async function loadAllowedSubjects() {
      const selectedClass = allClasses.find(item => item.id === newSubjectClassId)
      if (!schoolId || !selectedClass) {
        setAllowedSubjectNames([])
        setNewSubjectName('')
        return
      }
      const { data, error } = await supabase.rpc('get_allowed_teaching_subjects', {
        p_school_id: schoolId,
        p_grade: selectedClass.name,
      })
      if (cancelled) return
      if (error) {
        console.error('[SubjectHub] allowed subjects load failed', error)
        setAllowedSubjectNames([])
        return
      }
      const names = (data as { subjects?: unknown[] } | null)?.subjects
      setAllowedSubjectNames(Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string') : [])
      setNewSubjectName('')
    }
    void loadAllowedSubjects()
    return () => { cancelled = true }
  }, [newSubjectClassId, schoolId, allClasses])


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

  async function loadGrowthData(subjectId: string) {
    if (!subjectId || !currentId || !schoolId) return
    setSuggLoading(true)

    const today = nairobiDateStr()
    const weekAgo = nairobiDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const termStart =
      activeAcademicTerm?.start_date ??
      nairobiDateStr()
    const activeTermNumber =
      activeAcademicTerm?.term ?? null

    const activeAcademicYear =
      activeAcademicTerm?.academic_year ?? null

    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()

    const [subNameRes2, assignmentRes] = await Promise.all([
      supabase
        .from('subjects')
        .select('name')
        .eq('id', subjectId)
        .single(),
      supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('teacher_id', currentId)
        .eq('school_id', schoolId)
        .eq('subject_id', subjectId),
    ])

    const subjectName2 =
      subNameRes2.data?.name ?? ''

    const assignedClassIds = Array.from(
      new Set(
        (assignmentRes.data ?? [])
          .map(row => row.class_id)
          .filter(
            (id): id is string =>
              typeof id === 'string' &&
              id.length > 0,
          ),
      ),
    )

    const assignedClassRes =
      assignedClassIds.length > 0
        ? await supabase
            .from('classes')
            .select('id, name')
            .eq('school_id', schoolId)
            .in('id', assignedClassIds)
        : {
            data: [] as {
              id: string
              name: string
            }[],
            error: null,
          }

    const assignedClassesForSubject =
      (assignedClassRes.data ?? []) as {
        id: string
        name: string
      }[]

    const assignedGradeNames = Array.from(
      new Set(
        assignedClassesForSubject
          .map(classRow => classRow.name)
          .filter(Boolean),
      ),
    )

    setSubjectLibraryLoading(true)
    setSubjectLibraryError(null)

    try {
      setSubjectLibraryItems(
        await loadSubjectClassLibrary({
          teacherId: currentId,
          schoolId,
          subjectId,
          classIds: assignedClassIds,
        }),
      )
    } catch (libraryError) {
      console.error(
        '[SubjectHub] class library load failed',
        libraryError,
      )
      setSubjectLibraryItems([])
      setSubjectLibraryError(
        'Learning resources could not be loaded.',
      )
    } finally {
      setSubjectLibraryLoading(false)
    }

    // Fix 19: subjecthub has no selected-date context — active means today
    // in Africa/Nairobi (lib/time.ts is the single source of truth for this).
    const slotActiveDate = nairobiDateStr()

    // TBL-007E: timetable reads go through the canonical engine only
    // (teacher isolation, school isolation, effective-date filtering,
    // canonical ordering). The engine requires a school identity; without
    // one there is no canonical timetable, so slot-driven UI stays empty.
    const canonicalSlotsPromise: Promise<CanonicalTimetableSlot[]> = schoolId
      ? loadActiveTeacherTimetable({
          teacherId: currentId,
          schoolId,
          activeOn: slotActiveDate,
        }).catch((err) => {
          console.error('SubjectHub canonical timetable load failed:', err)
          return []
        })
      : Promise.resolve([])

    const [lpRes, assRes, strandPerfRes, strandNameRes, allCurriculumRes, progressRes, attRes, canonicalSlots, resRes] = await Promise.all([
      supabase.from('lesson_plans').select('id, status, created_at').eq('subject_id', subjectId).eq('teacher_id', currentId).gte('created_at', termStart),
      activeTermNumber && activeAcademicYear
        ? supabase
            .from('cbc_assessments')
            .select('id, created_at')
            .eq('teacher_id', currentId)
            .eq('school_id', schoolId)
            .eq('subject_id', subjectId)
            .eq('term', activeTermNumber)
            .eq(
              'academic_year',
              activeAcademicYear,
            )
        : Promise.resolve({
            data: [] as {
              id: string
              created_at: string
            }[],
            error: null,
          }),
      activeTermNumber && activeAcademicYear
        ? supabase
            .from('cbc_assessments')
            .select('strand_id, performance')
            .eq('teacher_id', currentId)
            .eq('school_id', schoolId)
            .eq('subject_id', subjectId)
            .eq('term', activeTermNumber)
            .eq(
              'academic_year',
              activeAcademicYear,
            )
        : Promise.resolve({
            data: [] as {
              strand_id: string | null
              performance: string
            }[],
            error: null,
          }),
      assignedGradeNames.length > 0 && subjectName2
        ? supabase
            .from('curriculum')
            .select('id, grade, strand')
            .in('grade', assignedGradeNames)
            .eq('subject', subjectName2)
        : Promise.resolve({
            data: [] as {
              id: string
              grade: string
              strand: string
            }[],
            error: null,
          }),
      assignedGradeNames.length > 0 && subjectName2
        ? supabase
            .from('curriculum')
            .select('id, grade, strand')
            .in('grade', assignedGradeNames)
            .eq('subject', subjectName2)
        : Promise.resolve({
            data: [] as {
              id: string
              grade: string
              strand: string
            }[],
            error: null,
          }),
      schoolId && activeTermNumber
        ? supabase
            .from('scheme_of_work')
            .select('class_id, curriculum_id, status')
            .eq('teacher_id', currentId)
            .eq('subject_id', subjectId)
            .eq('school_id', schoolId)
            .eq('term', activeTermNumber)
        : Promise.resolve({ data: [] }),
      supabase
        .from('attendance')
        .select('id, date, timetable_slot_id')
        .eq('teacher_id', currentId)
        .gte('date', weekAgo),
      canonicalSlotsPromise,
      Promise.resolve({
        data: subjectLibraryItems,
      }),
    ])

    const lCount = lpRes.data?.length ?? 0
    const aCount = assRes.data?.length ?? 0

    const subjectSlotIds = new Set(
      canonicalSlots
        .filter(slot => slot.subject_id === subjectId)
        .map(slot => slot.id)
    )

    const atCount = (attRes.data ?? []).filter(row =>
      row.timetable_slot_id
        ? subjectSlotIds.has(row.timetable_slot_id)
        : false
    ).length

    const rCount = subjectLibraryItems.length

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
      (strandNameRes.data ?? []).map((s: { id: string; strand: string }) => [s.id, s.strand])
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

    const curriculumRows =
      (allCurriculumRes.data ?? []) as {
        id: string
        grade: string
        strand: string
      }[]

    const curriculumIdsByGrade =
      new Map<string, Set<string>>()

    for (const row of curriculumRows) {
      const ids =
        curriculumIdsByGrade.get(row.grade) ??
        new Set<string>()

      ids.add(row.id)
      curriculumIdsByGrade.set(row.grade, ids)
    }

    let expectedClassCurriculumCount = 0

    for (const classRow of assignedClassesForSubject) {
      expectedClassCurriculumCount +=
        curriculumIdsByGrade.get(classRow.name)?.size ?? 0
    }

    const completedClassCurriculumKeys =
      new Set(
        (
          (progressRes.data ?? []) as {
            class_id: string | null
            curriculum_id: string | null
            status: string | null
          }[]
        )
          .filter(row =>
            row.status === 'done' &&
            Boolean(row.class_id) &&
            Boolean(row.curriculum_id),
          )
          .map(row =>
            `${row.class_id}:${row.curriculum_id}`,
          ),
      )

    if (expectedClassCurriculumCount > 0) {
      setCurriculumPct(
        Math.round(
          (
            completedClassCurriculumKeys.size /
            expectedClassCurriculumCount
          ) * 100,
        ),
      )
    } else {
      setCurriculumPct(null)
    }

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

    // Timetable weekday convention: Monday=1 … Sunday=7, anchored to
    // Africa/Nairobi (lib/time.ts). Slots arrive in canonical order
    // (day_of_week, start_time, id), so the first match is the next slot.
    const todayDow = nairobiDayOfWeek(now)
    const subjectSlots = canonicalSlots.filter((sl) => sl.subject_id === subjectId)
    const todaySlots = timetableSlotsForDay(subjectSlots, todayDow).filter((sl) => {
      const [h, m] = sl.start_time.split(':').map(Number)
      return (h * 60 + m) > nowMin
    })
    if (todaySlots.length > 0) {
      const next = todaySlots[0]
      const nextClassRes = await supabase.from('classes').select('name, stream').eq('id', next.class_id).single()
      const nextClassLabel = nextClassRes.data
        ? nextClassRes.data.name + (nextClassRes.data.stream ? ' · ' + nextClassRes.data.stream : '')
        : ''
      setNextSlot({
        subject: subjectName2,
        class: nextClassLabel,
        start: next.start_time,
      })
    } else {
      setNextSlot(null)
    }

    const subjectName = subjectName2
    if (lCount > 0 || aCount > 0 || atCount > 0 || rCount > 0) {
      try {
        const insightRes = await fetch('/api/subject-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectName, subjectId, lCount, aCount, atCount, rCount, strands: outcomesByStrand.map(o => o.strand), weakStrand, avgPerfPct }),
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

    // Priority 3 — load learner_outcomes for this subject
    const { data: outcomeRows } = await supabase
      .from('learner_outcomes')
      .select('strand')
      .eq('subject_id', subjectId)
    if (outcomeRows && outcomeRows.length > 0) {
      const strandMap: Record<string, number> = {}
      for (const row of outcomeRows) {
        if (!row.strand) continue
        strandMap[row.strand] = (strandMap[row.strand] ?? 0) + 1
      }
      const sorted = Object.entries(strandMap)
        .map(([strand, count]) => ({ strand, count }))
        .sort((a, b) => b.count - a.count)
      setOutcomesByStrand(sorted)
    } else {
      setOutcomesByStrand([])
    }

    // Three numbers — Coverage / Assessed / Mastered
    const { data: masteryRows } = await supabase
      .from('learner_outcomes')
      .select('status')
      .eq('subject_id', subjectId)
    if (masteryRows && masteryRows.length > 0) {
      const total = masteryRows.length
      const covered  = masteryRows.filter(r => ['assessed','mastered'].includes(r.status ?? '')).length
      const assessed = masteryRows.filter(r => r.status === 'assessed').length
      const mastered = masteryRows.filter(r => r.status === 'mastered').length
      setCoveragePct(Math.round((covered  / total) * 100))
      setAssessedPct(Math.round((assessed / total) * 100))
      setMasteredPct(Math.round((mastered / total) * 100))
    } else {
      setCoveragePct(null)
      setAssessedPct(null)
      setMasteredPct(null)
    }

    setSuggLoading(false)
  }

  async function addSubject() {
    if (addingSubject) return
    if (!newSubjectName.trim()) { setAddSubjectError('Select a subject'); return }
    if (!currentId || !schoolId) { setAddSubjectError('Select your school first'); return }
    const selectedClass = allClasses.find(item => item.id === newSubjectClassId)
    if (!selectedClass) { setAddSubjectError('Select the class you teach'); return }

    setAddingSubject(true)
    setAddSubjectError(null)
    try {
      const { error: assignmentError } = await supabase.rpc('create_teacher_class_assignment', {
        p_school_id: schoolId,
        p_grade: selectedClass.name,
        p_stream: selectedClass.stream ?? '',
        p_subject: newSubjectName.trim(),
        p_is_class_teacher: false,
      })
      if (assignmentError) throw assignmentError
      closeAddSubject()
      await init()
    } catch (assignmentError) {
      console.error('[SubjectHub] canonical subject assignment failed', assignmentError)
      setAddSubjectError('That subject is not available for this class level.')
      setAddingSubject(false)
    }
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
  const termTag = activeAcademicTerm
    ? `Term ${activeAcademicTerm.term} · ${activeAcademicTerm.academic_year}`
    : 'No active term'
  const totalStudents =
    classes.reduce(
      (sum, classRow) =>
        sum + classRow.studentCount,
      0,
    )

  const gradeGroups = Array.from(
    classes.reduce(
      (
        groups,
        classRow,
      ) => {
        const gradeClasses =
          groups.get(classRow.name) ?? []

        gradeClasses.push(classRow)
        groups.set(
          classRow.name,
          gradeClasses,
        )

        return groups
      },
      new Map<string, ClassForSubject[]>(),
    ),
  )
    .map(([grade, gradeClasses]) => ({
      grade,
      classes: [...gradeClasses].sort(
        (left, right) =>
          left.stream.localeCompare(
            right.stream,
          ),
      ),
    }))
    .sort((left, right) =>
      left.grade.localeCompare(
        right.grade,
        undefined,
        { numeric: true },
      ),
    )

  const perfClasses = classes.filter(c => c.perfPct !== null)
  const avgPerfPct = perfClasses.length > 0
    ? Math.round(perfClasses.reduce((sum, c) => sum + (c.perfPct ?? 0), 0) / perfClasses.length)
    : null

  function barColor(pct: number) {
    return pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'
  }

  return (
    <div style={{ fontFamily: "inherit", fontSize: 13, color: C.textMuted, paddingBottom: 60, background: C.surface, minHeight: '100%' }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* ── HERO ── */}
      <div style={{
        background: '#fff',
        padding: '14px 16px 18px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase' }}>SubjectHub</div>
          <button type="button" aria-label="Open notifications" onClick={() => router.push('/teacher/notifications')} style={{ background: C.surface, border: 'none', borderRadius: 8, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}>🔔</button>
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
                background: C.accentLight,
                backdropFilter: 'blur(8px)',
                border: '2px solid rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, flexShrink: 0,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}>🔬</div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 22, fontWeight: 750, color: C.textPrimary, margin: 0, lineHeight: 1.2 }}>
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
                        fontSize: 11, fontWeight: 800, borderRadius: 20,
                        padding: '3px 9px', background: readiness.bg, color: readiness.color,
                        letterSpacing: 0.5, whiteSpace: 'nowrap',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      {readiness.label} {readiness.label !== 'Ready' ? 'ℹ️' : '✅'}
                    </button>
                  )}
                  <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>
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
                    flex: 1, background: C.surface,
                    borderRadius: 16, padding: '10px 8px', textAlign: 'center',
                    border: 'none', cursor: s.route ? 'pointer' : 'default',
                    backdropFilter: 'blur(4px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    fontFamily: 'inherit',
                  }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.textPrimary }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── SUBJECT TABS ── */}
      {!loading && subjects.length > 0 && (
        <div style={{ padding: '14px 16px 0', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {subjects.map((subject, index) => (
            <button
              key={subject.id}
              type="button"
              onClick={() => setActiveIdx(index)}
              style={{
                flexShrink: 0,
                padding: '7px 14px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                background: index === activeIdx ? '#075985' : '#fff',
                color: index === activeIdx ? '#fff' : C.textMuted,
                boxShadow: index === activeIdx ? '0 2px 8px rgba(7,89,133,0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
                fontFamily: 'inherit',
              }}
            >
              {subject.name}
            </button>
          ))}
        </div>
      )}

      {/* ── SUBJECT INTELLIGENCE CARD ── */}
      {!loading && activeSubject && (
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase' }}>Subject Intelligence</span>
            <span style={{ fontSize: 11, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', borderRadius: 20, padding: '3px 9px' }}>{termTag}</span>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 750, color: C.textPrimary }}>{classes.length}</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>Classes</div>
            </div>
            <div style={{ width: 1, background: C.border }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 750, color: C.textPrimary }}>{totalStudents}</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>Students</div>
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

          {/* Three numbers — Coverage / Assessed / Mastered */}
          {[
            { label: 'Coverage',  pct: coveragePct,  color: '#075985', hint: 'Outcomes taught' },
            { label: 'Assessed',  pct: assessedPct,  color: '#6d28d9', hint: 'Outcomes tested' },
            { label: 'Mastered',  pct: masteredPct,  color: '#065f46', hint: 'Outcomes understood' },
          ].map(({ label, pct, color, hint }) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--teacher-muted, #627168)", fontWeight: 600 }}>{label} <span style={{ fontSize: 11, color: "var(--teacher-muted, #627168)", fontWeight: 400 }}>— {hint}</span></span>
                <span style={{ fontSize: 11, fontWeight: 800, color: pct !== null ? barColor(pct) : '#9ca3af' }}>{pct !== null ? `${pct}%` : '—'}</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 6, background: '#f3f4f6', overflow: 'hidden' }}>
                <div style={{ width: `${pct ?? 0}%`, height: '100%', borderRadius: 6, background: color, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))}
          {avgPerfPct !== null && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--teacher-muted, #627168)", fontWeight: 600 }}>Avg Perf <span style={{ fontSize: 11, color: "var(--teacher-muted, #627168)", fontWeight: 400 }}>— Assessment scores</span></span>
                <span style={{ fontSize: 11, fontWeight: 800, color: barColor(avgPerfPct) }}>{avgPerfPct}%</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 6, background: '#f3f4f6', overflow: 'hidden' }}>
                <div style={{ width: `${avgPerfPct}%`, height: '100%', borderRadius: 6, background: barColor(avgPerfPct), transition: 'width 0.4s ease' }} />
              </div>
            </div>
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

      {/* ── CURRICULUM OUTCOMES CARD ── */}
      {!loading && activeSubject && outcomesByStrand.length > 0 && (
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--teacher-muted, #627168)", letterSpacing: 1.4, textTransform: 'uppercase' }}>Curriculum map</span>
            <span style={{ fontSize: 11, fontWeight: 700, background: "var(--teacher-green-soft, #e9f4ed)", color: '#065f46', borderRadius: 20, padding: '3px 9px' }}>
              {outcomesByStrand.reduce((s, o) => s + o.count, 0)} total
            </span>
          </div>
          <div className="studio-curriculum-grid">
            {outcomesByStrand.map(o => (
              <div key={o.strand} className="studio-strand">
                <strong>{o.count}</strong>
                <span>{o.strand}</span>
                <small>registered outcome{o.count !== 1 ? 's' : ''}</small>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--teacher-muted, #627168)", lineHeight: 1.5 }}>
            Curriculum outcomes linked to this subject. Open a class below to inspect learner evidence and follow-up.
          </div>
        </div>
      )}

      {!loading && activeSubject && (
        <SubjectCompanion subject={activeSubject} classes={classes} />
      )}

      {/* ── GROWTH ENGINE ── */}
      {!loading && activeSubject && (
        <details className="teacher-today__details" style={{ margin: "14px 16px 0" }}><summary>Teaching activity &amp; coverage</summary>
          {/* Activity continuity is descriptive only; it is not a quality or performance score. */}
          {streak > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Recent teaching activity</div>
              <div style={{ fontSize: 13, color: C.textPrimary, marginTop: 4 }}>
                Records exist on {streak} consecutive day{streak === 1 ? '' : 's'}.
              </div>
            </div>
          )}

          {/* Curriculum Completion */}
          {curriculumPct !== null && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Curriculum Completion</div>
                <div style={{ fontSize: 16, fontWeight: 750, color: curriculumPct >= 70 ? '#065f46' : curriculumPct >= 40 ? '#92400e' : '#991b1b' }}>{curriculumPct}%</div>
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
                <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Weakest Strand This Term</div>
                <div style={{ fontSize: 15, fontWeight: 750, color: '#991b1b', marginTop: 2 }}>{weakStrand.name}</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 750, color: '#991b1b' }}>{weakStrand.pct}%</div>
            </div>
          )}

          {/* Cumulative Stats */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>Your Growth This Term</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'Lessons Planned', value: lessonCount, icon: '📖', color: '#6d28d9' },
                { label: 'Students Assessed', value: assessCount, icon: '📊', color: '#075985' },
                { label: 'Resources Published', value: resourceCount, icon: '🌍', color: '#065f46' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12, background: C.surface }}>
                  <div style={{ fontSize: 20 }}>{s.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 750, color: s.color, lineHeight: 1.1, marginTop: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, marginTop: 3, lineHeight: 1.3 }}>{s.label}</div>
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
                  <div style={{ fontSize: 12, fontWeight: 750, color: '#fff' }}>TPAD EVIDENCE READY</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>Your activity this term qualifies as TSC evidence.</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: '12px 0' }}>
                {lessonCount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{lessonCount} lesson plan{lessonCount !== 1 ? 's' : ''}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.15)', color: '#c7d2fe', borderRadius: 8, padding: '2px 8px' }}>Standard 1</span>
                  </div>
                )}
                {attCount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{attCount} attendance log{attCount !== 1 ? 's' : ''}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.15)', color: '#c7d2fe', borderRadius: 8, padding: '2px 8px' }}>Standard 2</span>
                  </div>
                )}
                {assessCount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{assessCount} assessment{assessCount !== 1 ? 's' : ''}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.15)', color: '#c7d2fe', borderRadius: 8, padding: '2px 8px' }}>Standard 4</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => router.push('/teacher/tpad')}
                style={{
                  width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                  background: '#fff', color: "var(--teacher-ink, #1c2923)", fontSize: 13, fontWeight: 800,
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
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.2, textTransform: 'uppercase' }}>Next Class Today</div>
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
              <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>💡 Did You Know?</div>
              <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6, fontWeight: 500 }}>{dailyFact}</div>
            </div>
          )}

          {aiSuggestion && !suggLoading && (
            <div style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)', borderRadius: 20, padding: '16px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '4px solid #7c3aed' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#5b21b6', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>🚀 Your Next Move</div>
              <div style={{ fontSize: 13, color: '#4c1d95', lineHeight: 1.6, fontWeight: 500 }}>{aiSuggestion}</div>
            </div>
          )}

        </details>
      )}

      {/* ── SUBJECT CONTENT LIBRARY ── */}
      {!loading && activeSubject && (
        <div style={{
          margin: '14px 16px 0',
          background: '#fff',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow:
            '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            padding: '14px 16px',
            borderBottom:
              '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              'space-between',
            gap: 12,
          }}>
            <div>
              <p style={{
                fontSize: 11,
                fontWeight: 800,
                color: C.textMuted,
                letterSpacing: 1.4,
                textTransform:
                  'uppercase',
                margin: 0,
              }}>
                Subject Content
              </p>

              <p style={{
                fontSize: 12,
                color: C.textMuted,
                margin: '3px 0 0',
              }}>
                VibeLearn resources adopted
                for your {
                  activeSubject.name
                } classes
              </p>
            </div>

            <div style={{
              minWidth: 34,
              height: 34,
              borderRadius: 12,
              background: '#ecfdf5',
              color: '#047857',
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                'center',
              fontSize: 14,
              fontWeight: 750,
            }}>
              {subjectLibraryItems.length}
            </div>
          </div>

          {subjectLibraryLoading && (
            <div style={{
              padding: '14px 16px',
            }}>
              <Skeleton h={58} />
            </div>
          )}

          {!subjectLibraryLoading &&
            subjectLibraryError && (
            <div style={{
              padding: '14px 16px',
              color: C.error,
              fontSize: 12,
            }}>
              {subjectLibraryError}
            </div>
          )}

          {!subjectLibraryLoading &&
            !subjectLibraryError &&
            subjectLibraryItems.length === 0 && (
            <div style={{
              padding: '22px 16px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 28,
              }}>
                📚
              </div>

              <p style={{
                fontSize: 13,
                fontWeight: 800,
                color: C.textPrimary,
                margin: '8px 0 4px',
              }}>
                No content adopted yet
              </p>

              <p style={{
                fontSize: 12,
                color: C.textMuted,
                lineHeight: 1.5,
                margin: '0 0 12px',
              }}>
                Discover curriculum-aligned
                content and add it to an exact
                class.
              </p>

              <button
                onClick={() =>
                  router.push(
                    '/teacher/vibelearn' +
                    '?tab=discover' +
                    '&subjectId=' +
                    activeSubject.id,
                  )
                }
                style={{
                  padding: '9px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#047857',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Discover on VibeLearn
              </button>
            </div>
          )}

          {!subjectLibraryLoading &&
            subjectLibraryItems.length > 0 && (
            <div>
              {subjectLibraryItems
                .slice(0, 4)
                .map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      padding:
                        '12px 16px',
                      display: 'flex',
                      alignItems:
                        'center',
                      gap: 12,
                      borderTop:
                        index === 0
                          ? 'none'
                          : '1px solid #f3f4f6',
                    }}
                  >
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      background:
                        '#ecfdf5',
                      display: 'flex',
                      alignItems:
                        'center',
                      justifyContent:
                        'center',
                      fontSize: 18,
                    }}>
                      📘
                    </div>

                    <div style={{
                      flex: 1,
                      minWidth: 0,
                    }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color:
                          C.textPrimary,
                        overflow: 'hidden',
                        textOverflow:
                          'ellipsis',
                        whiteSpace:
                          'nowrap',
                      }}>
                        {item.title}
                      </div>

                      <div style={{
                        marginTop: 2,
                        fontSize: 11,
                        color: C.textMuted,
                      }}>
                        {
                          item.sourceType
                        } · {
                          item.usageRole
                            .replaceAll(
                              '_',
                              ' ',
                            )
                        }
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (item.publicationId && item.chapterId) {
                          router.push(
                            '/read/textbook/' +
                            encodeURIComponent(item.publicationId) +
                            '/' +
                            encodeURIComponent(item.chapterId),
                          )
                          return
                        }
                        router.push(
                          '/teacher/resources?subjectId=' +
                          encodeURIComponent(activeSubject.id) +
                          '&classId=' +
                          encodeURIComponent(item.classId),
                        )
                      }}
                      style={{
                        border: 'none',
                        borderRadius: 10,
                        background: '#ecfdf5',
                        color: '#047857',
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '8px 10px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        flexShrink: 0,
                      }}
                    >
                      Open
                    </button>
                  </div>
                ))}

              <button
                onClick={() =>
                  router.push(
                    '/teacher/vibelearn' +
                    '?tab=discover' +
                    '&subjectId=' +
                    activeSubject.id,
                  )
                }
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  border: 'none',
                  borderTop:
                    '1px solid #f3f4f6',
                  background: "var(--teacher-canvas, #f5f6f2)",
                  color: '#047857',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Find more content
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MY CLASSES FOR THIS SUBJECT ── */}
      {!loading && activeSubject && (
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', margin: 0 }}>My Classes</p>
            <p style={{
              fontSize: 12,
              color: C.textMuted,
              margin: '3px 0 0',
            }}>
              Organised by grade for {
                activeSubject.name
              }
            </p>
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
                onClick={() => router.push('/teacher/onboarding/class')}
                style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Set up teaching assignment
              </button>
            </div>
          )}

          {!classLoading &&
            gradeGroups.map(
              (
                gradeGroup,
                gradeIndex,
              ) => (
                <div
                  key={gradeGroup.grade}
                  style={{
                    borderTop:
                      gradeIndex === 0
                        ? 'none'
                        : '8px solid #f8fafc',
                  }}
                >
                  <div style={{
                    padding: '10px 16px',
                    background: "var(--teacher-canvas, #f5f6f2)",
                    borderBottom:
                      '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent:
                      'space-between',
                  }}>
                    <div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 750,
                        color: C.textPrimary,
                      }}>
                        {gradeGroup.grade}
                      </div>

                      <div style={{
                        marginTop: 2,
                        fontSize: 11,
                        color: C.textMuted,
                        fontWeight: 600,
                      }}>
                        {
                          gradeGroup.classes.length
                        } {
                          gradeGroup.classes.length === 1
                            ? 'class'
                            : 'classes'
                        }
                      </div>
                    </div>

                    <div style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#075985',
                      background: '#dbeafe',
                      padding: '3px 9px',
                      borderRadius: 20,
                    }}>
                      {
                        gradeGroup.classes.reduce(
                          (
                            total,
                            classRow,
                          ) =>
                            total +
                            classRow.studentCount,
                          0,
                        )
                      } learners
                    </div>
                  </div>

                  {gradeGroup.classes.map(
                    (
                      cls,
                      classIndex,
                    ) => {
                      const paletteIndex =
                        (
                          gradeIndex +
                          classIndex
                        ) % PALETTES.length

                      return (
                        <div
                          key={cls.id}
                          onClick={() =>
                            router.push(
                              '/teacher/classhub/' +
                              cls.id +
                              '?mode=subject&subjectId=' +
                              activeSubject.id,
                            )
                          }
                          style={{
                            width: '100%',
                            padding: '14px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent:
                              'space-between',
                            borderTop:
                              classIndex === 0
                                ? 'none'
                                : '1px solid #f3f4f6',
                            background:
                              'transparent',
                            cursor: 'pointer',
                            fontFamily:
                              'inherit',
                            textAlign: 'left',
                            boxSizing:
                              'border-box',
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}>
                            <div style={{
                              width: 42,
                              height: 42,
                              borderRadius: 12,
                              background:
                                PALETTES[
                                  paletteIndex
                                ].bg,
                              display: 'flex',
                              alignItems:
                                'center',
                              justifyContent:
                                'center',
                              fontSize: 18,
                              flexShrink: 0,
                            }}>
                              🏫
                            </div>

                            <div>
                              <p style={{
                                fontSize: 14,
                                fontWeight: 800,
                                color:
                                  C.textPrimary,
                                margin: 0,
                              }}>
                                {
                                  cls.stream ||
                                  cls.name
                                }
                              </p>

                              <p style={{
                                fontSize: 12,
                                color:
                                  C.textMuted,
                                margin:
                                  '2px 0 0',
                              }}>
                                {
                                  cls.studentCount
                                } {
                                  cls.studentCount === 1
                                    ? 'student'
                                    : 'students'
                                }
                              </p>
                            </div>
                          </div>

                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}>
                            {
                              attRateByClass[
                                cls.id
                              ] !== undefined &&
                              (
                                <div style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding:
                                    '4px 9px',
                                  borderRadius:
                                    20,
                                  background:
                                    '#dbeafe',
                                  color:
                                    '#1d4ed8',
                                }}>
                                  {
                                    attRateByClass[
                                      cls.id
                                    ]
                                  }% att
                                </div>
                              )
                            }

                            {
                              cls.perfPct !== null &&
                              (
                                <div style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding:
                                    '4px 9px',
                                  borderRadius:
                                    20,
                                  background:
                                    cls.perfPct >= 70
                                      ? '#d1fae5'
                                      : cls.perfPct >= 40
                                        ? '#fef3c7'
                                        : '#fee2e2',
                                  color:
                                    cls.perfPct >= 70
                                      ? '#065f46'
                                      : cls.perfPct >= 40
                                        ? '#92400e'
                                        : '#991b1b',
                                }}>
                                  {cls.perfPct}%
                                </div>
                              )
                            }

                            <button
                              onClick={event => {
                                event.stopPropagation()
                                router.push(
                                  '/teacher/assessment?classId=' +
                                  cls.id +
                                  '&subjectId=' +
                                  activeSubject.id,
                                )
                              }}
                              style={{
                                padding:
                                  '6px 12px',
                                borderRadius: 8,
                                border: 'none',
                                background:
                                  '#92400e',
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontFamily:
                                  'inherit',
                                flexShrink: 0,
                              }}
                            >
                              Assess
                            </button>

                            <span style={{
                              fontSize: 18,
                              color: "var(--teacher-muted, #627168)",
                            }}>
                              ›
                            </span>
                          </div>
                        </div>
                      )
                    },
                  )}
                </div>
              ),
            )}
        </div>
      )}

      {/* ── DEPARTMENT TEAM ── */}
      {!loading && activeSubject && (
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', margin: 0 }}>Department Team</p>
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
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0, textAlign: 'center' }}>Subjects appear automatically from your verified class and subject teaching assignments.</p>
          <button
            onClick={() => router.push('/teacher/onboarding/class')}
            style={{ marginTop: 8, padding: '14px 32px', borderRadius: 14, background: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(67,56,202,0.35)' }}>
            Set up class & subject
          </button>
        </div>
      )}

      {showAddSubject && (
        <SharedModal open={showAddSubject} title="Add subject" onClose={closeAddSubject}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ overflowY: 'auto', padding: '24px 24px 8px', flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginBottom: 16 }}>Add Subject</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>SUBJECT NAME</div>
              <select
                aria-label="Subject name"
                value={useOtherSubject ? 'Other' : newSubjectName}
                onChange={e => {
                  const v = e.target.value
                  setUseOtherSubject(false)
                  setNewSubjectName(v)
                }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', marginBottom: useOtherSubject ? 10 : 14, background: '#fff' }}
              >
                <option value="">Select a subject…</option>
                {allowedSubjectNames.filter(s => !subjects.map(x => x.name.toLowerCase()).includes(s.toLowerCase())).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {useOtherSubject && (
                <input
                  aria-label="Subject name"
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
                  aria-label="Class (optional)"
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
        </SharedModal>
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
