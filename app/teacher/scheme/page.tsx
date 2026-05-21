'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface SchemeRow {
  id:         string
  week:       number
  term:       number
  strand:     string | null
  sub_strand: string | null
  topic:      string | null
  objectives: string | null
  resources:  string | null
  status:     string | null
  date:       string | null
}

interface ClassOption  { id: string; label: string }
interface SubjectOption { id: string; label: string }

function Skeleton({ h = 56, radius = 12 }: { h?: number; radius?: number }) {
  return (
    <div style={{
      height: h, borderRadius: radius,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

const STATUS_COLOURS: Record<string, { bg: string; color: string }> = {
  planned:   { bg: '#e5e7eb', color: '#6b7280' },
  taught:    { bg: '#d1fae5', color: '#065f46' },
  cancelled: { bg: '#fee2e2', color: '#991b1b' },
}

export default function SchemePage() {
  const accent = '#10b981'
  const dark   = '#1e1b4b'
  const bg     = '#f0f2f5'

  const [loading,        setLoading]        = useState(true)
  const [classes,        setClasses]        = useState<ClassOption[]>([])
  const [subjects,       setSubjects]       = useState<SubjectOption[]>([])
  const [selectedClass,  setSelectedClass]  = useState<string | null>(null)
  const [selectedSubject,setSelectedSubject]= useState<string | null>(null)
  const [selectedTerm,   setSelectedTerm]   = useState<number>(1)
  const [rows,           setRows]           = useState<SchemeRow[]>([])
  const [fetching,       setFetching]       = useState(false)

  useEffect(() => {
    async function bootstrap() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: tp } = await supabase
        .from('teacher_profiles')
        .select('school_id')
        .eq('profile_id', user.id)
        .single()

      if (!tp) return
      const school_id = tp.school_id

      const [tcRes, clRes, subRes] = await Promise.all([
        supabase.from('teacher_classes').select('class_id,subject_id').eq('teacher_id', user.id),
        supabase.from('classes').select('id,name,stream').eq('school_id', school_id),
        supabase.from('subjects').select('id,name').eq('school_id', school_id),
      ])

      const teacherClasses  = tcRes.data  ?? []
      const allClasses      = clRes.data  ?? []
      const allSubjects     = subRes.data ?? []

      const classIds   = Array.from(new Set(teacherClasses.map((r: { class_id: string }) => r.class_id)))
      const subjectIds = Array.from(new Set(teacherClasses.map((r: { subject_id: string }) => r.subject_id)))

      const classOptions: ClassOption[] = allClasses
        .filter((c: { id: string }) => classIds.includes(c.id))
        .map((c: { id: string; name: string; stream: string | null }) => ({
          id:    c.id,
          label: c.stream ? `${c.name} ${c.stream}` : c.name,
        }))

      const subjectOptions: SubjectOption[] = allSubjects
        .filter((s: { id: string }) => subjectIds.includes(s.id))
        .map((s: { id: string; name: string }) => ({ id: s.id, label: s.name }))

      setClasses(classOptions)
      setSubjects(subjectOptions)
      if (classOptions.length)   setSelectedClass(classOptions[0].id)
      if (subjectOptions.length) setSelectedSubject(subjectOptions[0].id)
      setLoading(false)
    }
    bootstrap()
  }, [])

  useEffect(() => {
    if (!selectedClass || !selectedSubject) return
    async function fetchScheme() {
      setFetching(true)
      const { data } = await supabase
        .from('scheme_of_work')
        .select('id,week,term,strand,sub_strand,topic,objectives,resources,status,date')
        .eq('class_id',   selectedClass!)
        .eq('subject_id', selectedSubject!)
        .eq('term',       selectedTerm)
        .order('week',    { ascending: true })

      setRows(data ?? [])
      setFetching(false)
    }
    fetchScheme()
  }, [selectedClass, selectedSubject, selectedTerm])

  const grouped = rows.reduce<Record<number, SchemeRow[]>>((acc, row) => {
    if (!acc[row.week]) acc[row.week] = []
    acc[row.week].push(row)
    return acc
  }, {})

  const pillBase: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 20, fontSize: 13,
    fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all .15s',
  }

  return (
    <div style={{ background: bg, minHeight: '100%', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      <h1 style={{ color: dark, fontSize: 22, fontWeight: 700, margin: '0 0 20px' }}>
        Scheme of Work
      </h1>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <Skeleton key={i} h={48} />)}
        </div>
      ) : (
        <>
          {/* Class pills */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase' }}>Class</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {classes.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClass(c.id)}
                  style={{
                    ...pillBase,
                    background: selectedClass === c.id ? dark : '#fff',
                    color:      selectedClass === c.id ? '#fff' : dark,
                    boxShadow:  selectedClass === c.id ? 'none' : '0 1px 4px rgba(0,0,0,.08)',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject pills */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase' }}>Subject</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {subjects.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSubject(s.id)}
                  style={{
                    ...pillBase,
                    background: selectedSubject === s.id ? accent : '#fff',
                    color:      selectedSubject === s.id ? '#fff' : dark,
                    boxShadow:  selectedSubject === s.id ? 'none' : '0 1px 4px rgba(0,0,0,.08)',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Term selector */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase' }}>Term</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3].map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTerm(t)}
                  style={{
                    ...pillBase,
                    background: selectedTerm === t ? accent : '#fff',
                    color:      selectedTerm === t ? '#fff' : dark,
                    boxShadow:  selectedTerm === t ? 'none' : '0 1px 4px rgba(0,0,0,.08)',
                  }}
                >
                  {`Term ${t}`}
                </button>
              ))}
            </div>
          </div>

          {/* Rows */}
          {fetching ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3,4].map(i => <Skeleton key={i} h={72} />)}
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '48px 24px',
              background: '#fff', borderRadius: 16,
              color: '#9ca3af', fontSize: 15,
            }}>
              No scheme entries found for this selection.
            </div>
          ) : (
            Object.entries(grouped)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([week, weekRows]) => (
                <div key={week} style={{ marginBottom: 20 }}>
                  <p style={{
                    fontSize: 12, fontWeight: 700, color: accent,
                    textTransform: 'uppercase', margin: '0 0 8px', letterSpacing: '.5px',
                  }}>
                    {`Week ${week}`}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {weekRows.map(row => {
                      const statusKey = row.status ?? 'planned'
                      const chip = STATUS_COLOURS[statusKey] ?? STATUS_COLOURS.planned
                      return (
                        <div
                          key={row.id}
                          style={{
                            background: '#fff', borderRadius: 14,
                            padding: '14px 16px',
                            boxShadow: '0 1px 4px rgba(0,0,0,.07)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              {row.strand && (
                                <p style={{ margin: '0 0 2px', fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>
                                  {row.strand}{row.sub_strand ? ` › ${row.sub_strand}` : ''}
                                </p>
                              )}
                              <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: dark }}>
                                {row.topic ?? '—'}
                              </p>
                              {row.objectives && (
                                <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                                  {row.objectives}
                                </p>
                              )}
                              {row.resources && (
                                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
                                  {`Resources: ${row.resources}`}
                                </p>
                              )}
                            </div>
                            <span style={{
                              ...chip,
                              padding: '3px 10px', borderRadius: 20,
                              fontSize: 11, fontWeight: 700,
                              textTransform: 'capitalize', whiteSpace: 'nowrap',
                            }}>
                              {statusKey}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
          )}
        </>
      )}
    </div>
  )
}
