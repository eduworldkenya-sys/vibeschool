'use client'

import OutcomeMatrix from '@/components/teacher/progress/OutcomeMatrix'
import { studio } from '@/components/teacher/studio-tokens'
import ProgressDataChecks from '@/components/teacher/progress/ProgressDataChecks'
import { downloadProgressCsv, progressCsv } from '@/lib/learner-intelligence/progress-review'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { buildOutcomeProgress, progressSummary, unlinkedSupportObservations, type ProgressEvidence } from '@/lib/learner-intelligence/progress-record'
import { currentProgressTerm, evidenceInProgressPeriod, progressDate, type ProgressPeriod, type ProgressTerm } from '@/lib/learner-intelligence/progress-period'
import { loadProgressAuthority, loadProgressEvidence, loadProgressRoster, loadProgressTerms, type ProgressAuthority, type ProgressLearner } from '@/lib/learner-intelligence/progress-data'

export const dynamic = 'force-dynamic'
type View = 'current'|'archived'
type SupportFilter = 'all'|'support'|'secure'|'no-evidence'|'declining'|'improving'

export default function ClassStudentProgressPage() {
  const { id: classId } = useParams<{id:string}>(), router = useRouter(), search = useSearchParams()
  const [summariesOpen, setSummariesOpen] = useState(false)
  const [authority, setAuthority] = useState<ProgressAuthority|null>(null)
  const [learners, setLearners] = useState<ProgressLearner[]>([]), [evidence, setEvidence] = useState<ProgressEvidence[]>([])
  const requestedSubject = search.get('subjectId')
  const requestedFilter = search.get('filter')
  const requestedPeriod = search.get('period')
  const requestedTermId=search.get('termId')
  const [termId,setTermId]=useState(requestedTermId??'')
  const [terms, setTerms] = useState<ProgressTerm[]>([]), [subject, setSubject] = useState('all'), [period, setPeriod] = useState<ProgressPeriod>('term')
  const [query, setQuery] = useState(''), [view, setView] = useState<View>('current'), [support, setSupport] = useState<SupportFilter>('all')
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const ticketRef = useRef(0)
  const load = useCallback(async () => {
    const ticket = ++ticketRef.current
    setLoading(true); setError('')
    try {
      const scope = await loadProgressAuthority(classId)
      const [roster, rows, calendar] = await Promise.all([loadProgressRoster(scope, view === 'archived'), loadProgressEvidence(scope), loadProgressTerms(scope.schoolId)])
      if (ticket !== ticketRef.current) return
      setAuthority(scope); setLearners(roster); setEvidence(rows); setTerms(calendar)
      if (requestedSubject && !scope.subjects.some(item => item.id === requestedSubject)) throw new Error('This subject is not assigned to you in this class.')
      setSubject(requestedSubject ?? 'all')
      setTermId(requestedTermId??'')
      setPeriod(['30','90','all'].includes(requestedPeriod ?? '') ? requestedPeriod as ProgressPeriod : 'term')
      setSupport(['declining','improving','support','no-evidence'].includes(requestedFilter ?? '') ? requestedFilter as SupportFilter : 'all')
    } catch (cause) {
      if (ticket === ticketRef.current) { setAuthority(null); setLearners([]); setEvidence([]); setError(cause instanceof Error ? cause.message : 'Class progress could not be loaded.') }
    } finally { if (ticket === ticketRef.current) setLoading(false) }
  }, [classId, view, requestedSubject, requestedFilter, requestedPeriod, requestedTermId])
  const invalidatePendingLoad = useCallback(() => { ++ticketRef.current }, [])
  useEffect(() => { void load(); return invalidatePendingLoad }, [load, invalidatePendingLoad])
  const today = progressDate(new Date())
  const term = useMemo(() => termId?terms.find(item=>item.id===termId)??null:currentProgressTerm(terms, new Date(`${today}T12:00:00+03:00`)), [terms, today, termId])
  const cards = useMemo(() => {
    const byLearner = new Map<string, ProgressEvidence[]>()
    for (const row of evidence) {
      if (!row.subjectId || (subject !== 'all' && row.subjectId !== subject) || !evidenceInProgressPeriod(row, period, term)) continue
      const items = byLearner.get(row.studentId) ?? []; items.push(row); byLearner.set(row.studentId, items)
    }
    return learners.map(learner => {
      const rows = byLearner.get(learner.id) ?? [], outcomes = buildOutcomeProgress(rows), summary = progressSummary(outcomes)
      return { ...learner, count: rows.length, outcomes, summary, supportObservations: unlinkedSupportObservations(rows).length, declining: outcomes.filter(item => item.trend === 'declining').length, improving: outcomes.filter(item => item.trend === 'improving').length, unlinked: rows.filter(item => !item.outcomeId).length }
    })
  }, [learners, evidence, subject, period, term])
  const visible = cards.filter(learner => `${learner.name} ${learner.admission_number ?? ''}`.toLowerCase().includes(query.toLowerCase().trim()))
    .filter(learner => support === 'all' || (support === 'support' && learner.summary.needsSupport + learner.supportObservations > 0) || (support === 'secure' && learner.summary.secure > 0) || (support === 'no-evidence' && learner.count === 0) || (support === 'declining' && learner.declining > 0) || (support === 'improving' && learner.improving > 0))
    .sort((a,b) => b.summary.needsSupport - a.summary.needsSupport || a.name.localeCompare(b.name))
  const gaps = useMemo(() => {
    const map = new Map<string, { label: string; assessed: number; support: number; subjectId: string|null }>()
    for (const learner of cards) for (const outcome of learner.outcomes) {
      const key = JSON.stringify([outcome.subjectId, outcome.outcomeId]), item = map.get(key) ?? { label: outcome.outcomeText, assessed: 0, support: 0, subjectId: outcome.subjectId }
      if (outcome.band !== 'NE') item.assessed++
      if (outcome.band === 'BE' || outcome.band === 'AE') item.support++
      map.set(key, item)
    }
    return Array.from(map.values()).filter(item => item.support > 0).sort((a,b) => b.support - a.support).slice(0,5)
  }, [cards])
  const contextFilters = new URLSearchParams()
  if (subject !== 'all') contextFilters.set('subjectId',subject)
  if (period !== 'term') contextFilters.set('period',period)
  if (termId) contextFilters.set('termId',termId)
  const contextQuery = contextFilters.size ? `?${contextFilters}` : ''
  function exportRecord() {
    if (!authority || period === 'term' && !term) return
    const ids = new Set(visible.map(learner=>learner.id))
    const rows = evidence.filter(row=>ids.has(row.studentId) && (subject==='all'||row.subjectId===subject) && evidenceInProgressPeriod(row,period,term))
    downloadProgressCsv(progressCsv(rows,visible,authority.subjects,{className:authority.className,period:period==='term'?term!.name:period==='all'?'All evidence':`Last ${period} days`,asOf:new Date().toISOString()}),'student-progress-record.csv')
  }
  if (loading) return <section style={{padding:20}} aria-label="Loading class progress"><p>Loading your complete class progress record…</p></section>
  return <section className="progress-print" style={{maxWidth:940,margin:'0 auto',padding:'16px 14px 112px',color:"var(--teacher-ink, #1c2923)"}}>
    <section style={{padding:18,borderRadius:20,background:'#2c2944',color:'#fff'}}>
      <button data-progress-controls type="button" onClick={() => router.push(`/teacher/classhub/${classId}`)} style={heroButton}>‹ Class</button>
      <h1 style={{margin:'12px 0 5px',fontSize:24}}>Student Progress Record · {authority?.className ?? 'Class'}</h1>
      <p style={{margin:0,fontSize:13,lineHeight:1.6}}>Review each learner's outcome evidence and choose the next useful action. A recorded score and a recorded performance level remain separate.</p>
    </section>
    {error ? <section role="alert" style={{...card,background:'#fef2f2',color:'#991b1b'}}>{error}<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}><button type="button" onClick={() => void load()} style={pill}>Retry</button>{view==='archived'&&<button type="button" onClick={()=>setView('current')} style={pill}>Current learners</button>}<button type="button" onClick={()=>router.push(`/teacher/classhub/${classId}/progress`)} style={pill}>Clear progress filters</button></div></section> : <>
      <nav data-progress-controls aria-label="Progress lifecycle" style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12}}>
        {([['current','Current learners'],['archived','Archived learners']] as const).map(([key,text]) => <button type="button" key={key} onClick={() => setView(key)} style={{...pill,background:view===key?'#111827':'#fff',color:view===key?'#fff':'#374151'}}>{text}</button>)}
        <button type="button" onClick={() => router.push(`/teacher/classhub/${classId}/workbook?sheet=progress${subject==='all'?'':`&subjectId=${encodeURIComponent(subject)}`}`)} style={pill}>Open record sheet</button>
        {view === 'current' && <button type="button" onClick={() => router.push(`/teacher/assessment/interventions?classId=${encodeURIComponent(classId)}${subject === 'all' ? '' : `&subjectId=${encodeURIComponent(subject)}`}`)} style={pill}>Review support</button>}
        <button type="button" disabled={period==='term'&&!term} onClick={exportRecord} style={pill}>Export working copy</button>
        <button type="button" onClick={()=>router.push(`/teacher/report-cards?classId=${encodeURIComponent(classId)}${subject==='all'?'':`&subjectId=${encodeURIComponent(subject)}`}`)} style={pill}>School reports</button>
        {view==='current'&&<button type="button" onClick={()=>router.push(`/teacher/classhub/${classId}/groups${subject==='all'?'':`?subjectId=${encodeURIComponent(subject)}`}`)} style={pill}>Learner groups</button>}
        <button type="button" onClick={() => window.print()} style={pill}>Print class record</button>
      </nav>
      <section data-progress-controls aria-label="Class progress search and filters" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8,margin:'12px 0'}}>
        <input aria-label="Search learners" placeholder="Search learner or admission number" value={query} onChange={event => setQuery(event.target.value)} style={control}/>
        <select aria-label="Subject" value={subject} onChange={event => setSubject(event.target.value)} style={control}><option value="all">All assigned subjects</option>{authority?.subjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Period" value={period} onChange={event => setPeriod(event.target.value as ProgressPeriod)} style={control}><option value="term">{term ? term.name : 'This term unavailable'}</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All evidence</option></select>
        {period==='term'&&<select aria-label="School term" value={termId} onChange={event=>setTermId(event.target.value)} style={control}><option value="">Current school term</option>{terms.map(item=><option key={item.id} value={item.id}>{item.name} · {item.academic_year??item.start_date.slice(0,4)}</option>)}</select>}
        <select aria-label="Progress status" value={support} onChange={event => setSupport(event.target.value as SupportFilter)} style={control}><option value="all">All learners</option><option value="support">Recorded support evidence</option><option value="secure">Meeting / exceeding in an outcome</option><option value="no-evidence">No evidence in this period</option><option value="declining">Declining in an outcome</option><option value="improving">Improving in an outcome</option></select>
      </section>
      {period === 'term' && !term && <section role="status" style={card}>No single school term contains today. Choose another period; no 120-day substitute has been used.</section>}
      {view === 'archived' && <section style={card}>Read-only history: archive does not delete learning evidence. Access still depends on your current authorized class scope.</section>}
      {(period!=='term'||term)&&<>
      <section style={card} aria-label="Class evidence overview"><strong>{visible.length} shown · {cards.length} {view === 'current' ? 'current' : 'archived'} learners</strong><p style={{fontSize:13,lineHeight:1.6,marginBottom:0}}>{cards.filter(item => item.summary.needsSupport + item.supportObservations > 0).length} have recorded evidence indicating support · {cards.filter(item => item.count === 0).length} have no evidence in this period. This view shows your readable evidence in assigned subjects.</p></section>
      {gaps.length > 0 && <section style={card}><h2 style={{fontSize:17,marginTop:0}}>Outcomes to review</h2>{gaps.map((gap,index) => <p key={index} style={{fontSize:13,lineHeight:1.6}}><strong>{gap.support} of {gap.assessed} learners with recorded levels need support</strong> · {cards.length - gap.assessed} have no recorded level · {authority?.subjects.find(item => item.id === gap.subjectId)?.name ?? 'Subject'} · {gap.label}</p>)}</section>}
      <OutcomeMatrix learners={visible} onOpenLearner={learnerId => router.push(`/teacher/classhub/${classId}/student/${learnerId}/progress${contextQuery}`)} />
      <details className="studio-lesson-details" open={summariesOpen || visible.every(learner => !learner.outcomes.length)} onToggle={event => { if (visible.some(learner => learner.outcomes.length)) setSummariesOpen(event.currentTarget.open) }}><summary>Learner summaries</summary>
      {(summariesOpen || visible.every(learner => !learner.outcomes.length)) && <>
      <div className="studio-lesson-grid studio-learner-grid">{visible.map(learner => <button type="button" key={learner.id} onClick={() => router.push(`/teacher/classhub/${classId}/student/${learner.id}/progress${contextQuery}`)} className="studio-lesson-card" style={{margin:0,textAlign:'left',font:'inherit',cursor:'pointer'}}>
        <strong>{learner.name}</strong><div style={{marginTop:6,fontSize:12,color:studio.muted,lineHeight:1.7}}>{learner.admission_number ? `Adm ${learner.admission_number} · ` : ''}{learner.count} evidence items · {learner.summary.secure} meeting / exceeding outcomes · {learner.summary.needsSupport} support outcomes</div>
        <div style={{marginTop:4,fontSize:12,color:studio.muted}}>{learner.declining ? `${learner.declining} declining outcome(s) · ` : ''}{learner.improving ? `${learner.improving} improving outcome(s) · ` : ''}{learner.supportObservations ? `${learner.supportObservations} CBC support observation(s) awaiting outcome links · ` : ''}{learner.unlinked ? `${learner.unlinked} evidence item(s) without an outcome link` : learner.count ? 'Open evidence and history' : 'No evidence in the selected period'}</div>
      </button>)}{!visible.length && <section style={card}>No learners match this view. Change the filters or check your class roster.</section>}</div>
      </>}
      </details>
      </>}
      <ProgressDataChecks rows={evidence.filter(row=>!row.subjectId||subject==='all'||row.subjectId===subject)}/>
      <p style={{fontSize:11,lineHeight:1.7,color:"var(--teacher-muted, #627168)"}}>Trend labels require four comparable observations on separate Nairobi dates. Learners are never given one overall level by averaging different subjects. This is a VibeSchool evidence projection, not a released school report.</p>
    </>}
  </section>
}
const card: React.CSSProperties = {padding:15,marginTop:12,border:`1px solid ${studio.border}`,borderRadius:15,background:'#fff',breakInside:'avoid'}
const heroButton: React.CSSProperties = {border:0,borderRadius:10,minHeight:44,padding:'0 12px',background:'rgba(255,255,255,.14)',color:'#fff',fontWeight:800}
const pill: React.CSSProperties = {minHeight:44,border:'1px solid #d1d5db',borderRadius:12,padding:'0 14px',background:'#fff',fontWeight:800,cursor:'pointer'}
const control: React.CSSProperties = {width:'100%',boxSizing:'border-box',minHeight:46,border:'1px solid #d1d5db',borderRadius:12,padding:'0 12px',background:'#fff',color:studio.ink}
