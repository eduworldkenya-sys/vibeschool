"use client";
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'

interface Evidence {
  id:          string
  standard:    number
  source:      string
  description: string
  created_at:  string
}

interface Appraisal {
  id: string
}

const STANDARDS = [
  { num: 1, title: 'Professional Knowledge & Practice', icon: '📚' },
  { num: 2, title: 'Learning Environment',              icon: '🏫' },
  { num: 3, title: 'Teacher Professionalism',           icon: '🎯' },
  { num: 4, title: 'Learner Outcomes',                  icon: '📊' },
]

const SOURCES = [
  { value: 'manual',       label: 'Manual Entry' },
  { value: 'lesson_plan',  label: 'Lesson Plan'  },
  { value: 'attendance',   label: 'Attendance'   },
  { value: 'homework',     label: 'Homework'     },
  { value: 'pd',           label: 'CPD / Training' },
]

function sourceLabel(source: string): string {
  return SOURCES.find(s => s.value === source)?.label ?? source
}

function sourceBadgeColor(source: string): { bg: string; color: string } {
  const map: Record<string, { bg: string; color: string }> = {
    manual:       { bg: '#f3f4f6', color: '#374151' },
    lesson_plan:  { bg: '#dbeafe', color: '#1e40af' },
    attendance:   { bg: '#d1fae5', color: '#065f46' },
    homework:     { bg: '#fef3c7', color: '#92400e' },
    pd:           { bg: '#ede9fe', color: '#3730a3' },
  }
  return map[source] ?? { bg: '#f3f4f6', color: '#374151' }
}

function Skeleton({ h = 80 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12, marginBottom: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function EvidencePage() {
  const [userId,      setUserId]      = useState<string | null>(null)
  const [schoolId,    setSchoolId]    = useState<string | null>(null)
  const [appraisal,   setAppraisal]   = useState<Appraisal | null>(null)
  const [evidence,    setEvidence]    = useState<Evidence[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [activeStd,   setActiveStd]   = useState(1)
  const [showForm,    setShowForm]    = useState(false)
  const [newStandard, setNewStandard] = useState(1)
  const [newSource,   setNewSource]   = useState('manual')
  const [newDesc,     setNewDesc]     = useState('')

  useEffect(() => {
    async function load() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError || !authData.user) {
          setError('Session expired. Please refresh.')
          setLoading(false)
          return
        }

        const uid = authData.user.id
        setUserId(uid)

        const { data: memberData } = await supabase
          .from('school_members')
          .select('school_id')
          .eq('profile_id', uid)
          .maybeSingle()

        const sid = memberData?.school_id ?? null
        setSchoolId(sid)
        if (!sid) { setLoading(false); return }

        const { data: termData } = await supabase
          .from('academic_terms')
          .select('id')
          .eq('school_id', sid)
          .eq('status', 'active')
          .single()

        if (!termData) { setLoading(false); return }

        const { data: appraisalData } = await supabase
          .from('tpad_appraisals')
          .select('id')
          .eq('teacher_id', uid)
          .eq('term_id', termData.id)
          .maybeSingle()

        if (!appraisalData) { setLoading(false); return }
        setAppraisal(appraisalData)

        const { data: evidenceData, error: evidenceError } = await supabase
          .from('tpad_evidence')
          .select('id,standard,source,description,created_at')
          .eq('appraisal_id', appraisalData.id)
          .eq('teacher_id', uid)
          .order('created_at', { ascending: false })

        if (evidenceError) {
          setError('Failed to load evidence.')
          setLoading(false)
          return
        }

        setEvidence(evidenceData ?? [])
      } catch {
        setError('Unexpected error. Please refresh.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleAdd() {
    if (!userId || !appraisal) return
    if (!newDesc.trim()) { setError('Description is required.'); return }

    setSaving(true)
    setError(null)

    const { data, error: insertError } = await supabase
      .from('tpad_evidence')
      .insert({
        appraisal_id: appraisal.id,
        teacher_id:   userId,
        standard:     newStandard,
        source:       newSource,
        description:  newDesc.trim(),
      })
      .select('id,standard,source,description,created_at')
      .single()

    if (insertError) {
      setSaving(false)
      setError('Failed to add evidence. ' + insertError.message)
      return
    }

    setEvidence(prev => [data, ...prev])
    setNewDesc('')
    setNewSource('manual')
    setNewStandard(activeStd)
    setShowForm(false)
    setSaving(false)
  }

  async function handleRemove(id: string) {
    const { error: deleteError } = await supabase
      .from('tpad_evidence')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setError('Failed to remove evidence.')
      return
    }

    setEvidence(prev => prev.filter(e => e.id !== id))
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: C.bg,
    border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '10px 14px', color: C.textPrimary, fontSize: 14, outline: 'none',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, color: C.textMuted, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 6, display: 'block', fontWeight: 600,
  }

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <Skeleton h={60} />
        <Skeleton h={100} />
        <Skeleton h={100} />
      </div>
    )
  }

  const filtered = evidence.filter(e => e.standard === activeStd)

  return (
    <div style={{ padding: '0 0 40px' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary, margin: 0 }}>Evidence</h1>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
          Track what supports your self-appraisal scores
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: C.error, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!appraisal && !loading && (
        <div style={{ padding: 16, borderRadius: 12, background: C.surface, border: `1.5px dashed ${C.border}`, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
            Start your self-appraisal first before adding evidence.
          </p>
        </div>
      )}

      {appraisal && (
        <>
          {/* Standard tabs */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 20 }}>
            {STANDARDS.map(s => {
              const count   = evidence.filter(e => e.standard === s.num).length
              const active  = activeStd === s.num
              return (
                <button
                  key={s.num}
                  onClick={() => setActiveStd(s.num)}
                  style={{
                    flexShrink: 0, padding: '6px 14px', borderRadius: 99,
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    color: active ? C.accent : C.textMuted,
                    background: active ? C.accentLight : 'transparent',
                    border: `1px solid ${active ? C.accent : C.border}`,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  S{s.num} {count > 0 ? `(${count})` : ''}
                </button>
              )
            })}
          </div>

          {/* Active standard header */}
          {STANDARDS.filter(s => s.num === activeStd).map(s => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{s.title}</p>
            </div>
          ))}

          {/* Evidence list */}
          {filtered.length === 0 ? (
            <div style={{ padding: 20, borderRadius: 12, background: C.surface, border: `1.5px dashed ${C.border}`, textAlign: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
                No evidence added for this standard yet.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {filtered.map(e => {
                const badge = sourceBadgeColor(e.source)
                return (
                  <div key={e.id} style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: C.bg, border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'inline-block', marginBottom: 6,
                          padding: '2px 8px', borderRadius: 99,
                          background: badge.bg, color: badge.color,
                          fontSize: 10, fontWeight: 700,
                        }}>
                          {sourceLabel(e.source)}
                        </span>
                        <p style={{ fontSize: 13, color: C.textPrimary, margin: 0, lineHeight: 1.5 }}>
                          {e.description}
                        </p>
                        <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                          {new Date(e.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemove(e.id)}
                        style={{
                          flexShrink: 0, background: '#fef2f2',
                          border: '1px solid #fecaca', color: C.error,
                          borderRadius: 8, padding: '4px 10px',
                          fontSize: 12, cursor: 'pointer', fontWeight: 600,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add evidence form */}
          {showForm ? (
            <div style={{ padding: 16, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, marginBottom: 16 }}>Add Evidence</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={lbl}>Standard</label>
                  <select style={inp} value={newStandard} onChange={e => setNewStandard(Number(e.target.value))}>
                    {STANDARDS.map(s => (
                      <option key={s.num} value={s.num}>Standard {s.num} — {s.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Source</label>
                  <select style={inp} value={newSource} onChange={e => setNewSource(e.target.value)}>
                    {SOURCES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Description</label>
                  <textarea
                    style={{ ...inp, minHeight: 80, resize: 'vertical' }}
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="e.g. Completed lesson plans for all units in Term 2"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  onClick={() => { setShowForm(false); setError(null) }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10,
                    background: C.surface, border: `1px solid ${C.border}`,
                    color: C.textPrimary, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10,
                    background: C.accent, border: 'none',
                    color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving...' : 'Add Evidence'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setShowForm(true); setNewStandard(activeStd) }}
              style={{
                padding: '12px 20px', borderRadius: 12, width: '100%',
                background: C.surface, border: `1px dashed ${C.accent}`,
                color: C.accent, fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              + Add Evidence
            </button>
          )}
        </>
      )}
    </div>
  )
}
