'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams }                        from 'next/navigation'
import { supabase }                               from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Exam {
  id:            string
  name:          string
  term:          number
  academic_year: number
  exam_type:     string
  pass_mark:     number
  is_locked:     boolean
  created_by:    string
}

interface ClassOption   { id: string; name: string; stream: string }
interface SubjectOption { id: string; name: string }

interface Student {
  id:         string
  name:       string
  source:     'db' | 'manual'
  class_name?: string
}

interface Result {
  id:         string
  student_id: string
  marks:      number
  is_absent:  boolean
}

type Tier = 1 | 2 | 3

// ─── Grade utility (8-4-4) ────────────────────────────────────────────────────

function getGrade(marks: number): string {
  if (marks >= 80) return 'A'
  if (marks >= 75) return 'A-'
  if (marks >= 70) return 'B+'
  if (marks >= 65) return 'B'
  if (marks >= 60) return 'B-'
  if (marks >= 55) return 'C+'
  if (marks >= 50) return 'C'
  if (marks >= 45) return 'C-'
  if (marks >= 40) return 'D+'
  if (marks >= 35) return 'D'
  if (marks >= 30) return 'D-'
  return 'E'
}

function gradeColor(grade: string): { bg: string; color: string } {
  if (grade === 'A')                          return { bg: '#d1fae5', color: '#065f46' }
  if (grade === 'A-' || grade === 'B+')       return { bg: '#dbeafe', color: '#1e40af' }
  if (['B','B-','C+'].includes(grade))        return { bg: '#fef3c7', color: '#92400e' }
  if (['C','C-','D+'].includes(grade))        return { bg: '#fed7aa', color: '#9a3412' }
  return { bg: '#fee2e2', color: '#991b1b' }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAM_TYPES  = ['summative', 'cat', 'midterm', 'opener']
const TERM_LABELS = ['Term 1', 'Term 2', 'Term 3']

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

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid #e5e7eb', fontSize: 13, color: '#0a0a0a',
  background: '#fafafa', outline: 'none', boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance: 'none' as const,
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#374151', marginBottom: 6,
}

const btnPrimary: React.CSSProperties = {
  width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
  cursor: 'pointer', fontSize: 14, fontWeight: 700,
  background: '#10b981', color: '#fff',
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  zIndex: 1000, display: 'flex', alignItems: 'flex-end',
}

const sheetStyle: React.CSSProperties = {
  width: '100%', maxHeight: '90vh', overflowY: 'auto',
  background: '#fff', borderRadius: '20px 20px 0 0',
  padding: '16px 16px 40px',
}

function pill(active: boolean, accent = '#10b981'): React.CSSProperties {
  return {
    flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: 'none',
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: active ? accent    : '#f3f4f6',
    color:      active ? '#fff'    : '#374151',
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function ResultsInner() {
  const searchParams = useSearchParams()

  // ── Identity ──
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [schoolId,  setSchoolId]  = useState<string | null>(null)
  const [tier,      setTier]      = useState<Tier | null>(null)

  // ── Tier 1 data ──
  const [classes,  setClasses]  = useState<ClassOption[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [activeClassIdx,   setActiveClassIdx]   = useState(0)
  const [activeSubjectIdx, setActiveSubjectIdx] = useState(0)

  // ── Exams ──
  const [exams,          setExams]          = useState<Exam[]>([])
  const [activeExam,     setActiveExam]     = useState<Exam | null>(null)
  const [showExamSheet,  setShowExamSheet]  = useState(false)
  const [newExamName,    setNewExamName]    = useState('')
  const [newExamType,    setNewExamType]    = useState('summative')
  const [newExamTerm,    setNewExamTerm]    = useState(1)
  const [newExamYear,    setNewExamYear]    = useState(new Date().getFullYear())
  const [newExamPass,    setNewExamPass]    = useState(50)
  const [creatingExam,   setCreatingExam]   = useState(false)
  const [examError,      setExamError]      = useState<string | null>(null)

  // ── Students ──
  const [students,        setStudents]        = useState<Student[]>([])
  const [showAddStudent,  setShowAddStudent]  = useState(false)
  const [newStudentName,  setNewStudentName]  = useState('')
  const [newStudentClass, setNewStudentClass] = useState('')
  const [addingStudent,   setAddingStudent]   = useState(false)

  // ── Results ──
  const [results,    setResults]    = useState<Result[]>([])
  const [draftMarks, setDraftMarks] = useState<Record<string, string>>({})
  const [savingId,   setSavingId]   = useState<string | null>(null)
  const [activeTab,  setActiveTab]  = useState<'entry' | 'analysis'>('entry')

  // ── Loading ──
  const [booting,  setBooting]  = useState(true)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const loadIdRef = useRef(0)

  // ── Boot ──────────────────────────────────────────────────────────────────

  useEffect(() => { boot() }, [])

  async function boot() {
    setBooting(true)
    setError(null)

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) { setError('Not signed in.'); setBooting(false); return }
    setTeacherId(user.id)

    // Profile — school_id optional
    const { data: profile } = await supabase
      .from('profiles').select('school_id').eq('id', user.id).maybeSingle()
    const sid: string | null = profile?.school_id ?? null
    setSchoolId(sid)

    // Detect tier
    if (!sid) {
      // Tier 3 — no school at all
      setTier(3)
      await loadManualStudents(user.id)
      await loadExams(user.id, null)
      setBooting(false)
      return
    }

    // Check teacher_classes
    const { data: tcRows } = await supabase
      .from('teacher_classes')
      .select('class_id, subject_id')
      .eq('teacher_id', user.id)

    const rows      = tcRows ?? []
    const classIds  = Array.from(new Set(rows.map((r: { class_id: string }) => r.class_id).filter(Boolean)))
    const subjectIds = Array.from(new Set(rows.map((r: { subject_id: string }) => r.subject_id).filter(Boolean)))

    if (classIds.length === 0) {
      // Tier 2 — school exists, no class assignment
      setTier(2)
      await loadManualStudents(user.id)
      await loadExams(user.id, sid)
      setBooting(false)
      return
    }

    // Tier 1 — full setup
    setTier(1)
    const [classesRes, subjectsRes] = await Promise.all([
      supabase.from('classes').select('id, name, stream').in('id', classIds),
      subjectIds.length > 0
        ? supabase.from('subjects').select('id, name').in('id', subjectIds)
        : Promise.resolve({ data: [] }),
    ])

    const loadedClasses  = (classesRes.data  ?? []) as ClassOption[]
    const loadedSubjects = (subjectsRes.data ?? []) as SubjectOption[]

    // URL pre-selection
    const urlClassId   = searchParams.get('classId')
    const urlSubjectId = searchParams.get('subjectId')
    let ci = 0, si = 0
    if (urlClassId)   { const i = loadedClasses.findIndex(c => c.id === urlClassId);    if (i !== -1) ci = i }
    if (urlSubjectId) { const i = loadedSubjects.findIndex(s => s.id === urlSubjectId); if (i !== -1) si = i }

    setClasses(loadedClasses)
    setSubjects(loadedSubjects)
    setActiveClassIdx(ci)
    setActiveSubjectIdx(si)

    await loadExams(user.id, sid)
    setBooting(false)
  }

  // ── Load exams ────────────────────────────────────────────────────────────

  async function loadExams(tid: string, sid: string | null) {
    const query = sid
      ? supabase.from('exams').select('*').or(`created_by.eq.${tid},school_id.eq.${sid}`).order('created_at', { ascending: false })
      : supabase.from('exams').select('*').eq('created_by', tid).order('created_at', { ascending: false })

    const { data } = await query
    const loaded = (data ?? []) as Exam[]
    setExams(loaded)
    if (loaded.length > 0) setActiveExam(loaded[0])
  }

  // ── Load students (Tier 1) ────────────────────────────────────────────────

  useEffect(() => {
    if (tier !== 1) return
    const classId = classes[activeClassIdx]?.id
    if (!classId) return
    const thisLoad = ++loadIdRef.current
    loadTier1Students(thisLoad, classId)
  }, [tier, activeClassIdx, classes])

  async function loadTier1Students(loadId: number, classId: string) {
    setLoading(true)
    const { data: scRows } = await supabase
      .from('student_classes')
      .select('student_id')
      .eq('class_id', classId)
      .eq('is_current', true)

    if (loadId !== loadIdRef.current) return
    const ids = (scRows ?? []).map((r: { student_id: string }) => r.student_id)
    if (ids.length === 0) { setStudents([]); setLoading(false); return }

    const { data: studs } = await supabase
      .from('students').select('id, name').in('id', ids)

    if (loadId !== loadIdRef.current) return
    setStudents(((studs ?? []) as { id: string; name: string }[])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(s => ({ ...s, source: 'db' as const }))
    )
    setLoading(false)
  }

  // ── Load manual students (Tier 2 & 3) ────────────────────────────────────

  async function loadManualStudents(tid: string) {
    const { data } = await supabase
      .from('manual_students')
      .select('id, name, class_name')
      .eq('teacher_id', tid)
      .order('name')
    setStudents(((data ?? []) as { id: string; name: string; class_name: string | null }[])
      .map(s => ({ id: s.id, name: s.name, source: 'manual' as const, class_name: s.class_name ?? undefined }))
    )
  }

  // ── Load results when exam + students ready ───────────────────────────────

  useEffect(() => {
    if (!activeExam || students.length === 0) return
    loadResults()
  }, [activeExam, students])

  async function loadResults() {
    if (!activeExam) return
    const studentIds = students.map(s => s.id)
    const { data } = await supabase
      .from('exam_results')
      .select('id, student_id, marks, is_absent')
      .eq('exam_id', activeExam.id)
      .in('student_id', studentIds)
    const loaded = (data ?? []) as Result[]
    setResults(loaded)
    // Seed draft marks from saved results
    const draft: Record<string, string> = {}
    for (const r of loaded) {
      if (!r.is_absent) draft[r.student_id] = String(r.marks)
    }
    setDraftMarks(draft)
  }

  // ── Create exam ───────────────────────────────────────────────────────────

  async function createExam() {
    if (creatingExam) return
    if (!newExamName.trim()) { setExamError('Enter exam name'); return }
    if (!teacherId)          { setExamError('Not signed in');  return }
    setCreatingExam(true); setExamError(null)

    const payload: Record<string, unknown> = {
      name:          newExamName.trim(),
      exam_type:     newExamType,
      term:          newExamTerm,
      academic_year: newExamYear,
      pass_mark:     newExamPass,
      created_by:    teacherId,
    }
    if (schoolId) payload.school_id = schoolId

    const { data, error: cErr } = await supabase
      .from('exams').insert(payload)
      .select('*').single()

    if (cErr || !data) { setExamError(cErr?.message ?? 'Failed'); setCreatingExam(false); return }
    const created = data as Exam
    setExams(prev => [created, ...prev])
    setActiveExam(created)
    setShowExamSheet(false)
    setNewExamName(''); setCreatingExam(false)
  }

  // ── Add manual student ────────────────────────────────────────────────────

  async function addManualStudent() {
    if (addingStudent) return
    if (!newStudentName.trim()) return
    if (!teacherId) return
    setAddingStudent(true)

    const { data, error: aErr } = await supabase
      .from('manual_students')
      .insert({ teacher_id: teacherId, name: newStudentName.trim(), class_name: newStudentClass.trim() || null })
      .select('id, name, class_name').single()

    if (!aErr && data) {
      const s = data as { id: string; name: string; class_name: string | null }
      setStudents(prev => [...prev, { id: s.id, name: s.name, source: 'manual' as const, class_name: s.class_name ?? undefined }]
        .sort((a, b) => a.name.localeCompare(b.name))
      )
    }
    setNewStudentName(''); setNewStudentClass(''); setAddingStudent(false); setShowAddStudent(false)
  }

  // ── Save mark (upsert on blur) ────────────────────────────────────────────

  async function saveMark(student: Student, isAbsent = false) {
    if (!activeExam || !teacherId) return
    if (activeExam.is_locked) return

    const rawMark = draftMarks[student.id] ?? ''
    const marks   = isAbsent ? 0 : parseFloat(rawMark)
    if (!isAbsent && (isNaN(marks) || marks < 0 || marks > 100)) return

    setSavingId(student.id)

    const classId   = tier === 1 ? classes[activeClassIdx]?.id   : null
    const subjectId = tier === 1 ? subjects[activeSubjectIdx]?.id : null

    const payload: Record<string, unknown> = {
      exam_id:    activeExam.id,
      student_id: student.id,
      teacher_id: teacherId,
      marks,
      is_absent:  isAbsent,
    }
    if (schoolId)  payload.school_id  = schoolId
    if (classId)   payload.class_id   = classId
    if (subjectId) payload.subject_id = subjectId

    const existing = results.find(r => r.student_id === student.id)

    if (existing) {
      const { data } = await supabase
        .from('exam_results').update({ marks, is_absent: isAbsent })
        .eq('id', existing.id)
        .select('id, student_id, marks, is_absent').single()
      if (data) setResults(prev => prev.map(r => r.id === existing.id ? data as Result : r))
    } else {
      const { data } = await supabase
        .from('exam_results').insert(payload)
        .select('id, student_id, marks, is_absent').single()
      if (data) setResults(prev => [...prev, data as Result])
    }

    setSavingId(null)
  }

  // ── Analysis helpers ──────────────────────────────────────────────────────

  function analysisData() {
    const entered = results.filter(r => !r.is_absent)
    if (entered.length === 0) return null
    const marks  = entered.map(r => r.marks)
    const avg    = marks.reduce((a, b) => a + b, 0) / marks.length
    const highest = Math.max(...marks)
    const lowest  = Math.min(...marks)
    const passM  = activeExam?.pass_mark ?? 50
    const passed = marks.filter(m => m >= passM).length
    const failed = marks.filter(m => m < passM).length
    const grades: Record<string, number> = {}
    for (const m of marks) {
      const g = getGrade(m)
      grades[g] = (grades[g] ?? 0) + 1
    }
    return { avg, highest, lowest, passed, failed, grades, total: entered.length, absent: results.filter(r => r.is_absent).length }
  }

  const analysis = analysisData()

  // ─── Render ────────────────────────────────────────────────────────────────

  if (booting) return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton h={40} /><Skeleton h={40} /><Skeleton h={64} /><Skeleton h={64} /><Skeleton h={64} />
    </div>
  )

  if (error) return (
    <div style={{ padding: 24, color: '#991b1b', fontSize: 14 }}>⚠️ {error}</div>
  )

  const activeClass   = classes[activeClassIdx]
  const activeSubject = subjects[activeSubjectIdx]
  const passM         = activeExam?.pass_mark ?? 50

  return (
    <div style={{ padding: '0 0 80px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0a0a0a' }}>📊 Results</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
              {tier === 1
                ? `${activeClass?.name ?? '—'}${activeClass?.stream ? ' ' + activeClass.stream : ''}${activeSubject ? ' · ' + activeSubject.name : ''}`
                : tier === 2 ? 'School teacher · no class assigned'
                : 'Solo mode · no school linked'}
            </p>
          </div>
          {/* Tier badge */}
          <span style={{
            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: tier === 1 ? '#d1fae5' : tier === 2 ? '#fef3c7' : '#f3f4f6',
            color:      tier === 1 ? '#065f46' : tier === 2 ? '#92400e' : '#6b7280',
          }}>
            {tier === 1 ? 'Full setup' : tier === 2 ? 'Partial setup' : 'Solo'}
          </span>
        </div>
      </div>

      {/* ── Tier 1: class + subject tabs ── */}
      {tier === 1 && (
        <>
          <div style={{ overflowX: 'auto', display: 'flex', gap: 8, padding: '12px 16px 0' }}>
            {classes.map((c, i) => (
              <button key={c.id} onClick={() => setActiveClassIdx(i)} style={pill(i === activeClassIdx)}>
                {c.name}{c.stream ? ' ' + c.stream : ''}
              </button>
            ))}
          </div>
          {subjects.length > 1 && (
            <div style={{ overflowX: 'auto', display: 'flex', gap: 8, padding: '8px 16px 0' }}>
              {subjects.map((s, i) => (
                <button key={s.id} onClick={() => setActiveSubjectIdx(i)} style={pill(i === activeSubjectIdx, '#6366f1')}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Exam selector ── */}
      <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, overflowX: 'auto', display: 'flex', gap: 8 }}>
          {exams.length === 0
            ? <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>No exams yet</p>
            : exams.map(e => (
                <button key={e.id} onClick={() => setActiveExam(e)} style={{
                  ...pill(activeExam?.id === e.id, '#0a0a0a'),
                  flexShrink: 0,
                }}>
                  {e.name}
                  {e.is_locked && <span style={{ marginLeft: 4, fontSize: 10 }}>🔒</span>}
                </button>
              ))
          }
        </div>
        <button onClick={() => { setShowExamSheet(true); setExamError(null) }} style={{
          flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: '1.5px solid #e5e7eb',
          background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>＋ Exam</button>
      </div>

      {/* ── Exam info bar ── */}
      {activeExam && (
        <div style={{ margin: '10px 16px 0', padding: '10px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>📅 {TERM_LABELS[activeExam.term - 1]} · {activeExam.academic_year}</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>📝 {activeExam.exam_type.charAt(0).toUpperCase() + activeExam.exam_type.slice(1)}</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>✅ Pass: {activeExam.pass_mark}</span>
          {activeExam.is_locked && <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 700 }}>🔒 Locked</span>}
        </div>
      )}

      {/* ── Tabs ── */}
      {activeExam && (
        <div style={{ display: 'flex', gap: 0, margin: '14px 16px 0', borderRadius: 12, background: '#f3f4f6', padding: 4 }}>
          {(['entry', 'analysis'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: activeTab === tab ? '#fff'    : 'transparent',
              color:      activeTab === tab ? '#0a0a0a' : '#9ca3af',
              boxShadow:  activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
              {tab === 'entry' ? '✏️ Mark Entry' : '📈 Analysis'}
            </button>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════
          MARK ENTRY TAB
      ════════════════════════════════════ */}
      {activeTab === 'entry' && (
        <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* No exam selected */}
          {!activeExam && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>
              <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>📋</span>
              Create or select an exam above to start entering marks.
            </div>
          )}

          {/* Tier 2 & 3: add student button */}
          {activeExam && tier !== 1 && (
            <button onClick={() => setShowAddStudent(true)} style={{
              padding: '10px 0', borderRadius: 12, border: '1.5px dashed #d1d5db',
              background: '#fafafa', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>＋ Add student</button>
          )}

          {/* Student rows */}
          {activeExam && (loading
            ? [1,2,3,4].map(i => <Skeleton key={i} h={64} />)
            : students.length === 0
              ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>
                  <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>👥</span>
                  {tier === 1 ? 'No students enrolled in this class.' : 'No students yet. Tap + Add student above.'}
                </div>
              )
              : students.map(student => {
                  const result   = results.find(r => r.student_id === student.id)
                  const isAbsent = result?.is_absent ?? false
                  const draft    = draftMarks[student.id] ?? ''
                  const marks    = parseFloat(draft)
                  const grade    = (!isAbsent && !isNaN(marks) && marks >= 0) ? getGrade(marks) : null
                  const gc       = grade ? gradeColor(grade) : null
                  const isSaving = savingId === student.id
                  const locked   = activeExam.is_locked

                  return (
                    <div key={student.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 14, background: '#fff',
                      border: `1.5px solid ${isAbsent ? '#fca5a5' : result ? '#d1fae5' : '#f0f0f0'}`,
                      opacity: locked ? 0.75 : 1,
                    }}>

                      {/* Grade badge */}
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: gc ? gc.bg   : '#f3f4f6',
                        color:      gc ? gc.color : '#9ca3af',
                        fontSize: 13, fontWeight: 800,
                      }}>
                        {isAbsent ? 'ABS' : grade ?? '—'}
                      </div>

                      {/* Name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0a0a0a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {student.name}
                        </p>
                        {student.class_name {student.class_name && ({student.class_name && ( (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>{student.class_name}</p>
                        )}
                        {activeExam && (
                          <a href={`/teacher/results/report-card/${student.id}?examId=${activeExam.id}`} style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>📄 Report Card →</a>
                        )}
                        {false && (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>{student.class_name}</p>
                        )}
                        {!isAbsent && marks >= 0 && !isNaN(marks) && (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: marks >= passM ? '#065f46' : '#991b1b', fontWeight: 600 }}>
                            {marks >= passM ? '✓ Pass' : '✗ Below pass mark'}
                          </p>
                        )}
                      </div>

                      {/* Mark input */}
                      {!locked && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <input
                            type="number"
                            min={0} max={100}
                            placeholder="—"
                            value={isAbsent ? '' : draft}
                            disabled={isAbsent || locked}
                            onChange={e => setDraftMarks(prev => ({ ...prev, [student.id]: e.target.value }))}
                            onBlur={() => saveMark(student)}
                            style={{
                              width: 64, padding: '8px 10px', borderRadius: 10,
                              border: '1.5px solid #e5e7eb', fontSize: 15, fontWeight: 700,
                              textAlign: 'center', color: '#0a0a0a', background: isAbsent ? '#f9fafb' : '#fff',
                              outline: 'none',
                            }}
                          />
                          {/* Absent toggle */}
                          <button
                            onClick={() => {
                              if (isAbsent) {
                                setResults(prev => prev.map(r => r.student_id === student.id ? { ...r, is_absent: false } : r))
                              } else {
                                saveMark(student, true)
                              }
                            }}
                            style={{
                              width: 36, height: 36, borderRadius: 10, border: 'none',
                              cursor: 'pointer', fontSize: 13, fontWeight: 700,
                              background: isAbsent ? '#fee2e2' : '#f3f4f6',
                              color:      isAbsent ? '#991b1b' : '#9ca3af',
                            }}
                            title="Mark absent"
                          >
                            {isSaving ? '…' : isAbsent ? 'ABS' : '○'}
                          </button>
                        </div>
                      )}

                      {/* Locked: show mark only */}
                      {locked && (
                        <div style={{
                          padding: '6px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800,
                          background: gc ? gc.bg : '#f3f4f6',
                          color:      gc ? gc.color : '#9ca3af',
                        }}>
                          {isAbsent ? 'ABS' : draft || '—'}
                        </div>
                      )}
                    </div>
                  )
                })
          )}
        </div>
      )}

      {/* ════════════════════════════════════
          ANALYSIS TAB
      ════════════════════════════════════ */}
      {activeTab === 'analysis' && (
        <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!analysis
            ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>
                <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>📈</span>
                Enter marks first to see analysis.
              </div>
            )
            : (
              <>
                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Average',  value: analysis.avg.toFixed(1),     icon: '📊', bg: '#dbeafe', color: '#1e40af' },
                    { label: 'Highest',  value: String(analysis.highest),     icon: '🏆', bg: '#d1fae5', color: '#065f46' },
                    { label: 'Lowest',   value: String(analysis.lowest),      icon: '📉', bg: '#fee2e2', color: '#991b1b' },
                    { label: 'Absent',   value: String(analysis.absent),      icon: '🚫', bg: '#f3f4f6', color: '#6b7280' },
                  ].map(c => (
                    <div key={c.label} style={{ padding: '14px 12px', borderRadius: 14, background: c.bg }}>
                      <p style={{ margin: 0, fontSize: 11, color: c.color, fontWeight: 600 }}>{c.icon} {c.label}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</p>
                    </div>
                  ))}
                </div>

                {/* Pass/fail bar */}
                <div style={{ padding: '14px', borderRadius: 14, background: '#fff', border: '1px solid #f0f0f0' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#374151' }}>
                    Pass vs Fail · pass mark {passM}
                  </p>
                  <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 24 }}>
                    <div style={{ flex: analysis.passed, background: '#10b981' }} />
                    <div style={{ flex: analysis.failed, background: '#ef4444' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>✓ {analysis.passed} passed</span>
                    <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>✗ {analysis.failed} failed</span>
                  </div>
                </div>

                {/* Grade distribution */}
                <div style={{ padding: '14px', borderRadius: 14, background: '#fff', border: '1px solid #f0f0f0' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#374151' }}>Grade distribution</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {['A','A-','B+','B','B-','C+','C','C-','D+','D','D-','E'].map(g => {
                      const count = analysis.grades[g] ?? 0
                      if (count === 0) return null
                      const gc    = gradeColor(g)
                      const pct   = Math.round((count / analysis.total) * 100)
                      return (
                        <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 28, fontSize: 12, fontWeight: 800, color: gc.color, textAlign: 'right' }}>{g}</span>
                          <div style={{ flex: 1, height: 16, borderRadius: 6, background: '#f3f4f6', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: gc.color, borderRadius: 6 }} />
                          </div>
                          <span style={{ width: 28, fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Below pass mark list */}
                {analysis.failed > 0 && (
                  <div style={{ padding: '14px', borderRadius: 14, background: '#fff7f7', border: '1px solid #fca5a5' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#991b1b' }}>⚠️ Below pass mark</p>
                    {students
                      .filter(s => {
                        const r = results.find(x => x.student_id === s.id)
                        return r && !r.is_absent && r.marks < passM
                      })
                      .map(s => {
                        const r  = results.find(x => x.student_id === s.id)!
                        const gc = gradeColor(getGrade(r.marks))
                        return (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #fee2e2' }}>
                            <span style={{ fontSize: 13, color: '#0a0a0a' }}>{s.name}</span>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>{r.marks}</span>
                              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, background: gc.bg, color: gc.color }}>{getGrade(r.marks)}</span>
                            </div>
                          </div>
                        )
                      })
                    }
                  </div>
                )}
              </>
            )
          }
        </div>
      )}

      {/* ════════════════════════════════════
          CREATE EXAM SHEET
      ════════════════════════════════════ */}
      {showExamSheet && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setShowExamSheet(false) }}>
          <div style={sheetStyle}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb', margin: '0 auto 16px' }} />
            <p style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#0a0a0a' }}>📋 New Exam</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Exam name *</label>
                <input placeholder="e.g. End Term 1 Exam" value={newExamName} onChange={e => setNewExamName(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Type</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {EXAM_TYPES.map(t => (
                    <button key={t} onClick={() => setNewExamType(t)} style={{
                      padding: '6px 12px', borderRadius: 16, border: '1.5px solid',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      borderColor: newExamType === t ? '#10b981' : '#e5e7eb',
                      background:  newExamType === t ? '#d1fae5' : '#fafafa',
                      color:       newExamType === t ? '#065f46' : '#6b7280',
                    }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Term</label>
                  <select value={newExamTerm} onChange={e => setNewExamTerm(Number(e.target.value))} style={selectStyle}>
                    {[1,2,3].map(t => <option key={t} value={t}>Term {t}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Year</label>
                  <input type="number" value={newExamYear} onChange={e => setNewExamYear(Number(e.target.value))} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Pass mark (default 50)</label>
                <input type="number" min={0} max={100} value={newExamPass} onChange={e => setNewExamPass(Number(e.target.value))} style={inputStyle} />
              </div>

              {examError && <p style={{ color: '#991b1b', fontSize: 12, margin: 0 }}>⚠️ {examError}</p>}

              <button onClick={createExam} disabled={creatingExam} style={{ ...btnPrimary, background: creatingExam ? '#d1d5db' : '#10b981' }}>
                {creatingExam ? 'Creating…' : 'Create Exam'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════
          ADD STUDENT SHEET (Tier 2 & 3)
      ════════════════════════════════════ */}
      {showAddStudent && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setShowAddStudent(false) }}>
          <div style={sheetStyle}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb', margin: '0 auto 16px' }} />
            <p style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#0a0a0a' }}>👤 Add Student</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Student name *</label>
                <input placeholder="Full name" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Class / stream (optional)</label>
                <input placeholder="e.g. Grade 6 Mango" value={newStudentClass} onChange={e => setNewStudentClass(e.target.value)} style={inputStyle} />
              </div>
              <button onClick={addManualStudent} disabled={addingStudent || !newStudentName.trim()} style={{ ...btnPrimary, background: (!newStudentName.trim() || addingStudent) ? '#d1d5db' : '#10b981' }}>
                {addingStudent ? 'Adding…' : 'Add Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  )
}

// ─── Export ────────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <ResultsInner />
    </Suspense>
  )
}
