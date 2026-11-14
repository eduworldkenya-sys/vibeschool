'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { BrainCircuit, BookOpen, CheckCheck, ChevronRight, CircleCheck, ClipboardList, Hash, Pencil, RotateCcw, Settings2, SlidersHorizontal, Target, AlertCircle } from 'lucide-react'
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
  const [view, setView] = useState<'fix' | 'reviewed' | 'history'>('fix')
  const [showPreferences,setShowPreferences] = useState(false)
  const [expandSkills,setExpandSkills] = useState(false)
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
    (view === 'reviewed' ? item.status === 'resolved' : item.status !== 'resolved') &&
    (subject === 'all' || item.subject === subject)
  )
  const next = ordered.find(item => item.status !== 'resolved')
  const recovery = (item: MistakeNotebookItem) => router.push('/student/vibelearn/recovery?mistake=' + encodeURIComponent(item.id))


  const spotlight = released.find(item => Boolean(item.attempt_id))
  const releaseGroups = Array.from(released.reduce((groups,item) => {
    // A single assessment can have many misses. Preserve exact item URLs.
    const key=item.context_title
    groups.set(key,[...(groups.get(key)??[]),item])
    return groups
  },new Map<string,ReleasedMiss[]>()).entries())
  const jumpToReleased = (item:ReleasedMiss) => {
    if(!item.attempt_id)return
    router.push('/student/vibelearn/recovery?attempt='+encodeURIComponent(item.attempt_id)+(item.assessment_item_id?'&item='+encodeURIComponent(item.assessment_item_id):''))
  }
  const allSubjects=[...new Set([...subjects,...released.map(item=>{
    const match=item.context_title.match(/(?:Grade|Form)\s+\d+\s+(.+?)\s+[—–-]/i)
    return match?.[1]?.trim()??''
  }).filter(Boolean)])].sort()

  return <main style={shell}><div className="vs-learn-page" style={container}>
    <div style={topline}>
      <div style={{display:'flex',alignItems:'center',gap:11}}>
        <span style={brandMark}><BrainCircuit size={23} aria-hidden="true"/></span>
        <div><div style={eyebrow}>VIBESCHOOL</div><h1 style={{margin:0,fontSize:23,letterSpacing:'-.03em'}}>Recovery Studio</h1></div>
      </div>
      <button type="button" aria-label="Recovery Studio settings" aria-expanded={showPreferences} onClick={()=>setShowPreferences(value=>!value)} style={iconButton}><Settings2 size={19}/></button>
    </div>
    {showPreferences&&<section style={{...surface,marginBottom:12}} aria-label="Recovery preferences">
      <strong>Recovery tools</strong>
      <p style={muted}>Your results are always marked by the existing assessment system. Update the evidence or open the original records whenever you need to.</p>
      <button type="button" style={lightButton} onClick={()=>void load()}><RotateCcw size={15}/> Refresh learning records</button>
    </section>}

    <header style={hero} aria-label="Recovery Studio introduction">
      <span style={heroBadge}>YOUR LEARNING COMEBACK</span>
      <h2 style={{fontSize:'clamp(25px,4vw,34px)',lineHeight:1.16,letterSpacing:'-.035em',margin:'18px 0 11px'}}>Every mistake is a chance to improve.</h2>
      <p style={{fontSize:14,lineHeight:1.6,color:'#E9D8CE',margin:'0 0 17px'}}>Understand the difficult skills. Practise them again. See what you've improved.</p>
      <span style={{display:'flex',alignItems:'center',gap:8,color:'#F6C29E',fontSize:13,fontWeight:700}}><Target size={17}/> Focus on one skill at a time</span>
    </header>

    {error&&<div role="alert" style={alert}><AlertCircle size={17}/> Notebook unavailable: {error} <button style={linkButton} onClick={()=>void load()}>Retry</button></div>}
    {releasedError&&<div role="alert" style={alert}><AlertCircle size={17}/> Assessment history unavailable: {releasedError} <button style={linkButton} onClick={()=>void load()}>Retry</button></div>}
    {loading ? <section role="status" style={surface}>Loading your recovery studio…</section>:<>
      <section aria-label="Your recovery summary" style={metricGrid}>
        <RecoveryMetric icon={<ClipboardList size={17}/>} value={released.length} title="Recorded" description="Recent incorrect or skipped answers"/>
        <RecoveryMetric icon={<Target size={17}/>} value={needs.length} title="Need work" description="Current-grade skills requiring review"/>
        <RecoveryMetric icon={<CircleCheck size={17}/>} value={reviewed.length} title="Reviewed" description="Not automatically mastered"/>
      </section>

      <section aria-labelledby="next-challenge" style={{...surface,padding:18,marginBottom:20}}>
        <div style={split}><span style={eyebrow}>YOUR NEXT CHALLENGE</span>{(next||spotlight)&&<span style={priorityBadge}>Needs attention</span>}</div>
        {next||spotlight ? <>
          <div style={{display:'flex',gap:14,alignItems:'center',margin:'15px 0 13px'}}>
            <span style={skillIcon}><Hash size={23}/></span>
            <div style={{minWidth:0,flex:1}}>
              <h2 id="next-challenge" style={{fontSize:19,letterSpacing:'-.02em',margin:'0 0 4px'}}>{next?next.topic:spotlight!.context_title}</h2>
              <div style={{fontSize:12,color:'var(--vs-muted)',marginBottom:6}}>{next?next.subject:spotlight!.reason==='skipped'?'Skipped assessment response':'Incorrect assessment response'}</div>
              <p style={{fontSize:13,margin:0,lineHeight:1.5,color:'var(--vs-text)'}}>{next?'Review the linked skill, then prove your understanding with another question.':'Review the exact missed question, then follow the available recovery steps.'}</p>
            </div>
          </div>
          <div style={steps}>
            <div style={step}><BookOpen size={17}/><span>1. Understand</span></div><ChevronRight size={14} color="var(--vs-muted)"/>
            <div style={step}><Pencil size={17}/><span>2. Retry</span></div><ChevronRight size={14} color="var(--vs-muted)"/>
            <div style={step}><CheckCheck size={17}/><span>3. Verify</span></div>
          </div>
          <button type="button" style={startButton} onClick={()=>next?recovery(next):jumpToReleased(spotlight!)}>Start recovery <ChevronRight size={18}/></button>
        </>:<>
          <h2 id="next-challenge" style={{fontSize:20,margin:'14px 0 6px'}}>Nothing waiting for repair</h2>
          <p style={muted}>After you complete a marked assessment, missed questions will appear here automatically.</p>
          <button type="button" style={startButton} onClick={()=>router.push('/student/vibelearn/topic-practice')}>Open Topic Practice <ChevronRight size={18}/></button>
        </>}
      </section>

      <section aria-labelledby="recovery-library">
        <div style={{...split,marginBottom:14}}>
          <h2 id="recovery-library" style={{fontSize:21,letterSpacing:'-.03em',margin:0}}>My Recovery Library</h2>
          <button type="button" aria-label="Toggle subject filter" onClick={()=>setShowPreferences(value=>!value)} style={iconButton}><SlidersHorizontal size={18}/></button>
        </div>
        <div role="tablist" aria-label="Recovery library views" style={tabRow}>
          {([['fix','To Fix'],['reviewed','Reviewed'],['history','History']] as const).map(([id,label])=>
            <button type="button" key={id} role="tab" aria-selected={view===id} onClick={()=>{setView(id);setExpandSkills(false)}} style={{...tabButton,...(view===id?activeTab:{})}}>{label}</button>)}
        </div>
        <label style={{display:'block',margin:'12px 0'}}>
          <span style={visuallyHidden}>Filter recovery by subject</span>
          <select value={subject} onChange={event=>setSubject(event.target.value)} style={subjectSelect}>
            <option value="all">All subjects</option>
            {allSubjects.map(value=><option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        {view==='history'?<section role="tabpanel" aria-label="Assessment mistake history" style={surface}>
          <div style={split}><div><div style={eyebrow}>ORIGINAL ASSESSMENTS</div><h3 style={subheading}>Missed & skipped questions</h3></div><span style={muted}>{released.length} recent</span></div>
          <p style={muted}>Open an assessment to see its exact recorded answers. Original scores remain unchanged.</p>
          {releaseGroups.filter(([name])=>subject==='all'||name.toLowerCase().includes(subject.toLowerCase())).length===0?
            <p style={muted}>No released mistakes match this subject.</p>:
            releaseGroups.filter(([name])=>subject==='all'||name.toLowerCase().includes(subject.toLowerCase())).map(([name,items])=>
              <details key={name} style={historyGroup}><summary style={historySummary}><strong>{name}</strong><span style={historyCount}>{items.length} questions</span></summary>
                {items.map(item=><div key={item.recovery_key} style={{borderTop:'1px solid var(--vs-border)',padding:'12px 0'}}>
                  <div style={split}><strong style={{fontSize:13}}>{item.prompt}</strong><span style={muted}>{item.reason==='skipped'?'Skipped':'Incorrect'}</span></div>
                  <p style={muted}>{item.identity_state==='verified'?'Verified outcome link':'Outcome verification pending'}</p>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {item.attempt_id&&<button type="button" style={lightButton} onClick={()=>jumpToReleased(item)}>Review mistake <ChevronRight size={14}/></button>}
                    {item.attempt_id&&<button type="button" style={lightButton} onClick={()=>router.push('/student/results/'+encodeURIComponent(item.attempt_id!))}>Original result</button>}
                  </div>
                </div>)}
              </details>)}
          {historical.length>0&&<details style={historyGroup}><summary style={historySummary}>Earlier or unverified notebook records ({historical.length})</summary>{historical.map(item=><p key={item.id} style={muted}>{item.subject} · {item.topic} — {item.prompt}</p>)}</details>}
        </section>:<section role="tabpanel" aria-label={view==='fix'?'Skills to practise':'Reviewed skills'} style={surface}>
          <div style={split}><div style={{display:'flex',gap:9,alignItems:'center'}}><SlidersHorizontal size={17}/><h3 style={subheading}>{view==='fix'?'Skills to practise':'Reviewed skills'}</h3></div><span style={muted}>{view==='fix'?'Prioritised':'Review evidence'}</span></div>
          {visible.length===0?<div style={{padding:'15px 0'}}><p style={muted}>{view==='fix'?'No verified current-grade skills to repair in this selection. You can still review released mistakes under History.':'No reviewed skills match this selection.'}</p><button type="button" style={lightButton} onClick={()=>setView('history')}>Open history <ChevronRight size={15}/></button></div>:
            (expandSkills?visible:visible.slice(0,5)).map(item=><button type="button" key={item.id} style={skillRow} onClick={()=>recovery(item)}>
              <span style={libraryIcon}><Hash size={19}/></span>
              <span style={{flex:1,minWidth:0,textAlign:'left'}}><strong style={{display:'block',fontSize:14}}>{item.topic}</strong><small style={{display:'block',color:'var(--vs-muted)',marginTop:4}}>{item.subject} · {item.status==='resolved'?'Reviewed · check retention':item.status==='practising'?'Practising':'Needs review'} · {item.repeatCount} {item.repeatCount===1?'miss':'misses'}</small></span>
              <ChevronRight size={18} color="var(--vs-muted)"/>
            </button>)}
          {visible.length>5&&<button style={{...lightButton,marginTop:12}} type="button" onClick={()=>setExpandSkills(value=>!value)}>{expandSkills?'Show fewer skills':`Show all ${visible.length} skills`}</button>}
        </section>}
      </section>
      <p style={{...muted,textAlign:'center',marginTop:20}}>Only verified assessment evidence can establish progress. Reviewing a mistake does not change your original marks.</p>
    </>}
  </div></main>
}

function RecoveryMetric({icon,value,title,description}:{icon:React.ReactNode;value:number;title:string;description:string}){
  return <div style={metric}><span style={{color:'var(--vs-muted)'}}>{icon}</span><strong style={{fontSize:24,fontVariantNumeric:'tabular-nums'}}>{value}</strong><span style={{fontSize:12,fontWeight:750}}>{title}</span><span style={{...muted,fontSize:10}}>{description}</span></div>
}

const shell:CSSProperties={minHeight:'100vh',background:'var(--vs-soft)',padding:'20px clamp(12px,3vw,28px) 100px',color:'var(--vs-text)',fontFamily:"'Plus Jakarta Sans',sans-serif"}
const container:CSSProperties={maxWidth:850,margin:'0 auto'}
const topline:CSSProperties={display:'flex',justifyContent:'space-between',alignItems:'center',gap:14,marginBottom:17}
const brandMark:CSSProperties={width:44,height:44,borderRadius:12,background:'var(--vs-accent)',color:'var(--vs-on-accent,#fff)',display:'grid',placeItems:'center'}
const eyebrow:CSSProperties={fontSize:10,fontWeight:800,letterSpacing:'.07em',color:'var(--vs-muted)'}
const iconButton:CSSProperties={width:38,height:38,display:'grid',placeItems:'center',background:'var(--vs-card)',border:'1px solid var(--vs-border)',borderRadius:999,color:'var(--vs-text)',cursor:'pointer'}
const hero:CSSProperties={background:'#342B28',color:'#fff',borderRadius:19,padding:'clamp(18px,4vw,29px)',marginBottom:14}
const heroBadge:CSSProperties={display:'inline-block',fontSize:11,fontWeight:800,padding:'5px 9px',borderRadius:999,background:'#68554E',color:'#fff'}
const metricGrid:CSSProperties={display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,marginBottom:14}
const metric:CSSProperties={background:'var(--vs-card)',border:'1px solid var(--vs-border)',borderRadius:16,padding:'14px 12px',minWidth:0,display:'flex',flexDirection:'column',gap:5}
const surface:CSSProperties={background:'var(--vs-card)',border:'1px solid var(--vs-border)',borderRadius:17,padding:16,marginBottom:14}
const split:CSSProperties={display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}
const priorityBadge:CSSProperties={background:'var(--vs-accent-soft)',color:'var(--vs-accent)',fontSize:11,fontWeight:700,padding:'5px 9px',borderRadius:999}
const skillIcon:CSSProperties={width:52,height:52,flexShrink:0,background:'var(--vs-accent-soft)',color:'var(--vs-accent)',borderRadius:13,display:'grid',placeItems:'center'}
const steps:CSSProperties={display:'flex',alignItems:'center',gap:7,marginBottom:13}
const step:CSSProperties={display:'flex',flex:1,minWidth:0,alignItems:'center',justifyContent:'center',gap:6,flexWrap:'wrap',background:'var(--vs-soft)',borderRadius:11,padding:'12px 5px',fontSize:11,fontWeight:750}
const startButton:CSSProperties={border:0,background:'#171717',color:'#fff',borderRadius:999,width:'100%',minHeight:45,padding:'11px 16px',fontWeight:800,fontFamily:'inherit',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:9}
const tabRow:CSSProperties={display:'flex',gap:5,alignItems:'center',flexWrap:'wrap'}
const tabButton:CSSProperties={border:'none',background:'transparent',color:'var(--vs-muted)',borderRadius:999,fontFamily:'inherit',fontWeight:700,fontSize:13,padding:'9px 16px',cursor:'pointer'}
const activeTab:CSSProperties={background:'var(--vs-card)',color:'var(--vs-text)',boxShadow:'0 1px 4px #00000012'}
const subjectSelect:CSSProperties={background:'var(--vs-card)',color:'var(--vs-text)',border:'1px solid var(--vs-border)',borderRadius:999,padding:'12px 16px',width:'100%',fontSize:13,fontFamily:'inherit'}
const subheading:CSSProperties={fontSize:16,margin:'4px 0 9px'}
const skillRow:CSSProperties={display:'flex',gap:12,alignItems:'center',textAlign:'left',width:'100%',background:'transparent',border:0,borderBottom:'1px solid var(--vs-border)',padding:'15px 0',cursor:'pointer',color:'var(--vs-text)',fontFamily:'inherit'}
const libraryIcon:CSSProperties={width:43,height:43,display:'grid',placeItems:'center',flexShrink:0,background:'var(--vs-soft)',borderRadius:12}
const muted:CSSProperties={fontSize:12,color:'var(--vs-muted)',lineHeight:1.6}
const historyGroup:CSSProperties={border:'1px solid var(--vs-border)',borderRadius:12,padding:'12px 14px',marginTop:10}
const historySummary:CSSProperties={display:'flex',justifyContent:'space-between',gap:10,cursor:'pointer',fontSize:13,alignItems:'center'}
const historyCount:CSSProperties={flexShrink:0,fontSize:11,color:'var(--vs-accent)',fontWeight:800}
const lightButton:CSSProperties={border:'1px solid var(--vs-border)',background:'var(--vs-accent-soft)',color:'var(--vs-text)',fontFamily:'inherit',cursor:'pointer',borderRadius:10,padding:'9px 12px',fontSize:12,fontWeight:750,display:'inline-flex',alignItems:'center',gap:6}
const linkButton:CSSProperties={border:0,background:'transparent',color:'var(--vs-accent)',textDecoration:'underline',cursor:'pointer'}
const alert:CSSProperties={display:'flex',alignItems:'center',flexWrap:'wrap',gap:8,background:'var(--vs-card)',color:'var(--vs-text)',padding:14,border:'1px solid var(--vs-border)',borderRadius:12,marginBottom:14}
const visuallyHidden:CSSProperties={position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0}
