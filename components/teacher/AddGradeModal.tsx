'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, C } from '@/components/teacher/ui'

interface StudentOption { id: string; name: string }
interface StrandOption  { id: string; name: string }

interface Props {
  teacherId: string
  schoolId:  string
  classId:   string
  subjectId: string
  onClose:   () => void
  onSaved:   () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: `1.5px solid ${C.border}`,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  background: C.surface,
  color: C.textPrimary,
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: C.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  marginBottom: 6,
  display: 'block',
}

const CBC_PERFORMANCE = ['EM', 'ME', 'EE', 'BE'] // Exceeding, Meeting, Approaching, Below

export default function AddGradeModal({
  teacherId, schoolId, classId, subjectId, onClose, onSaved,
}: Props) {
  const [students, setStudents] = useState<StudentOption[]>([])
  const [strands,  setStrands]  = useState<StrandOption[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [mode,     setMode]     = useState<'traditional' | 'cbc'>('traditional')

  // Traditional fields
  const [studentId,   setStudentId]   = useState('')
  const [assessment,  setAssessment]  = useState('')
  const [marks,       setMarks]       = useState('')
  const [outOf,       setOutOf]       = useState('100')
  const [term,        setTerm]        = useState('1')
  const [year,        setYear]        = useState(String(new Date().getFullYear()))

  // CBC fields
  const [cbcStudentId,   setCbcStudentId]   = useState('')
  const [strandId,       setStrandId]       = useState('')
  const [subStrand,      setSubStrand]      = useState('')
  const [assessmentType, setAssessmentType] = useState('')
  const [performance,    setPerformance]    = useState('ME')
  const [cbcTerm,        setCbcTerm]        = useState('1')
  const [cbcYear,        setCbcYear]        = useState(String(new Date().getFullYear()))

  useEffect(() => {
    async function load() {
      const { data: scData } = await supabase
        .from('student_classes')
        .select('student_id')
        .eq('class_id', classId)
        .eq('is_current', true)

      const studentIds = Array.from(new Set(
        (scData ?? []).map((r: { student_id: string }) => r.student_id)
      ))

      const [studRes, strandRes] = await Promise.all([
        studentIds.length > 0
          ? supabase.from('students').select('id, name').in('id', studentIds)
          : Promise.resolve({ data: [] }),
        supabase.from('strands').select('id, name').eq('subject_id', subjectId).eq('school_id', schoolId),
      ])

      const studs   = (studRes.data   ?? []) as StudentOption[]
      const strandList = (strandRes.data ?? []) as StrandOption[]

      setStudents(studs)
      setStrands(strandList)
      setStudentId(studs[0]?.id      ?? '')
      setCbcStudentId(studs[0]?.id   ?? '')
      setStrandId(strandList[0]?.id  ?? '')
      setLoading(false)
    }
    load()
  }, [classId, subjectId, schoolId])

  async function saveTraditional() {
    setError(null)
    if (!studentId)       { setError('Select a student.');     return }
    if (!assessment.trim()) { setError('Enter assessment name.'); return }
    if (!marks)           { setError('Enter marks.');          return }
    if (!outOf)           { setError('Enter out of value.');   return }

    const marksNum = parseFloat(marks)
    const outOfNum = parseFloat(outOf)
    if (isNaN(marksNum) || isNaN(outOfNum)) { setError('Marks must be numbers.'); return }
    if (marksNum > outOfNum) { setError('Marks cannot exceed out of value.'); return }

    setSaving(true)
    const { error: err } = await supabase
      .from('traditional_grades')
      .insert({
        school_id:     schoolId,
        teacher_id:    teacherId,
        class_id:      classId,
        subject_id:    subjectId,
        student_id:    studentId,
        assessment:    assessment.trim(),
        marks:         marksNum,
        out_of:        outOfNum,
        term:          parseInt(term),
        academic_year: parseInt(year),
      })

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  async function saveCbc() {
    setError(null)
    if (!cbcStudentId)       { setError('Select a student.');      return }
    if (!subStrand.trim())   { setError('Enter sub-strand.');      return }
    if (!assessmentType.trim()) { setError('Enter assessment type.'); return }

    setSaving(true)
    const { error: err } = await supabase
      .from('cbc_assessments')
      .insert({
        school_id:       schoolId,
        teacher_id:      teacherId,
        class_id:        classId,
        subject_id:      subjectId,
        student_id:      cbcStudentId,
        strand_id:       strandId || null,
        sub_strand:      subStrand.trim(),
        assessment_type: assessmentType.trim(),
        performance:     performance,
        term:            parseInt(cbcTerm),
        academic_year:   parseInt(cbcYear),
      })

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: C.bg,
        borderRadius: '20px 20px 0 0',
        padding: '24px 20px 40px',
        width: '100%', maxWidth: 480,
        display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Handle + title */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary }}>Record Assessment</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.textMuted }}>✕</button>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['traditional', 'cbc'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '8px', borderRadius: 10, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                background: mode === m ? C.dark : C.surface,
                color:      mode === m ? '#fff' : C.textMuted,
              }}
            >
              {m === 'traditional' ? 'Traditional' : 'CBC'}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ fontSize: 12, color: C.error, background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: C.textMuted, fontSize: 13 }}>Loading…</div>
        ) : mode === 'traditional' ? (
          <>
            <div>
              <label style={labelStyle}>Student *</label>
              <select value={studentId} onChange={e => setStudentId(e.target.value)} style={inputStyle}>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Assessment Name *</label>
              <input value={assessment} onChange={e => setAssessment(e.target.value)} placeholder="e.g. Mid-Term Test" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Marks *</label>
                <input type="number" value={marks} onChange={e => setMarks(e.target.value)} placeholder="72" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Out Of *</label>
                <input type="number" value={outOf} onChange={e => setOutOf(e.target.value)} placeholder="100" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Term *</label>
                <select value={term} onChange={e => setTerm(e.target.value)} style={inputStyle}>
                  {[1, 2, 3].map(t => <option key={t} value={t}>Term {t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Year *</label>
                <input type="number" value={year} onChange={e => setYear(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <Btn onClick={saveTraditional} disabled={saving}>
              {saving ? 'Saving…' : 'Save Grade'}
            </Btn>
          </>
        ) : (
          <>
            <div>
              <label style={labelStyle}>Student *</label>
              <select value={cbcStudentId} onChange={e => setCbcStudentId(e.target.value)} style={inputStyle}>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {strands.length > 0 && (
              <div>
                <label style={labelStyle}>Strand</label>
                <select value={strandId} onChange={e => setStrandId(e.target.value)} style={inputStyle}>
                  <option value="">— None —</option>
                  {strands.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>Sub-Strand *</label>
              <input value={subStrand} onChange={e => setSubStrand(e.target.value)} placeholder="e.g. Fractions" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Assessment Type *</label>
              <input value={assessmentType} onChange={e => setAssessmentType(e.target.value)} placeholder="e.g. Observation" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Performance *</label>
              <select value={performance} onChange={e => setPerformance(e.target.value)} style={inputStyle}>
                {CBC_PERFORMANCE.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Term *</label>
                <select value={cbcTerm} onChange={e => setCbcTerm(e.target.value)} style={inputStyle}>
                  {[1, 2, 3].map(t => <option key={t} value={t}>Term {t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Year *</label>
                <input type="number" value={cbcYear} onChange={e => setCbcYear(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <Btn onClick={saveCbc} disabled={saving}>
              {saving ? 'Saving…' : 'Save CBC Record'}
            </Btn>
          </>
        )}
      </div>
    </div>
  )
}