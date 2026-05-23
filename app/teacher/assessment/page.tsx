'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams }                        from 'next/navigation'
import { supabase }                               from '@/lib/supabase'
import { Card, C }                                from '@/components/teacher/ui'

// ─── Types ────────────────────────────────────────────────────────────────────
// TODO: move to lib/types.ts

interface ClassOption   { id: string; name: string; stream: string }
interface SubjectOption { id: string; name: string }
interface StrandOption  { id: string; name: string }
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
  const searchParams = useSearchParams()

  // ── Identity ──
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [schoolId,  setSchoolId]  = useState<string | null>(null)

  // ── Lists ──
  const [classes,     setClasses]     = useState<ClassOption[]>([])
  const [subjects,    setSubjects]    = useState<SubjectOption[]>([])
  const [strands,     setStrands]     = useState<StrandOption[]>([])
  const [students,    setStudents]    = useState<Student[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])

  // ── Selection ──
  const [activeClassIdx,   setActiveClassIdx]   = useState(0)
  const [activeSubjectIdx, setActiveSubjectIdx] = useState(0)
  const [selectedTerm,     setSelectedTerm]     = useState(1)

  // ── UI state ──
  const [loading,     setLoading]     = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  // ── Modal ──
  const [modalStudent, setModalStudent] = useState<Student | null>(null)
  const [viewMode,     setViewMode]     = useState(false)
  const [selStrand,    setSelStrand]    = useState('')
  const [selSubStrand, setSelSubStrand] = useState('')
  const [selType,      setSelType]      = useState('Formative')
  const [selPerf,      setSelPerf]      = useState('')
  const [selNotes,     setSelNotes]     = useState('')
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState<string | null>(null)

  const loadIdRef = useRef(0)

  // Scroll lock while modal open
  useEffect(() => {
    document.body.style.overflow = modalStudent ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [modalStudent])

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => { boot() }, [])

  async function boot() {
    setLoading(true)
    setError(null)

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      setError('Not signed in.')
      setLoading(false)
      return
    }
    setTeacherId(user.id)

    const profileRes = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileRes.error) {
      setError(profileRes.error.message)
      setLoading(false)
      return
    }

    // null is valid — teacher not yet assigned to a school
    const sid: string | null = profileRes.data?.school_id ?? null
    setSchoolId(sid)

    const tcRes = await supabase
      .from('teacher_classes')
      .select('class_id, subject_id')
      .eq('teacher_id', user.id)

    if (tcRes.error) {
      setError(tcRes.error.message)
      setLoading(false)
      return
    }

    const rows = tcRes.data ?? []

    const classIds = Array.from(
      new Set(
        rows
          .map((r: { class_id: string | null }) => r.class_id)
          .filter((x): x is string => !!x)
      )
    )
    const subjectIds = Array.from(
      new Set(
        rows
          .map((r: { subject_id: string | null }) => r.subject_id)
          .filter((x): x is string => !!x)
      )
    )

    if (classIds.length === 0) {
      setLoading(false)
      return
    }

    const [classesRes, subjectsRes] = await Promise.all([
      supabase.from('classes').select('id, name, stream').in('id', classIds),
      subjectIds.length > 0
        ? supabase.from('subjects').select('id, name').in('id', subjectIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (classesRes.error) {
      setError(classesRes.error.message)
      setLoading(false)
      return
    }
    if (subjectsRes.error) {
      setError(subjectsRes.error.message)
      setLoading(false)
      return
    }

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

  // ── Derived stable IDs ────────────────────────────────────────────────────
  const activeClassId   = classes[activeClassIdx]?.id   ?? null
  const activeSubjectId = subjects[activeSubjectIdx]?.id ?? null

  // Reset subject index when class changes
  useEffect(() => {
    setActiveSubjectIdx(0)
  }, [activeClassIdx])

  // Trigger data load
  useEffect(() => {
    if (!activeClassId || !activeSubjectId) return
    const thisLoad = ++loadIdRef.current
    loadData(thisLoad, activeClassId, activeSubjectId)
  }, [activeClassId, activeSubjectId, selectedTerm, schoolId])

  // ── loadData — IDs passed as args, never read from closure ───────────────
  async function loadData(loadId: number, classId: string, subjectId: string) {
    setDataLoading(true)
    setStrands([])
    setStudents([])
    setAssessments([])

    const currentYear = new Date().getFullYear()

    const [strandsRes, scRes] = await Promise.all([
      supabase
        .from('strands')
        .select('id, name')
        .eq('subject_id', subjectId)
        .order('name'),
      supabase
        .from('student_classes')
        .select('student_id')
        .eq('class_id', classId)
        .eq('is_current', true),
    ])

    if (loadId !== loadIdRef.current) return

    setStrands(strandsRes.error ? [] : (strandsRes.data ?? []) as StrandOption[])

    const studentIds = Array.from(
      new Set((scRes.data ?? []).map((r: { student_id: string }) => r.student_id))
    )

    if (studentIds.length === 0) {
      setStudents([])
      setAssessments([])
      setDataLoading(false)
      return
    }

    const studentsPromise = supabase
      .from('students')
      .select('id, name')
      .in('id', studentIds)

    // Only fetch assessments when schoolId is known
    const assessPromise = schoolId
      ? supabase
          .from('cbc_assessments')
          .select('id, student_id, strand_id, sub_strand, assessment_type, performance, term, academic_year, notes, created_at')
          .eq('class_id',      classId)
          .eq('subject_id',    subjectId)
          .eq('term',          selectedTerm)
          .eq('academic_year', currentYear)
          .eq('school_id',     schoolId)
          .in('student_id',    studentIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null })

    const [studentsRes, assessRes] = await Promise.all([studentsPromise, assessPromise])

    if (loadId !== loadIdRef.current) return

    setStudents(
      studentsRes.error
        ? []
        : ((studentsRes.data ?? []) as Student[]).sort((a, b) => a.name.localeCompare(b.name))
    )
    setAssessments(assessRes.error ? [] : (assessRes.data ?? []) as Assessment[])
    setDataLoading(false)
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openRecord(student: Student) {
    setModalStudent(student)
    setViewMode(false)
    setSelStrand('')
    setSelSubStrand('')
    setSelType('Formative')
    setSelPerf('')
    setSelNotes('')
    setSaveError(null)
    setSaving(false)
  }

  function openHistory(student: Student) {
    setModalStudent(student)
    setViewMode(true)
    setSaveError(null)
  }

  function closeModal() {
    setModalStudent(null)
    setSaveError(null)
    setSaving(false)
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function saveAssessment() {
    if (saving) return
    if (!selStrand)       { setSaveError('Select a strand'); return }
    if (!selPerf)         { setSaveError('Select a performance level'); return }
    if (!teacherId)       { setSaveError('Not signed in'); return }
    if (!schoolId)        { setSaveError("Your profile isn't linked to a school yet. Contact your admin."); return }
    if (!activeClassId)   { setSaveError('No class selected'); return }
    if (!activeSubjectId) { setSaveError('No subject selected'); return }
    if (!modalStudent)    return

    const currentYear = new Date().getFullYear()

    const dup = assessments.find(a =>
      a.student_id      === modalStudent.id &&
      a.strand_id       === selStrand &&
      a.assessment_type === selType &&
      a.term            === selectedTerm &&
      a.academic_year   === currentYear
    )
    if (dup) {
      setSaveError(
        `A ${selType} assessment for this strand already exists for Term ${selectedTerm}. View history to edit or delete it first.`
      )
      return
    }

    setSaving(true)
    setSaveError(null)

    const { data, error: saveErr } = await supabase
      .from('cbc_assessments')
      .insert({
        student_id:      modalStudent.id,
        teacher_id:      teacherId,
        class_id:        activeClassId,
        subject_id:      activeSubjectId,
        strand_id:       selStrand,
        sub_strand:      selSubStrand.trim() || null,
        assessment_type: selType,
        performance:     selPerf,
        term:            selectedTerm,
        academic_year:   currentYear,
        school_id:       schoolId,
        notes:           selNotes.trim() || null,
      })
      .select('id, student_id, strand_id, sub_strand, assessment_type, performance, term, academic_year, notes, created_at')
      .single()

    if (saveErr || !data) {
      setSaveError(saveErr?.message ?? 'Failed to save. Please try again.')
      setSaving(false)
      return
    }

    // Prepend — maintains newest-first order that latestPerf depends on
    setAssessments(prev => [data as Assessment, ...prev])
    closeModal()
  }

  // ── Derived helpers ───────────────────────────────────────────────────────

  // Badge shows most recently recorded entry regardless of strand — informational only
  function latestPerf(studentId: string): string | null {
    return assessments.find(a => a.student_id === studentId)?.performance ?? null
  }

  function studentHistory(studentId: string): Assessment[] {
    return assessments.filter(a => a.student_id === studentId)
  }

  function strandName(id: string): string {
    return strands.find(s => s.id === id)?.name ?? 'Unknown strand'
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

      <div style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${AMBER_DARK} 0%, ${AMBER_MID} 100%)`,
          borderRadius: 20, padding: '20px', color: '#fff',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            Assessment
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>CBC Strand Performance</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            {classes[activeClassIdx]
              ? `${classes[activeClassIdx].name}${classes[activeClassIdx].stream ? ' ' + classes[activeClassIdx].stream : ''} · `
              : ''}
            {subjects[activeSubjectIdx]?.name ?? ''}
            {subjects[activeSubjectIdx] ? ` · Term ${selectedTerm}` : ''}
          </div>
        </div>

        {/* Global error */}
        {error && (
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fef2f2', color: C.error, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Boot loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton h={44} /><Skeleton h={44} /><Skeleton h={200} />
          </div>
        )}

        {/* No school assigned */}
        {!loading && !error && !schoolId && (
          <EmptyState icon="🏫" message="Your profile isn't linked to a school yet. Contact your admin to get set up." />
        )}

        {/* No classes assigned */}
        {!loading && !error && schoolId && classes.length === 0 && (
          <EmptyState icon="📚" message="No classes assigned yet. Go to SubjectHub to add a subject." />
        )}

        {/* Main content */}
        {!loading && !error && schoolId && classes.length > 0 && (
          <>
            {/* Class tabs */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {classes.map((cl, i) => (
                <button
                  key={cl.id}
                  onClick={() => setActiveClassIdx(i)}
                  disabled={dataLoading}
                  style={{
                    padding: '7px 16px', borderRadius: 20, border: 'none',
                    cursor: dataLoading ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                    background: i === activeClassIdx ? AMBER_DARK : '#fff',
                    color:      i === activeClassIdx ? '#fff'     : C.textMuted,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    opacity: dataLoading ? 0.6 : 1,
                  }}
                >
                  {cl.name}{cl.stream ? ` ${cl.stream}` : ''}
                </button>
              ))}
            </div>

            {/* Subject tabs */}
            {subjects.length > 1 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {subjects.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSubjectIdx(i)}
                    disabled={dataLoading}
                    style={{
                      padding: '6px 14px', borderRadius: 20,
                      border: `1px solid ${C.border}`,
                      cursor: dataLoading ? 'not-allowed' : 'pointer',
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                      background: i === activeSubjectIdx ? C.dark : C.bg,
                      color:      i === activeSubjectIdx ? '#fff' : C.textMuted,
                      opacity: dataLoading ? 0.6 : 1,
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}

            {/* No subjects */}
            {subjects.length === 0 && (
              <EmptyState icon="📖" message="No subjects linked to your classes yet. Go to SubjectHub to add one." />
            )}

            {/* Term selector */}
            {subjects.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3].map(t => (
                  <button
                    key={t}
                    onClick={() => setSelectedTerm(t)}
                    disabled={dataLoading}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 12, border: 'none',
                      cursor: dataLoading ? 'not-allowed' : 'pointer',
                      fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                      background: t === selectedTerm ? AMBER_MID : '#fff',
                      color:      t === selectedTerm ? '#fff'    : C.textMuted,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      opacity: dataLoading ? 0.6 : 1,
                    }}
                  >
                    Term {t}
                  </button>
                ))}
              </div>
            )}

            {/* Data loading */}
            {dataLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={60} />)}
              </div>
            )}

            {/* No students */}
            {!dataLoading && subjects.length > 0 && students.length === 0 && (
              <EmptyState icon="👥" message="No students enrolled in this class yet." />
            )}

            {/* Student list */}
            {!dataLoading && students.length > 0 && (
              <div style={{
                background: '#fff', borderRadius: 20, overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}>
                <div style={{
                  padding: '14px 16px', borderBottom: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                      Students
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                      {students.length} students · tap to assess
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: AMBER_MID }}>
                    {assessments.length} recorded
                  </div>
                </div>

                {students.map((st, idx) => {
                  const perf  = latestPerf(st.id)
                  const count = studentHistory(st.id).length
                  const meta  = perf ? perfMeta(perf) : null
                  return (
                    <div
                      key={st.id}
                      style={{
                        borderTop: idx === 0 ? 'none' : `1px solid ${C.border}`,
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      <button
                        onClick={() => openRecord(st)}
                        style={{
                          flex: 1, padding: '14px 16px',
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: 'transparent', border: 'none',
                          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        }}
                      >
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%',
                          background: meta ? meta.bg : '#f3f4f6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 800,
                          color: meta ? meta.color : C.textMuted,
                          flexShrink: 0,
                        }}>
                          {meta ? meta.short : (idx + 1)}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
                            {st.name}
                          </div>
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                            {count === 0
                              ? 'Tap to record'
                              : `${count} entr${count > 1 ? 'ies' : 'y'} · Term ${selectedTerm}`}
                          </div>
                        </div>
                      </button>

                      {count > 0 && (
                        <button
                          onClick={() => openHistory(st)}
                          style={{
                            padding: '10px 14px', background: 'transparent',
                            border: 'none', cursor: 'pointer',
                            fontSize: 11, fontWeight: 700,
                            color: C.textMuted, fontFamily: 'inherit',
                          }}
                        >
                          View
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Legend */}
            {!dataLoading && students.length > 0 && (
              <div style={{
                background: '#fff', borderRadius: 16, padding: '14px 16px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, color: C.textMuted,
                  letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10,
                }}>
                  Performance Key
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {PERFORMANCE_OPTIONS.map(p => (
                    <div key={p.value} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: p.bg, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 11, fontWeight: 800,
                        color: p.color, flexShrink: 0,
                      }}>
                        {p.short}
                      </div>
                      <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.3 }}>
                        {p.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {modalStudent && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: '20px 20px 0 0',
            padding: '24px 24px 40px', width: '100%', maxWidth: 480,
            maxHeight: '90vh', overflowY: 'auto',
          }}>

            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 20,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary }}>
                  {viewMode ? 'Assessment History' : 'Record Assessment'}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  {modalStudent.name}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {viewMode && (
                  <button
                    onClick={() => setViewMode(false)}
                    style={{
                      padding: '6px 12px', borderRadius: 8, border: 'none',
                      background: AMBER_MID, color: '#fff',
                      fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    + New
                  </button>
                )}
                <button
                  onClick={closeModal}
                  aria-label="Close modal"
                  style={{
                    width: 32, height: 32, borderRadius: '50%', border: 'none',
                    background: '#f3f4f6', cursor: 'pointer', fontSize: 18,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: C.textMuted,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* History view */}
            {viewMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {studentHistory(modalStudent.id).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: C.textMuted, fontSize: 13 }}>
                    No assessments recorded yet.
                  </div>
                ) : (
                  studentHistory(modalStudent.id).map(a => {
                    const meta = perfMeta(a.performance)
                    return (
                      <div
                        key={a.id}
                        style={{
                          padding: '12px 14px', borderRadius: 12,
                          border: `1px solid ${C.border}`, background: '#fafafa',
                        }}
                      >
                        <div style={{
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between', marginBottom: 4,
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>
                            {strandName(a.strand_id)}
                          </div>
                          <div style={{
                            padding: '3px 10px', borderRadius: 20,
                            background: meta.bg, fontSize: 11,
                            fontWeight: 700, color: meta.color,
                          }}>
                            {meta.short}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>
                          {a.assessment_type}
                          {a.sub_strand ? ` · ${a.sub_strand}` : ''}
                          {` · Term ${a.term}`}
                        </div>
                        {a.notes && (
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, fontStyle: 'italic' }}>
                            {a.notes}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Record view */}
            {!viewMode && (
              <>
                {strands.length === 0 ? (
                  <div style={{
                    padding: '20px', borderRadius: 12,
                    background: AMBER_LIGHT, textAlign: 'center',
                    fontSize: 13, color: AMBER_DARK,
                  }}>
                    No strands configured for this subject yet. Contact your admin to set up strands.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>STRAND</div>
                    <select
                      value={selStrand}
                      onChange={e => setSelStrand(e.target.value)}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '10px 14px', borderRadius: 10,
                        border: `1px solid ${C.border}`,
                        fontSize: 14, fontFamily: 'inherit',
                        marginBottom: 14, background: '#fff',
                      }}
                    >
                      <option value="">Select strand…</option>
                      {strands.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>

                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>SUB-STRAND (OPTIONAL)</div>
                    <input
                      value={selSubStrand}
                      onChange={e => setSelSubStrand(e.target.value)}
                      placeholder="e.g. Nouns and Pronouns"
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '10px 14px', borderRadius: 10,
                        border: `1px solid ${C.border}`,
                        fontSize: 14, fontFamily: 'inherit',
                        marginBottom: 14, outline: 'none',
                      }}
                    />

                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, fontWeight: 600 }}>ASSESSMENT TYPE</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      {ASSESSMENT_TYPES.map(t => (
                        <button
                          key={t}
                          onClick={() => setSelType(t)}
                          style={{
                            flex: 1, padding: '9px 0', borderRadius: 10,
                            border: `1px solid ${t === selType ? AMBER_MID : C.border}`,
                            cursor: 'pointer', fontSize: 13, fontWeight: 700,
                            fontFamily: 'inherit',
                            background: t === selType ? AMBER_LIGHT : '#fff',
                            color:      t === selType ? AMBER_DARK  : C.textMuted,
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, fontWeight: 600 }}>PERFORMANCE LEVEL</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                      {PERFORMANCE_OPTIONS.map(p => (
                        <button
                          key={p.value}
                          onClick={() => setSelPerf(p.value)}
                          style={{
                            width: '100%', padding: '12px 14px', borderRadius: 12,
                            border: `2px solid ${p.value === selPerf ? p.color : C.border}`,
                            cursor: 'pointer', fontFamily: 'inherit',
                            background: p.value === selPerf ? p.bg : '#fff',
                            display: 'flex', alignItems: 'center', gap: 12,
                            textAlign: 'left',
                          }}
                        >
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: p.bg, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 800,
                            color: p.color, flexShrink: 0,
                          }}>
                            {p.short}
                          </div>
                          <div style={{
                            fontSize: 13, fontWeight: 700,
                            color: p.value === selPerf ? p.color : C.textPrimary,
                          }}>
                            {p.label}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>NOTES (OPTIONAL)</div>
                    <textarea
                      value={selNotes}
                      onChange={e => setSelNotes(e.target.value)}
                      placeholder="Additional observations…"
                      rows={3}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '10px 14px', borderRadius: 10,
                        border: `1px solid ${C.border}`,
                        fontSize: 14, fontFamily: 'inherit',
                        marginBottom: 16, outline: 'none', resize: 'none',
                      }}
                    />

                    {saveError && (
                      <div style={{ fontSize: 13, color: C.error, marginBottom: 12 }}>
                        {saveError}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={closeModal}
                        style={{
                          flex: 1, padding: '13px', borderRadius: 12,
                          border: `1px solid ${C.border}`, background: '#fff',
                          fontSize: 14, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit', color: C.textMuted,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveAssessment}
                        disabled={saving}
                        style={{
                          flex: 2, padding: '13px', borderRadius: 12,
                          border: 'none', background: AMBER_MID,
                          fontSize: 14, fontWeight: 700,
                          cursor: saving ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit', color: '#fff',
                          opacity: saving ? 0.7 : 1,
                        }}
                      >
                        {saving ? 'Saving…' : 'Save Assessment'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default function AssessmentPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontSize: 13, color: '#9ca3af' }}>Loading…</div>}>
      <AssessmentInner />
    </Suspense>
  )
}
