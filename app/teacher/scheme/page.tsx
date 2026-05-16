'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { C } from '@/components/teacher/ui'

interface TeacherContext {
  userId:    string
  schoolId:  string
  classId:   string
  subjectId: string
  grade:     string
  subject:   string
  className: string
  stream:    string
}

interface CurriculumRow {
  id:         string
  curriculum: string
  grade:      string
  subject:    string
  term:       number
  week:       number
  strand:     string
  sub_strand: string
  topic:      string
  periods:    number
  reference:  string
}

interface SchemeRow {
  id:            string
  term:          number
  week:          number
  strand:        string
  sub_strand:    string
  topic:         string
  objectives:    string | null
  resources:     string | null
  reference:     string | null
  remarks:       string | null
  status:        string
  curriculum_id: string
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#6b7280', bg: '#f3f4f6' },
  taught:  { label: 'Taught',  color: '#065f46', bg: '#d1fae5' },
  skipped: { label: 'Skipped', color: '#92400e', bg: '#fef3c7' },
} as const

type StatusKey = keyof typeof STATUS_CONFIG

const STRAND_PALETTE = [
  '#065f46','#075985','#6d28d9','#92400e',
  '#14532d','#1e3a5f','#be185d','#374151',
  '#7c3aed','#b45309','#0f766e','#c2410c',
]

function strandColor(strand: string): string {
  let hash = 0
  for (let i = 0; i < strand.length; i++) hash = strand.charCodeAt(i) + ((hash << 5) - hash)
  return STRAND_PALETTE[Math.abs(hash) % STRAND_PALETTE.length]
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

function SchemePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [ctx,         setCtx]         = useState<TeacherContext | null>(null)
  const [term,        setTerm]        = useState<number>(1)
  const [curriculum,  setCurriculum]  = useState<CurriculumRow[]>([])
  const [scheme,      setScheme]      = useState<SchemeRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [genStep,     setGenStep]     = useState<string>('')
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [savingId,    setSavingId]    = useState<string | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [editRemarks, setEditRemarks] = useState<Record<string, string>>({})
  const [editStatus,  setEditStatus]  = useState<Record<string, StatusKey>>({})

  const loadScheme = useCallback(async (c: TeacherContext, t: number) => {
    const { data } = await supabase
      .from('scheme_of_work')
      .select('id,term,week,strand,sub_strand,topic,objectives,resources,reference,remarks,status,curriculum_id')
      .eq('teacher_id', c.userId)
      .eq('class_id',   c.classId)
      .eq('school_id',  c.schoolId)
      .eq('term', t)
      .order('week')
    setScheme(data ?? [])
  }, [])

  useEffect(() => {
    async function bootstrap() {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/academy/signin?role=teacher'); return }

      const urlClassId   = searchParams.get('classId')
      const urlSubjectId = searchParams.get('subjectId')

      const [memberRes, tcAllRes] = await Promise.all([
        supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('teacher_classes').select('class_id,subject_id').eq('teacher_id', user.id),
      ])

      const tcRows = tcAllRes.data ?? []
      if (tcRows.length === 0) {
        setError('No class assigned. Ask your admin to assign you a class.')
        setLoading(false)
        return
      }

      // Use URL params if present, else fall back to first row
      const matched = tcRows.find((r: { class_id: string; subject_id: string }) =>
        (!urlClassId   || r.class_id   === urlClassId) &&
        (!urlSubjectId || r.subject_id === urlSubjectId)
      ) ?? tcRows[0]

      const schoolId  = memberRes.data?.school_id ?? ''
      const classId   = matched.class_id
      const subjectId = matched.subject_id

      const [classRes, subjRes] = await Promise.all([
        supabase.from('classes').select('name,stream,subject').eq('id', classId).single(),
        supabase.from('subjects').select('name').eq('id', subjectId).single(),
      ])

      const grade   = classRes.data?.name   ?? ''
      const subject = subjRes.data?.name    ?? classRes.data?.subject ?? ''
      const stream  = classRes.data?.stream ?? ''

      const context: TeacherContext = {
        userId: user.id, schoolId, classId, subjectId,
        grade, subject, className: grade, stream,
      }
      setCtx(context)

      const { data: currData } = await supabase
        .from('curriculum')
        .select('id,curriculum,grade,subject,term,week,strand,sub_strand,topic,periods,reference')
        .eq('grade',   grade)
        .eq('subject', subject)
        .order('term').order('week')

      setCurriculum(currData ?? [])
      await loadScheme(context, 1)
      setLoading(false)
    }

    bootstrap()
  }, [router, loadScheme])

  useEffect(() => {
    if (!ctx) return
    loadScheme(ctx, term)
  }, [term, ctx, loadScheme])

  async function generateCurriculum(): Promise<CurriculumRow[]> {
    if (!ctx) return []
    setGenStep('Generating CBC curriculum outline...')

    const prompt = `You are an expert Kenya CBC curriculum specialist.

Generate the complete CBC ${ctx.grade} ${ctx.subject} curriculum outline for all 3 terms.

Respond ONLY with a valid JSON array. No preamble, no markdown, no backticks.
Each object must have exactly these fields:
- term (number: 1, 2, or 3)
- week (number: 1 to 12)
- strand (string)
- sub_strand (string)
- topic (string)
- periods (number: lessons per week, typically 4-6)
- reference (string: KIE textbook page reference)

Base this strictly on the official KIE CBC curriculum design for ${ctx.grade} ${ctx.subject} Kenya.
Cover all weeks across all 3 terms. Return all rows in one array.`

    const response = await fetch('/api/generate-scheme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? 'Generation failed')
    const clean = (data.text ?? '').replace(/```json|```/g, '').trim()

    const rows: Array<{
      term: number; week: number; strand: string; sub_strand: string
      topic: string; periods: number; reference: string
    }> = JSON.parse(clean)

    setGenStep('Saving curriculum...')

    const inserts = rows.map(r => ({
      curriculum: 'CBC',
      grade:      ctx.grade,
      subject:    ctx.subject,
      term:       r.term,
      week:       r.week,
      strand:     r.strand,
      sub_strand: r.sub_strand,
      topic:      r.topic,
      periods:    r.periods,
      reference:  r.reference,
    }))

    const { data: saved, error: insertErr } = await supabase
      .from('curriculum')
      .insert(inserts)
      .select('id,curriculum,grade,subject,term,week,strand,sub_strand,topic,periods,reference')

    if (insertErr) throw new Error(insertErr.message)
    return saved ?? []
  }

  async function generateScheme(currRows: CurriculumRow[], t: number) {
    if (!ctx) return
    const termRows = currRows.filter(r => r.term === t)
    if (termRows.length === 0) {
      setError(`No curriculum rows found for Term ${t}.`)
      return
    }

    setGenStep(`Building Term ${t} scheme of work...`)

    const prompt = `You are an expert Kenyan CBC curriculum specialist and experienced ${ctx.grade} ${ctx.subject} teacher.

Generate a detailed Term ${t} Scheme of Work for ${ctx.grade} ${ctx.subject} based on the KIE CBC curriculum.

CLASS: ${ctx.className}${ctx.stream ? ' ' + ctx.stream : ''}
SUBJECT: ${ctx.subject}
GRADE: ${ctx.grade}
TERM: ${t}

CURRICULUM ROWS TO USE:
${termRows.map(r => `Week ${r.week} | Strand: ${r.strand} | Sub-strand: ${r.sub_strand} | Topic: ${r.topic} | Periods: ${r.periods} | Ref: ${r.reference} | ID: ${r.id}`).join('\n')}

Respond ONLY with a valid JSON array. No preamble, no markdown, no backticks.
Each object must have exactly these fields:
- curriculum_id (string: use the exact ID provided above for that week)
- week (number)
- strand (string: match exactly from curriculum)
- sub_strand (string: match exactly from curriculum)
- topic (string: match exactly from curriculum)
- objectives (string: 3 to 5 measurable CBC competency-based outcomes, start with action verbs)
- resources (string: comma separated, 4 to 6 specific teaching materials realistic for Kenyan primary schools)
- reference (string: KIE textbook page reference)`

    const response = await fetch('/api/generate-scheme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? 'Generation failed')
    const clean = (data.text ?? '').replace(/```json|```/g, '').trim()

    const rows: Array<{
      curriculum_id: string; week: number; strand: string; sub_strand: string
      topic: string; objectives: string; resources: string; reference: string
    }> = JSON.parse(clean)

    setGenStep('Saving scheme...')

    const inserts = rows.map(r => ({
      school_id:       ctx.schoolId,
      teacher_id:      ctx.userId,
      class_id:        ctx.classId,
      subject_id:      ctx.subjectId,
      curriculum_id:   r.curriculum_id,
      curriculum_type: 'CBC',
      grade:           ctx.grade,
      subject:         ctx.subject,
      term:            t,
      week:            r.week,
      strand:          r.strand,
      sub_strand:      r.sub_strand,
      topic:           r.topic,
      objectives:      r.objectives,
      resources:       r.resources,
      reference:       r.reference,
      status:          'pending',
      updated_at:      new Date().toISOString(),
    }))

    const { error: insertErr } = await supabase
      .from('scheme_of_work')
      .insert(inserts)

    if (insertErr) throw new Error(insertErr.message)
  }

  async function handleGenerate() {
    if (!ctx) return
    setError(null)
    try {
      let currRows = curriculum
      if (currRows.length === 0) {
        currRows = await generateCurriculum()
        setCurriculum(currRows)
      }
      await generateScheme(currRows, term)
      await loadScheme(ctx, term)
      setGenStep('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed. Check your connection and try again.')
      setGenStep('')
    }
  }

  async function handleSaveRow(row: SchemeRow) {
    if (!ctx) return
    setSavingId(row.id)
    await supabase
      .from('scheme_of_work')
      .update({
        remarks:    editRemarks[row.id] ?? row.remarks,
        status:     editStatus[row.id]  ?? row.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    await loadScheme(ctx, term)
    setExpandedId(null)
    setSavingId(null)
  }

  const termScheme   = scheme.filter(s => s.term === term)
  const taughtCount  = termScheme.filter(s => s.status === 'taught').length
  const isGenerating = genStep !== ''

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: `1px solid ${C.border}`, fontSize: 13, color: C.textPrimary,
    outline: 'none', fontFamily: 'inherit', background: C.surface,
    boxSizing: 'border-box',
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 80, background: C.surface, minHeight: '100%' }}>
      <style>{`
        @keyframes shimmer   { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin      { to{transform:rotate(360deg)} }
      `}</style>

      <div style={{ background: 'linear-gradient(135deg,#1e3a5f 0%,#075985 60%,#0ea5e9 150%)', padding: '20px 16px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }} />
        <div style={{ position:'absolute', bottom:-20, left:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />

        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ width:44, height:44, borderRadius:13, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📋</div>
          <div>
            <div style={{ fontSize:20, fontWeight:900, color:'#fff', lineHeight:1.2 }}>Scheme of Work</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:2 }}>
              {loading ? '...' : ctx ? `${ctx.className}${ctx.stream ? ' · ' + ctx.stream : ''} · ${ctx.subject}` : 'CBC'}
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          {[1,2,3].map(t => (
            <button key={t} onClick={() => setTerm(t)} style={{ flex:1, padding:'9px 4px', borderRadius:12, border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:800, fontSize:13, background: term===t ? '#fff' : 'rgba(255,255,255,0.12)', color: term===t ? '#075985' : 'rgba(255,255,255,0.7)', transition:'all 0.15s' }}>
              Term {t}
            </button>
          ))}
        </div>

        {termScheme.length > 0 && (
          <div style={{ marginTop:14, background:'rgba(255,255,255,0.1)', borderRadius:12, padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', fontWeight:600 }}>{taughtCount} of {termScheme.length} weeks taught</div>
            <div style={{ fontSize:12, color:'#fff', fontWeight:800 }}>{Math.round((taughtCount/termScheme.length)*100)}%</div>
          </div>
        )}
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        {error && (
          <div style={{ padding:'12px 14px', borderRadius:10, background:'#fef2f2', color:C.error, fontSize:13, marginBottom:14 }}>{error}</div>
        )}

        {loading && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2,3,4].map(i => <Skeleton key={i} h={72} />)}
          </div>
        )}

        {!loading && !ctx && !error && (
          <div style={{ textAlign:'center', padding:'40px 0', fontSize:13, color:C.textMuted }}>
            No class assigned. Ask your admin to assign you a class.
          </div>
        )}

        {!loading && ctx && termScheme.length === 0 && (
          <div style={{ background:'#fff', borderRadius:20, padding:'28px 20px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🤖</div>
            <div style={{ fontSize:16, fontWeight:800, color:C.textPrimary, marginBottom:6 }}>No scheme for Term {term}</div>
            <div style={{ fontSize:13, color:C.textMuted, marginBottom:20, lineHeight:1.6 }}>
              {curriculum.length === 0
                ? `AI will first generate the CBC ${ctx.grade} ${ctx.subject} curriculum outline, then build your Term ${term} scheme of work.`
                : `AI will build your Term ${term} scheme of work from the CBC ${ctx.grade} ${ctx.subject} curriculum.`}
            </div>
            {isGenerating ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
                <div style={{ width:32, height:32, border:'3px solid #e5e7eb', borderTop:'3px solid #075985', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                <div style={{ fontSize:13, color:'#075985', fontWeight:700 }}>{genStep}</div>
              </div>
            ) : (
              <button onClick={handleGenerate} style={{ padding:'13px 28px', borderRadius:14, background:'linear-gradient(135deg,#075985,#0ea5e9)', color:'#fff', fontWeight:800, fontSize:14, border:'none', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 14px rgba(7,89,133,0.3)' }}>
                ✨ Generate Term {term} Scheme
              </button>
            )}
          </div>
        )}

        {!loading && termScheme.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {termScheme.map(row => {
              const isExpanded = expandedId === row.id
              const status     = editStatus[row.id]  ?? (row.status as StatusKey)
              const remarks    = editRemarks[row.id] ?? row.remarks ?? ''
              const cfg        = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
              const sColor     = strandColor(row.strand)

              return (
                <div key={row.id} style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                  <button onClick={() => setExpandedId(isExpanded ? null : row.id)} style={{ width:'100%', padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:12, background:'none', border:'none', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
                    <div style={{ width:40, height:40, borderRadius:12, background:sColor, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:0.5 }}>Wk</div>
                      <div style={{ fontSize:16, fontWeight:900, color:'#fff', lineHeight:1 }}>{row.week}</div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:C.textPrimary, lineHeight:1.3, marginBottom:4 }}>{row.topic}</div>
                      <div style={{ fontSize:11, color:C.textMuted }}>{row.strand} · {row.sub_strand}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                      <div style={{ padding:'3px 10px', borderRadius:20, background:cfg.bg, color:cfg.color, fontSize:10, fontWeight:700 }}>{cfg.label}</div>
                      <div style={{ fontSize:16, color:'#9ca3af' }}>{isExpanded ? '▲' : '▼'}</div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div style={{ borderTop:'1px solid #f3f4f6', padding:16, animation:'slideDown 0.2s ease' }}>
                      <div style={{ marginBottom:14 }}>
                        <div style={{ fontSize:10, fontWeight:800, color:C.textMuted, textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Learning Objectives</div>
                        <div style={{ fontSize:13, color:C.textPrimary, lineHeight:1.7, background:C.surface, borderRadius:10, padding:'10px 12px' }}>{row.objectives ?? '—'}</div>
                      </div>
                      <div style={{ marginBottom:14 }}>
                        <div style={{ fontSize:10, fontWeight:800, color:C.textMuted, textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Resources</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                          {(row.resources ?? '').split(',').filter(Boolean).map((r, i) => (
                            <span key={i} style={{ padding:'4px 10px', borderRadius:20, background:'#ede9fe', color:'#6d28d9', fontSize:11, fontWeight:600 }}>{r.trim()}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginBottom:16 }}>
                        <div style={{ fontSize:10, fontWeight:800, color:C.textMuted, textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Reference</div>
                        <div style={{ fontSize:12, color:'#075985', fontWeight:600 }}>{row.reference ?? '—'}</div>
                      </div>
                      <div style={{ marginBottom:14 }}>
                        <div style={{ fontSize:10, fontWeight:800, color:C.textMuted, textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Status</div>
                        <div style={{ display:'flex', gap:8 }}>
                          {(Object.keys(STATUS_CONFIG) as StatusKey[]).map(s => {
                            const c = STATUS_CONFIG[s]
                            const active = status === s
                            return (
                              <button key={s} onClick={() => setEditStatus(prev => ({ ...prev, [row.id]: s }))} style={{ flex:1, padding:'8px 4px', borderRadius:10, border: active ? `2px solid ${c.color}` : `2px solid ${C.border}`, background: active ? c.bg : '#fff', color: active ? c.color : '#9ca3af', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                                {c.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div style={{ marginBottom:16 }}>
                        <div style={{ fontSize:10, fontWeight:800, color:C.textMuted, textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Remarks</div>
                        <textarea rows={3} placeholder="Add remarks after teaching this topic..." value={remarks} onChange={e => setEditRemarks(prev => ({ ...prev, [row.id]: e.target.value }))} style={{ ...inputStyle, resize:'none' } as React.CSSProperties} />
                      </div>
                      <button onClick={() => handleSaveRow(row)} disabled={savingId === row.id} style={{ width:'100%', padding:12, borderRadius:12, background: savingId===row.id ? C.accentLight : C.accent, color:'#fff', fontWeight:800, fontSize:14, border:'none', cursor: savingId===row.id ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
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

export default function SchemePage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontSize: 13, color: '#6b7280' }}>Loading…</div>}>
      <SchemePageInner />
    </Suspense>
  )
}
