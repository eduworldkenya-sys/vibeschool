'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { C } from '@/components/teacher/ui'

interface CurriculumRow {
  id:         string
  term:       number
  week:        number
  strand:     string
  sub_strand: string
  topic:      string
  periods:    number
  reference:  string
}

interface SchemeRow {
  id:         string
  term:        number
  week:        number
  date:       string | null
  day_of_week: string | null
  period:     number | null
  strand:     string
  sub_strand: string
  topic:      string
  objectives: string | null
  resources:  string | null
  reference:  string | null
  rollcall:   string | null
  remarks:    string | null
  status:     string
  curriculum_id: string
}

interface ClassInfo {
  id:       string
  name:     string
  stream:   string
  subject:  string
}

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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending',  color: '#6b7280', bg: '#f3f4f6' },
  taught:  { label: 'Taught',   color: '#065f46', bg: '#d1fae5' },
  skipped: { label: 'Skipped',  color: '#92400e', bg: '#fef3c7' },
}

const STRAND_COLORS: Record<string, string> = {
  'Living Things': '#065f46',
  'Matter':        '#075985',
  'Energy':        '#6d28d9',
  'Force':         '#92400e',
  'Environment':   '#14532d',
  'Technology':    '#1e3a5f',
  'Health':        '#be185d',
  'Review':        '#374151',
}

function strandColor(strand: string) {
  return STRAND_COLORS[strand] ?? '#1e1b4b'
}

export default function SchemePage() {
  const router = useRouter()

  const [classInfo,    setClassInfo]    = useState<ClassInfo | null>(null)
  const [schoolId,     setSchoolId]     = useState<string>('')
  const [subjectId,    setSubjectId]    = useState<string>('')
  const [userId,       setUserId]       = useState<string>('')
  const [term,         setTerm]         = useState<number>(1)
  const [curriculum,   setCurriculum]   = useState<CurriculumRow[]>([])
  const [scheme,       setScheme]       = useState<SchemeRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [generating,   setGenerating]   = useState(false)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [savingId,     setSavingId]     = useState<string | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [genProgress,  setGenProgress]  = useState('')

  // Remarks / status edit state
  const [editRemarks,  setEditRemarks]  = useState<Record<string, string>>({})
  const [editStatus,   setEditStatus]   = useState<Record<string, string>>({})

  async function loadBase() {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=teacher'); return }
    setUserId(user.id)

    const [memberRes, tcRes] = await Promise.all([
      supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
      supabase.from('teacher_classes').select('class_id, subject_id').eq('teacher_id', user.id).limit(1).maybeSingle(),
    ])

    const sId = memberRes.data?.school_id ?? ''
    setSchoolId(sId)

    if (!tcRes.data) {
      setError('No class assigned. Ask your admin to assign you a class.')
      setLoading(false)
      return
    }

    const [classRes, subjRes, currRes] = await Promise.all([
      supabase.from('classes').select('id, name, stream, subject').eq('id', tcRes.data.class_id).single(),
      supabase.from('subjects').select('id, name').eq('id', tcRes.data.subject_id).single(),
      supabase.from('curriculum')
        .select('id, term, week, strand, sub_strand, topic, periods, reference')
        .eq('curriculum', 'CBC')
        .eq('grade', 'Grade 4')
        .eq('subject', 'Science and Technology')
        .order('term').order('week'),
    ])

    if (classRes.data) setClassInfo({ ...classRes.data, subject: subjRes.data?.name ?? classRes.data.subject })
    setSubjectId(tcRes.data.subject_id)
    setCurriculum(currRes.data ?? [])

    await loadScheme(user.id, tcRes.data.class_id, term)
    setLoading(false)
  }

  async function loadScheme(uid: string, cid: string, t: number) {
    const { data } = await supabase
      .from('scheme_of_work')
      .select('*')
      .eq('teacher_id', uid)
      .eq('class_id', cid)
      .eq('term', t)
      .order('week')
    setScheme(data ?? [])
  }

  useEffect(() => { loadBase() }, [])

  useEffect(() => {
    if (!userId || !classInfo) return
    loadScheme(userId, classInfo.id, term)
  }, [term])

  async function handleGenerate() {
    if (!classInfo || !userId || curriculum.length === 0) return
    setGenerating(true)
    setError(null)
    setGenProgress('Reading curriculum...')

    const termRows = curriculum.filter(c => c.term === term)
    if (termRows.length === 0) {
      setError('No curriculum rows found for this term.')
      setGenerating(false)
      return
    }

    const prompt = `You are an expert Kenyan CBC curriculum specialist and experienced Grade 4 Science and Technology teacher.

Generate a detailed Term ${term} Scheme of Work for Grade 4 Science and Technology based on the KIE CBC curriculum.

CLASS: ${classInfo.name}${classInfo.stream ? ' ' + classInfo.stream : ''}
SUBJECT: Science and Technology
CURRICULUM: CBC Kenya (KIE)
TERM: ${term}

For each of the ${termRows.length} weeks below, generate a complete scheme row.

CURRICULUM ROWS:
${termRows.map(r => `Week ${r.week} | Strand: ${r.strand} | Sub-strand: ${r.sub_strand} | Topic: ${r.topic} | Periods: ${r.periods} | Ref: ${r.reference}`).join('\n')}

Respond ONLY with a valid JSON array. No preamble, no markdown, no backticks.
Each object must have exactly these fields:
- week (number)
- strand (string)
- sub_strand (string)  
- topic (string)
- objectives (string — 3 to 5 measurable CBC competency-based learning outcomes starting with action verbs)
- resources (string — comma separated list of 4 to 6 specific teaching/learning materials)
- reference (string — KIE book page reference)
- curriculum_id (string — use exactly the id provided below)

Curriculum IDs by week:
${termRows.map(r => `Week ${r.week}: ${r.id}`).join('\n')}

Make objectives specific, measurable, and CBC-aligned. Resources must be realistic for a Kenyan primary school.`

    try {
      setGenProgress('AI generating scheme...')

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      const text = data.content?.map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '').join('') ?? ''
      const clean = text.replace(/```json|```/g, '').trim()
      const rows: Array<{
        week: number
        strand: string
        sub_strand: string
        topic: string
        objectives: string
        resources: string
        reference: string
        curriculum_id: string
      }> = JSON.parse(clean)

      setGenProgress('Saving to database...')

      const inserts = rows.map(r => ({
        school_id:       schoolId,
        teacher_id:      userId,
        class_id:        classInfo.id,
        subject_id:      subjectId,
        curriculum_id:   r.curriculum_id,
        curriculum_type: 'CBC',
        grade:           'Grade 4',
        subject:         'Science and Technology',
        term,
        week:            r.week,
        strand:          r.strand,
        sub_strand:      r.sub_strand,
        topic:           r.topic,
        objectives:      r.objectives,
        resources:       r.resources,
        reference:       r.reference,
        status:          'pending',
      }))

      const { error: insertErr } = await supabase.from('scheme_of_work').insert(inserts)
      if (insertErr) { setError(insertErr.message); setGenerating(false); setGenProgress(''); return }

      await loadScheme(userId, classInfo.id, term)
      setGenProgress('')
      setGenerating(false)

    } catch (e) {
      setError('Generation failed. Check your connection and try again.')
      setGenProgress('')
      setGenerating(false)
    }
  }

  async function handleSaveRow(row: SchemeRow) {
    setSavingId(row.id)
    await supabase.from('scheme_of_work').update({
      remarks: editRemarks[row.id] ?? row.remarks,
      status:  editStatus[row.id]  ?? row.status,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    await loadScheme(userId, classInfo!.id, term)
    setExpandedId(null)
    setSavingId(null)
  }

  const termScheme   = scheme.filter(s => s.term === term)
  const taughtCount  = termScheme.filter(s => s.status === 'taught').length
  const hasScheme    = termScheme.length > 0

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1px solid #e5e7eb', fontSize: 13, color: '#111827',
    outline: 'none', fontFamily: 'inherit', background: '#f9fafb',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b7280', paddingBottom: 80, background: '#f8f9fa', minHeight: '100%' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      {/* HERO */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #075985 60%, #0ea5e9 150%)', padding: '20px 16px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📋</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>Scheme of Work</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
              {loading ? '...' : classInfo ? `${classInfo.name}${classInfo.stream ? ' · ' + classInfo.stream : ''} · Science & Technology` : 'CBC Grade 4'}
            </div>
          </div>
        </div>

        {/* Term selector */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3].map(t => (
            <button
              key={t}
              onClick={() => setTerm(t)}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 800, fontSize: 13,
                background: term === t ? '#fff' : 'rgba(255,255,255,0.12)',
                color: term === t ? '#075985' : 'rgba(255,255,255,0.7)',
                transition: 'all 0.15s',
              }}
            >
              Term {t}
            </button>
          ))}
        </div>

        {/* Progress strip */}
        {hasScheme && (
          <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{taughtCount} of {termScheme.length} weeks taught</div>
            <div style={{ fontSize: 12, color: '#fff', fontWeight: 800 }}>{Math.round((taughtCount / termScheme.length) * 100)}%</div>
          </div>
        )}
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {error && (
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fef2f2', color: '#ef4444', fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} h={72} />)}
          </div>
        )}

        {/* GENERATE BUTTON — shown when no scheme for this term */}
        {!loading && !hasScheme && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 6 }}>No scheme for Term {term}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
              AI will generate a full detailed scheme of work from the KIE CBC curriculum for Grade 4 Science and Technology.
            </div>
            {generating ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTop: '3px solid #075985', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontSize: 13, color: '#075985', fontWeight: 700 }}>{genProgress}</div>
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                style={{ padding: '13px 28px', borderRadius: 14, background: 'linear-gradient(135deg, #075985, #0ea5e9)', color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(7,89,133,0.3)' }}
              >
                ✨ Generate Term {term} Scheme
              </button>
            )}
          </div>
        )}

        {/* SCHEME LIST */}
        {!loading && hasScheme && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {termScheme.map(row => {
              const isExpanded = expandedId === row.id
              const cfg        = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.pending
              const sColor     = strandColor(row.strand)
              const remarks    = editRemarks[row.id]  ?? row.remarks  ?? ''
              const status     = editStatus[row.id]   ?? row.status

              return (
                <div key={row.id} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  {/* Row header — always visible */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                  >
                    {/* Week badge */}
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: sColor, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Wk</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{row.week}</div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', lineHeight: 1.3, marginBottom: 4 }}>{row.topic}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{row.strand} · {row.sub_strand}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <div style={{ padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700 }}>{cfg.label}</div>
                      <div style={{ fontSize: 16, color: '#9ca3af' }}>{isExpanded ? '▲' : '▼'}</div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #f3f4f6', padding: '16px', animation: 'slideDown 0.2s ease' }}>

                      {/* Objectives */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Learning Objectives</div>
                        <div style={{ fontSize: 13, color: '#111827', lineHeight: 1.7, background: '#f8f9fa', borderRadius: 10, padding: '10px 12px' }}>
                          {row.objectives ?? '—'}
                        </div>
                      </div>

                      {/* Resources */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Resources</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(row.resources ?? '').split(',').map((r, i) => (
                            <span key={i} style={{ padding: '4px 10px', borderRadius: 20, background: '#ede9fe', color: '#6d28d9', fontSize: 11, fontWeight: 600 }}>{r.trim()}</span>
                          ))}
                        </div>
                      </div>

                      {/* Reference */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Reference</div>
                        <div style={{ fontSize: 12, color: '#075985', fontWeight: 600 }}>{row.reference ?? '—'}</div>
                      </div>

                      {/* Status picker */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Status</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {(['pending', 'taught', 'skipped'] as const).map(s => {
                            const c = STATUS_CONFIG[s]
                            const active = status === s
                            return (
                              <button
                                key={s}
                                onClick={() => setEditStatus(prev => ({ ...prev, [row.id]: s }))}
                                style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: active ? `2px solid ${c.color}` : '2px solid #e5e7eb', background: active ? c.bg : '#fff', color: active ? c.color : '#9ca3af', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                {c.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Remarks */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Remarks</div>
                        <textarea
                          rows={3}
                          placeholder="Add remarks after teaching this lesson..."
                          value={remarks}
                          onChange={e => setEditRemarks(prev => ({ ...prev, [row.id]: e.target.value }))}
                          style={{ ...inputStyle, resize: 'none' } as React.CSSProperties}
                        />
                      </div>

                      {/* Save */}
                      <button
                        onClick={() => handleSaveRow(row)}
                        disabled={savingId === row.id}
                        style={{ width: '100%', padding: '12px', borderRadius: 12, background: savingId === row.id ? '#d1fae5' : '#10b981', color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: savingId === row.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                      >
                        {savingId === row.id ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
