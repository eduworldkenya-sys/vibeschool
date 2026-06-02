"use client";

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams }    from 'next/navigation'
import { supabase }                      from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id:         string
  name:       string
  admission?: string
  source:     'db' | 'manual'
  class_name?: string
}

interface Exam {
  id:            string
  name:          string
  term:          number
  academic_year: number
  exam_type:     string
  pass_mark:     number
}

interface Result {
  id:         string
  student_id: string
  subject_id: string | null
  marks:      number
  is_absent:  boolean
}

interface Subject {
  id:   string
  name: string
}

interface Remarks {
  remarks:  string | null
  conduct:  string | null
}

interface CbcAssessment {
  id:              string
  strand_id:       string
  sub_strand:      string | null
  assessment_type: string
  performance:     string
  term:            number
}

interface Strand {
  id:   string
  name: string
}

// ─── Grade utility ────────────────────────────────────────────────────────────

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

function gradePoints(grade: string): number {
  const map: Record<string, number> = {
    'A': 12, 'A-': 11, 'B+': 10, 'B': 9, 'B-': 8,
    'C+': 7, 'C': 6, 'C-': 5, 'D+': 4, 'D': 3, 'D-': 2, 'E': 1,
  }
  return map[grade] ?? 0
}

function meanGrade(grades: string[]): string {
  if (grades.length === 0) return '—'
  const avg = grades.reduce((a, g) => a + gradePoints(g), 0) / grades.length
  if (avg >= 11.5) return 'A'
  if (avg >= 10.5) return 'A-'
  if (avg >= 9.5)  return 'B+'
  if (avg >= 8.5)  return 'B'
  if (avg >= 7.5)  return 'B-'
  if (avg >= 6.5)  return 'C+'
  if (avg >= 5.5)  return 'C'
  if (avg >= 4.5)  return 'C-'
  if (avg >= 3.5)  return 'D+'
  if (avg >= 2.5)  return 'D'
  if (avg >= 1.5)  return 'D-'
  return 'E'
}

function gradeColor(grade: string): { bg: string; color: string } {
  if (grade === 'A')                          return { bg: '#d1fae5', color: '#065f46' }
  if (grade === 'A-' || grade === 'B+')       return { bg: '#dbeafe', color: '#1e40af' }
  if (['B','B-','C+'].includes(grade))        return { bg: '#fef3c7', color: '#92400e' }
  if (['C','C-','D+'].includes(grade))        return { bg: '#fed7aa', color: '#9a3412' }
  return { bg: '#fee2e2', color: '#991b1b' }
}

// ─── CBC performance ──────────────────────────────────────────────────────────

const PERF_OPTIONS = [
  { value: 'exceeds_expectation',    short: 'EE', label: 'Exceeds Expectation',    bg: '#d1fae5', color: '#065f46' },
  { value: 'meets_expectation',      short: 'ME', label: 'Meets Expectation',      bg: '#dbeafe', color: '#1e40af' },
  { value: 'approaches_expectation', short: 'AE', label: 'Approaches Expectation', bg: '#fef3c7', color: '#92400e' },
  { value: 'below_expectation',      short: 'BE', label: 'Below Expectation',      bg: '#fee2e2', color: '#991b1b' },
]

function perfMeta(value: string) {
  return PERF_OPTIONS.find(p => p.value === value) ?? PERF_OPTIONS[1]
}

function aggregatePerf(performances: string[]): string {
  if (performances.length === 0) return 'meets_expectation'
  const order = ['exceeds_expectation','meets_expectation','approaches_expectation','below_expectation']
  const counts: Record<string, number> = {}
  for (const p of performances) counts[p] = (counts[p] ?? 0) + 1
  let best = performances[0]; let bestCount = 0
  for (const level of order) {
    if ((counts[level] ?? 0) > bestCount) { bestCount = counts[level]; best = level }
  }
  return best
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ h = 40 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 10,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function ReportCardInner() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const studentId    = params.studentId as string
  const examId       = searchParams.get('examId')
  const mode         = (searchParams.get('mode') ?? '844') as '844' | 'cbc'

  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [student,      setStudent]      = useState<Student | null>(null)
  const [exam,         setExam]         = useState<Exam | null>(null)
  const [results,      setResults]      = useState<Result[]>([])
  const [subjects,     setSubjects]     = useState<Subject[]>([])
  const [cbcData,      setCbcData]      = useState<CbcAssessment[]>([])
  const [strands,      setStrands]      = useState<Strand[]>([])
  const [remarks,      setRemarks]      = useState<Remarks>({ remarks: null, conduct: null })
  const [editRemarks,  setEditRemarks]  = useState(false)
  const [draftRemarks, setDraftRemarks] = useState('')
  const [draftConduct, setDraftConduct] = useState('')
  const [savingRem,    setSavingRem]    = useState(false)
  const [teacherId,    setTeacherId]    = useState<string | null>(null)
  const [schoolId,     setSchoolId]     = useState<string | null>(null)
  const [classId,      setClassId]      = useState<string | null>(null)
  const [schoolName,   setSchoolName]   = useState<string>('')
  const [position,     setPosition]     = useState<number | null>(null)
  const [totalStudents,setTotalStudents]= useState<number>(0)
  const [activeMode,   setActiveMode]   = useState<'844' | 'cbc'>(mode)

  useEffect(() => { boot() }, [studentId, examId])

  async function boot() {
    setLoading(true); setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setLoading(false); return }
    setTeacherId(user.id)

    const { data: profile } = await supabase
      .from('profiles').select('school_id').eq('id', user.id).maybeSingle()
    const sid = profile?.school_id ?? null
    setSchoolId(sid)

    // School name
    if (sid) {
      const { data: school } = await supabase
        .from('schools').select('name').eq('id', sid).maybeSingle()
      setSchoolName(school?.name ?? '')
    }

    // Student — try DB students first, then manual
    const { data: dbStudent } = await supabase
      .from('students').select('id, name, admission_number').eq('id', studentId).maybeSingle()

    if (dbStudent) {
      setStudent({ id: dbStudent.id, name: dbStudent.name, admission: dbStudent.admission_number, source: 'db' })
    } else {
      const { data: manualStudent } = await supabase
        .from('manual_students').select('id, name, class_name').eq('id', studentId).maybeSingle()
      if (manualStudent) {
        setStudent({ id: manualStudent.id, name: manualStudent.name, source: 'manual', class_name: manualStudent.class_name })
      }
    }

    if (!examId) { setLoading(false); return }

    // Exam
    const { data: examData } = await supabase
      .from('exams').select('*').eq('id', examId).maybeSingle()
    if (examData) setExam(examData as Exam)

    // Results for this student
    const { data: resultsData } = await supabase
      .from('exam_results')
      .select('id, student_id, subject_id, marks, is_absent')
      .eq('exam_id', examId)
      .eq('student_id', studentId)
    setResults((resultsData ?? []) as Result[])

    // All results for this exam + class (for position)
    const { data: classResults } = await supabase
      .from('exam_results')
      .select('student_id, marks, is_absent, class_id')
      .eq('exam_id', examId)

    if (classResults && classResults.length > 0) {
      const cid = (classResults as { class_id: string }[]).find(r => r.class_id)?.class_id ?? null
      setClassId(cid)

      // Group by student, sum marks
      const studentTotals: Record<string, number> = {}
      for (const r of classResults as { student_id: string; marks: number; is_absent: boolean }[]) {
        if (!r.is_absent) {
          studentTotals[r.student_id] = (studentTotals[r.student_id] ?? 0) + r.marks
        }
      }
      const myTotal = studentTotals[studentId] ?? 0
      const sorted  = Object.values(studentTotals).sort((a, b) => b - a)
      const pos     = sorted.indexOf(myTotal) + 1
      setPosition(pos)
      setTotalStudents(Object.keys(studentTotals).length)
    }

    // Subjects
    const subjectIds = Array.from(new Set(
      (resultsData ?? [])
        .map((r: { subject_id: string | null }) => r.subject_id)
        .filter((x): x is string => !!x)
    ))
    if (subjectIds.length > 0) {
      const { data: subjectsData } = await supabase
        .from('subjects').select('id, name').in('id', subjectIds)
      setSubjects((subjectsData ?? []) as Subject[])
    }

    // CBC assessments for this student + term
    if (examData) {
      const { data: cbcRows } = await supabase
        .from('cbc_assessments')
        .select('id, strand_id, sub_strand, assessment_type, performance, term')
        .eq('student_id', studentId)
        .eq('term', (examData as Exam).term)
      setCbcData((cbcRows ?? []) as CbcAssessment[])

      // Strands
      const strandIds = Array.from(new Set((cbcRows ?? []).map((r: { strand_id: string }) => r.strand_id)))
      if (strandIds.length > 0) {
        const { data: strandsData } = await supabase
          .from('strands').select('id, name').in('id', strandIds)
        setStrands((strandsData ?? []) as Strand[])
      }
    }

    // Remarks
    const { data: remData } = await supabase
      .from('report_card_remarks')
      .select('remarks, conduct')
      .eq('exam_id', examId)
      .eq('student_id', studentId)
      .maybeSingle()
    if (remData) {
      setRemarks({ remarks: remData.remarks, conduct: remData.conduct })
      setDraftRemarks(remData.remarks ?? '')
      setDraftConduct(remData.conduct ?? '')
    }

    setLoading(false)
  }

  // ── Save remarks ───────────────────────────────────────────────────────────

  async function saveRemarks() {
    if (!examId || !teacherId || !studentId) return
    setSavingRem(true)

    const payload = {
      exam_id:          examId,
      student_id:       studentId,
      class_teacher_id: teacherId,
      remarks:          draftRemarks.trim() || null,
      conduct:          draftConduct.trim() || null,
      school_id:        schoolId,
      class_id:         classId,
    }

    const existing = remarks.remarks !== null || remarks.conduct !== null
    if (existing) {
      await supabase.from('report_card_remarks')
        .update({ remarks: payload.remarks, conduct: payload.conduct })
        .eq('exam_id', examId).eq('student_id', studentId)
    } else {
      await supabase.from('report_card_remarks').insert(payload)
    }

    setRemarks({ remarks: payload.remarks ?? null, conduct: payload.conduct ?? null })
    setEditRemarks(false)
    setSavingRem(false)
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  function subjectName(id: string | null): string {
    if (!id) return 'Unknown'
    return subjects.find(s => s.id === id)?.name ?? 'Unknown'
  }

  function strandName(id: string): string {
    return strands.find(s => s.id === id)?.name ?? 'Unknown'
  }

  const totalMarks  = results.filter(r => !r.is_absent).reduce((a, r) => a + r.marks, 0)
  const meanScore   = results.filter(r => !r.is_absent).length > 0
    ? totalMarks / results.filter(r => !r.is_absent).length : 0
  const allGrades   = results.filter(r => !r.is_absent).map(r => getGrade(r.marks))
  const overallGrade = allGrades.length > 0 ? meanGrade(allGrades) : null
  const overallGC    = overallGrade ? gradeColor(overallGrade) : null

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton h={80} /><Skeleton h={40} /><Skeleton h={56} /><Skeleton h={56} /><Skeleton h={56} />
    </div>
  )

  if (error) return (
    <div style={{ padding: 24, color: '#991b1b', fontSize: 14 }}>⚠️ {error}</div>
  )

  if (!student) return (
    <div style={{ padding: 24, color: '#6b7280', fontSize: 14 }}>Student not found.</div>
  )

  return (
    <div style={{ padding: '0 0 80px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>

      {/* ── Print header (visible on print only) ── */}
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @media print {
          .no-print { display: none !important; }
          .print-card { box-shadow: none !important; margin: 0 !important; }
          body { background: #fff !important; }
        }
      `}</style>

      {/* ── Top bar ── */}
      <div className="no-print" style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0a0a0a' }}>📄 Report Card</h1>
        <button
          onClick={() => window.print()}
          style={{ padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: '#0a0a0a', color: '#fff' }}
        >
          🖨 Print
        </button>
      </div>

      {/* ── Mode toggle ── */}
      <div className="no-print" style={{ display: 'flex', gap: 0, margin: '12px 16px 0', borderRadius: 12, background: '#f3f4f6', padding: 4 }}>
        {(['844', 'cbc'] as const).map(m => (
          <button key={m} onClick={() => setActiveMode(m)} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: activeMode === m ? '#fff'    : 'transparent',
            color:      activeMode === m ? '#0a0a0a' : '#9ca3af',
            boxShadow:  activeMode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
          }}>
            {m === '844' ? '📝 8-4-4 Marks' : '🌿 CBC Strands'}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          REPORT CARD BODY
      ══════════════════════════════════════════ */}
      <div className="print-card" style={{ margin: '16px', borderRadius: 16, border: '2px solid #e5e7eb', overflow: 'hidden', background: '#fff' }}>

        {/* School header */}
        <div style={{ background: '#0a0a0a', padding: '20px 20px 16px', textAlign: 'center' }}>
          {schoolName && <p style={{ margin: '0 0 4px', fontSize: 11, color: '#9ca3af', letterSpacing: 2, textTransform: 'uppercase' }}>{schoolName}</p>}
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>
            {activeMode === '844' ? 'ACADEMIC REPORT CARD' : 'CBC PERFORMANCE REPORT'}
          </p>
          {exam && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#10b981' }}>
              {exam.name} · Term {exam.term} · {exam.academic_year}
            </p>
          )}
        </div>

        {/* Student info */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Student Name', value: student.name },
            { label: 'Admission No.', value: student.admission ?? student.class_name ?? '—' },
            { label: 'Term', value: exam ? `Term ${exam.term}` : '—' },
            { label: 'Year', value: exam ? String(exam.academic_year) : '—' },
          ].map(f => (
            <div key={f.label}>
              <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{f.label}</p>
              <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: '#0a0a0a' }}>{f.value}</p>
            </div>
          ))}
        </div>

        {/* ── 8-4-4 mode ── */}
        {activeMode === '844' && (
          <>
            {/* Subject results table */}
            <div style={{ padding: '0 0 0' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 48px', padding: '8px 20px', background: '#f8fafc', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Subject</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', textAlign: 'center' }}>Marks</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', textAlign: 'center' }}>Grade</span>
              </div>

              {results.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No results recorded yet.</div>
              ) : (
                results.map(r => {
                  const grade = r.is_absent ? null : getGrade(r.marks)
                  const gc    = grade ? gradeColor(grade) : null
                  return (
                    <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 48px', padding: '12px 20px', borderBottom: '1px solid #f9fafb', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, color: '#0a0a0a', fontWeight: 500 }}>{subjectName(r.subject_id)}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: r.is_absent ? '#9ca3af' : '#0a0a0a', textAlign: 'center' }}>
                        {r.is_absent ? 'ABS' : r.marks}
                      </span>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {grade && gc ? (
                          <span style={{ padding: '3px 8px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: gc.bg, color: gc.color }}>{grade}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>—</span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Summary */}
            {results.length > 0 && (
              <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '2px solid #e5e7eb', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Total Marks', value: totalMarks.toFixed(1) },
                  { label: 'Mean Score',  value: meanScore.toFixed(1)  },
                  { label: 'Mean Grade',  value: overallGrade ?? '—'   },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: overallGC?.color ?? '#0a0a0a' }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Position */}
            {position !== null && totalStudents > 0 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>Class Position</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a' }}>
                  {position}<span style={{ fontSize: 11, color: '#9ca3af' }}>/{totalStudents}</span>
                </span>
              </div>
            )}
          </>
        )}

        {/* ── CBC mode ── */}
        {activeMode === 'cbc' && (
          <div>
            {cbcData.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No CBC assessments recorded for this term.
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 48px', padding: '8px 20px', background: '#f8fafc', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Strand</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', textAlign: 'center' }}>Type</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', textAlign: 'center' }}>Level</span>
                </div>

                {cbcData.map(a => {
                  const pm = perfMeta(a.performance)
                  return (
                    <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 48px', padding: '12px 20px', borderBottom: '1px solid #f9fafb', alignItems: 'center' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0a0a0a' }}>{strandName(a.strand_id)}</p>
                        {a.sub_strand && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>{a.sub_strand}</p>}
                      </div>
                      <span style={{ fontSize: 11, color: '#6b7280', textAlign: 'center' }}>{a.assessment_type}</span>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <span style={{ padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 800, background: pm.bg, color: pm.color }}>{pm.short}</span>
                      </div>
                    </div>
                  )
                })}

                {/* CBC aggregate */}
                {(() => {
                  const agg = aggregatePerf(cbcData.map(a => a.performance))
                  const pm  = perfMeta(agg)
                  return (
                    <div style={{ padding: '14px 20px', background: pm.bg, borderTop: '2px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: pm.color }}>Overall Performance</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: pm.color }}>{pm.label}</span>
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )}

        {/* ── Remarks ── */}
        <div style={{ padding: '16px 20px', borderTop: '2px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 1 }}>Class Teacher Remarks</p>
            <button className="no-print" onClick={() => { setEditRemarks(e => !e); setDraftRemarks(remarks.remarks ?? ''); setDraftConduct(remarks.conduct ?? '') }} style={{
              padding: '4px 12px', borderRadius: 12, border: '1.5px solid #e5e7eb',
              background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              {editRemarks ? 'Cancel' : '✏️ Edit'}
            </button>
          </div>

          {editRemarks ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                placeholder="Write remarks about this student's performance…"
                value={draftRemarks}
                onChange={e => setDraftRemarks(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
              />
              <input
                placeholder="Conduct (e.g. Excellent, Good, Fair)"
                value={draftConduct}
                onChange={e => setDraftConduct(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
              <button onClick={saveRemarks} disabled={savingRem} style={{
                padding: '12px 0', borderRadius: 12, border: 'none',
                cursor: savingRem ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700,
                background: savingRem ? '#d1d5db' : '#10b981', color: '#fff',
              }}>
                {savingRem ? 'Saving…' : 'Save Remarks'}
              </button>
            </div>
          ) : (
            <div>
              <p style={{ margin: 0, fontSize: 13, color: remarks.remarks ? '#0a0a0a' : '#9ca3af', fontStyle: remarks.remarks ? 'normal' : 'italic', lineHeight: 1.6 }}>
                {remarks.remarks ?? 'No remarks added yet.'}
              </p>
              {remarks.conduct && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280' }}>
                  Conduct: <strong style={{ color: '#0a0a0a' }}>{remarks.conduct}</strong>
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Signature lines ── */}
        <div style={{ padding: '16px 20px 24px', borderTop: '1px solid #f0f0f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {['Class Teacher', "Principal's"].map(label => (
            <div key={label}>
              <div style={{ height: 1, background: '#0a0a0a', marginBottom: 6 }} />
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{label} Signature</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  )
}

// ─── Export ────────────────────────────────────────────────────────────────────

export default function ReportCardPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading report card…</div>}>
      <ReportCardInner />
    </Suspense>
  )
}
