'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, SectionLabel, Btn, C } from '@/components/teacher/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassOption {
  id: string
  name: string
  stream: string
}

interface SubjectOption {
  id: string
  name: string
}

interface CbcRow {
  id: string
  student_id: string
  studentName: string
  sub_strand: string
  assessment_type: string
  performance: string
  term: number
  academic_year: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Skeleton({ h = 56 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AssessmentInner() {
  const [classes, setClasses]         = useState<ClassOption[]>([])
  const [subjects, setSubjects]       = useState<SubjectOption[]>([])
  const [activeClassIdx, setActiveClassIdx] = useState(0)
  const [activeSubjectIdx, setActiveSubjectIdx] = useState(0)
  const [cbcRows, setCbcRows]         = useState<CbcRow[]>([])
  const [schoolId, setSchoolId]       = useState<string | null>(null)
  const [teacherId, setTeacherId]     = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const searchParams = useSearchParams()

  // ── Bootstrap: get teacher, school, classes, subjects ────────────────────
  useEffect(() => {
    async function boot() {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not signed in.'); setLoading(false); return }

      setTeacherId(user.id)

      const [memberRes, tcRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('school_id')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('teacher_classes')
          .select('class_id, subject_id')
          .eq('teacher_id', user.id),
      ])

      if (memberRes.error) { setError(memberRes.error.message); setLoading(false); return }
      if (tcRes.error)     { setError(tcRes.error.message);     setLoading(false); return }

      const sid = memberRes.data?.school_id ?? null
      setSchoolId(sid)

      const classIds   = Array.from(new Set((tcRes.data ?? []).map((r: { class_id: string }) => r.class_id)))
      const subjectIds = Array.from(new Set((tcRes.data ?? []).map((r: { subject_id: string }) => r.subject_id)))

      if (classIds.length === 0) {
        setLoading(false)
        return
      }

      const [classesRes, subjectsRes] = await Promise.all([
        supabase
          .from('classes')
          .select('id, name, stream')
          .in('id', classIds),
        supabase
          .from('subjects')
          .select('id, name')
          .in('id', subjectIds),
      ])

      if (classesRes.error)  { setError(classesRes.error.message);  setLoading(false); return }
      if (subjectsRes.error) { setError(subjectsRes.error.message); setLoading(false); return }

      const loadedClasses  = classesRes.data  ?? []
      const loadedSubjects = subjectsRes.data ?? []
      setClasses(loadedClasses)
      setSubjects(loadedSubjects)
      const urlClassId   = searchParams.get('classId')
      const urlSubjectId = searchParams.get('subjectId')
      if (urlClassId) {
        const idx = loadedClasses.findIndex((c: { id: string }) => c.id === urlClassId)
        if (idx !== -1) setActiveClassIdx(idx)
      }
      if (urlSubjectId) {
        const idx = loadedSubjects.findIndex((s: { id: string }) => s.id === urlSubjectId)
        if (idx !== -1) setActiveSubjectIdx(idx)
      }
      setLoading(false)
    }

    boot()
  }, [])

  // ── Load CBC when class/subject selection changes ────────────────────────
  useEffect(() => {
    if (!schoolId || !teacherId || classes.length === 0 || subjects.length === 0) return

    async function loadData() {
      setDataLoading(true)

      const classId   = classes[activeClassIdx]?.id
      const subjectId = subjects[activeSubjectIdx]?.id
      if (!classId || !subjectId) { setDataLoading(false); return }

      // Get students in this class
      const { data: scData, error: scErr } = await supabase
        .from('student_classes')
        .select('student_id')
        .eq('class_id', classId)
        .eq('is_current', true)

      if (scErr || !scData || scData.length === 0) {
        setCbcRows([])
        setDataLoading(false)
        return
      }

      const studentIds = Array.from(new Set(scData.map((r: { student_id: string }) => r.student_id)))

      // Parallel: CBC assessments + student names (traditional_grades table does not exist)
      const [cbcRes, studentsRes] = await Promise.all([
        supabase
          .from('cbc_assessments')
          .select('id, student_id, sub_strand, assessment_type, performance, term, academic_year')
          .eq('class_id', classId)
          .eq('subject_id', subjectId)
          .eq('school_id', schoolId ?? '')
          .in('student_id', studentIds),
        supabase
          .from('students')
          .select('id, name')
          .in('id', studentIds),
      ])

      if (cbcRes.error)     { setError(cbcRes.error.message);     setDataLoading(false); return }
      if (studentsRes.error){ setError(studentsRes.error.message); setDataLoading(false); return }

      const nameMap = new Map<string, string>(
        (studentsRes.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name])
      )


      setCbcRows(
        (cbcRes.data ?? []).map((c: {
          id: string; student_id: string; sub_strand: string;
          assessment_type: string; performance: string; term: number; academic_year: number
        }) => ({
          ...c,
          studentName: nameMap.get(c.student_id) ?? 'Unknown',
        }))
      )

      setDataLoading(false)
    }

    loadData()
  }, [classes, subjects, activeClassIdx, activeSubjectIdx, schoolId, teacherId])

  const activeClass   = classes[activeClassIdx]   ?? null
  const activeSubject = subjects[activeSubjectIdx] ?? null

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #92400e 0%, #f59e0b 100%)',
          borderRadius: 20, padding: '20px', color: '#fff',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            Assessment
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
            Scores & Progressive Records
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            Linked to scheme of work and parent reports.
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fef2f2', color: C.error, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Boot skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton h={44} />
            <Skeleton h={200} />
          </div>
        )}

        {/* No classes */}
        {!loading && !error && classes.length === 0 && (
          <Card>
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.textMuted, fontSize: 13 }}>
              No classes assigned yet. Contact your school admin to get set up.
            </div>
          </Card>
        )}

        {/* Class tabs */}
        {!loading && classes.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {classes.map((cl, i) => (
              <button
                key={cl.id}
                onClick={() => setActiveClassIdx(i)}
                style={{
                  padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: i === activeClassIdx ? C.warning : C.surface,
                  color:      i === activeClassIdx ? '#fff'    : C.textMuted,
                }}
              >
                {cl.name} {cl.stream}
              </button>
            ))}
          </div>
        )}

        {/* Subject tabs */}
        {!loading && subjects.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {subjects.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActiveSubjectIdx(i)}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: `1px solid ${C.border}`, cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: i === activeSubjectIdx ? C.dark : C.bg,
                  color:      i === activeSubjectIdx ? '#fff' : C.textMuted,
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* Data loading skeletons */}
        {dataLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} h={48} />)}
          </div>
        )}

        {/* CBC assessments */}
        {!loading && !dataLoading && activeClass && (
          <Card>
            <SectionLabel>CBC — Strand Performance</SectionLabel>

            {cbcRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: C.textMuted }}>
                No CBC assessments recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {cbcRows.map((c, idx) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 0',
                      borderBottom: idx < cbcRows.length - 1 ? `1px solid ${C.border}` : 'none',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>
                        {c.studentName}
                      </div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>
                        {c.sub_strand} · {c.assessment_type} · Term {c.term}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 11, fontWeight: 700,
                      padding: '3px 10px', borderRadius: 20,
                      background: C.accentLight, color: C.accent,
                    }}>
                      {c.performance}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

      </div>

    </>
  )
}
export default function AssessmentPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontSize: 13, color: C.textMuted }}>Loading…</div>}>
      <AssessmentInner />
    </Suspense>
  )
}
