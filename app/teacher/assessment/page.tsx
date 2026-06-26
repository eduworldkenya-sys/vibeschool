"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams }                        from 'next/navigation'
import { supabase }                               from '@/lib/supabase'
import { Card, C }                                from '@/components/teacher/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassOption   { id: string; name: string; stream: string }
interface SubjectOption { id: string; name: string }
interface StrandOption  { id: string; name: string; sub_strand: string; topic: string }
interface Student       { id: string; name: string }

interface Assessment {
  id:              string
  student_id:      string
  strand_id:       string
  sub_strand:      string | null
  assessment_type: string
  performance:     string
  term:            number
  academic_year:   number
  notes:           string | null
  created_at:      string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERFORMANCE_OPTIONS = [
  { value: 'exceeds_expectation',    label: 'Exceeds Expectation',    short: 'EE', color: '#065f46', bg: '#d1fae5' },
  { value: 'meets_expectation',      label: 'Meets Expectation',      short: 'ME', color: '#1e40af', bg: '#dbeafe' },
  { value: 'approaches_expectation', label: 'Approaches Expectation', short: 'AE', color: '#92400e', bg: '#fef3c7' },
  { value: 'below_expectation',      label: 'Below Expectation',      short: 'BE', color: '#991b1b', bg: '#fee2e2' },
]

const ASSESSMENT_TYPES = ['Formative', 'Summative', 'Project']
const AMBER_DARK  = '#92400e'
const AMBER_MID   = '#f59e0b'
const AMBER_LIGHT = '#fef3c7'

function perfMeta(value: string) {
  return PERFORMANCE_OPTIONS.find(p => p.value === value) ?? PERFORMANCE_OPTIONS[1]
}

// Aggregate: most frequent performance level wins; tie goes to higher level
function aggregatePerf(entries: Assessment[]): string | null {
  if (entries.length === 0) return null
  const order = ['exceeds_expectation', 'meets_expectation', 'approaches_expectation', 'below_expectation']
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
  const [schoolId,         setSchoolId]         = useState<string | null>(null)
  const [classes,          setClasses]          = useState<ClassOption[]>([])
  const [subjects,         setSubjects]         = useState<SubjectOption[]>([])
  const [strands,          setStrands]          = useState<StrandOption[]>([])
  const [students,         setStudents]         = useState<Student[]>([])
  const [assessments,      setAssessments]      = useState<Assessment[]>([])
  const [activeClassIdx,   setActiveClassIdx]   = useState(0)
  const [activeSubjectIdx, setActiveSubjectIdx] = useState(0)
  const [selectedTerm,     setSelectedTerm]     = useState(1)
  const [loading,          setLoading]          = useState(true)
  const [dataLoading,      setDataLoading]      = useState(false)
  const [error,            setError]            = useState<string | null>(null)

  // Record/edit modal
  const [modalStudent,  setModalStudent]  = useState<Student | null>(null)
  const [viewMode,      setViewMode]      = useState(false)
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [selStrand,     setSelStrand]     = useState('')
  const [selSubStrand,  setSelSubStrand]  = useState('')
  const [selType,       setSelType]       = useState('Formative')
  const [selPerf,       setSelPerf]       = useState('')
  const [selNotes,      setSelNotes]      = useState('')
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState<string | null>(null)
  const [deletingId,    setDeletingId]    = useState<string | null>(null)

  // Bulk mode
  const [bulkMode,      setBulkMode]      = useState(false)
  const [bulkStrand,    setBulkStrand]    = useState('')
  const [bulkSubStrand, setBulkSubStrand] = useState('')
  const [bulkType,      setBulkType]      = useState('Formative')
  const [bulkPerf,      setBulkPerf]      = useState('')
  const [bulkNotes,     setBulkNotes]     = useState('')
  const [bulkSelected,  setBulkSelected]  = useState<Set<string>>(new Set())
  const [bulkSaving,    setBulkSaving]    = useState(false)
  const [bulkError,     setBulkError]     = useState<string | null>(null)
  const [bulkDone,      setBulkDone]      = useState(false)

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

    const [profileRes, teacherProfileRes, memberRes] = await Promise.all([
      supabase.from('profiles').select('school_id').eq('id', user.id).maybeSingle(),
      supabase.from('teacher_profiles').select('school_id').eq('profile_id', user.id).maybeSingle(),
      supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
    ])
    if (profileRes.error) { setError(profileRes.error.message); setLoading(false); return }
    const sid: string | null = memberRes.data?.school_id ?? teacherProfileRes.data?.school_id ?? profileRes.data?.school_id ?? null
    setSchoolId(sid)

    const tcRes = await supabase.from('teacher_classes').select('class_id, subject_id').eq('teacher_id', user.id)
    if (tcRes.error) { setError(tcRes.error.message); setLoading(false); return }

    const rows = tcRes.data ?? []
    const classIds   = Array.from(new Set(rows.map((r: { class_id: string | null })   => r.class_id).filter((x): x is string => !!x)))
    const subjectIds = Array.from(new Set(rows.map((r: { subject_id: string | null }) => r.subject_id).filter((x): x is string => !!x)))

    if (classIds.length === 0) { setLoading(false); return }

    const [classesRes, subjectsRes] = await Promise.all([
      supabase.from('classes').select('id, name, stream').in('id', classIds),
      subjectIds.length > 0
        ? supabase.from('subjects').select('id, name').in('id', subjectIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (classesRes.error)  { setError(classesRes.error.message);  setLoading(false); return }
    if (subjectsRes.error) { setError(subjectsRes.error.message); setLoading(false); return }

    const loadedClasses  = (classesRes.data  ?? []) as ClassOption[]
    const loadedSubjects = (subjectsRes.data ?? []) as SubjectOption[]

    const urlClassId   = searchParams.get('classId')
    const urlSubjectId = searchParams.get('subjectId')
    let ci = 0, si = 0
    if (urlClassId)   { const i = loadedClasses.findIndex(c => c.id === urlClassId);    if (i !== -1) ci = i }
    if (urlSubjectId) { const i = loadedSubjects.findIndex(s => s.id === urlSubjectId); if (i !== -1) si = i }

    setClasses(loadedClasses)
    setSubjects(loadedSubjects)
    setActiveClassIdx(ci)
    setActiveSubjectIdx(si)
    setLoading(false)
  }

  const activeClassId   = classes[activeClassIdx]?.id   ?? null
  const activeSubjectId = subjects[activeSubjectIdx]?.id ?? null

  useEffect(() => { setActiveSubjectIdx(0) }, [activeClassIdx])

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

    const clsRes = await supabase.from('classes').select('name').eq('id', classId).single()
    const grade  = clsRes.data?.name ?? ''
    const subRes = await supabase.from('subjects').select('name').eq('id', subjectId).single()
    const subjectName = subRes.data?.name ?? ''

    const [strandsRes, scRes] = await Promise.all([
      supabase.from('curriculum').select('id, strand, sub_strand, topic').eq('grade', grade).eq('subject', subjectName).order('strand'),
      supabase.from('student_classes').select('student_id').eq('class_id', classId).eq('is_current', true),
    ])

    if (loadId !== loadIdRef.current) return

    const seen = new Set()
    const uniqueStrands: StrandOption[] = []
    for (const r of (strandsRes.data ?? [])) {
      if (!seen.has(r.strand)) {
        seen.add(r.strand)
        uniqueStrands.push({ id: r.id, name: r.strand, sub_strand: r.sub_strand ?? '', topic: r.topic ?? '' })
      }
    }
    setStrands(strandsRes.error ? [] : uniqueStrands)

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

    setStudents(studentsRes.error ? [] : ((studentsRes.data ?? []) as Student[]).sort((a, b) => a.name.localeCompare(b.name)))
    setAssessments(assessRes.error ? [] : (assessRes.data ?? []) as Assessment[])
    setDataLoading(false)
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openRecord(student: Student) {
    setModalStudent(student); setViewMode(false); setEditingId(null)
    setSelStrand(''); setSelSubStrand(''); setSelType('Formative')
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

    // Session 5 — update learner_outcomes mastery
    const masteryStatus = ['exceeds_expectation','meets_expectation'].includes(selPerf) ? 'mastered' : 'assessed'
    const resolvedStrandName = strands.find(s => s.id === selStrand)?.name ?? null
    if (resolvedStrandName && activeSubjectId) {
      // upsert student-specific mastery row only
      await supabase
        .from('learner_outcomes')
        .upsert({
          student_id:   modalStudent.id,
          subject_id:   activeSubjectId,
          strand:       resolvedStrandName,
          outcome_text: selSubStrand.trim() || resolvedStrandName,
          status:       masteryStatus,
          score:        masteryStatus === 'mastered' ? 100 : 50,
          assessed_at:  new Date().toISOString(),
          school_id:    schoolId,
        }, { onConflict: 'student_id,subject_id,strand,outcome_text' })
    }

    closeModal()
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function deleteAssessment(id: string) {
    setDeletingId(id)
    const { error: delErr } = await supabase.from('cbc_assessments').delete().eq('id', id)
    if (!delErr) setAssessments(prev => prev.filter(a => a.id !== id))
    setDeletingId(null)
  }

  // ── Bulk save ──────────────────────────────────────────────────────────────

  async function saveBulk() {
    if (bulkSaving) return
    if (!bulkStrand)             { setBulkError('Select a strand'); return }
    if (!bulkPerf)               { setBulkError('Select a performance level'); return }
    if (bulkSelected.size === 0) { setBulkError('Select at least one student'); return }
    if (!schoolId)               { setBulkError("Profile isn't linked to a school yet."); return }
    if (!teacherId || !activeClassId || !activeSubjectId) return

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

    if (rows.length === 0) { setBulkError('All selected students already have this assessment. No duplicates allowed.'); setBulkSaving(false); return }

    const { data, error: bulkErr } = await supabase
      .from('cbc_assessments')
      .insert(rows)
      .select('id, student_id, strand_id, sub_strand, assessment_type, performance, term, academic_year, notes, created_at')

    if (bulkErr || !data) { setBulkError(bulkErr?.message ?? 'Failed to save'); setBulkSaving(false); return }
    setAssessments(prev => [...(data as Assessment[]), ...prev])

    // Session 5 — bulk update learner_outcomes mastery
    const bulkMasteryStatus = ['exceeds_expectation','meets_expectation'].includes(bulkPerf) ? 'mastered' : 'assessed'
    const bulkStrandName = strands.find(s => s.id === bulkStrand)?.name ?? null
    if (bulkStrandName && activeSubjectId) {
      const bulkOutcomeRows = Array.from(bulkSelected).map(sid => ({
        student_id:   sid,
        subject_id:   activeSubjectId,
        strand:       bulkStrandName,
        outcome_text: bulkSubStrand.trim() || bulkStrandName,
        status:       bulkMasteryStatus,
        score:        bulkMasteryStatus === 'mastered' ? 100 : 50,
        assessed_at:  new Date().toISOString(),
        school_id:    schoolId,
      }))
      await supabase
        .from('learner_outcomes')
        .upsert(bulkOutcomeRows, { onConflict: 'student_id,subject_id,strand,outcome_text' })
    }

    setBulkSelected(new Set()); setBulkDone(true); setBulkSaving(false)
    setBulkStrand(''); setBulkPerf(''); setBulkNotes(''); setBulkSubStrand('')
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
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton h={40} /><Skeleton h={40} /><Skeleton h={56} /><Skeleton h={56} /><Skeleton h={56} />
    </div>
  )

  if (error) return (
    <div style={{ padding: 24, color: '#991b1b', fontSize: 14 }}>⚠️ {error}</div>
  )

  if (classes.length === 0) return (
    <EmptyState icon="🏫" message="No classes assigned yet. Contact your admin." />
  )

  const activeClass   = classes[activeClassIdx]
  const activeSubject = subjects[activeSubjectIdx]

  // Student list enriched
  const studentRows = students.map(s => {
    const history = studentHistory(s.id)
    const badge   = aggregateBadge(s.id)
    return { ...s, history, badge, count: history.length }
  })

  // Bulk: selected student ids that already have this assessment
  const bulkDupIds = new Set(
    Array.from(bulkSelected).filter(sid =>
      assessments.find(a =>
        a.student_id === sid && a.strand_id === bulkStrand &&
        a.assessment_type === bulkType && a.term === selectedTerm &&
        a.academic_year === new Date().getFullYear()
      )
    )
  )

  return (
    <div style={{ padding: '0 0 80px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #f0f0f0' }}>
        {activeClassId && (
          <button
            onClick={() => router.push('/teacher/classhub/' + activeClassId)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 14px', borderRadius: 10, background: '#f3f4f6', border: 'none', color: '#374151', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ← View Class
          </button>
        )}
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0a0a0a' }}>CBC Assessment</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          {activeClass ? `${activeClass.name}${activeClass.stream ? ' ' + activeClass.stream : ''}` : '—'}
          {activeSubject ? ` · ${activeSubject.name}` : ''}
        </p>
      </div>

      {/* ── Class tabs ── */}
      <div style={{ overflowX: 'auto', display: 'flex', gap: 8, padding: '12px 16px 0', borderBottom: '1px solid #f0f0f0' }}>
        {classes.map((c, i) => (
          <button key={c.id} onClick={() => setActiveClassIdx(i)} style={{
            flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: i === activeClassIdx ? '#0a0a0a' : '#f3f4f6',
            color:      i === activeClassIdx ? '#fff'    : '#374151',
          }}>
            {c.name}{c.stream ? ' ' + c.stream : ''}
          </button>
        ))}
      </div>

      {/* ── Subject tabs ── */}
      {subjects.length > 1 && (
        <div style={{ overflowX: 'auto', display: 'flex', gap: 8, padding: '10px 16px 0' }}>
          {subjects.map((s, i) => (
            <button key={s.id} onClick={() => setActiveSubjectIdx(i)} style={{
              flexShrink: 0, padding: '5px 12px', borderRadius: 16, border: '1.5px solid',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              borderColor:  i === activeSubjectIdx ? '#10b981' : '#e5e7eb',
              background:   i === activeSubjectIdx ? '#d1fae5' : '#fff',
              color:        i === activeSubjectIdx ? '#065f46' : '#6b7280',
            }}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Term selector ── */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px' }}>
        {[1, 2, 3].map(t => (
          <button key={t} onClick={() => setSelectedTerm(t)} style={{
            padding: '5px 16px', borderRadius: 16, border: '1.5px solid',
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
            borderColor: t === selectedTerm ? '#10b981' : '#e5e7eb',
            background:  t === selectedTerm ? '#10b981' : '#fff',
            color:       t === selectedTerm ? '#fff'    : '#6b7280',
          }}>
            Term {t}
          </button>
        ))}
        <button onClick={() => { setBulkMode(m => !m); setBulkDone(false); setBulkSelected(new Set()) }} style={{
          marginLeft: 'auto', padding: '5px 14px', borderRadius: 16, border: '1.5px solid',
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
          borderColor: bulkMode ? '#f59e0b' : '#e5e7eb',
          background:  bulkMode ? '#fef3c7' : '#fff',
          color:       bulkMode ? AMBER_DARK : '#6b7280',
        }}>
          {bulkMode ? '✕ Cancel Bulk' : '⚡ Bulk'}
        </button>
      </div>

      {/* ── Bulk panel ── */}
      {bulkMode && (
        <div style={{ margin: '0 16px 16px', padding: 16, borderRadius: 16, background: AMBER_LIGHT, border: `1.5px solid ${AMBER_MID}` }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: AMBER_DARK }}>⚡ Bulk Assessment</p>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: AMBER_DARK }}>Pick strand + type + performance, then tap students below.</p>

          {/* Strand */}
          <select value={bulkStrand} onChange={e => setBulkStrand(e.target.value)} style={selectStyle}>
            <option value="">— Select strand —</option>
            {strands.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {/* Sub-strand */}
          <input
            placeholder="Sub-strand (optional)"
            value={bulkSubStrand}
            onChange={e => setBulkSubStrand(e.target.value)}
            style={{ ...inputStyle, marginTop: 8 }}
          />

          {/* Type */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {ASSESSMENT_TYPES.map(t => (
              <button key={t} onClick={() => setBulkType(t)} style={{
                flex: 1, padding: '6px 0', borderRadius: 10, border: '1.5px solid',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                borderColor: bulkType === t ? AMBER_MID : '#e5e7eb',
                background:  bulkType === t ? '#fff'    : '#fafafa',
                color:       bulkType === t ? AMBER_DARK : '#6b7280',
              }}>{t}</button>
            ))}
          </div>

          {/* Performance */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {PERFORMANCE_OPTIONS.map(p => (
              <button key={p.value} onClick={() => setBulkPerf(p.value)} style={{
                padding: '8px 6px', borderRadius: 10, border: '2px solid',
                cursor: 'pointer', fontSize: 11, fontWeight: 700, textAlign: 'center',
                borderColor: bulkPerf === p.value ? p.color : '#e5e7eb',
                background:  bulkPerf === p.value ? p.bg   : '#fff',
                color:       bulkPerf === p.value ? p.color : '#6b7280',
              }}>{p.short} — {p.label}</button>
            ))}
          </div>

          {/* Notes */}
          <textarea
            placeholder="Notes (optional)"
            value={bulkNotes}
            onChange={e => setBulkNotes(e.target.value)}
            rows={2}
            style={{ ...inputStyle, marginTop: 8, resize: 'none' }}
          />

          {bulkError && <p style={{ color: '#991b1b', fontSize: 12, margin: '8px 0 0' }}>⚠️ {bulkError}</p>}
          {bulkDone  && <p style={{ color: '#065f46', fontSize: 12, margin: '8px 0 0' }}>✅ Saved successfully!</p>}

          {bulkSelected.size > 0 && (
            <button onClick={saveBulk} disabled={bulkSaving} style={{
              marginTop: 12, width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
              cursor: bulkSaving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700,
              background: bulkSaving ? '#d1d5db' : AMBER_MID, color: '#fff',
            }}>
              {bulkSaving ? 'Saving…' : `Save for ${bulkSelected.size} student${bulkSelected.size > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}

      {/* ── Student list ── */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {dataLoading
          ? [1,2,3,4].map(i => <Skeleton key={i} h={64} />)
          : studentRows.length === 0
            ? <EmptyState icon="👥" message="No students enrolled in this class." />
            : studentRows.map(s => {
                const isSelected = bulkSelected.has(s.id)
                const isDup      = bulkDupIds.has(s.id)
                return (
                  <div key={s.id} onClick={() => {
                    if (!bulkMode) return
                    setBulkSelected(prev => {
                      const next = new Set(prev)
                      next.has(s.id) ? next.delete(s.id) : next.add(s.id)
                      return next
                    })
                    setBulkDone(false)
                  }} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 14, background: '#fff',
                    border: `1.5px solid ${isSelected ? AMBER_MID : isDup ? '#fca5a5' : '#f0f0f0'}`,
                    cursor: bulkMode ? 'pointer' : 'default',
                    opacity: isDup ? 0.6 : 1,
                  }}>

                    {/* Bulk checkbox */}
                    {bulkMode && (
                      <div style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${isSelected ? AMBER_MID : '#d1d5db'}`,
                        background: isSelected ? AMBER_MID : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && <span style={{ color: '#fff', fontSize: 12, lineHeight: 1 }}>✓</span>}
                      </div>
                    )}

                    {/* Badge */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: s.badge ? s.badge.bg    : '#f3f4f6',
                      color:      s.badge ? s.badge.color : '#9ca3af',
                      fontSize: 12, fontWeight: 800,
                    }}>
                      {s.badge ? s.badge.short : '—'}
                    </div>

                    {/* Name + count */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0a0a0a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.name}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>
                        {s.count === 0 ? 'No assessments' : `${s.count} assessment${s.count > 1 ? 's' : ''} · Term ${selectedTerm}`}
                      </p>
                    </div>

                    {/* Action buttons */}
                    {!bulkMode && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {s.count > 0 && (
                          <>
                            <button onClick={() => setReportStudent(s)} style={iconBtn('#f3f4f6', '#374151')} title="Report">📄</button>
                            <button onClick={() => openHistory(s)}      style={iconBtn('#dbeafe', '#1e40af')} title="History">📋</button>
                          </>
                        )}
                        <button onClick={() => openRecord(s)} style={iconBtn('#d1fae5', '#065f46')} title="Add">＋</button>
                      </div>
                    )}
                  </div>
                )
              })
        }
      </div>

      {/* ── Performance legend ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '20px 16px 0' }}>
        {PERFORMANCE_OPTIONS.map(p => (
          <span key={p.value} style={{
            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: p.bg, color: p.color,
          }}>{p.short} = {p.label}</span>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════
          RECORD / EDIT MODAL
      ════════════════════════════════════════════════════════ */}
      {modalStudent && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div style={sheetStyle}>

            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb', margin: '0 auto 16px' }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0a0a0a' }}>
                  {viewMode ? '📋 History' : editingId ? '✏️ Edit Assessment' : '＋ New Assessment'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>{modalStudent.name}</p>
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af', padding: 4 }}>×</button>
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
                              {a.sub_strand && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{a.sub_strand}</p>}
                              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>{a.assessment_type} · Term {a.term}</p>
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
                      }}>{t}</button>
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
                      }}>{p.short}<br /><span style={{ fontSize: 10, fontWeight: 500 }}>{p.label}</span></button>
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
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb', margin: '0 auto 16px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0a0a0a' }}>📄 Report</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>{reportStudent.name}</p>
              </div>
              <button onClick={() => setReportStudent(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af', padding: 4 }}>×</button>
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
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>{a.assessment_type}{a.sub_strand ? ' · ' + a.sub_strand : ''}</p>
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
    </div>
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
