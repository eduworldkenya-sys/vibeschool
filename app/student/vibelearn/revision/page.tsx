'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpenCheck, BrainCircuit, CalendarDays, CheckCircle2, ChevronRight, Clock3, Layers3, Lightbulb, RefreshCcw, RotateCcw, Sparkles, Target, X } from 'lucide-react'
import { useStudent } from '@/lib/student-context'
import { useLearningFeedback } from '@/components/learn/LearningFeedback'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import RevisionTopicStarter from '@/components/student/RevisionTopicStarter'
import { getRevisionWorkspace, isCurrentGradeMistake, type MistakeNotebookItem, type RevisionWorkspace } from '@/lib/student/vibelearn'
import { getMyRevisionMemory, recordRevisionRecall, type RevisionMemoryRecord } from '@/lib/student/revisionMemory'

type Screen = 'home' | 'recall' | 'feedback' | 'finished'
type Mode = 'Recall' | 'Flashcards'
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date())
const dayTitle = (date: string) => new Intl.DateTimeFormat('en-KE',{weekday:'short',month:'short',day:'numeric',timeZone:'Africa/Nairobi'}).format(new Date(date))
const style = {
  shell: { minHeight:'100vh',background:'var(--vs-soft)',color:'var(--vs-text)',padding:'18px 14px 100px',fontFamily:"'Plus Jakarta Sans', sans-serif" } as React.CSSProperties,
  card: {background:'var(--vs-card, #fff)',border:'1px solid var(--vs-border)',borderRadius:18,padding:18} as React.CSSProperties,
  muted: {color:'var(--vs-muted)',fontSize:13,lineHeight:1.55} as React.CSSProperties,
  primary: {background:'var(--vs-accent)',color:'var(--vs-on-accent, #fff)',border:0,borderRadius:12,padding:'13px 18px',fontWeight:800,cursor:'pointer',fontFamily:'inherit'} as React.CSSProperties,
  secondary: {background:'var(--vs-accent-soft)',color:'var(--vs-accent)',border:'1px solid var(--vs-border)',borderRadius:12,padding:'12px 15px',fontWeight:750,cursor:'pointer',fontFamily:'inherit'} as React.CSSProperties,
} as const
function priority(item:MistakeNotebookItem) {return item.repeatCount > 1 ? 'Needs another look' : 'Ready to recall'}
function dateDue(date:string) {return new Date(date).getTime()<=Date.now()}
function prettyDate(date:string) {return dayTitle(date)}
export default function RevisionStudioPage() {
  const router=useRouter()
  const {identity,loading:identityLoading}=useStudent()
  const {play}=useLearningFeedback()
  const [workspace,setWorkspace]=useState<RevisionWorkspace|null>(null)
  const [memory,setMemory]=useState<RevisionMemoryRecord[]>([])
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [subject,setSubject]=useState('All subjects')
  const [mode,setMode]=useState<Mode>('Recall')
  const [screen,setScreen]=useState<Screen>('home')
  const [item,setItem]=useState<MistakeNotebookItem|null>(null)
  const [revealed,setRevealed]=useState(false)
  const [remembered,setRemembered]=useState<boolean|null>(null)
  const [nextReview,setNextReview]=useState<string|null>(null)
  const load=useCallback(async()=>{
    setLoading(true);setError('')
    try {
      const [w,m]=await Promise.all([getRevisionWorkspace(),getMyRevisionMemory()])
      setWorkspace(w);setMemory(m)
    } catch(e) {setError(e instanceof Error?e.message:'Revision is unavailable right now.')}
    finally {setLoading(false)}
  },[])
  useEffect(()=>{if(!identityLoading&&identity)void load();else if(!identityLoading)setLoading(false)},[load,identityLoading,identity])
  const verified=useMemo(()=> (workspace?.mistakes??[]).filter(m=>isCurrentGradeMistake(m,identity?.className)),[workspace,identity?.className])
  const memoryById=useMemo(()=>new Map(memory.map(m=>[m.mistakeId,m])),[memory])
  const subjects=useMemo(()=>['All subjects',...Array.from(new Set(verified.map(m=>m.subject)))],[verified])
  const filtered=useMemo(()=>verified.filter(m=>subject==='All subjects'||m.subject===subject).sort((a,b)=>{
    const ad=memoryById.get(a.id)?.nextReviewAt
    const bd=memoryById.get(b.id)?.nextReviewAt
    const adue=!ad||dateDue(ad),bdue=!bd||dateDue(bd)
    if(adue!==bdue)return adue?-1:1
    return b.repeatCount-a.repeatCount
  }),[verified,subject,memoryById])
  const due=filtered.filter(m=>{const date=memoryById.get(m.id)?.nextReviewAt;return !date||dateDue(date)})
  const completeCount=filtered.length-due.length
  const selectedItem=due[0]??null
  function begin(m:MistakeNotebookItem, selectedMode:Mode='Recall') {
    setItem(m);setMode(selectedMode);setRevealed(false);setRemembered(null);setNextReview(null);setError('');setScreen('recall')
  }
  async function submitRecall(value:boolean) {
    if(!item||saving)return
    setSaving(true);setError('')
    try {
      const result=await recordRevisionRecall(item.id,value)
      setNextReview(result.nextReviewAt)
      setRemembered(value)
      setMemory(prev=>[...prev.filter(m=>m.mistakeId!==item.id),{mistakeId:item.id,nextReviewAt:result.nextReviewAt,lastRemembered:value,recallCount:(memoryById.get(item.id)?.recallCount??0)+1}])
      play(value?'correct':'saved',value?'Recall recorded':'Review scheduled')
      setScreen('feedback')
    } catch(e) {play('error');setError(e instanceof Error?e.message:'Could not save your revision. Please try again.')}
    finally {setSaving(false)}
  }
  return <main style={style.shell}><div style={{maxWidth:980,margin:'0 auto',display:'grid',gap:14}}>
    <VibeLearnSubnav/>
    <header style={{...style.card,background:'var(--vs-card, #fff)',padding:20}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:screen==='home'?16:0}}>
        {screen!=='home' && <button type="button" onClick={()=>setScreen('home')} aria-label="Back to revision" style={{...style.secondary,padding:10}}><ArrowLeft size={18}/></button>}
        <div style={{background:'var(--vs-accent-soft)',color:'var(--vs-accent)',padding:10,borderRadius:13}}><BrainCircuit size={22}/></div>
        <div style={{flex:1}}><div style={{fontSize:11,color:'var(--vs-muted)',letterSpacing:1,fontWeight:850}}>VIBESCHOOL · REVISION</div><strong style={{fontSize:18}}>Revision Studio</strong></div>
        {screen==='home'&&<span style={{fontSize:12,color:'var(--vs-muted)'}}>{today()}</span>}
      </div>
      {screen==='home'&&<><h1 style={{fontSize:'clamp(25px,4vw,36px)',margin:'0 0 6px',letterSpacing:'-.04em'}}>Remember more. Every day.</h1>
        <p style={{...style.muted,margin:0}}>Return to previous learning, recall what you know and strengthen the parts that need attention.</p>
        {workspace && workspace.revisionMode.daysRemaining > 0 && <p style={{...style.muted,margin:'10px 0 0'}}>Exam in {workspace.revisionMode.daysRemaining} days · {workspace.revisionMode.message}</p>}</>}
    </header>
    {error&&<div role="alert" style={{...style.card,color:'var(--vs-danger, #a73434)'}}>{error} <button type="button" style={style.secondary} onClick={()=>void load()}>Retry</button></div>}
    {identityLoading||loading?<section style={style.card} aria-live="polite">Preparing your personal revision…</section>:
    !identity?<section style={style.card}><h2>Sign in to revise</h2><p style={style.muted}>Your revision history belongs to your learner account.</p><button style={style.primary} onClick={()=>router.push('/student')}>Go to learner home</button></section>:
    screen==='home'?<>
      <RevisionTopicStarter className={identity.className ?? ''}/>
      <section style={{...style.card,background:'var(--vs-card, #fff)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
          <div><div style={{color:'var(--vs-accent)',fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:1}}>Your next revision</div>
          <h2 style={{margin:'6px 0',fontSize:24}}>{selectedItem?.topic??'Start building your memory'}</h2>
          <p style={{...style.muted,margin:0}}>{selectedItem?selectedItem.subject+' · '+priority(selectedItem):'Revise an available subject to start collecting your learning history.'}</p></div>
          <div style={{borderRadius:16,background:'var(--vs-accent-soft)',padding:18,color:'var(--vs-accent)'}}><BookOpenCheck size={32}/></div>
        </div>
        <div style={{display:'flex',gap:9,flexWrap:'wrap',marginTop:18}}>
          <button style={style.primary} onClick={()=>selectedItem?begin(selectedItem):document.getElementById('revision-topics')?.scrollIntoView({behavior:'smooth'})}>
            {selectedItem?'Start revision':'Choose a revision topic'} <ArrowRight size={16} style={{verticalAlign:'middle',marginLeft:6}}/>
          </button>
          <button style={style.secondary} onClick={()=>router.push('/student/study')}>Open Learn</button>
        </div>
      </section>
      <section style={style.card}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
          <div><h2 style={{margin:'0 0 4px',fontSize:20}}>Your subjects</h2><p style={{...style.muted,margin:0}}>Only evidence from your current grade is recommended.</p></div>
          <Target color="var(--vs-accent)" size={22}/>
        </div>
        <div style={{display:'flex',gap:8,overflowX:'auto',padding:'14px 0 3px'}}>
          {subjects.map(s=><button key={s} onClick={()=>setSubject(s)} aria-pressed={subject===s} style={{...(subject===s?style.primary:style.secondary),flexShrink:0,padding:'10px 13px'}}>{s}</button>)}
        </div>
      </section>
      <section style={style.card}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><h2 style={{margin:0,fontSize:20}}>Revision queue</h2><span style={{fontSize:12,color:'var(--vs-muted)'}}>{due.length} due · {completeCount} reviewed</span></div>
        {filtered.length===0?<div style={{padding:'20px 0'}}><p style={style.muted}>No eligible mistakes to revisit yet. Use the approved topic cards above to revise independently.</p><button style={style.secondary} onClick={()=>document.getElementById('revision-topics')?.scrollIntoView({behavior:'smooth'})}>Choose an approved topic <ChevronRight size={15} style={{verticalAlign:'middle'}}/></button></div>:
        <div style={{display:'grid',gap:9,marginTop:14}}>{filtered.slice(0,12).map(m=>{
          const record=memoryById.get(m.id),isDue=!record||dateDue(record.nextReviewAt)
          return <div key={m.id} style={{border:'1px solid var(--vs-border)',borderRadius:14,padding:13,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <div style={{minWidth:0}}><strong style={{fontSize:14}}>{m.topic}</strong><div style={style.muted}>{m.subject} · {isDue?'Ready now':'Next '+prettyDate(record.nextReviewAt)}</div></div>
            <button style={{...style.secondary,whiteSpace:'nowrap'}} onClick={()=>begin(m)}>{isDue?'Revise':'Review'} <ChevronRight size={14} style={{verticalAlign:'middle'}}/></button>
          </div>
        })}</div>}
      </section>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(205px,1fr))',gap:12}}>
        <button style={{...style.card,textAlign:'left',cursor:'pointer',fontFamily:'inherit',color:'inherit'}} onClick={()=>selectedItem?begin(selectedItem,'Flashcards'):document.getElementById('revision-topics')?.scrollIntoView({behavior:'smooth'})}><Layers3 size={24} color="var(--vs-accent)"/><h3 style={{margin:'12px 0 5px'}}>Quick recall</h3><span style={style.muted}>Remember before revealing an explanation.</span></button>
        <button style={{...style.card,textAlign:'left',cursor:'pointer',fontFamily:'inherit',color:'inherit'}} onClick={()=>router.push('/student/vibelearn/mistakes')}><RefreshCcw size={24} color="var(--vs-accent)"/><h3 style={{margin:'12px 0 5px'}}>Mistake notebook</h3><span style={style.muted}>Review the source and retry difficult ideas.</span></button>
        <button style={{...style.card,textAlign:'left',cursor:'pointer',fontFamily:'inherit',color:'inherit'}} onClick={()=>document.getElementById('revision-topics')?.scrollIntoView({behavior:'smooth'})}><Sparkles size={24} color="var(--vs-accent)"/><h3 style={{margin:'12px 0 5px'}}>Choose a topic</h3><span style={style.muted}>Practise independently when nothing is due.</span></button>
      </div>
      <section style={style.card}><div style={{display:'flex',gap:10,alignItems:'center'}}><CalendarDays size={20} color="var(--vs-accent)"/><h2 style={{fontSize:18,margin:0}}>Coming up</h2></div>
        {memory.filter(m=>verified.some(v=>v.id===m.mistakeId)&&!dateDue(m.nextReviewAt)).length===0?
          <p style={style.muted}>Your future reviews will appear here after you finish a recall session.</p>:
          <div style={{display:'grid',gap:8,marginTop:12}}>{memory.filter(m=>verified.some(v=>v.id===m.mistakeId)&&!dateDue(m.nextReviewAt)).sort((a,b)=>a.nextReviewAt.localeCompare(b.nextReviewAt)).slice(0,5).map(m=><div key={m.mistakeId} style={{display:'flex',justifyContent:'space-between',gap:12,padding:'9px 0',borderBottom:'1px solid var(--vs-border)'}}><span>{verified.find(v=>v.id===m.mistakeId)?.topic}</span><span style={style.muted}>{prettyDate(m.nextReviewAt)}</span></div>)}</div>}
      </section>
    </>:
    screen==='recall'&&item?<section style={style.card}>
      <div style={{display:'flex',justifyContent:'space-between',gap:8}}><span style={{fontWeight:850,color:'var(--vs-accent)',fontSize:12}}>{mode.toUpperCase()} · {item.subject}</span><button style={{background:'transparent',border:0,color:'var(--vs-muted)',cursor:'pointer'}} aria-label="Exit revision" onClick={()=>setScreen('home')}><X size={19}/></button></div>
      <div style={{height:5,background:'var(--vs-accent-soft)',borderRadius:999,margin:'17px 0 20px'}}><div style={{width:revealed?'100%':'45%',height:'100%',background:'var(--vs-accent)',borderRadius:999}}/></div>
      <div style={{display:'flex',alignItems:'center',gap:7,color:'var(--vs-muted)',fontSize:12}}><Clock3 size={15}/> Think before you reveal</div>
      <h2 style={{fontSize:'clamp(20px,3vw,28px)',lineHeight:1.4,margin:'14px 0 20px'}}>{item.prompt}</h2>
      {!revealed?<><p style={style.muted}>Try recalling the answer in your own words. There is no timer or penalty.</p>
        <button style={{...style.primary,width:'100%',marginTop:12}} onClick={()=>setRevealed(true)}>Reveal explanation <Lightbulb size={16} style={{verticalAlign:'middle',marginLeft:6}}/></button>
        {item.reviewUrl&&<button style={{...style.secondary,width:'100%',marginTop:9}} onClick={()=>router.push(item.reviewUrl!)}>Revisit the lesson</button>}
      </>:<><div style={{background:'var(--vs-accent-soft)',borderRadius:14,padding:16}}><strong>Remember this</strong><p style={{...style.muted,margin:'8px 0 0',color:'var(--vs-text)'}}>{item.explanation??item.hint??'Use the linked lesson to verify your understanding before marking this review.'}</p></div>
        <h3 style={{fontSize:17,margin:'20px 0 10px'}}>Did you remember it?</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:9}}>
          <button disabled={saving} style={style.primary} onClick={()=>void submitRecall(true)}><CheckCircle2 size={16} style={{verticalAlign:'middle',marginRight:7}}/>Yes, I did</button>
          <button disabled={saving} style={style.secondary} onClick={()=>void submitRecall(false)}><RotateCcw size={16} style={{verticalAlign:'middle',marginRight:7}}/>Not yet</button>
        </div>
        <p style={style.muted}>Your response schedules another review; it does not change a formal exam result or automatically mark a mistake as resolved.</p>
      </>}
    </section>:
    screen==='feedback'&&item?<section style={{...style.card,textAlign:'center',padding:24}}>
      <div style={{display:'inline-flex',padding:16,borderRadius:999,background:'var(--vs-accent-soft)',color:'var(--vs-accent)'}}>{remembered?<CheckCircle2 size={32}/>:<Lightbulb size={32}/>}</div>
      <h2 style={{fontSize:26}}>{remembered?'Well remembered!':'You can strengthen this.'}</h2>
      <p style={style.muted}>{remembered?'Good recall. We will revisit the idea later.':'Revisit the explanation and retry the concept. Another review is scheduled.'}</p>
      {nextReview&&<div style={{...style.card,margin:'14px 0',background:'var(--vs-soft)'}}><span style={style.muted}>Next review</span><div style={{fontWeight:850,marginTop:5}}>{prettyDate(nextReview)}</div></div>}
      <button style={{...style.primary,width:'100%'}} onClick={()=>setScreen('finished')}>Finish session <ArrowRight size={16} style={{verticalAlign:'middle'}}/></button>
      {item.reviewUrl&&<button style={{...style.secondary,width:'100%',marginTop:9}} onClick={()=>router.push(item.reviewUrl!)}>Read explanation in Learn</button>}
    </section>:
    <section style={{...style.card,textAlign:'center',padding:30}}>
      <div style={{display:'inline-flex',padding:18,borderRadius:999,background:'var(--vs-accent-soft)',color:'var(--vs-accent)'}}><CheckCircle2 size={34}/></div>
      <h2 style={{fontSize:27}}>Revision saved</h2>
      <p style={style.muted}>Your recall has been recorded for your account. Pick another item when you are ready.</p>
      <button style={style.primary} onClick={()=>{setScreen('home');void load()}}>Back to Revision Studio <ArrowRight size={16} style={{verticalAlign:'middle'}}/></button>
    </section>}
  </div></main>
}
