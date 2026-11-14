'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { useStudent } from '@/lib/student-context'
import { getRevisionWorkspace, isCurrentGradeMistake, type MistakeNotebookItem, type RevisionWorkspace } from '@/lib/student/vibelearn'

/**
 * My Mistakes is a learner-owned repair queue, not a second assessment engine.
 * The exact outcome repair route is authoritative for approved content, marking
 * and spaced verification. Notebook statuses are not certified mastery.
 */
export default function VibeLearnMistakesPage() {
  const router = useRouter()
  const { identity } = useStudent()
  const [workspace, setWorkspace] = useState<RevisionWorkspace | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'needs' | 'all' | 'reviewed'>('needs')
  const [subject, setSubject] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setWorkspace(await getRevisionWorkspace()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load your learning records.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const { eligible, historical } = useMemo(() => {
    const records = workspace?.mistakes ?? []
    return {
      eligible: records.filter(item => isCurrentGradeMistake(item, identity?.className)),
      historical: records.filter(item => !isCurrentGradeMistake(item, identity?.className)),
    }
  }, [workspace, identity?.className])
  const needs = eligible.filter(item => item.status !== 'resolved')
  const reviewed = eligible.filter(item => item.status === 'resolved')
  const ordered = useMemo(() => [...eligible].sort((a, b) => {
    const aOpen = a.status === 'resolved' ? 1 : 0
    const bOpen = b.status === 'resolved' ? 1 : 0
    return aOpen - bOpen || b.repeatCount - a.repeatCount ||
      (Date.parse(b.lastMissedAt ?? '') || 0) - (Date.parse(a.lastMissedAt ?? '') || 0)
  }), [eligible])
  const subjects = useMemo(() => [...new Set(eligible.map(item => item.subject))].sort(), [eligible])
  const visible = ordered.filter(item =>
    (filter === 'all' || (filter === 'needs' ? item.status !== 'resolved' : item.status === 'resolved')) &&
    (subject === 'all' || item.subject === subject)
  )
  const next = ordered.find(item => item.status !== 'resolved')
  const recovery = (item: MistakeNotebookItem) => router.push('/student/vibelearn/recovery?mistake=' + encodeURIComponent(item.id))

  return <main style={shell}><div className="vs-learn-page" style={container}>
    <VibeLearnSubnav />
    <header style={hero}>
      <div style={kicker}>VIBESCHOOL · LEARNING REPAIR</div>
      <h1 style={{fontSize:'clamp(26px,5vw,37px)',letterSpacing:'-.04em',lineHeight:1.12,margin:'8px 0'}}>My Mistakes</h1>
      <p style={{...muted,maxWidth:640,margin:0}}>Find what needs another look, relearn the exact skill, and prove it with a fresh question. No AI guesses or self-awarded mastery.</p>
    </header>

    {error && <section style={card} role="alert"><strong>We could not load your mistakes.</strong><p style={muted}>{error}</p><button style={secondary} onClick={() => void load()}>Try again</button></section>}
    {loading ? <section style={card} role="status">Loading your learning records…</section>
    : error ? null : <>
      <section aria-label="Your repair overview" style={stats}>
        <Metric value={needs.length} title="Need fixing" detail="Current grade" />
        <Metric value={eligible.filter(item => item.status === 'practising').length} title="Practising" detail="Still needs proof" />
        <Metric value={reviewed.length} title="Reviewed" detail="Not automatically mastered" />
      </section>

      {next ? <section style={feature} aria-labelledby="next-repair">
        <div style={featureHead}><span style={kicker}>YOUR NEXT REPAIR</span><span style={tag}>Recommended next</span></div>
        <h2 id="next-repair" style={{fontSize:22,margin:'9px 0 4px',letterSpacing:'-.025em'}}>{next.subject} · {next.topic}</h2>
        <p style={{...muted,margin:'6px 0 12px'}}>You have missed this question {next.repeatCount} {next.repeatCount===1?'time':'times'}. Start with its linked explanation, then try a new independently marked question.</p>
        <div style={question}>{next.prompt}</div>
        {next.explanation && <details style={{margin:'12px 0'}}><summary style={summary}>Read recorded explanation</summary><p style={muted}>{next.explanation}</p></details>}
        <button style={primary} onClick={() => recovery(next)}>Fix this mistake →</button>
      </section> : <section style={card}>
        <h2 style={heading}>No current-grade repairs waiting</h2>
        <p style={muted}>Incorrect or skipped answers from supported scored activities appear here once recorded. Reviewed answers remain below; mastery still requires verified evidence.</p>
        <button style={secondary} onClick={() => router.push('/student/vibelearn/topic-practice')}>Open Topic Practice</button>
      </section>}

      <section style={card} aria-labelledby="repair-queue">
        <div style={sectionHead}><div><div style={kicker}>YOUR SKILLS</div><h2 id="repair-queue" style={heading}>Repair queue</h2></div><span style={counter}>{visible.length} shown</span></div>
        <div style={controls}>
          <div role="group" aria-label="Filter by recovery state" style={tabs}>
            {([['needs','Needs fixing'],['all','All'],['reviewed','Reviewed']] as const).map(([value,label]) =>
              <button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}
                style={{...tab,...(filter===value?selectedTab:{})}}>{label}</button>)}
          </div>
          <label style={{fontSize:12,fontWeight:700,color:'var(--vs-muted)'}}>Subject{' '}
            <select aria-label="Filter by subject" value={subject} onChange={e=>setSubject(e.target.value)} style={select}>
              <option value="all">All subjects</option>
              {subjects.map(value=><option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>
        {visible.length===0 ? <p style={muted}>No recorded skills match these filters.</p> :
          <div style={{display:'grid',gap:10}}>
            {visible.map(item=><article key={item.id} style={itemCard}>
              <div style={sectionHead}><div><strong>{item.subject} · {item.topic}</strong><p style={{...muted,margin:'4px 0'}}>{item.status==='resolved'?'Reviewed — verify retained understanding':item.status==='practising'?'Practising — more evidence needed':'Needs correction'}</p></div>
                <span style={counter}>{item.repeatCount} {item.repeatCount===1?'miss':'misses'}</span></div>
              <p style={{fontSize:14,lineHeight:1.55,margin:'7px 0 10px'}}>{item.prompt}</p>
              {item.explanation && <details><summary style={summary}>Show available explanation</summary><p style={muted}>{item.explanation}</p></details>}
              <div style={actions}>
                <button style={primarySmall} onClick={()=>recovery(item)}>{item.status==='resolved'?'Check recovery evidence':'Repair exact skill'} →</button>
                {item.reviewUrl && <button style={secondary} onClick={()=>router.push(item.reviewUrl!)}>Review source</button>}
              </div>
            </article>)}
          </div>}
      </section>

      {historical.length>0 && <section style={card}>
        <details><summary style={summary}>Earlier or unverified practice ({historical.length})</summary>
          <p style={muted}>Preserved for review only. Records without verified current-grade provenance never become recommended repairs.</p>
          <div style={{display:'grid',gap:10}}>{historical.map(item=><article key={item.id} style={itemCard}>
            <strong>{item.subject} · {item.topic}</strong>
            <p style={muted}>{item.sourceGrade ?? 'Grade not recorded'} · {item.sourceVerified?'Verified source':'Source verification pending'}</p>
            <p style={{fontSize:14,lineHeight:1.55}}>{item.prompt}</p>
            {item.explanation && <details><summary style={summary}>Earlier explanation</summary><p style={muted}>{item.explanation}</p></details>}
          </article>)}</div>
        </details>
      </section>}
      <p style={{...muted,textAlign:'center',marginBottom:24}}>Recovery is scored by the existing assessment system. Opening an explanation or completing a screen does not earn mastery.</p>
    </>}
  </div></main>
}

function Metric({value,title,detail}:{value:number;title:string;detail:string}) {
  return <div style={metric}><strong style={{fontSize:28,letterSpacing:'-.04em',fontVariantNumeric:'tabular-nums'}}>{value}</strong>
    <span style={{fontWeight:800,fontSize:13}}>{title}</span><span style={{fontSize:11,color:'var(--vs-muted)'}}>{detail}</span></div>
}
const shell:CSSProperties={minHeight:'100vh',background:'var(--vs-soft)',padding:'16px 14px 90px',color:'var(--vs-text)',fontFamily:"'Plus Jakarta Sans', sans-serif"}
const container:CSSProperties={maxWidth:980,margin:'0 auto'}
const hero:CSSProperties={background:'var(--vs-card)',border:'1px solid var(--vs-border)',borderRadius:22,padding:'clamp(20px,4vw,30px)',marginBottom:14}
const card:CSSProperties={background:'var(--vs-card)',border:'1px solid var(--vs-border)',borderRadius:18,padding:'clamp(14px,3vw,22px)',marginBottom:14}
const feature:CSSProperties={...card,border:'2px solid var(--vs-accent)'}
const kicker:CSSProperties={fontSize:10,fontWeight:900,letterSpacing:1.1,color:'var(--vs-accent)'}
const muted:CSSProperties={fontSize:13,lineHeight:1.6,color:'var(--vs-muted)'}
const stats:CSSProperties={display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:9,marginBottom:14}
const metric:CSSProperties={background:'var(--vs-card)',border:'1px solid var(--vs-border)',borderRadius:16,padding:'14px 10px',display:'flex',flexDirection:'column',gap:3}
const featureHead:CSSProperties={display:'flex',gap:10,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}
const sectionHead:CSSProperties={display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}
const heading:CSSProperties={fontSize:20,letterSpacing:'-.025em',margin:'5px 0 14px'}
const tag:CSSProperties={fontSize:11,padding:'6px 10px',fontWeight:800,background:'var(--vs-accent-soft)',color:'var(--vs-accent)',borderRadius:20}
const question:CSSProperties={background:'var(--vs-soft)',border:'1px solid var(--vs-border)',borderRadius:12,padding:13,fontSize:15,lineHeight:1.55}
const controls:CSSProperties={display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap',marginBottom:16}
const tabs:CSSProperties={display:'flex',gap:5,flexWrap:'wrap'}
const tab:CSSProperties={border:'1px solid var(--vs-border)',borderRadius:9,padding:'9px 11px',background:'var(--vs-card)',color:'var(--vs-text)',cursor:'pointer',fontWeight:750}
const selectedTab:CSSProperties={background:'var(--vs-accent-soft)',color:'var(--vs-accent)',borderColor:'var(--vs-accent)'}
const select:CSSProperties={border:'1px solid var(--vs-border)',borderRadius:8,padding:9,background:'var(--vs-card)',color:'var(--vs-text)',maxWidth:180}
const itemCard:CSSProperties={background:'var(--vs-soft)',border:'1px solid var(--vs-border)',borderRadius:13,padding:14}
const counter:CSSProperties={fontSize:11,fontWeight:750,color:'var(--vs-muted)',whiteSpace:'nowrap'}
const summary:CSSProperties={cursor:'pointer',fontSize:13,fontWeight:750,color:'var(--vs-accent)',padding:'4px 0'}
const actions:CSSProperties={display:'flex',flexWrap:'wrap',gap:8,marginTop:12}
const primary:CSSProperties={border:0,background:'var(--vs-accent)',color:'var(--vs-on-accent)',borderRadius:10,padding:'12px 15px',minHeight:44,fontWeight:800,cursor:'pointer'}
const primarySmall:CSSProperties={...primary,padding:'9px 12px'}
const secondary:CSSProperties={border:'1px solid var(--vs-border)',background:'var(--vs-accent-soft)',color:'var(--vs-text)',borderRadius:10,padding:'9px 12px',minHeight:40,fontWeight:750,cursor:'pointer'}
