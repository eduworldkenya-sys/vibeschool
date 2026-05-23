'use client'

import { useEffect, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, SectionLabel, C } from '@/components/teacher/ui'

interface ClassOption   { id: string; label: string }
interface SubjectOption { id: string; label: string }
interface Strand        { id: string; name: string }
interface Progress      { strand_id: string; term: number; week: number; status: string; notes: string | null }

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  planned:   { bg: '#f3f4f6',     color: '#6b7280', label: 'Planned'   },
  teaching:  { bg: '#dbeafe',     color: '#1d4ed8', label: 'Teaching'  },
  done:      { bg: C.accentLight, color: '#065f46', label: 'Done'      },
  cancelled: { bg: '#fee2e2',     color: '#991b1b', label: 'Cancelled' },
}
const STATUSES = ['planned', 'teaching', 'done', 'cancelled']

function Skeleton({ h = 56 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function SchemePage() {
  const [uid,             setUid]             = useState<string | null>(null)
  const [schoolId,        setSchoolId]        = useState<string | null>(null)
  const [loading,         setLoading]         = useState(true)
  const [classes,         setClasses]         = useState<ClassOption[]>([])
  const [subjects,        setSubjects]        = useState<SubjectOption[]>([])
  const [strands,         setStrands]         = useState<Strand[]>([])
  const [progress,        setProgress]        = useState<Progress[]>([])
  const [selectedClass,   setSelectedClass]   = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [selectedTerm,    setSelectedTerm]    = useState(1)
  const [selectedWeek,    setSelectedWeek]    = useState(1)
  const [fetching,        setFetching]        = useState(false)
  const [saving,          setSaving]          = useState<string | null>(null)
  const [fetchError,      setFetchError]      = useState<string | null>(null)

  useEffect(() => {
    async function boot() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUid(user.id)

      const [profileRes, tcRes] = await Promise.all([
        supabase.from('profiles').select('school_id').eq('id', user.id).single(),
        supabase.from('teacher_classes').select('class_id,subject_id').eq('teacher_id', user.id),
      ])

      const sid = profileRes.data?.school_id ?? null
      setSchoolId(sid)

      const teacherClasses = tcRes.data ?? []
      const classIds   = Array.from(new Set(teacherClasses.map((r: { class_id: string }) => r.class_id)))
      const subjectIds = Array.from(new Set(teacherClasses.map((r: { subject_id: string }) => r.subject_id)))

      if (!sid || classIds.length === 0) { setLoading(false); return }

      const [clRes, subRes] = await Promise.all([
        supabase.from('classes').select('id,name,stream').in('id', classIds),
        supabase.from('subjects').select('id,name').in('id', subjectIds),
      ])

      const classOptions: ClassOption[] = (clRes.data ?? []).map(
        (c: { id: string; name: string; stream: string | null }) => ({
          id: c.id, label: c.stream ? `${c.name} ${c.stream}` : c.name,
        })
      )
      const subjectOptions: SubjectOption[] = (subRes.data ?? []).map(
        (s: { id: string; name: string }) => ({ id: s.id, label: s.name })
      )

      setClasses(classOptions)
      setSubjects(subjectOptions)
      if (classOptions.length)   setSelectedClass(classOptions[0].id)
      if (subjectOptions.length) setSelectedSubject(subjectOptions[0].id)
      setLoading(false)
    }
    boot()
  }, [])

  const loadStrands = useCallback(async () => {
    if (!selectedSubject || !selectedClass || !schoolId || !uid) return
    setFetching(true)
    setStrands([])
    setProgress([])
    setFetchError(null)

    const [strandsRes, progressRes] = await Promise.all([
      supabase.from('strands').select('id,name')
        .eq('subject_id', selectedSubject)
        .eq('school_id', schoolId),
      supabase.from('strand_progress').select('strand_id,term,week,status,notes')
        .eq('teacher_id', uid)
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('term', selectedTerm),
    ])

    if (strandsRes.error)  { setFetchError(strandsRes.error.message);  setFetching(false); return }
    if (progressRes.error) { setFetchError(progressRes.error.message); setFetching(false); return }

    setStrands(strandsRes.data ?? [])
    setProgress(progressRes.data ?? [])
    setFetching(false)
  }, [selectedSubject, selectedClass, selectedTerm, schoolId, uid])

  useEffect(() => {
    if (!loading) loadStrands()
  }, [loading, loadStrands])

  async function updateStatus(strandId: string, status: string) {
    if (!uid || !selectedClass || !selectedSubject || !schoolId) return
    setSaving(strandId)

    const { error } = await supabase.from('strand_progress').upsert({
      teacher_id: uid,
      class_id:   selectedClass,
      subject_id: selectedSubject,
      school_id:  schoolId,
      strand_id:  strandId,
      term:       selectedTerm,
      week:       selectedWeek,
      status,
    }, { onConflict: 'teacher_id,class_id,strand_id,term,week' })

    if (!error) {
      setProgress(prev => {
        const exists = prev.find(p => p.strand_id === strandId && p.week === selectedWeek)
        if (exists) return prev.map(p =>
          p.strand_id === strandId && p.week === selectedWeek ? { ...p, status } : p
        )
        return [...prev, { strand_id: strandId, term: selectedTerm, week: selectedWeek, status, notes: null }]
      })
    }
    setSaving(null)
  }

  const getStatus = (strandId: string) =>
    progress.find(p => p.strand_id === strandId && p.week === selectedWeek)?.status ?? 'planned'

  const donePct = strands.length > 0
    ? Math.round(
        (progress.filter(p => p.status === 'done' && p.week === selectedWeek).length / strands.length) * 100
      )
    : 0

  const pillStyle = (active: boolean, color: string): CSSProperties => ({
    padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700,
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    background: active ? color : '#f3f4f6',
    color: active ? '#fff' : C.textMuted,
  })

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg,#1e1b4b 0%,#4338ca 100%)',
        borderRadius: 20, padding: 20, marginBottom: 14, color: '#fff',
      }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
          Scheme of Work
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Curriculum Tracker</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
          Track strand coverage across terms and weeks
        </div>
        {strands.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
              <span>Week {selectedWeek} Coverage</span><span>{donePct}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 10, background: 'rgba(255,255,255,0.2)' }}>
              <div style={{ height: 6, borderRadius: 10, background: C.accent, width: `${donePct}%`, transition: 'width 0.4s' }} />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => <Skeleton key={i} />)}
        </div>
      ) : (
        <>
          {/* Filters */}
          <Card>
            <SectionLabel>Class</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {classes.length === 0
                ? <div style={{ fontSize: 13, color: C.textMuted }}>No classes assigned</div>
                : classes.map(c => (
                  <button key={c.id} onClick={() => setSelectedClass(c.id)}
                    style={pillStyle(selectedClass === c.id, C.dark)}>
                    {c.label}
                  </button>
                ))}
            </div>

            <SectionLabel>Subject</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {subjects.map(s => (
                <button key={s.id} onClick={() => setSelectedSubject(s.id)}
                  style={pillStyle(selectedSubject === s.id, C.accent)}>
                  {s.label}
                </button>
              ))}
            </div>

            <SectionLabel>Term</SectionLabel>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[1,2,3].map(t => (
                <button key={t} onClick={() => setSelectedTerm(t)}
                  style={pillStyle(selectedTerm === t, C.accent)}>
                  Term {t}
                </button>
              ))}
            </div>

            <SectionLabel>Week</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: 14 }, (_, i) => i + 1).map(w => (
                <button key={w} onClick={() => setSelectedWeek(w)}
                  style={pillStyle(selectedWeek === w, '#6366f1')}>
                  W{w}
                </button>
              ))}
            </div>
          </Card>

          {/* Strands */}
          <Card>
            <SectionLabel>Strands — Term {selectedTerm}, Week {selectedWeek}</SectionLabel>

            {fetchError ? (
              <div style={{ fontSize: 13, color: C.error, padding: '12px 0' }}>{fetchError}</div>
            ) : fetching ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3,4].map(i => <Skeleton key={i} h={72} />)}
              </div>
            ) : strands.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: C.textMuted }}>
                No strands found for this subject
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {strands.map(strand => {
                  const status   = getStatus(strand.id)
                  const st       = STATUS_STYLE[status] ?? STATUS_STYLE.planned
                  const isSaving = saving === strand.id
                  return (
                    <div key={strand.id} style={{
                      borderRadius: 12, border: `1px solid ${C.border}`,
                      padding: '12px 14px', background: '#fff',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{strand.name}</div>
                        <span style={{
                          background: st.bg, color: st.color,
                          padding: '3px 10px', borderRadius: 20,
                          fontSize: 11, fontWeight: 700,
                        }}>
                          {isSaving ? '…' : st.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {STATUSES.map(s => {
                          const ss = STATUS_STYLE[s]
                          return (
                            <button key={s} onClick={() => updateStatus(strand.id, s)}
                              disabled={isSaving}
                              style={{
                                padding: '4px 10px', borderRadius: 8, border: 'none',
                                cursor: isSaving ? 'not-allowed' : 'pointer',
                                fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                                background: status === s ? ss.bg : '#f3f4f6',
                                color:      status === s ? ss.color : C.textMuted,
                                opacity:    isSaving ? 0.6 : 1,
                              }}>
                              {ss.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  )
}
