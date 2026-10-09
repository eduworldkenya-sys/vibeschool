"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams }                        from 'next/navigation'
import { supabase }                               from '@/lib/supabase'
import { ensureMyActiveSchoolTerm } from '@/lib/academicTerm'
import { resolveGlobalSubjectId } from '@/lib/curriculum/globalSubjects'
import { Card, C }                                from '@/components/teacher/ui'
import {
  ArrowLeft, BarChart3, BookOpen, Check, ChevronDown, ClipboardCheck,
  FileQuestion, FileText, Layers3, MoreHorizontal,
  Search, Sparkles, Users, X,
} from 'lucide-react'
import styles from './assessment.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassOption   { id: string; name: string; stream: string }
interface SubjectOption { id: string; name: string }
interface StrandOption  { id: string; name: string }
interface Student       { id: string; name: string }
interface TeachingContext { class_id: string; class_name: string; stream?: string | null; subject_id: string; subject_name: string }

type PerformanceLevel =
  | 'exceeds_expectation'
  | 'meets_expectation'
  | 'approaches_expectation'
  | 'below_expectation'

interface Assessment {
  id:              string
  student_id:      string
  strand_id:       string
  sub_strand:      string | null
  assessment_type: string
  performance:     PerformanceLevel
  term:            number
  academic_year:   number
  notes:           string | null
  created_at:      string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERFORMANCE_OPTIONS: ReadonlyArray<{
  value: PerformanceLevel
  label: string
  short: string
  color: string
  bg: string
}> = [
  { value: 'exceeds_expectation',    label: 'Exceeds Expectation',    short: 'EE', color: '#065f46', bg: '#d1fae5' },
  { value: 'meets_expectation',      label: 'Meets Expectation',      short: 'ME', color: '#1e40af', bg: '#dbeafe' },
  { value: 'approaches_expectation', label: 'Approaches Expectation', short: 'AE', color: '#92400e', bg: '#fef3c7' },
  { value: 'below_expectation',      label: 'Below Expectation',      short: 'BE', color: '#991b1b', bg: '#fee2e2' },
]

const ASSESSMENT_TYPES = ['formative', 'summative', 'project']

function perfMeta(value: string) {
  return PERFORMANCE_OPTIONS.find(p => p.value === value) ?? PERFORMANCE_OPTIONS[1]
}

// Aggregate: most frequent performance level wins; tie goes to higher level
function aggregatePerf(entries: Assessment[]): string | null {
  if (entries.length === 0) return null
  const order: readonly PerformanceLevel[] = ['exceeds_expectation', 'meets_expectation', 'approaches_expectation', 'below_expectation']
  const counts: Record<string, number> = {}
  for (const a of entries) counts[a.performance] = (counts[a.performance] ?? 0) + 1
  let best = entries[0].performance
  let bestCount = 0
  for (const level of order) {
    const c = counts[level] ?? 0
    if (c > bestCount) { bestCount = c; best = level }
  }
  return best
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ h = 56 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: '32px 0', color: C.textMuted, fontSize: 13 }}>
        <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>{icon}</span>
        {message}
      </div>
    </Card>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function AssessmentInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [teacherId,        setTeacherId]        = useState<string | null>(null)
  const [syncPromptStrand, setSyncPromptStrand] = useState<string | null>(null)
  const [syncing,          setSyncing]           = useState(false)
  const [schoolId,         setSchoolId]         = useState<string | null>(null)
  const [classes,          setClasses]          = useState<ClassOption[]>([])
  const [subjects,         setSubjects]         = useState<SubjectOption[]>([])
  const [teachingContexts, setTeachingContexts] = useState<TeachingContext[]>([])
  const [strands,          setStrands]          = useState<StrandOption[]>([])
  const [students,         setStudents]         = useState<Student[]>([])
  const [assessments,      setAssessments]      = useState<Assessment[]>([])
  const [activeClassIdx,   setActiveClassIdx]   = useState(0)
  const [activeSubjectIdx, setActiveSubjectIdx] = useState(0)
  const [selectedTerm,     setSelectedTerm]     = useState(1)
  const [loading,          setLoading]          = useState(true)
  const [dataLoading,      setDataLoading]      = useState(false)
  const [learnerQuery, setLearnerQuery] = useState('')
  const [performanceFilter, setPerformanceFilter] = useState<PerformanceLevel | 'all' | 'none'>('all')
  const [error,            setError]            = useState<string | null>(null)

  // Record/edit modal
  const [modalStudent,  setModalStudent]  = useState<Student | null>(null)
  const [viewMode,      setViewMode]      = useState(false)
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [selStrand,     setSelStrand]     = useState('')
  const [selSubStrand,  setSelSubStrand]  = useState('')
  const [selType,       setSelType]       = useState('formative')
  const [selPerf,       setSelPerf]       = useState<PerformanceLevel | ''>('')
  const [selNotes,      setSelNotes]      = useState('')
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState<string | null>(null)
  const [deletingId,    setDeletingId]    = useState<string | null>(null)

  // Bulk mode
  const [bulkMode,      setBulkMode]      = useState(false)
  const [bulkStrand,    setBulkStrand]    = useState('')
  const [bulkSubStrand, setBulkSubStrand] = useState('')
  const [bulkType,      setBulkType]      = useState('formative')
  const [bulkPerf,      setBulkPerf]      = useState<PerformanceLevel | ''>('')
  const [bulkNotes,     setBulkNotes]     = useState('')
  const [bulkSelected,  setBulkSelected]  = useState<Set<string>>(new Set())
  const [bulkSaving,    setBulkSaving]    = useState(false)
  const [bulkError,     setBulkError]     = useState<string | null>(null)
  const [bulkDone,      setBulkDone]      = useState(false)
  const [bulkEditorOpen,setBulkEditorOpen]= useState(false)

  // Report/export modal
  const [reportStudent, setReportStudent] = useState<Student | null>(null)

  const loadIdRef = useRef(0)

  useEffect(() => {
    document.body.style.overflow = (modalStudent || reportStudent) ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [modalStudent, reportStudent])

  useEffect(() => { boot() }, [])

  async function boot() {
    setLoading(true)
    setError(null)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) { setError('Not signed in.'); setLoading(false); return }
    setTeacherId(user.id)

    // Assessment must consume the same server-authoritative assignment
    // projection as SubjectHub, Scheme, Attendance and Results. Independent
    // teacher_classes/classes/subjects reads can turn valid assignments into
    // false empty states when one nested RLS read is hidden.
    const contextRes = await supabase.rpc('teacher_get_operating_context')
    if (contextRes.error) { setError('Teacher operating context could not be loaded.'); setLoading(false); return }
    const context = contextRes.data as {
      school_id?: string | null
      classes?: Array<{ class_id: string; class_name: string; stream?: string | null; subject_id: string; subject_name: string }>
    } | null
    const sid = context?.school_id ?? null
    setSchoolId(sid)
    if (!sid) { setLoading(false); return }

    const assignments = (context?.classes ?? []) as TeachingContext[]
    if (assignments.length === 0) { setLoading(false); return }

    const loadedClasses = Array.from(new Map(assignments.map(a => [
      a.class_id,
      { id: a.class_id, name: a.class_name, stream: a.stream ?? '' },
    ])).values()) as ClassOption[]
    const urlClassId   = searchParams.get('classId')
    const urlSubjectId = searchParams.get('subjectId')
    let ci = 0
    if (urlClassId)   { const i = loadedClasses.findIndex(c => c.id === urlClassId);    if (i !== -1) ci = i }
    const loadedSubjects = subjectsForClass(assignments, loadedClasses[ci]?.id)
    let si = 0
    if (urlSubjectId) { const i = loadedSubjects.findIndex(s => s.id === urlSubjectId); if (i !== -1) si = i }

    setTeachingContexts(assignments)
    setClasses(loadedClasses)
    setSubjects(loadedSubjects)
    setActiveClassIdx(ci)
    setActiveSubjectIdx(si)
    setLoading(false)
  }

  const activeClassId   = classes[activeClassIdx]?.id   ?? null
  const activeSubjectId = subjects[activeSubjectIdx]?.id ?? null

  function subjectsForClass(contexts: TeachingContext[], classId?: string): SubjectOption[] {
    return Array.from(new Map(contexts.filter(a => a.class_id === classId).map(a => [a.subject_id, { id: a.subject_id, name: a.subject_name }])).values())
  }

  function selectClass(index: number) {
    const nextClassId = classes[index]?.id
    setActiveClassIdx(index)
    setSubjects(subjectsForClass(teachingContexts, nextClassId))
    setActiveSubjectIdx(0)
  }

  useEffect(() => {
    if (!activeClassId || !activeSubjectId) return
    const thisLoad = ++loadIdRef.current
    loadData(thisLoad, activeClassId, activeSubjectId)
    setBulkMode(false)
    setBulkSelected(new Set())
    setBulkDone(false)
  }, [activeClassId, activeSubjectId, selectedTerm, schoolId])

  async function loadData(loadId: number, classId: string, subjectId: string) {
    setDataLoading(true)
    setStrands([]); setStudents([]); setAssessments([])
    const currentYear = new Date().getFullYear()

    const cls = classes.find(c => c.id === classId)

    // cbc_strands (national KICD reference) is the single source of
    // strand identity — see migration 20260709120000. Resolved via the
    // GLOBAL subject row (school_id IS NULL), not the school's own local
    // subject_id — cbc_strands is anchored to the national taxonomy.
    // TBL-010C: crosses via the FK bridge (subjects.global_subject_id),
    // not a name match — subjectId is already this school's subject id.
    const globalSubjectId = await resolveGlobalSubjectId(subjectId)

    const [strandsRes, scRes] = await Promise.all([
      cls && globalSubjectId
        ? supabase.from('cbc_strands').select('id, name').eq('subject_id', globalSubjectId).ilike('grade', cls.name).order('name')
        : Promise.resolve({ data: [], error: null }),
      supabase.from('student_classes').select('student_id').eq('school_id', schoolId!).eq('class_id', classId).eq('is_current', true),
    ])

    if (loadId !== loadIdRef.current) return

    if (strandsRes.error) {
      console.error('[Assessment] strands load failed', strandsRes.error)
    }
    const strandRows = strandsRes.error ? [] : (strandsRes.data ?? []) as StrandOption[]
    setStrands(strandRows)

    if (scRes.error) {
      setError('Class roster could not be loaded. Retry instead of treating this class as empty.')
      setDataLoading(false)
      return
    }
    const studentIds = Array.from(new Set((scRes.data ?? []).map((r: { student_id: string }) => r.student_id)))
    if (studentIds.length === 0) { setStudents([]); setAssessments([]); setDataLoading(false); return }

    const studentsPromise = supabase.from('students').select('id, name').in('id', studentIds)
    const assessPromise   = schoolId
      ? supabase.from('cbc_assessments')
          .select('id, student_id, strand_id, sub_strand, assessment_type, performance, term, academic_year, notes, created_at')
          .eq('class_id', classId).eq('subject_id', subjectId)
          .eq('term', selectedTerm).eq('academic_year', currentYear)
          .eq('school_id', schoolId).in('student_id', studentIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null })

    const [studentsRes, assessRes] = await Promise.all([studentsPromise, assessPromise])
    if (loadId !== loadIdRef.current) return

    if (studentsRes.error) {
      setError('Learner identities could not be loaded. Retry instead of treating this class as empty.')
      setDataLoading(false)
      return
    }
    if (assessRes.error) {
      setError('Assessment records could not be loaded.')
      setDataLoading(false)
      return
    }
    setStudents(((studentsRes.data ?? []) as Student[]).sort((a, b) => a.name.localeCompare(b.name)))
    setAssessments((assessRes.data ?? []) as Assessment[])
    setDataLoading(false)
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openRecord(student: Student) {
    setModalStudent(student); setViewMode(false); setEditingId(null)
    setSelStrand(''); setSelSubStrand(''); setSelType('formative')
    setSelPerf(''); setSelNotes(''); setSaveError(null); setSaving(false)
  }

  function openHistory(student: Student) {
    setModalStudent(student); setViewMode(true); setSaveError(null); setEditingId(null)
  }

  function openEdit(a: Assessment) {
    setViewMode(false); setEditingId(a.id)
    setSelStrand(a.strand_id); setSelSubStrand(a.sub_strand ?? '')
    setSelType(a.assessment_type); setSelPerf(a.performance)
    setSelNotes(a.notes ?? ''); setSaveError(null); setSaving(false)
  }

  function closeModal() { setModalStudent(null); setSaveError(null); setSaving(false); setEditingId(null) }

  // ── Save (insert or update) ────────────────────────────────────────────────

  // Same week-derivation formula as Scheme's currentWeekOf — keeps scheme sync week-consistent
  async function syncStrandProgress(strandId: string) {
    if (!teacherId || !activeClassId || !activeSubjectId || !schoolId) return
    setSyncing(true)
    try {
      await ensureMyActiveSchoolTerm()

      const { data: termRow } = await supabase
        .from('academic_terms')
        .select('id, start_date, end_date, term')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .single()
      if (!termRow) { setSyncing(false); setSyncPromptStrand(null); return }
      const start = new Date(termRow.start_date)
      const end = new Date(termRow.end_date)
      const totalWeeks = isNaN(start.getTime()) || isNaN(end.getTime())
        ? 13
        : Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)))
      const now = Date.now()
      const week = now < start.getTime()
        ? 1
        : Math.max(1, Math.min(Math.floor((now - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1, totalWeeks))

      // Assessing a strand this week means its scheme items are at least
      // "teaching" — promote planned items only, never regress done/cancelled.
      // Bridge is by strand NAME until assessments carry scheme identity natively.
      const name = strandName(strandId)
      if (name !== 'Unknown strand') {
        await supabase.from('scheme_of_work')
          .update({ status: 'teaching' })
          .eq('teacher_id',       teacherId)
          .eq('class_id',         activeClassId)
          .eq('subject_id',       activeSubjectId)
          .eq('academic_term_id', termRow.id)
          .eq('school_id',        schoolId)
          .eq('week',             week)
          .eq('status',           'planned')
          .ilike('strand',        name)
      }
    } catch {
      // Non-blocking — assessment already saved successfully regardless of sync outcome
    }
    setSyncing(false)
    setSyncPromptStrand(null)
  }

  async function saveAssessment() {
    if (saving) return
    if (!selStrand)       { setSaveError('Select a strand'); return }
    if (!selPerf)         { setSaveError('Select a performance level'); return }
    if (!teacherId)       { setSaveError('Not signed in'); return }
    if (!schoolId)        { setSaveError("Your profile isn't linked to a school yet."); return }
    if (!activeClassId)   { setSaveError('No class selected'); return }
    if (!activeSubjectId) { setSaveError('No subject selected'); return }
    if (!modalStudent)    return

    const currentYear = new Date().getFullYear()
    setSaving(true); setSaveError(null)

    // ── Edit existing ──
    if (editingId) {
      const { data, error: updErr } = await supabase
        .from('cbc_assessments')
        .update({
          strand_id:       selStrand,
          sub_strand:      selSubStrand.trim() || null,
          assessment_type: selType,
          performance:     selPerf,
          notes:           selNotes.trim() || null,
        })
        .eq('id', editingId)
        .select('id, student_id, strand_id, sub_strand, assessment_type, performance, term, academic_year, notes, created_at')
        .single()

      if (updErr || !data) { setSaveError(updErr?.message ?? 'Failed to update'); setSaving(false); return }
      setAssessments(prev => prev.map(a => a.id === editingId ? (data as Assessment) : a))
      closeModal()
      return
    }

    // ── New insert ──
    const dup = assessments.find(a =>
      a.student_id === modalStudent.id && a.strand_id === selStrand &&
      a.assessment_type === selType && a.term === selectedTerm && a.academic_year === currentYear
    )
    if (dup) { setSaveError(`A ${selType} assessment for this strand already exists. Edit it instead.`); setSaving(false); return }

    const { data, error: saveErr } = await supabase
      .from('cbc_assessments')
      .insert({
        student_id: modalStudent.id, teacher_id: teacherId,
        class_id: activeClassId, subject_id: activeSubjectId,
        strand_id: selStrand, sub_strand: selSubStrand.trim() || null,
        assessment_type: selType, performance: selPerf,
        term: selectedTerm, academic_year: currentYear,
        school_id: schoolId, notes: selNotes.trim() || null,
      })
      .select('id, student_id, strand_id, sub_strand, assessment_type, performance, term, academic_year, notes, created_at')
      .single()

    if (saveErr || !data) { setSaveError(saveErr?.message ?? 'Failed to save'); setSaving(false); return }
    setAssessments(prev => [data as Assessment, ...prev])
    const savedStrandId = selStrand
    closeModal()
    // Hybrid: offer to sync curriculum progress — teacher confirms, nothing writes automatically
    setSyncPromptStrand(savedStrandId)
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function deleteAssessment(id: string) {
    setDeletingId(id)
    const { error: delErr } = await supabase.from('cbc_assessments').delete().eq('id', id)
    if (!delErr) setAssessments(prev => prev.filter(a => a.id !== id))
    setDeletingId(null)
  }

  // ── Bulk save ──────────────────────────────────────────────────────────────

  async function saveBulk(): Promise<boolean> {
    if (bulkSaving) return false
    if (!bulkStrand)             { setBulkError('Select a strand'); return false }
    if (!bulkPerf)               { setBulkError('Select a performance level'); return false }
    if (bulkSelected.size === 0) { setBulkError('Select at least one learner'); return false }
    if (!schoolId)               { setBulkError("Profile isn't linked to a school yet."); return false }
    if (!teacherId || !activeClassId || !activeSubjectId) return false

    setBulkSaving(true); setBulkError(null)
    const currentYear = new Date().getFullYear()
    const rows = Array.from(bulkSelected)
      .filter(sid => !assessments.find(a =>
        a.student_id === sid && a.strand_id === bulkStrand &&
        a.assessment_type === bulkType && a.term === selectedTerm && a.academic_year === currentYear
      ))
      .map(sid => ({
        student_id: sid, teacher_id: teacherId,
        class_id: activeClassId, subject_id: activeSubjectId,
        strand_id: bulkStrand, sub_strand: bulkSubStrand.trim() || null,
        assessment_type: bulkType, performance: bulkPerf,
        term: selectedTerm, academic_year: currentYear,
        school_id: schoolId, notes: bulkNotes.trim() || null,
      }))

    if (rows.length === 0) { setBulkError('These learners already have this assessment.'); setBulkSaving(false); return false }

    const { data, error: bulkErr } = await supabase
      .from('cbc_assessments')
      .insert(rows)
      .select('id, student_id, strand_id, sub_strand, assessment_type, performance, term, academic_year, notes, created_at')

    if (bulkErr || !data) { setBulkError(bulkErr?.message ?? 'Failed to save'); setBulkSaving(false); return false }
    setAssessments(prev => [...(data as Assessment[]), ...prev])
    setBulkSelected(new Set()); setBulkDone(true); setBulkSaving(false)
    setBulkStrand(''); setBulkPerf(''); setBulkNotes(''); setBulkSubStrand('')
    return true
  }

  // ── Derived helpers ────────────────────────────────────────────────────────

  function studentHistory(studentId: string): Assessment[] {
    return assessments.filter(a => a.student_id === studentId)
  }

  function aggregateBadge(studentId: string) {
    const entries = studentHistory(studentId)
    const perf    = aggregatePerf(entries)
    return perf ? perfMeta(perf) : null
  }

  function strandName(id: string): string {
    return strands.find(s => s.id === id)?.name ?? 'Unknown strand'
  }

  function exportText(student: Student): string {
    const history = studentHistory(student.id)
    const cls     = classes[activeClassIdx]
    const sub     = subjects[activeSubjectIdx]
    const lines   = [
      `ASSESSMENT REPORT`,
      `Student : ${student.name}`,
      `Class   : ${cls ? cls.name + (cls.stream ? ' ' + cls.stream : '') : '—'}`,
      `Subject : ${sub?.name ?? '—'}`,
      `Term    : ${selectedTerm}`,
      `Year    : ${new Date().getFullYear()}`,
      ``,
      ...history.map(a =>
        `• ${strandName(a.strand_id)}${a.sub_strand ? ' / ' + a.sub_strand : ''} — ${perfMeta(a.performance).short} (${a.assessment_type})${a.notes ? '\n  Note: ' + a.notes : ''}`
      ),
      ``,
      `Overall : ${aggregatePerf(history) ? perfMeta(aggregatePerf(history)!).label : 'No data'}`,
    ]
    return lines.join('\n')
  }

  async function copyReport(student: Student) {
    await navigator.clipboard.writeText(exportText(student))
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className={styles.page} aria-label="Loading assessment workspace" aria-busy="true">
      <div style={{ paddingTop: 20, display: 'grid', gap: 12 }}>
        <Skeleton h={34} /><Skeleton h={58} /><Skeleton h={72} /><Skeleton h={82} /><Skeleton h={64} /><Skeleton h={64} />
      </div>
    </div>
  )

  if (error) return (
    <div className={styles.error} role="alert">
      <strong>Assessment could not load</strong>
      <span>{error}</span>
      <button type="button" className={styles.primaryButton} onClick={() => void boot()}>Try again</button>
    </div>
  )

  if (classes.length === 0) return (
    <div className={styles.page}>
      <div className={styles.top}><div><p className={styles.eyebrow}>Teacher workspace</p><h1 className={styles.title}>Assessment</h1></div></div>
      <div className={styles.empty}><Users size={30} /><strong>No classes yet</strong><span>Connect a class before recording results.</span><button type="button" className={styles.primaryButton} style={{ marginTop: 16 }} onClick={() => router.push('/teacher/onboarding/class')}>Connect class</button></div>
    </div>
  )

  const activeClass   = classes[activeClassIdx]
  const activeSubject = subjects[activeSubjectIdx]

  // Student list enriched
  const studentRows = students.map(s => {
    const history = studentHistory(s.id)
    const badge   = aggregateBadge(s.id)
    return { ...s, history, badge, count: history.length }
  })

  const recordedCount = studentRows.filter(s => s.count > 0).length
  const filteredRows = studentRows.filter(s => {
    if (!s.name.toLocaleLowerCase().includes(learnerQuery.trim().toLocaleLowerCase())) return false
    if (performanceFilter === 'all') return true
    if (performanceFilter === 'none') return s.count === 0
    return s.badge?.value === performanceFilter
  })

  return (
    <section className={styles.page}>
      <header className={styles.top}>
        <div><p className={styles.eyebrow}>{activeClass.name}{activeClass.stream ? ` ${activeClass.stream}` : ''} · {activeSubject?.name}</p><h1 className={styles.title}>Assessment</h1></div>
        <button type="button" className={styles.iconButton} aria-label="Open class" onClick={() => router.push('/teacher/classhub/' + activeClassId)}><ArrowLeft size={19} /></button>
      </header>

      <section className={styles.context} aria-label="Assessment context">
        <label><span>Class</span><select aria-label="Select class" value={activeClassIdx} onChange={e => selectClass(Number(e.target.value))}>{classes.map((c,i)=><option key={c.id} value={i}>{c.name}{c.stream ? ` ${c.stream}` : ''}</option>)}</select><ChevronDown size={15}/></label>
        <label><span>Subject</span><select aria-label="Select subject" value={activeSubjectIdx < subjects.length ? activeSubjectIdx : 0} onChange={e => setActiveSubjectIdx(Number(e.target.value))} disabled={subjects.length<=1}>{subjects.map((s,i)=><option key={s.id} value={i}>{s.name}</option>)}</select><ChevronDown size={15}/></label>
        <label><span>Term</span><select aria-label="Select term" value={selectedTerm} onChange={e => setSelectedTerm(Number(e.target.value))}>{[1,2,3].map(t=><option key={t} value={t}>Term {t}</option>)}</select><ChevronDown size={15}/></label>
      </section>

      <nav className={styles.tools} aria-label="Assessment tools">
        <button className={styles.tool} onClick={() => router.push('/teacher/lessonplan')}><BookOpen size={21}/><span>Exercise</span></button>
        <button className={styles.tool} onClick={() => router.push('/teacher/lessonplan')}><ClipboardCheck size={21}/><span>Quiz</span></button>
        <button className={styles.tool} onClick={() => router.push('/teacher/assessment/cat/new')}><FileText size={21}/><span>CAT</span></button>
        <button className={styles.tool} onClick={() => router.push('/teacher/results')}><BarChart3 size={21}/><span>Exams</span></button>
      </nav>
      <div className={styles.secondaryTools}>
        <button className={styles.quietButton} onClick={() => router.push('/teacher/assessment/bank')}><FileQuestion size={16}/>Question bank</button>
        <button className={styles.quietButton} onClick={() => router.push('/teacher/progress')}><Layers3 size={16}/>Progress</button>
        <button className={styles.quietButton} style={{marginLeft:'auto'}} onClick={() => { setBulkMode(m=>!m); setBulkDone(false); setBulkSelected(new Set()); setBulkEditorOpen(false) }}><Check size={16}/>{bulkMode?'Cancel':'Select'}</button>
      </div>

      {syncPromptStrand && <section aria-live="polite" style={{marginTop:10,padding:'10px 12px',border:'1px solid #d8e5de',borderRadius:13,display:'flex',alignItems:'center',gap:8,fontSize:12}}><Sparkles size={16} color="#087d57"/><strong style={{flex:1}}>Update scheme progress?</strong><button disabled={syncing} className={styles.quietButton} onClick={() => void syncStrandProgress(syncPromptStrand)}>{syncing?'Updating…':'Update'}</button><button aria-label="Dismiss" className={styles.iconButton} style={{width:36,height:36}} onClick={() => setSyncPromptStrand(null)}><X size={16}/></button></section>}

      <section className={styles.overview} aria-label="Assessment overview">
        <div className={styles.heroMetric}><strong>{recordedCount}/{students.length}</strong><span>recorded</span></div>
        <button className={styles.metric} style={{textAlign:'left',background:'none',borderTop:0,borderRight:0,borderBottom:0,cursor:'pointer'}} onClick={() => setPerformanceFilter('none')}><strong>{students.length-recordedCount}</strong><span>missing</span></button>
        <button className={styles.metric} style={{textAlign:'left',background:'none',borderTop:0,borderRight:0,borderBottom:0,cursor:'pointer'}} onClick={() => setPerformanceFilter('below_expectation')}><strong>{studentRows.filter(s=>s.badge?.value==='below_expectation').length}</strong><span>follow-up</span></button>
      </section>

      <div className={styles.find}>
        <label className={styles.search}><Search size={18}/><input id="assessment-learner-search" type="search" value={learnerQuery} onChange={e=>setLearnerQuery(e.target.value)} placeholder="Find learner" aria-label="Find learner" /></label>
      </div>
      <div className={styles.filters} role="group" aria-label="Filter learners">
        {([{value:'all',short:`All ${students.length}`},...PERFORMANCE_OPTIONS,{value:'none',short:`Missing ${students.length-recordedCount}`} ] as const).map(option=><button type="button" key={option.value} aria-pressed={performanceFilter===option.value} onClick={()=>setPerformanceFilter(option.value)} className={`${styles.filterChip} ${performanceFilter===option.value?styles.filterChipActive:''}`}>{option.short}</button>)}
      </div>

      <div className={styles.listHeader}><strong>Learners</strong><span>{filteredRows.length} shown</span></div>
      <section className={styles.list} aria-label="Learners">
        {dataLoading ? [1,2,3,4].map(i=><div key={i} style={{padding:7}}><Skeleton h={52}/></div>) : filteredRows.length===0 ? <div className={styles.empty}><Users size={30}/><strong>{students.length===0?'No learners yet':'No matches'}</strong><span>{students.length===0?'Add learners from Class Hub.':'Try another search or filter.'}</span></div> : filteredRows.map(s=>{
          const isSelected=bulkSelected.has(s.id); const initials=s.name.split(/\s+/).map(p=>p[0]).join('').slice(0,2).toUpperCase()
          return <article key={s.id} className={`${styles.learner} ${isSelected?styles.learnerSelected:''}`}>
            {bulkMode && <button type="button" className={`${styles.checkbox} ${isSelected?styles.checkboxSelected:''}`} aria-label={`${isSelected?'Deselect':'Select'} ${s.name}`} aria-pressed={isSelected} onClick={()=>{setBulkSelected(prev=>{const next=new Set(prev);next.has(s.id)?next.delete(s.id):next.add(s.id);return next});setBulkDone(false)}}>{isSelected&&<Check size={14}/>}</button>}
            <div className={styles.avatar} style={{background:s.badge?s.badge.bg:'#eef2ef',color:s.badge?s.badge.color:'#59665e'}}>{s.badge?s.badge.short:initials}</div>
            <div className={styles.identity}><strong>{s.name}</strong><span>{s.count===0?'No record':`${s.badge?.label??'Recorded'} · ${s.count}`}</span></div>
            {!bulkMode && <div className={styles.rowActions}><button className={`${styles.rowAction} ${styles.recordAction}`} onClick={()=>openRecord(s)}>{s.count?'Update':'Record'}</button>{s.count>0&&<button className={`${styles.rowAction} ${styles.moreAction}`} aria-label={`More actions for ${s.name}`} onClick={()=>openHistory(s)}><MoreHorizontal size={20}/></button>}</div>}
          </article>
        })}
      </section>

      {bulkMode && <div className={styles.bulkBar} role="region" aria-label="Bulk assessment actions"><div><strong>{bulkSelected.size} selected</strong><span> · {filteredRows.length} shown</span></div><button type="button" disabled={bulkSelected.size===0} onClick={()=>setBulkEditorOpen(true)}>Record</button></div>}

      {bulkEditorOpen && <div style={overlayStyle} onClick={e=>{if(e.target===e.currentTarget)setBulkEditorOpen(false)}}><div style={sheetStyle} role="dialog" aria-modal="true" aria-label="Record for selected learners"><div className={styles.sheetTitle}><div><p className={styles.eyebrow}>{bulkSelected.size} learners</p><h2 style={{margin:0,fontSize:20}}>Record together</h2></div><button className={styles.iconButton} aria-label="Close" onClick={()=>setBulkEditorOpen(false)}><X size={19}/></button></div><div style={{display:'grid',gap:12,marginTop:18}}><select aria-label="Select strand" value={bulkStrand} onChange={e=>setBulkStrand(e.target.value)} style={selectStyle}><option value="">Select strand</option>{strands.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><input placeholder="Sub-strand (optional)" value={bulkSubStrand} onChange={e=>setBulkSubStrand(e.target.value)} style={inputStyle}/><div style={{display:'flex',gap:8}}>{ASSESSMENT_TYPES.map(t=><button key={t} onClick={()=>setBulkType(t)} className={styles.filterChip} style={bulkType===t?{borderColor:'#087d57',color:'#087d57'}:undefined}>{t}</button>)}</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>{PERFORMANCE_OPTIONS.map(p=><button key={p.value} onClick={()=>setBulkPerf(p.value)} style={{minHeight:48,borderRadius:12,border:`2px solid ${bulkPerf===p.value?p.color:'#e5e7eb'}`,background:bulkPerf===p.value?p.bg:'#fff',color:p.color,fontWeight:800}}>{p.short} <small>{p.label}</small></button>)}</div><textarea placeholder="Note (optional)" value={bulkNotes} onChange={e=>setBulkNotes(e.target.value)} rows={2} style={{...inputStyle,resize:'none'}}/>{bulkError&&<p role="alert" style={{color:'#991b1b',fontSize:12,margin:0}}>{bulkError}</p>}{bulkDone&&<p style={{color:'#087d57',fontSize:12,margin:0}}>Saved</p>}<button className={styles.primaryButton} disabled={bulkSaving} onClick={async()=>{if(await saveBulk()){setBulkEditorOpen(false);setBulkMode(false)}}}>{bulkSaving?'Saving…':`Save ${bulkSelected.size} records`}</button></div></div></div>}

      {/* ════════════════════════════════════════════════════════
          RECORD / EDIT MODAL
      ════════════════════════════════════════════════════════ */}
      {modalStudent && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div style={sheetStyle}>

            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--teacher-border, #dfe5de)", margin: '0 auto 16px' }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0a0a0a' }}>
                  {viewMode ? 'History' : editingId ? 'Edit assessment' : 'New assessment'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: "var(--teacher-muted, #627168)" }}>{modalStudent.name}</p>
              </div>
              <div style={{display:'flex',gap:6}}>
                {viewMode && <button className={styles.quietButton} onClick={()=>{setReportStudent(modalStudent);closeModal()}}><FileText size={16}/>Report</button>}
                <button aria-label="Close" className={styles.iconButton} style={{width:40,height:40}} onClick={closeModal}><X size={18}/></button>
              </div>
            </div>

            {/* ── History view ── */}
            {viewMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
                {studentHistory(modalStudent.id).length === 0
                  ? <EmptyState icon="📭" message="No assessments for this term." />
                  : studentHistory(modalStudent.id).map(a => {
                      const pm = perfMeta(a.performance)
                      return (
                        <div key={a.id} style={{ padding: '12px 14px', borderRadius: 14, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0a0a0a' }}>{strandName(a.strand_id)}</p>
                              {a.sub_strand && <p style={{ margin: '2px 0 0', fontSize: 12, color: "var(--teacher-muted, #627168)" }}>{a.sub_strand}</p>}
                              <p style={{ margin: '4px 0 0', fontSize: 11, color: "var(--teacher-muted, #627168)" }}>{a.assessment_type} · Term {a.term}</p>
                              {a.notes && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#374151', fontStyle: 'italic' }}>"{a.notes}"</p>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                              <span style={{
                                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                                background: pm.bg, color: pm.color,
                              }}>{pm.short}</span>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => openEdit(a)} style={iconBtn('#dbeafe', '#1e40af')} title="Edit">✏️</button>
                                <button onClick={() => deleteAssessment(a.id)} disabled={deletingId === a.id} style={iconBtn('#fee2e2', '#991b1b')} title="Delete">
                                  {deletingId === a.id ? '…' : '🗑'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                }
              </div>
            ) : (
              /* ── Record / Edit form ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Strand */}
                <div>
                  <label style={labelStyle}>Strand *</label>
                  <select value={selStrand} onChange={e => setSelStrand(e.target.value)} style={selectStyle}>
                    <option value="">— Select strand —</option>
                    {strands.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Sub-strand */}
                <div>
                  <label style={labelStyle}>Sub-strand (optional)</label>
                  <input
                    placeholder="e.g. Listening and Speaking"
                    value={selSubStrand}
                    onChange={e => setSelSubStrand(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                {/* Type */}
                <div>
                  <label style={labelStyle}>Assessment Type *</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {ASSESSMENT_TYPES.map(t => (
                      <button key={t} onClick={() => setSelType(t)} style={{
                        flex: 1, padding: '8px 0', borderRadius: 10, border: '1.5px solid',
                        cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        borderColor: selType === t ? '#10b981' : '#e5e7eb',
                        background:  selType === t ? '#d1fae5' : '#fafafa',
                        color:       selType === t ? '#065f46' : '#6b7280',
                      }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                    ))}
                  </div>
                </div>

                {/* Performance */}
                <div>
                  <label style={labelStyle}>Performance Level *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {PERFORMANCE_OPTIONS.map(p => (
                      <button key={p.value} onClick={() => setSelPerf(p.value)} style={{
                        padding: '10px 6px', borderRadius: 12, border: '2px solid',
                        cursor: 'pointer', fontSize: 11, fontWeight: 700, textAlign: 'center',
                        borderColor: selPerf === p.value ? p.color : '#e5e7eb',
                        background:  selPerf === p.value ? p.bg   : '#fff',
                        color:       selPerf === p.value ? p.color : '#6b7280',
                      }}>{p.short}<br /><span style={{ fontSize: 11, fontWeight: 500 }}>{p.label}</span></button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label style={labelStyle}>Notes (optional)</label>
                  <textarea
                    placeholder="Observation or comment…"
                    value={selNotes}
                    onChange={e => setSelNotes(e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, resize: 'none' }}
                  />
                </div>

                {saveError && <p style={{ color: '#991b1b', fontSize: 12, margin: 0 }}>⚠️ {saveError}</p>}

                <button onClick={saveAssessment} disabled={saving} style={{
                  padding: '14px 0', borderRadius: 14, border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700,
                  background: saving ? '#d1d5db' : '#10b981', color: '#fff',
                }}>
                  {saving ? 'Saving…' : editingId ? 'Update Assessment' : 'Save Assessment'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          REPORT MODAL
      ════════════════════════════════════════════════════════ */}
      {reportStudent && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setReportStudent(null) }}>
          <div style={sheetStyle}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--teacher-border, #dfe5de)", margin: '0 auto 16px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0a0a0a' }}>📄 Report</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: "var(--teacher-muted, #627168)" }}>{reportStudent.name}</p>
              </div>
              <button onClick={() => setReportStudent(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: "var(--teacher-muted, #627168)", padding: 4 }}>×</button>
            </div>

            {/* Aggregate badge */}
            {(() => {
              const hist  = studentHistory(reportStudent.id)
              const agg   = aggregatePerf(hist)
              const pm    = agg ? perfMeta(agg) : null
              return pm ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: pm.bg, marginBottom: 14 }}>
                  <span style={{ fontSize: 24 }}>🏅</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: pm.color, fontWeight: 600 }}>OVERALL PERFORMANCE</p>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: pm.color }}>{pm.label}</p>
                  </div>
                </div>
              ) : null
            })()}

            {/* Strand breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '45vh', overflowY: 'auto', marginBottom: 16 }}>
              {studentHistory(reportStudent.id).map(a => {
                const pm = perfMeta(a.performance)
                return (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0a0a0a' }}>{strandName(a.strand_id)}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: "var(--teacher-muted, #627168)" }}>{a.assessment_type}{a.sub_strand ? ' · ' + a.sub_strand : ''}</p>
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800, background: pm.bg, color: pm.color }}>{pm.short}</span>
                  </div>
                )
              })}
            </div>

            {/* Copy button */}
            <button onClick={() => copyReport(reportStudent)} style={{
              width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: 700,
              background: '#0a0a0a', color: '#fff',
            }}>
              📋 Copy Report as Text
            </button>
          </div>
        </div>
      )}

      {/* shimmer keyframe */}
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </section>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  zIndex: 1000, display: 'flex', alignItems: 'flex-end',
}

const sheetStyle: React.CSSProperties = {
  width: '100%', maxHeight: '90vh', overflowY: 'auto',
  background: '#fff', borderRadius: '20px 20px 0 0',
  padding: '16px 16px 40px',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#374151', marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid #e5e7eb', fontSize: 13, color: '#0a0a0a',
  background: '#fafafa', outline: 'none', boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid #e5e7eb', fontSize: 13, color: '#0a0a0a',
  background: '#fafafa', outline: 'none', boxSizing: 'border-box',
  appearance: 'none',
}

function iconBtn(bg: string, color: string): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: 8, border: 'none',
    cursor: 'pointer', fontSize: 14, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: bg, color,
  }
}

// ─── Export ────────────────────────────────────────────────────────────────────

export default function AssessmentPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <AssessmentInner />
    </Suspense>
  )
}
