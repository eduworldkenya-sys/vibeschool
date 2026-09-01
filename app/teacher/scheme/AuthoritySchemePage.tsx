"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LessonPanel } from '@/components/scheme/LessonPanel'
import { SchemeOfWorkPrint } from '@/components/scheme/SchemeOfWorkPrint'
import { resolveGlobalSubjectId } from '@/lib/curriculum/globalSubjects'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type SchemeUpdate = Database['public']['Tables']['scheme_of_work']['Update']

type RpcError = { message: string; code?: string | null }
type RpcResponse<T> = { data: T | null; error: RpcError | null }

async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<RpcResponse<T>> {
  const result: RpcResponse<T> = await Reflect.apply(supabase.rpc, supabase, [name, args])
  return result
}

const C = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surface2: '#f1f5f9',
  border: '#e2e8f0',
  border2: '#cbd5e1',
  text: '#1e293b',
  text2: '#64748b',
  text3: '#94a3b8',
  heroFrom: '#3730a3',
  heroTo: '#4338ca',
  teal: '#0d9488',
  tealLight: '#ccfbf1',
  indigo: '#4f46e5',
  indigoLight: '#e0e7ff',
  amber: '#d97706',
  amberLight: '#fef3c7',
  red: '#e11d48',
  redLight: '#ffe4e6',
  dark: '#0a1628',
  shadow: '0 1px 3px rgba(0,0,0,0.08)',
} as const

interface ClassOption { id: string; label: string; grade: string }
interface SubjectOption { id: string; label: string }
interface TermRecord {
  id: string
  name: string
  term: number
  academic_year: number
  start_date: string
  end_date: string
  status: string
  school_id: string
}
interface TermWeekRecord {
  school_id: string | null
  term_id: string
  week_number: number
  start_date: string
  end_date: string
  week_type: string
  label: string | null
}
interface CalendarResolution {
  term_id: string
  academic_year: number
  term_number: number
  week_number: number
  week_start: string
  week_end: string
  week_type: string
  week_label: string | null
}
interface CurriculumRow {
  id: string
  grade: string
  subject: string
  strand: string
  sub_strand: string | null
  topic: string
  week: number
  term: number
}
interface SchemeItem {
  id: string
  curriculum_id: string | null
  curriculum_content_id: string | null
  week: number
  strand: string | null
  sub_strand: string | null
  topic: string
  status: string
  source: string
  lesson_number: number | null
  sequence_number: number | null
  reflection: string | null
  objectives: string | null
  key_inquiry_question: string | null
  learning_resources: string | null
  assessment_methods: string | null
  learning_experiences: string | null
}
interface AssignmentPair { class_id: string; subject_id: string }
interface ResourceLinkRow {
  id: string
  scheme_lesson_id: string
  resource_id: string
  publication_id: string
  chapter_id: string
  resource_role: string
  sequence: number
  page_start: number | null
  page_end: number | null
  exercise_refs: unknown
}
interface SchemeLinkedResource {
  id: string
  resourceId: string
  publicationId: string
  chapterId: string
  publicationTitle: string
  chapterTitle: string
  resourceRole: string
  sequence: number
  pageStart: number | null
  pageEnd: number | null
  exerciseRefs: unknown[]
}
interface EbookSuggestion {
  resourceId: string
  publicationId: string
  chapterId: string
  chapterTitle: string
  publicationTitle: string
  strandName: string
  learningOutcomes: string[]
  resourceRole: string
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string; border: string }> = {
  planned: { bg: C.surface2, color: C.text2, label: 'Planned', border: C.border },
  teaching: { bg: '#dbeafe', color: '#1d4ed8', label: 'Teaching', border: '#93c5fd' },
  done: { bg: C.tealLight, color: C.teal, label: 'Done', border: '#5eead4' },
  cancelled: { bg: C.redLight, color: C.red, label: 'Cancelled', border: '#fda4af' },
}
const PROGRESSION_STATUSES = ['planned', 'teaching', 'done'] as const

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function termLabel(term: TermRecord): string {
  return term.name.includes(String(term.academic_year))
    ? term.name
    : `${term.name} ${term.academic_year}`
}

function explainCommitError(message: string): string {
  if (message.includes('SCHEME_CANONICAL_CONTENT_REQUIRED')) {
    return 'This curriculum item has no confirmed canonical lesson content yet. Nothing was committed.'
  }
  if (message.includes('SCHEME_CANONICAL_CONTENT_INCOMPLETE')) {
    return 'Canonical lesson content is incomplete. Outcomes, key inquiry, experiences, resources and assessment must all be approved before Scheme commit.'
  }
  if (message.includes('SCHEME_ASSIGNMENT_REQUIRED')) {
    return 'This class and subject are not assigned to you. Scheme changes were blocked.'
  }
  if (message.includes('SCHEME_CURRICULUM_IDENTITY_MISMATCH')) {
    return 'The selected curriculum does not match the canonical class, subject and term identity.'
  }
  return message
}

function EmptyState({ icon, title, desc, action }: {
  icon: string
  title: string
  desc: string
  action?: React.ReactNode
}) {
  return (
    <div style={{ textAlign: 'center', padding: '36px 24px', background: C.surface, borderRadius: 16, border: `1.5px dashed ${C.border2}` }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>{desc}</div>
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  )
}

function Chip({ label, active, color = C.indigo, onClick }: {
  label: string
  active: boolean
  color?: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '7px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700,
      border: `1.5px solid ${active ? color : C.border}`, cursor: 'pointer',
      fontFamily: 'inherit', background: active ? color : C.surface,
      color: active ? '#fff' : C.text2, whiteSpace: 'nowrap',
    }}>{label}</button>
  )
}

function SchemePageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initial = useRef({
    classId: searchParams.get('classId'),
    subjectId: searchParams.get('subjectId'),
    termId: searchParams.get('termId'),
    week: searchParams.get('week'),
  })

  const [uid, setUid] = useState<string | null>(null)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [pairs, setPairs] = useState<AssignmentPair[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [terms, setTerms] = useState<TermRecord[]>([])
  const [termWeeks, setTermWeeks] = useState<TermWeekRecord[]>([])
  const [todayResolution, setTodayResolution] = useState<CalendarResolution | null>(null)

  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null)
  const [selectedWeek, setSelectedWeek] = useState(1)

  const [schemeItems, setSchemeItems] = useState<SchemeItem[]>([])
  const [curriculumRows, setCurriculumRows] = useState<CurriculumRow[]>([])
  const [linkedResources, setLinkedResources] = useState<Record<string, SchemeLinkedResource[]>>({})
  const [ebookSuggestions, setEbookSuggestions] = useState<EbookSuggestion[]>([])
  const [selectedSchemeResource, setSelectedSchemeResource] = useState<EbookSuggestion | null>(null)
  const [weeklyTarget, setWeeklyTarget] = useState<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingSet, setSavingSet] = useState<Set<string>>(new Set())
  const [showPrint, setShowPrint] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [newStrandName, setNewStrandName] = useState('')
  const [addCustomBusy, setAddCustomBusy] = useState(false)

  const selectedClassObj = useMemo(() => classes.find(row => row.id === selectedClass) ?? null, [classes, selectedClass])
  const selectedSubjectObj = useMemo(() => subjects.find(row => row.id === selectedSubject) ?? null, [subjects, selectedSubject])
  const selectedTermObj = useMemo(() => terms.find(row => row.id === selectedTermId) ?? null, [terms, selectedTermId])
  const filteredSubjects = useMemo(() => {
    if (!selectedClass) return []
    const ids = new Set(pairs.filter(row => row.class_id === selectedClass).map(row => row.subject_id))
    return subjects.filter(row => ids.has(row.id))
  }, [pairs, selectedClass, subjects])

  const authoritativeWeeks = useMemo(() => {
    const byWeek = new Map<number, TermWeekRecord>()
    for (const row of termWeeks) {
      const previous = byWeek.get(row.week_number)
      if (!previous || (row.school_id !== null && previous.school_id === null)) {
        byWeek.set(row.week_number, row)
      }
    }
    return [...byWeek.values()].sort((a, b) => a.week_number - b.week_number)
  }, [termWeeks])

  const totalWeeks = authoritativeWeeks.length > 0
    ? Math.max(...authoritativeWeeks.map(row => row.week_number))
    : 0

  const currentWeek = useMemo(() => {
    if (!selectedTermId) return 0
    if (todayResolution?.term_id === selectedTermId) return todayResolution.week_number
    const today = isoToday()
    return authoritativeWeeks.find(row => today >= row.start_date && today <= row.end_date)?.week_number ?? 0
  }, [authoritativeWeeks, selectedTermId, todayResolution])

  const boot = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      const user = authData.user
      if (!user) throw new Error('Not signed in')
      setUid(user.id)

      const [teacherRes, memberRes, profileRes, assignmentRes] = await Promise.all([
        supabase.from('teacher_profiles').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('profiles').select('school_id').eq('id', user.id).maybeSingle(),
        supabase.from('teacher_classes').select('class_id,subject_id').eq('teacher_id', user.id),
      ])
      const firstError = teacherRes.error ?? memberRes.error ?? profileRes.error ?? assignmentRes.error
      if (firstError) throw firstError
      const sid = memberRes.data?.school_id ?? teacherRes.data?.school_id ?? profileRes.data?.school_id ?? null
      if (!sid) throw new Error('Your account is not linked to a school.')
      setSchoolId(sid)

      const loadedPairs = (assignmentRes.data ?? []) as AssignmentPair[]
      if (loadedPairs.length === 0) throw new Error('No class and subject assignments are configured for this teacher.')
      setPairs(loadedPairs)

      const classIds = [...new Set(loadedPairs.map(row => row.class_id))]
      const subjectIds = [...new Set(loadedPairs.map(row => row.subject_id))]
      const [classRes, subjectRes, termRes, calendarRes] = await Promise.all([
        supabase.from('classes').select('id,name,stream').in('id', classIds).eq('school_id', sid),
        supabase.from('subjects').select('id,name').in('id', subjectIds),
        supabase.from('academic_terms').select('id,name,term,academic_year,start_date,end_date,status,school_id').eq('school_id', sid).order('start_date', { ascending: false }),
        callRpc<CalendarResolution[]>('resolve_instructional_week_for_date', { p_school_id: sid, p_date: isoToday() }),
      ])
      if (classRes.error) throw classRes.error
      if (subjectRes.error) throw subjectRes.error
      if (termRes.error) throw termRes.error

      const classOptions: ClassOption[] = (classRes.data ?? []).map(row => ({
        id: row.id,
        grade: row.name,
        label: row.stream ? `${row.name} ${row.stream}` : row.name,
      }))
      const subjectOptions: SubjectOption[] = (subjectRes.data ?? []).map(row => ({ id: row.id, label: row.name }))
      const loadedTerms = (termRes.data ?? []) as TermRecord[]
      setClasses(classOptions)
      setSubjects(subjectOptions)
      setTerms(loadedTerms)
      const calendar = !calendarRes.error && calendarRes.data?.length === 1 ? calendarRes.data[0] : null
      setTodayResolution(calendar)

      const initialClass = initial.current.classId && classOptions.some(row => row.id === initial.current.classId)
        ? initial.current.classId
        : classOptions[0]?.id ?? null
      setSelectedClass(initialClass)
      const allowedSubjectIds = new Set(loadedPairs.filter(row => row.class_id === initialClass).map(row => row.subject_id))
      const initialSubject = initial.current.subjectId && allowedSubjectIds.has(initial.current.subjectId)
        ? initial.current.subjectId
        : subjectOptions.find(row => allowedSubjectIds.has(row.id))?.id ?? null
      setSelectedSubject(initialSubject)

      const requestedTerm = initial.current.termId && loadedTerms.some(row => row.id === initial.current.termId)
        ? initial.current.termId
        : null
      const resolvedTerm = calendar?.term_id && loadedTerms.some(row => row.id === calendar.term_id)
        ? calendar.term_id
        : null
      const chosenTerm = requestedTerm ?? resolvedTerm ?? loadedTerms[0]?.id ?? null
      setSelectedTermId(chosenTerm)
      const requestedWeek = Number.parseInt(initial.current.week ?? '', 10)
      if (Number.isFinite(requestedWeek) && requestedWeek > 0) setSelectedWeek(requestedWeek)
      else if (calendar && chosenTerm === calendar.term_id) setSelectedWeek(calendar.week_number)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Scheme could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void boot() }, [boot])

  useEffect(() => {
    if (!selectedClass) return
    if (!filteredSubjects.some(row => row.id === selectedSubject)) {
      setSelectedSubject(filteredSubjects[0]?.id ?? null)
    }
  }, [filteredSubjects, selectedClass, selectedSubject])

  useEffect(() => {
    if (loading) return
    const params = new URLSearchParams()
    if (selectedClass) params.set('classId', selectedClass)
    if (selectedSubject) params.set('subjectId', selectedSubject)
    if (selectedTermId) params.set('termId', selectedTermId)
    params.set('week', String(selectedWeek))
    router.replace(`/teacher/scheme?${params.toString()}`)
  }, [loading, router, selectedClass, selectedSubject, selectedTermId, selectedWeek])

  useEffect(() => {
    let cancelled = false
    async function loadCalendarWeeks() {
      if (!selectedTermId || !schoolId) {
        setTermWeeks([])
        return
      }
      const { data, error: weekError } = await supabase
        .from('term_weeks')
        .select('school_id,term_id,week_number,start_date,end_date,week_type,label')
        .eq('term_id', selectedTermId)
        .or(`school_id.eq.${schoolId},school_id.is.null`)
        .order('week_number', { ascending: true })
      if (cancelled) return
      if (weekError) {
        setError(`Instructional calendar could not be loaded: ${weekError.message}`)
        setTermWeeks([])
        return
      }
      setTermWeeks((data ?? []) as TermWeekRecord[])
    }
    void loadCalendarWeeks()
    return () => { cancelled = true }
  }, [schoolId, selectedTermId])

  useEffect(() => {
    if (totalWeeks > 0 && selectedWeek > totalWeeks) setSelectedWeek(totalWeeks)
  }, [selectedWeek, totalWeeks])

  useEffect(() => {
    let cancelled = false
    async function loadAllocation() {
      if (!selectedClass || !selectedSubject) {
        setWeeklyTarget(null)
        return
      }
      const result = await callRpc<number>('resolve_subject_weekly_allocation', {
        p_class_id: selectedClass,
        p_subject_id: selectedSubject,
      })
      if (cancelled) return
      if (result.error) {
        setWeeklyTarget(null)
        setError(`Weekly allocation could not be resolved: ${result.error.message}`)
      } else {
        setWeeklyTarget(result.data ?? null)
      }
    }
    void loadAllocation()
    return () => { cancelled = true }
  }, [selectedClass, selectedSubject])

  const loadScheme = useCallback(async () => {
    if (!selectedClass || !selectedSubject || !selectedTermId || !schoolId || !uid || !selectedClassObj || !selectedTermObj) return
    setFetching(true)
    setError(null)
    setLinkedResources({})
    try {
      const { data, error: schemeError } = await supabase
        .from('scheme_of_work')
        .select('id,curriculum_id,curriculum_content_id,week,strand,sub_strand,topic,status,source,lesson_number,sequence_number,reflection,objectives,key_inquiry_question,learning_resources,assessment_methods,learning_experiences')
        .eq('teacher_id', uid)
        .eq('school_id', schoolId)
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('academic_term_id', selectedTermId)
        .order('sequence_number', { ascending: true, nullsFirst: false })
        .order('lesson_number', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
      if (schemeError) throw schemeError
      const items = (data ?? []) as SchemeItem[]
      setSchemeItems(items)

      if (items.length > 0) {
        const batch = await callRpc<ResourceLinkRow[]>('list_scheme_lesson_resources_batch', {
          p_scheme_ids: items.map(item => item.id),
        })
        if (batch.error) throw new Error(`Attached resources could not be loaded: ${batch.error.message}`)
        const links = batch.data ?? []
        const resourceIds = [...new Set(links.map(row => row.resource_id))]
        const publicationIds = [...new Set(links.map(row => row.publication_id))]
        const [resourceRes, publicationRes] = await Promise.all([
          resourceIds.length > 0
            ? supabase.from('learning_resources').select('id,title').in('id', resourceIds)
            : Promise.resolve({ data: [], error: null }),
          publicationIds.length > 0
            ? supabase.from('vibe_publications').select('id,title').in('id', publicationIds)
            : Promise.resolve({ data: [], error: null }),
        ])
        if (resourceRes.error) throw resourceRes.error
        if (publicationRes.error) throw publicationRes.error
        const resourceTitles = new Map((resourceRes.data ?? []).map(row => [row.id, row.title]))
        const publicationTitles = new Map((publicationRes.data ?? []).map(row => [row.id, row.title]))
        const map: Record<string, SchemeLinkedResource[]> = {}
        for (const link of links) {
          const entry: SchemeLinkedResource = {
            id: link.id,
            resourceId: link.resource_id,
            publicationId: link.publication_id,
            chapterId: link.chapter_id,
            publicationTitle: publicationTitles.get(link.publication_id) ?? '',
            chapterTitle: resourceTitles.get(link.resource_id) ?? 'Teaching resource',
            resourceRole: link.resource_role,
            sequence: link.sequence,
            pageStart: link.page_start,
            pageEnd: link.page_end,
            exerciseRefs: Array.isArray(link.exercise_refs) ? link.exercise_refs : [],
          }
          map[link.scheme_lesson_id] = [...(map[link.scheme_lesson_id] ?? []), entry]
        }
        for (const value of Object.values(map)) value.sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))
        setLinkedResources(map)
      }

      const globalSubjectId = await resolveGlobalSubjectId(selectedSubject)
      if (!globalSubjectId) throw new Error('This school subject is not linked to the canonical subject taxonomy.')
      const { data: curriculumData, error: curriculumError } = await supabase
        .from('curriculum')
        .select('id,grade,subject,strand,sub_strand,topic,week,term')
        .eq('grade', selectedClassObj.grade)
        .eq('global_subject_id', globalSubjectId)
        .eq('term', selectedTermObj.term)
        .order('week', { ascending: true })
        .order('created_at', { ascending: true })
      if (curriculumError) throw curriculumError
      const presentIds = new Set(items.map(item => item.curriculum_id).filter((id): id is string => Boolean(id)))
      setCurriculumRows(((curriculumData ?? []) as CurriculumRow[]).filter(row => !presentIds.has(row.id)))

      const { data: libraryRows, error: libraryError } = await supabase
        .from('class_resource_library')
        .select('resource_id,usage_role')
        .eq('teacher_id', uid)
        .eq('school_id', schoolId)
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('status', 'active')
      if (libraryError) throw libraryError
      const libraryResourceIds = [...new Set((libraryRows ?? []).map(row => row.resource_id))]
      if (libraryResourceIds.length === 0) {
        setEbookSuggestions([])
      } else {
        const { data: resources, error: resourcesError } = await supabase
          .from('learning_resources')
          .select('id,title,publication_id,chapter_id,strand,learning_outcomes')
          .in('id', libraryResourceIds)
          .eq('status', 'active')
        if (resourcesError) throw resourcesError
        const pubIds = [...new Set((resources ?? []).map(row => row.publication_id).filter((id): id is string => Boolean(id)))]
        const { data: pubs, error: pubsError } = pubIds.length > 0
          ? await supabase.from('vibe_publications').select('id,title').in('id', pubIds)
          : { data: [], error: null }
        if (pubsError) throw pubsError
        const pubTitles = new Map((pubs ?? []).map(row => [row.id, row.title]))
        const roleByResource = new Map((libraryRows ?? []).map(row => [row.resource_id, row.usage_role]))
        setEbookSuggestions((resources ?? []).flatMap(row => {
          if (!row.publication_id || !row.chapter_id) return []
          return [{
            resourceId: row.id,
            publicationId: row.publication_id,
            chapterId: row.chapter_id,
            chapterTitle: row.title,
            publicationTitle: pubTitles.get(row.publication_id) ?? '',
            strandName: row.strand ?? '',
            learningOutcomes: row.learning_outcomes ?? [],
            resourceRole: roleByResource.get(row.id) ?? 'supplementary',
          }]
        }))
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Scheme could not be loaded.')
    } finally {
      setFetching(false)
    }
  }, [schoolId, selectedClass, selectedClassObj, selectedSubject, selectedTermId, selectedTermObj, uid])

  useEffect(() => { if (!loading) void loadScheme() }, [loadScheme, loading])

  async function commitScheme() {
    if (!selectedClass || !selectedSubject || !selectedTermId || curriculumRows.length === 0) return
    setCommitting(true)
    setError(null)
    const result = await callRpc<SchemeItem[]>('commit_curriculum_scheme', {
      p_class_id: selectedClass,
      p_subject_id: selectedSubject,
      p_academic_term_id: selectedTermId,
      p_curriculum_ids: curriculumRows.map(row => row.id),
    })
    if (result.error) setError(explainCommitError(result.error.message))
    else await loadScheme()
    setCommitting(false)
  }

  async function addCustomItem() {
    if (!selectedClass || !selectedSubject || !selectedTermId || !newTopicName.trim()) return
    setAddCustomBusy(true)
    setError(null)
    const result = await callRpc<SchemeItem>('commit_custom_scheme_item', {
      p_class_id: selectedClass,
      p_subject_id: selectedSubject,
      p_academic_term_id: selectedTermId,
      p_week: selectedWeek,
      p_topic: newTopicName.trim(),
      p_strand: newStrandName.trim() || null,
      p_resource_id: selectedSchemeResource?.resourceId ?? null,
      p_resource_role: selectedSchemeResource?.resourceRole ?? null,
    })
    if (result.error) setError(result.error.message)
    else {
      setNewTopicName('')
      setNewStrandName('')
      setSelectedSchemeResource(null)
      await loadScheme()
    }
    setAddCustomBusy(false)
  }

  async function updateStatus(itemId: string, nextStatus: string) {
    if (!schoolId || !uid) return
    setSavingSet(previous => new Set(previous).add(itemId))
    const { error: updateError } = await supabase.from('scheme_of_work').update({ status: nextStatus }).eq('id', itemId).eq('school_id', schoolId).eq('teacher_id', uid)
    if (updateError) setError(`Failed to update status: ${updateError.message}`)
    else setSchemeItems(previous => previous.map(item => item.id === itemId ? { ...item, status: nextStatus } : item))
    setSavingSet(previous => { const next = new Set(previous); next.delete(itemId); return next })
  }

  async function updateLessonNumber(itemId: string, lessonNumber: number | null) {
    if (!schoolId || !uid) return
    const { error: updateError } = await supabase.from('scheme_of_work').update({ lesson_number: lessonNumber }).eq('id', itemId).eq('school_id', schoolId).eq('teacher_id', uid)
    if (updateError) setError(`Failed to update lesson number: ${updateError.message}`)
    else setSchemeItems(previous => previous.map(item => item.id === itemId ? { ...item, lesson_number: lessonNumber } : item))
  }

  async function updateReflection(itemId: string, reflection: string) {
    if (!schoolId || !uid) return
    const { error: updateError } = await supabase.from('scheme_of_work').update({ reflection }).eq('id', itemId).eq('school_id', schoolId).eq('teacher_id', uid)
    if (updateError) setError(`Failed to save reflection: ${updateError.message}`)
    else setSchemeItems(previous => previous.map(item => item.id === itemId ? { ...item, reflection } : item))
  }

  type OverrideField = 'key_inquiry_question' | 'learning_resources' | 'assessment_methods' | 'learning_experiences'
  async function updateOverride(itemId: string, field: OverrideField, value: string) {
    if (!schoolId || !uid) return
    const normalized = value.trim() || null
    const payload: SchemeUpdate = field === 'key_inquiry_question'
      ? { key_inquiry_question: normalized }
      : field === 'learning_resources'
        ? { learning_resources: normalized }
        : field === 'assessment_methods'
          ? { assessment_methods: normalized }
          : { learning_experiences: normalized }
    const { error: updateError } = await supabase.from('scheme_of_work').update(payload).eq('id', itemId).eq('school_id', schoolId).eq('teacher_id', uid)
    if (updateError) setError(`Failed to update ${field}: ${updateError.message}`)
    else setSchemeItems(previous => previous.map(item => item.id === itemId ? { ...item, [field]: normalized } : item))
  }

  const orderedItems = useMemo(() => [...schemeItems].sort((a, b) =>
    (a.sequence_number ?? Number.MAX_SAFE_INTEGER) - (b.sequence_number ?? Number.MAX_SAFE_INTEGER)
      || (a.lesson_number ?? Number.MAX_SAFE_INTEGER) - (b.lesson_number ?? Number.MAX_SAFE_INTEGER)
      || a.id.localeCompare(b.id)
  ), [schemeItems])
  const selectedWeekItems = useMemo(() => orderedItems.filter(item => item.week === selectedWeek), [orderedItems, selectedWeek])
  const donePct = selectedWeekItems.length === 0 ? 0 : Math.round(selectedWeekItems.filter(item => item.status === 'done').length / selectedWeekItems.length * 100)
  const plannedPct = selectedWeekItems.length === 0 ? 0 : Math.round(selectedWeekItems.filter(item => item.status === 'planned').length / selectedWeekItems.length * 100)
  const weekCoverage = useMemo(() => {
    const result: Record<number, number> = {}
    for (const week of authoritativeWeeks) {
      const items = orderedItems.filter(item => item.week === week.week_number)
      result[week.week_number] = items.length === 0 ? 0 : Math.round(items.filter(item => item.status === 'done').length / items.length * 100)
    }
    return result
  }, [authoritativeWeeks, orderedItems])

  if (loading) return <EmptyState icon="…" title="Loading Scheme" desc="Resolving your class, subject and academic calendar authority." />
  if (!uid || !schoolId) return <EmptyState icon="!" title="Scheme unavailable" desc={error ?? 'Teacher identity could not be resolved.'} action={<button type="button" onClick={() => void boot()}>Try again</button>} />

  return (
    <div className="vs-scheme" style={{ width: '100%' }}>
      <div style={{ background: `linear-gradient(135deg, ${C.heroFrom}, ${C.heroTo})`, borderRadius: 20, padding: 20, marginBottom: 14, color: '#fff' }}>
        <div style={{ fontSize: 10, opacity: .6, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Scheme of Work</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 3 }}>Curriculum Tracker</div>
        <div style={{ fontSize: 12, opacity: .7, marginTop: 5 }}>
          {selectedTermObj ? `${termLabel(selectedTermObj)} · ${currentWeek > 0 ? `Instructional Week ${currentWeek}` : 'Not the current term'}` : 'Select a term'}
        </div>
        {weeklyTarget !== null && (
          <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700 }}>
            Week {selectedWeek}: {selectedWeekItems.length} of {weeklyTarget} scheduled · {donePct}% taught{plannedPct > 0 ? ` · ${plannedPct}% planned` : ''}
          </div>
        )}
      </div>

      {error && <div role="alert" style={{ padding: 11, marginBottom: 12, borderRadius: 10, background: C.redLight, color: C.red, fontSize: 12, fontWeight: 700 }}>{error}</div>}

      <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 16, marginBottom: 12, boxShadow: C.shadow }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', marginBottom: 8 }}>Class</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
          {classes.map(row => <Chip key={row.id} label={row.label} active={selectedClass === row.id} color={C.dark} onClick={() => setSelectedClass(row.id)} />)}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', marginBottom: 8 }}>Subject</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
          {filteredSubjects.map(row => <Chip key={row.id} label={row.label} active={selectedSubject === row.id} color={C.teal} onClick={() => setSelectedSubject(row.id)} />)}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', marginBottom: 8 }}>Term</div>
        <div style={{ display: 'flex', overflowX: 'auto', gap: 7, marginBottom: 14 }}>
          {terms.map(row => <Chip key={row.id} label={termLabel(row)} active={selectedTermId === row.id} color={C.teal} onClick={() => setSelectedTermId(row.id)} />)}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', marginBottom: 8 }}>Instructional week</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 5 }}>
          {authoritativeWeeks.map(week => {
            const active = selectedWeek === week.week_number
            const current = currentWeek === week.week_number
            const coverage = weekCoverage[week.week_number] ?? 0
            return (
              <button key={week.week_number} type="button" onClick={() => setSelectedWeek(week.week_number)} style={{
                padding: '9px 2px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800,
                border: active ? `2px solid ${C.indigo}` : current ? `2px solid ${C.teal}` : `1px solid ${C.border}`,
                background: active ? C.indigoLight : current ? C.tealLight : C.surface2,
                color: active ? C.indigo : current ? C.teal : C.text2,
              }}>W{week.week_number}<div style={{ fontSize: 8, marginTop: 2, opacity: .7 }}>{coverage}%</div></button>
            )
          })}
        </div>
        {authoritativeWeeks.length === 0 && <div style={{ fontSize: 12, color: C.red, marginTop: 6 }}>No instructional calendar weeks are configured for this term.</div>}
      </div>

      {selectedClassObj && selectedSubjectObj && selectedTermObj && selectedClass && selectedSubject && selectedTermId && (
        <>
          {orderedItems.length > 0 && <button type="button" onClick={() => setShowPrint(true)} style={{ width: '100%', padding: 11, borderRadius: 12, border: `1px solid ${C.border2}`, background: C.surface, color: C.text, fontWeight: 700, marginBottom: 12 }}>Print / Export Scheme of Work</button>}
          {showPrint && <SchemeOfWorkPrint schoolId={schoolId} teacherId={uid} className={selectedClassObj.label} subjectLabel={selectedSubjectObj.label} termLabelText={termLabel(selectedTermObj)} items={orderedItems} onClose={() => setShowPrint(false)} />}
          <LessonPanel teacherId={uid} classId={selectedClass} subjectId={selectedSubject} subjectLabel={selectedSubjectObj.label} academicTermId={selectedTermId} schoolId={schoolId} week={selectedWeek} />
        </>
      )}

      <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 16, boxShadow: C.shadow }}>
        {curriculumRows.length > 0 && (
          <div style={{ padding: 14, background: C.indigoLight, borderRadius: 12, border: '1px solid #c7d2fe', marginBottom: 14 }}>
            <div style={{ fontWeight: 800, color: C.indigo, fontSize: 13 }}>{curriculumRows.length} canonical curriculum item{curriculumRows.length === 1 ? '' : 's'} available</div>
            <div style={{ color: '#4338ca', fontSize: 11, margin: '4px 0 10px', lineHeight: 1.45 }}>Commit is transactional and will fail closed if confirmed canonical lesson content is missing or incomplete.</div>
            <button type="button" disabled={committing} onClick={() => void commitScheme()} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: C.indigo, color: '#fff', fontWeight: 700, cursor: committing ? 'not-allowed' : 'pointer' }}>{committing ? 'Committing…' : 'Commit approved curriculum to Scheme'}</button>
          </div>
        )}

        {fetching ? <div style={{ color: C.text3, fontSize: 12 }}>Loading authoritative Scheme…</div> : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.text }}>Week {selectedWeek} lessons</div>
              <div style={{ fontSize: 11, color: C.teal, fontWeight: 700 }}>{selectedWeekItems.length} scheduled</div>
            </div>
            {selectedWeekItems.length === 0 ? <EmptyState icon="–" title="No lessons scheduled" desc="Add a legitimate teacher-created lesson or commit approved canonical curriculum content." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedWeekItems.map(item => {
                  const style = STATUS_STYLE[item.status] ?? STATUS_STYLE.planned
                  const isSaving = savingSet.has(item.id)
                  return (
                    <div key={item.id} style={{ border: `1px solid ${C.border}`, borderRadius: 13, padding: 14, background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{item.topic}</div>
                          <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{[item.strand, item.sub_strand].filter(Boolean).join(' · ')}</div>
                          {linkedResources[item.id]?.map(resource => <div key={resource.id} style={{ marginTop: 6, fontSize: 10, color: C.indigo, background: C.indigoLight, borderRadius: 7, padding: '5px 7px' }}>{resource.chapterTitle} · {resource.resourceRole.replaceAll('_', ' ')}</div>)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                          <button type="button" onClick={() => {
                            const params = new URLSearchParams({
                              schemeId: item.id,
                              classId: selectedClass ?? '',
                              subjectId: selectedSubject ?? '',
                              grade: selectedClassObj?.grade ?? '',
                              subject: selectedSubjectObj?.label ?? '',
                              strand: item.strand ?? '',
                              topic: item.topic,
                              week: String(selectedWeek),
                              term: String(selectedTermObj?.term ?? 1),
                              ...(item.curriculum_id ? { curriculumId: item.curriculum_id } : {}),
                            })
                            router.push(`/teacher/scheme/generate?${params.toString()}`)
                          }} style={{ padding: '5px 8px', border: `1px solid ${C.border2}`, borderRadius: 7, background: '#fff', color: C.indigo, fontSize: 11, fontWeight: 700 }}>Lesson Plan →</button>
                          <span style={{ padding: '4px 8px', borderRadius: 99, background: style.bg, color: style.color, border: `1px solid ${style.border}`, fontSize: 10, fontWeight: 800 }}>{style.label}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                        {PROGRESSION_STATUSES.map(status => <button key={status} type="button" disabled={isSaving} onClick={() => void updateStatus(item.id, status)} style={{ padding: '5px 9px', borderRadius: 99, border: `1px solid ${STATUS_STYLE[status].border}`, background: item.status === status ? STATUS_STYLE[status].bg : '#fff', color: STATUS_STYLE[status].color, fontSize: 10, fontWeight: 700 }}>{STATUS_STYLE[status].label}</button>)}
                        <button type="button" disabled={isSaving} onClick={() => void updateStatus(item.id, 'cancelled')} style={{ padding: '5px 9px', borderRadius: 99, border: `1px solid ${STATUS_STYLE.cancelled.border}`, background: item.status === 'cancelled' ? STATUS_STYLE.cancelled.bg : '#fff', color: STATUS_STYLE.cancelled.color, fontSize: 10, fontWeight: 700 }}>Cancel</button>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 9 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: C.text3 }}>Lesson number</label>
                        <input type="number" min={1} defaultValue={item.lesson_number ?? ''} onBlur={event => void updateLessonNumber(item.id, event.target.value ? Number.parseInt(event.target.value, 10) : null)} style={{ width: 58, padding: '5px 7px', borderRadius: 7, border: `1px solid ${C.border2}` }} />
                      </div>
                      <textarea defaultValue={item.reflection ?? ''} onBlur={event => void updateReflection(item.id, event.target.value)} placeholder="Reflection after teaching" rows={2} style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 8, border: `1px solid ${C.border2}`, fontFamily: 'inherit' }} />
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: 'pointer', color: C.indigo, fontSize: 10, fontWeight: 800 }}>Professional Scheme fields</summary>
                        <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
                          {([
                            ['key_inquiry_question', 'Key inquiry question'],
                            ['learning_experiences', 'Learning experiences'],
                            ['learning_resources', 'Learning resources'],
                            ['assessment_methods', 'Assessment methods'],
                          ] as const).map(([field, label]) => <label key={field} style={{ fontSize: 10, color: C.text2 }}>{label}<textarea defaultValue={item[field] ?? ''} onBlur={event => void updateOverride(item.id, field, event.target.value)} rows={2} style={{ width: '100%', marginTop: 3, padding: 7, borderRadius: 7, border: `1px solid ${C.border2}`, fontFamily: 'inherit' }} /></label>)}
                        </div>
                      </details>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.text, marginBottom: 8 }}>Add a teacher-created lesson</div>
          {ebookSuggestions.length > 0 && <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 8 }}>{ebookSuggestions.map(resource => <button key={resource.resourceId} type="button" onClick={() => { setSelectedSchemeResource(resource); setNewTopicName(resource.chapterTitle); setNewStrandName(resource.strandName) }} style={{ minWidth: 170, textAlign: 'left', padding: 8, borderRadius: 8, border: `1px solid ${selectedSchemeResource?.resourceId === resource.resourceId ? C.indigo : C.border}`, background: selectedSchemeResource?.resourceId === resource.resourceId ? C.indigoLight : '#fff', fontSize: 10 }}>{resource.chapterTitle}<br/><span style={{ color: C.text3 }}>{resource.publicationTitle}</span></button>)}</div>}
          <div style={{ display: 'grid', gap: 7 }}>
            <input value={newTopicName} onChange={event => { setNewTopicName(event.target.value); setSelectedSchemeResource(null) }} placeholder="Lesson focus" style={{ padding: 9, borderRadius: 8, border: `1px solid ${C.border2}` }} />
            <input value={newStrandName} onChange={event => setNewStrandName(event.target.value)} placeholder="Strand (optional)" style={{ padding: 9, borderRadius: 8, border: `1px solid ${C.border2}` }} />
            <button type="button" disabled={addCustomBusy || !newTopicName.trim()} onClick={() => void addCustomItem()} style={{ padding: 9, borderRadius: 8, border: 'none', background: C.dark, color: '#fff', fontWeight: 700, cursor: addCustomBusy ? 'not-allowed' : 'pointer' }}>{addCustomBusy ? 'Adding…' : `Add to Week ${selectedWeek}`}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AuthoritySchemePage() {
  return (
    <Suspense fallback={<EmptyState icon="…" title="Loading Scheme" desc="Resolving Scheme authority." />}>
      <SchemePageInner />
    </Suspense>
  )
}
