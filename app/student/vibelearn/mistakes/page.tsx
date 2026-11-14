'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useStudent } from '@/lib/student-context'
import { getRevisionWorkspace, isCurrentGradeMistake, type MistakeNotebookItem, type RevisionWorkspace } from '@/lib/student/vibelearn'
import { supabase } from '@/lib/supabase'

type ReleasedMiss = { recovery_key:string; attempt_id:string|null; assessment_item_id:string|null; reason:'incorrect'|'skipped'; prompt:string; context_title:string; identity_state:'verified'|'outcome_unlinked'|'outcome_not_verified'; outcome_code:string|null }
function parseReleasedMisses(value:unknown):ReleasedMiss[] {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Invalid released assessment evidence.')
  const row=value as Record<string,unknown>
  if(row.ok!==true || !Array.isArray(row.cases))throw new Error('Invalid released assessment evidence.')
  return row.cases.flatMap((entry:unknown)=>{
    if(!entry || typeof entry!=='object' || Array.isArray(entry))return []
    const e=entry as Record<string,unknown>
    if(e.origin!=='released_assessment'||typeof e.recovery_key!=='string'||typeof e.prompt!=='string'||typeof e.context_title!=='string'||!['incorrect','skipped'].includes(String(e.reason)))return []
    return [{recovery_key:e.recovery_key,attempt_id:typeof e.attempt_id==='string'?e.attempt_id:null,assessment_item_id:typeof e.assessment_item_id==='string'?e.assessment_item_id:null,reason:e.reason as 'incorrect'|'skipped',prompt:e.prompt,context_title:e.context_title,identity_state:['verified','outcome_unlinked','outcome_not_verified'].includes(String(e.identity_state))?e.identity_state as ReleasedMiss['identity_state']:'outcome_unlinked',outcome_code:typeof e.outcome_code==='string'?e.outcome_code:null}]
  })
}

/**
 * My Mistakes is a learner-owned repair queue, not a second assessment engine.
 * The exact outcome repair route is authoritative for approved content, marking
 * and spaced verification. Notebook statuses are not certified mastery.
 */
export default function VibeLearnMistakesPage() {
  const router = useRouter()
  const { identity } = useStudent()
  const [workspace, setWorkspace] = useState<RevisionWorkspace | null>(null)
  const [released, setReleased] = useState<ReleasedMiss[]>([])
  const [releasedError,setReleasedError]=useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'needs' | 'all' | 'reviewed'>('needs')
  const [subject, setSubject] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [notebook,canonical]=await Promise.allSettled([
      getRevisionWorkspace(),
      supabase.rpc('student_get_exact_learning_recovery' as never,{p_attempt_id:null,p_limit:80})
    ])
    if(notebook.status==='fulfilled')setWorkspace(notebook.value)
    else setError(notebook.reason instanceof Error?notebook.reason.message:'Could not load your learning records.')
    if(canonical.status==='fulfilled' && !canonical.value.error){
      try{setReleased(parseReleasedMisses(canonical.value.data));setReleasedError('')}
      catch(cause){setReleasedError(cause instanceof Error?cause.message:'Could not read released assessment mistakes.')}
    }else setReleasedError(canonical.status==='rejected'?String(canonical.reason):canonical.value.error?.message??'Could not read released assessment mistakes.')
    setLoading(false)
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

  // Assessment evidence stays authoritative. The dashboard presents one actionable
  // record first, instead of forcing learners through a long, repeated list.
  const spotlight = released.find(item => Boolean(item.attempt_id))
  const releasedGroups = Array.from(released.reduce((groups, item) => {
    const key = item.context_title
    groups.set(key, [...(groups.get(key) ?? []), item])
    return groups
  }, new Map<string, ReleasedMiss[]>()).entries())

  return <main style={shell}><div className="vs-learn-page" style={container}>
    <header style={{...hero,background:'linear-gradient(125deg,var(--vs-card) 0%,var(--vs-accent-soft) 100%)',padding:'clamp(22px,4vw,36px)'}}>
      <div style={kicker}>MY LEARNING / SKILL RECOVERY</div>
      <h1 style={{fontSize:'clamp(30px,5vw,44px)',letterSpacing:'-.045em',lineHeight:1.1,margin:'10px 0'}}>Make your next answer better.</h1>
      <p style={{...muted,maxWidth:580,margin:'0 0 16px'}}>My Mistakes helps you understand what went wrong, revisit the skill and try again. Your marks stay with the original assessment.</p>
      <button type="button" style={secondary} onClick={() => void load()}>Refresh my mistakes</button>
    </header>

    {error && <section style={card} role="alert"><strong>Learning notebook unavailable</strong><p style={muted}>{error}</p><button style={secondary} onClick={() => void load()}>Try again</button></section>}
    {releasedError && <section style={card} role="alert"><strong>Assessment mistakes could not be loaded</strong><p style={muted}>{releasedError}</p><button style={secondary} onClick={() => void load()}>Retry</button></section>}
    {loading ? <section style={card} role="status">Loading your learning evidence…</section> : <>
      <section aria-label="Your mistake recovery snapshot" style={stats}>
        <Metric value={released.length} title="Recent misses" detail="Incorrect or skipped assessment responses" />
        <Metric value={needs.length} title="Skills to repair" detail="Current-grade learning notebook" />
        <Metric value={reviewed.length} title="Reviewed skills" detail="Still subject to verification" />
      </section>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,310px),1fr))',gap:14,alignItems:'start',marginBottom:14}}>
        <section style={{...feature,marginBottom:0}} aria-labelledby="mistake-next">
          <div style={featureHead}><span style={kicker}>YOUR NEXT ACTION</span><span style={tag}>Start here</span></div>
          <h2 id="mistake-next" style={{fontSize:23,letterSpacing:'-.035em',margin:'11px 0 7px'}}>Fix one mistake</h2>
          {next ? <>
            <p style={{...muted,margin:'0 0 9px'}}>{next.subject} · {next.topic} · missed {next.repeatCount} {next.repeatCount===1?'time':'times'}</p>
            <div style={question}>{next.prompt}</div>
            {next.explanation && <details style={{marginTop:12}}><summary style={summary}>See the recorded explanation</summary><p style={muted}>{next.explanation}</p></details>}
            <button style={{...primary,marginTop:15,width:'100%'}} onClick={() => recovery(next)}>Review and retry this skill</button>
          </> : spotlight ? <>
            <p style={{...muted,margin:'0 0 9px'}}>{spotlight.context_title} · {spotlight.reason==='skipped'?'Skipped question':'Incorrect answer'}</p>
            <div style={question}>{spotlight.prompt}</div>
            <p style={{...muted,margin:'10px 0'}}>{spotlight.identity_state==='verified'?'Linked to a verified outcome':'Outcome verification pending; no mastery claim'}</p>
            <button style={{...primary,marginTop:8,width:'100%'}} onClick={() => router.push('/student/vibelearn/recovery?attempt='+encodeURIComponent(spotlight.attempt_id!)+(spotlight.assessment_item_id?'&item='+encodeURIComponent(spotlight.assessment_item_id):''))}>Review and retry this question</button>
          </> : <>
            <p style={muted}>No recorded mistakes are ready to repair. You can keep learning and return after a marked assessment.</p>
            <button style={secondary} onClick={() => router.push('/student/vibelearn/topic-practice')}>Open Topic Practice</button>
          </>}
        </section>
        <section style={{...card,marginBottom:0}} aria-labelledby="mistake-how">
          <div style={kicker}>HOW RECOVERY WORKS</div>
          <h2 id="mistake-how" style={{...heading,marginTop:9}}>Understand. Try. Verify.</h2>
          <div style={{display:'grid',gap:13}}>
            {[
              ['01','Understand','Read the explanation or return to the exact learning source.'],
              ['02','Try again','Answer a new question using the existing assessment engine.'],
              ['03','Check your progress','See recorded feedback. Mastery is never awarded just for opening a page.'],
            ].map(([number,title,description])=><div key={number} style={{display:'flex',gap:12}}>
              <span aria-hidden="true" style={{...tag,height:30,minWidth:35,textAlign:'center'}}>{number}</span>
              <span><strong style={{fontSize:14}}>{title}</strong><p style={{...muted,margin:'3px 0'}}>{description}</p></span>
            </div>)}
          </div>
        </section>
      </div>

      <section style={card} aria-labelledby="mistake-skills">
        <div style={sectionHead}><div><div style={kicker}>MY SKILL RECOVERY</div><h2 id="mistake-skills" style={heading}>Skills that need another look</h2></div><span style={counter}>{visible.length} matching</span></div>
        <div style={controls}>
          <div role="group" aria-label="Filter skills by recovery state" style={tabs}>
            {([['needs','Needs work'],['reviewed','Reviewed'],['all','All skills']] as const).map(([value,label])=>
              <button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)} style={{...tab,...(filter===value?selectedTab:{})}}>{label}</button>)}
          </div>
          <label style={{fontSize:12,fontWeight:700,color:'var(--vs-muted)'}}>Subject{' '}
            <select aria-label="Filter by subject" value={subject} onChange={e=>setSubject(e.target.value)} style={select}>
              <option value="all">All subjects</option>
              {subjects.map(value=><option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>
        {visible.length===0?<p style={muted}>No current-grade skills match this view. Assessment mistakes can still be reviewed in the history below.</p>:
          <div style={{display:'grid',gap:9}}>{visible.slice(0,4).map(item=><article key={item.id} style={itemCard}>
            <div style={sectionHead}><div><strong>{item.subject} · {item.topic}</strong><p style={{...muted,margin:'4px 0'}}>{item.status==='resolved'?'Reviewed — verify retention':item.status==='practising'?'Practising':'Needs correction'} · {item.repeatCount} {item.repeatCount===1?'miss':'misses'}</p></div><span style={tag}>{item.status==='resolved'?'Reviewed':'To practise'}</span></div>
            <p style={{fontSize:14,lineHeight:1.55,margin:'9px 0'}}>{item.prompt}</p>
            <div style={actions}><button style={primarySmall} onClick={()=>recovery(item)}>Work on this skill</button>{item.reviewUrl&&<button style={secondary} onClick={()=>router.push(item.reviewUrl!)}>Read lesson</button>}</div>
          </article>)}</div>}
        {visible.length>4&&<details style={{marginTop:14}}><summary style={summary}>Show {visible.length-4} more skills</summary>
          <div style={{display:'grid',gap:9,marginTop:12}}>{visible.slice(4).map(item=><article key={item.id} style={itemCard}>
            <strong>{item.subject} · {item.topic}</strong><p style={muted}>{item.prompt}</p>
            <button style={secondary} onClick={()=>recovery(item)}>Review skill</button>
          </article>)}</div></details>}
      </section>

      <section style={card} aria-labelledby="mistake-history">
        <div style={sectionHead}><div><div style={kicker}>ASSESSMENT HISTORY</div><h2 id="mistake-history" style={heading}>Missed and skipped questions</h2></div><span style={counter}>{released.length} recent responses</span></div>
        <p style={muted}>Grouped by assessment to keep this screen focused. These are your released responses, not new scores. An outcome awaiting verification stays unverified.</p>
        {releasedGroups.length===0 ? <p style={muted}>No released missed or skipped answers were found in the recent window.</p> :
          <div style={{display:'grid',gap:9,marginTop:14}}>{releasedGroups.map(([name,items])=>
            <details key={name} style={itemCard}><summary style={{...summary,color:'var(--vs-text)',display:'flex',justifyContent:'space-between',gap:12}}>
              <strong>{name}</strong><span style={tag}>{items.length} {items.length===1?'question':'questions'}</span>
            </summary>
            <div style={{display:'grid',gap:9,marginTop:13}}>{items.map(entry=><article key={entry.recovery_key} style={{padding:'12px 0',borderTop:'1px solid var(--vs-border)'}}>
              <div style={sectionHead}><strong style={{fontSize:13,lineHeight:1.6}}>{entry.prompt}</strong><span style={counter}>{entry.reason==='skipped'?'Skipped':'Incorrect'}</span></div>
              <p style={{...muted,margin:'7px 0'}}>{entry.identity_state==='verified'?'Verified outcome link':entry.outcome_code?'Outcome '+entry.outcome_code+' · verification pending':'Curriculum link pending'}</p>
              <div style={actions}>
                {entry.attempt_id&&<button style={primarySmall} onClick={()=>router.push('/student/vibelearn/recovery?attempt='+encodeURIComponent(entry.attempt_id!)+(entry.assessment_item_id?'&item='+encodeURIComponent(entry.assessment_item_id):''))}>Review mistake</button>}
                {entry.attempt_id&&<button style={secondary} onClick={()=>router.push('/student/results/'+encodeURIComponent(entry.attempt_id!))}>Original result</button>}
              </div>
            </article>)}</div>
          </details>)}</div>}
      </section>

      {historical.length>0&&<section style={card}><details><summary style={summary}>Earlier or unverified notebook records ({historical.length})</summary>
        <p style={muted}>Preserved for reference only. These cannot be treated as verified current-grade recovery.</p>
        {historical.map(item=><div key={item.id} style={{...itemCard,marginTop:8}}><strong>{item.subject} · {item.topic}</strong><p style={muted}>{item.prompt}</p></div>)}
      </details></section>}
      <p style={{...muted,textAlign:'center'}}>Your original scores remain unchanged. Only the existing learning and assessment systems determine progress.</p>
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
