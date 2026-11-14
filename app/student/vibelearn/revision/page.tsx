'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
const actionRow: React.CSSProperties = {width:'100%',display:'flex',alignItems:'center',gap:12,border:0,borderBottom:'1px solid var(--vs-border)',background:'transparent',color:'var(--vs-text)',padding:'14px 18px',cursor:'pointer',fontFamily:'inherit'}
const actionIcon: React.CSSProperties = {width:40,height:40,borderRadius:11,display:'grid',placeItems:'center',flexShrink:0}
function priority(item:MistakeNotebookItem) {return item.repeatCount > 1 ? 'Needs another look' : 'Ready to recall'}
function dateDue(date:string) {return new Date(date).getTime()<=Date.now()}
function prettyDate(date:string) {return dayTitle(date)}
export default function RevisionStudioPage() {
  const router=useRouter()
  const searchParams=useSearchParams()
  const requestedSubject=searchParams.get('subject')?.trim()??''
  const {identity,loading:identityLoading}=useStudent()
  const {play}=useLearningFeedback()
  const [workspace,setWorkspace]=useState<RevisionWorkspace|null>(null)
  const [memory,setMemory]=useState<RevisionMemoryRecord[]>([])
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [subject,setSubject]=useState('All subjects')
  const [queuePeriod,setQueuePeriod]=useState<'today'|'week'>('today')
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
  useEffect(()=>{const match=subjects.find(s=>s.toLowerCase()===requestedSubject.toLowerCase());if(match)setSubject(match)},[requestedSubject,subjects])
  const filtered=useMemo(()=>verified.filter(m=>subject==='All subjects'||m.subject===subject).sort((a,b)=>{
    const ad=memoryById.get(a.id)?.nextReviewAt
    const bd=memoryById.get(b.id)?.nextReviewAt
    const adue=!ad||dateDue(ad),bdue=!bd||dateDue(bd)
    if(adue!==bdue)return adue?-1:1
    return b.repeatCount-a.repeatCount
  }),[verified,subject,memoryById])
  const due=filtered.filter(m=>{const date=memoryById.get(m.id)?.nextReviewAt;return !date||dateDue(date)})
  const completeCount=filtered.length-due.length
  const weekQueue=filtered.filter(m=>{const date=memoryById.get(m.id)?.nextReviewAt;return !date||new Date(date).getTime()<=Date.now()+7*86400000})
  const visibleQueue=queuePeriod==='today'?due:weekQueue
  const rememberedCount=memory.filter(m=>m.lastRemembered===true&&verified.some(v=>v.id===m.mistakeId)).length
  const needReviewCount=memory.filter(m=>m.lastRemembered===false&&verified.some(v=>v.id===m.mistakeId)).length
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
      <section style={{...style.card,background:'var(--vs-card)',padding:0,overflow:'hidden'}}>
        <div style={{padding:'24px 22px',background:'var(--vs-hero-bg, #10213b)',color:'var(--vs-hero-text, #fff)'}}>
          <div style={{fontSize:11,fontWeight:850,letterSpacing:1,opacity:.78}}>TODAY · REVISION SPACE</div>
          <h1 style={{fontSize:'clamp(26px,4vw,36px)',letterSpacing:'-.035em',margin:'10px 0 7px',lineHeight:1.12}}>A little today.<br/>Stronger tomorrow.</h1>
          <p style={{fontSize:13,opacity:.84,margin:'0 0 22px'}}>Everything you need to remember, all in one place.</p>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,fontWeight:800,marginBottom:7}}><span>Today's revision goal</span><span>{Math.min(3,completeCount)}/3</span></div>
          <div role="progressbar" aria-valuenow={Math.min(3,completeCount)} aria-valuemin={0} aria-valuemax={3} aria-label="Daily revision goal" style={{background:'rgba(255,255,255,.2)',height:7,borderRadius:99,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,completeCount/3*100)}%`,background:'var(--vs-goal-fill, #b9f58c)',borderRadius:99}}/></div>
        </div>
        <div style={{padding:'20px 22px',display:'grid',gap:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><h2 style={{fontSize:18,margin:0}}>Your next revision</h2><span style={{fontSize:11,padding:'5px 9px',borderRadius:99,background:'var(--vs-accent-soft)',color:'var(--vs-accent)',fontWeight:800}}>{selectedItem?'Ready':'Choose a topic'}</span></div>
          <div style={{padding:14,borderRadius:14,background:'var(--vs-soft)',display:'flex',gap:12,alignItems:'center'}}>
            <span style={{padding:12,borderRadius:12,background:'var(--vs-accent-soft)',color:'var(--vs-accent)'}}><BookOpenCheck size={22}/></span>
            <div style={{minWidth:0}}><div style={{fontSize:12,color:'var(--vs-muted)'}}>{selectedItem?.subject??'Curriculum revision'}</div><strong style={{fontSize:19}}>{selectedItem?.topic??'Choose an approved topic'}</strong><p style={{...style.muted,margin:'4px 0 0'}}>{selectedItem?'Refresh what you already know':'You can begin without an exam or previous mistakes.'}</p></div>
          </div>
          <button type="button" style={{...style.primary,width:'100%',minHeight:46}} onClick={()=>selectedItem?begin(selectedItem):document.getElementById('revision-topics')?.scrollIntoView({behavior:'smooth'})}>{selectedItem?'Start revision':'Browse revision topics'} <ArrowRight size={16} style={{verticalAlign:'middle'}}/></button>
        </div>
      </section>
      <section style={{...style.card,padding:16}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',marginBottom:12}}><h2 style={{margin:0,fontSize:18}}>Subjects</h2><span style={style.muted}>Select to revise</span></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(115px,1fr))',gap:9}}>
          {subjects.map(s=><button key={s} type="button" aria-pressed={subject===s} onClick={()=>setSubject(s)} style={{...style.secondary,background:subject===s?'var(--vs-accent-soft)':'var(--vs-card)',border:subject===s?'2px solid var(--vs-accent)':'1px solid var(--vs-border)',color:'var(--vs-text)',display:'grid',justifyItems:'center',gap:7,minHeight:70}}><BookOpenCheck size={19} color="var(--vs-accent)"/><span style={{fontSize:12}}>{s==='All subjects'?'All subjects':s}</span></button>)}
        </div>
      </section>
      <section style={{...style.card,padding:0,overflow:'hidden'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'17px 18px 10px',gap:10,flexWrap:'wrap'}}><h2 style={{margin:0,fontSize:18}}>Your revision</h2><div style={{display:'flex',gap:6}}>{(['today','week'] as const).map(t=><button key={t} type="button" aria-pressed={queuePeriod===t} onClick={()=>setQueuePeriod(t)} style={{border:0,borderRadius:9,padding:'8px 10px',cursor:'pointer',background:queuePeriod===t?'var(--vs-accent-soft)':'transparent',color:queuePeriod===t?'var(--vs-accent)':'var(--vs-muted)',fontWeight:750}}>{t==='today'?'Today':'This week'}</button>)}</div></div>
        <button type="button" onClick={()=>router.push('/student/vibelearn/mistakes')} style={{...actionRow,borderTop:'1px solid var(--vs-border)'}}><span style={{...actionIcon,background:'#fff0df'}}><RefreshCcw size={18} color="#ad6c34"/></span><span style={{flex:1,textAlign:'left'}}><strong style={{display:'block'}}>Review mistakes</strong><small style={{display:'block',color:'var(--vs-muted)'}}>Return to questions you missed</small></span><ChevronRight size={17}/></button>
        <button type="button" onClick={()=>selectedItem?begin(selectedItem,'Flashcards'):document.getElementById('revision-topics')?.scrollIntoView({behavior:'smooth'})} style={actionRow}><span style={{...actionIcon,background:'#e7edff'}}><Layers3 size={18} color="#6379c7"/></span><span style={{flex:1,textAlign:'left'}}><strong style={{display:'block'}}>Quick flashcards</strong><small style={{display:'block',color:'var(--vs-muted)'}}>Recall definitions and concepts</small></span><ChevronRight size={17}/></button>
        <button type="button" onClick={()=>selectedItem?begin(selectedItem):document.getElementById('revision-topics')?.scrollIntoView({behavior:'smooth'})} style={actionRow}><span style={{...actionIcon,background:'#e3f5e8'}}><BrainCircuit size={18} color="#38875d"/></span><span style={{flex:1,textAlign:'left'}}><strong style={{display:'block'}}>Memory check</strong><small style={{display:'block',color:'var(--vs-muted)'}}>See what you still remember</small></span><ChevronRight size={17}/></button>
        {visibleQueue.length>0&&<div style={{padding:'12px 18px',borderTop:'1px solid var(--vs-border)'}}><strong style={{fontSize:13}}>{queuePeriod==='today'?'Ready today':'Ready this week'} · {visibleQueue.length}</strong>{visibleQueue.slice(0,4).map(m=><button key={m.id} onClick={()=>begin(m)} style={{...actionRow,padding:'10px 0'}}><span style={{flex:1,textAlign:'left'}}><strong style={{display:'block'}}>{m.topic}</strong><small style={{display:'block',color:'var(--vs-muted)'}}>{m.subject}</small></span><ChevronRight size={16}/></button>)}</div>}
      </section>
      <section style={{...style.card,padding:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><strong style={{fontSize:16}}>Memory health</strong><span style={{fontSize:11,color:'var(--vs-muted)'}}>Your saved recalls</span></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',textAlign:'center',gap:8,marginTop:16}}>
          <div><strong style={{fontSize:23,color:'var(--vs-accent)'}}>{rememberedCount}</strong><div style={style.muted}>Remembered</div></div>
          <div><strong style={{fontSize:23}}>{due.length}</strong><div style={style.muted}>Due now</div></div>
          <div><strong style={{fontSize:23}}>{needReviewCount}</strong><div style={style.muted}>Needs review</div></div>
        </div>
      </section>
      <RevisionTopicStarter className={identity.className ?? ''}/>
      <section style={style.card}><h2 style={{margin:'0 0 12px',fontSize:18}}>Coming up</h2>{memory.filter(m=>verified.some(v=>v.id===m.mistakeId)&&!dateDue(m.nextReviewAt)).length===0?<p style={style.muted}>Your next review dates appear here after you finish recalling.</p>:memory.filter(m=>verified.some(v=>v.id===m.mistakeId)&&!dateDue(m.nextReviewAt)).sort((a,b)=>a.nextReviewAt.localeCompare(b.nextReviewAt)).slice(0,5).map(m=><div key={m.mistakeId} style={{display:'flex',justifyContent:'space-between',gap:10,padding:'10px 0',borderBottom:'1px solid var(--vs-border)'}}><span>{verified.find(v=>v.id===m.mistakeId)?.topic}</span><span style={style.muted}>{prettyDate(m.nextReviewAt)}</span></div>)}</section>
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
