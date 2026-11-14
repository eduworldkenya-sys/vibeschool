'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, ChevronRight, Layers3, Lightbulb, RefreshCw, RotateCcw } from 'lucide-react'
import { useLearningFeedback } from '@/components/learn/LearningFeedback'
import { getRevisionCards, learnerRevisionGrade, listRevisionTopics, saveRevisionTopicRecall, type RevisionCard, type RevisionTopic } from '@/lib/student/revisionTopic'

const card: React.CSSProperties = { background:'var(--vs-card)',border:'1px solid var(--vs-border)',borderRadius:18,padding:18 }
const primary: React.CSSProperties = { background:'var(--vs-accent)',color:'var(--vs-on-accent, #fff)',border:0,borderRadius:12,padding:'12px 16px',minHeight:44,fontWeight:800,fontFamily:'inherit',cursor:'pointer' }
const secondary: React.CSSProperties = {...primary,background:'var(--vs-accent-soft)',color:'var(--vs-accent)',border:'1px solid var(--vs-border)'}
const muted: React.CSSProperties = { color:'var(--vs-muted)',fontSize:13,lineHeight:1.5 }
const due = (iso:string|null) => !iso || new Date(iso).getTime()<=Date.now()
const future = (iso:string) => new Intl.DateTimeFormat('en-KE',{day:'numeric',month:'short',timeZone:'Africa/Nairobi'}).format(new Date(iso))

export type RevisionStarterHandle = { startFirst: (subject?:string)=>Promise<boolean>; startTopic: (assignmentId:string)=>Promise<boolean> }
type RevisionStarterProps = {className:string; embedded?:boolean; onTopicsChange?:(topics:RevisionTopic[])=>void; onActiveChange?:(active:boolean)=>void; onCompleted?:()=>void}
const RevisionTopicStarter = forwardRef<RevisionStarterHandle,RevisionStarterProps>(function RevisionTopicStarter({className,embedded=false,onTopicsChange,onActiveChange,onCompleted},ref) {
  const grade = learnerRevisionGrade(className)
  const {play}=useLearningFeedback()
  const [topics,setTopics]=useState<RevisionTopic[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [subject,setSubject]=useState('All')
  const [active,setActive]=useState<RevisionTopic|null>(null)
  const [cards,setCards]=useState<RevisionCard[]>([])
  const [index,setIndex]=useState(0)
  const [revealed,setRevealed]=useState(false)
  const [remembered,setRemembered]=useState(0)
  const [struggled,setStruggled]=useState(0)
  const [nextDate,setNextDate]=useState('')
  const refresh=useCallback(async()=>{
    if(!grade) {setLoading(false);setError('Set your learner grade to see approved revision topics.');return}
    setLoading(true);setError('')
    try {const found=await listRevisionTopics(grade);setTopics(found);onTopicsChange?.(found)}
    catch(e) {setError(e instanceof Error?e.message:'Could not load revision topics.')}
    finally {setLoading(false)}
  },[grade,onTopicsChange])
  useEffect(()=>{void refresh()},[refresh])
  useEffect(()=>{onActiveChange?.(Boolean(active))},[active,onActiveChange])
  const subjects=useMemo(()=>['All',...Array.from(new Set(topics.map(t=>t.subject)))],[topics])
  const visible=topics.filter(t=>subject==='All'||t.subject===subject)
    .sort((a,b)=>Number(due(b.nextReviewAt))-Number(due(a.nextReviewAt)))
  async function start(topic:RevisionTopic):Promise<boolean> {
    if(!grade||busy)return false
    setBusy(true);setError('')
    try {
      const available=await getRevisionCards(grade,topic.assignmentId)
      if(!available.length)throw new Error('This topic has no approved revision cards yet.')
      setCards(available);setActive(topic);setIndex(0);setRevealed(false);setRemembered(0);setStruggled(0);setNextDate('');return true
    } catch(e) {setError(e instanceof Error?e.message:'Could not open this revision.');return false}
    finally {setBusy(false)}
  }
  useImperativeHandle(ref,()=>({
    startFirst:async (selectedSubject?:string)=>{
      const available=topics.filter(t=>!selectedSubject||selectedSubject==='All'||t.subject.toLowerCase()===selectedSubject.toLowerCase())
        .sort((a,b)=>Number(due(b.nextReviewAt))-Number(due(a.nextReviewAt)))
      if(!available.length){setError('No approved revision cards in this subject yet.');return false}
      return start(available[0])
    },
    startTopic:async (assignmentId:string)=>{
      const found=topics.find(t=>t.assignmentId===assignmentId)
      if(!found){setError('This revision topic is not available.');return false}
      return start(found)
    }
  }))
  async function mark(yes:boolean) {
    if(!grade||!active||busy)return
    const newRemembered=remembered+Number(yes),newStruggled=struggled+Number(!yes)
    if(index+1<cards.length){setRemembered(newRemembered);setStruggled(newStruggled);setIndex(i=>i+1);setRevealed(false);play(yes?'correct':'retry');return}
    setBusy(true);setError('')
    try {
      const date=await saveRevisionTopicRecall(grade,active.assignmentId,newStruggled===0)
      setRemembered(newRemembered);setStruggled(newStruggled);setNextDate(date);play('complete','Revision recorded')
    } catch(e){setError(e instanceof Error?e.message:'Could not save this revision. Retry finishing.')}
    finally{setBusy(false)}
  }
  async function finishAgain() {
    setActive(null);setCards([]);setNextDate('');await refresh();onCompleted?.()
  }
  if (embedded && !active) return error ? <div role="alert" style={{...card,color:'var(--vs-text)'}}>{error}</div> : null
  return <section id="revision-topics" style={{...card,display:'grid',gap:15,scrollMarginTop:20}} aria-label="Revise a topic">
    {!active?<>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}>
        <div><div style={{fontSize:11,letterSpacing:1,fontWeight:850,color:'var(--vs-accent)'}}>START HERE</div>
          <h2 style={{fontSize:22,margin:'5px 0'}}>Revise a real topic</h2>
          <p style={{...muted,margin:0}}>No mistakes or previous results needed. Choose a topic and recall what you know.</p>
        </div>
        <div style={{padding:12,borderRadius:14,background:'var(--vs-accent-soft)',color:'var(--vs-accent)'}}><BookOpenCheck size={26}/></div>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
        <span style={{...muted,fontWeight:750}}>{grade??'Grade not set'} · {topics.length} approved {topics.length===1?'topic':'topics'}</span>
        <button style={{...secondary,padding:'8px 12px',minHeight:34}} onClick={()=>void refresh()} disabled={loading} aria-label="Refresh revision topics"><RefreshCw size={15}/></button>
      </div>
      {loading?<p style={muted}>Finding approved learning topics…</p>:topics.length>0?<>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {subjects.map(s=><button key={s} type="button" onClick={()=>setSubject(s)}
            aria-pressed={subject===s} style={{...(subject===s?primary:secondary),minHeight:36,padding:'8px 12px'}}>{s==='All'?'All subjects':s}</button>)}
        </div>
        {visible.map(t=><button key={t.assignmentId} onClick={()=>void start(t)} disabled={busy}
          style={{border:'1px solid var(--vs-border)',background:'var(--vs-soft)',color:'var(--vs-text)',padding:14,borderRadius:14,textAlign:'left',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:12}}>
          <span style={{flex:1}}><strong style={{display:'block',fontSize:16}}>{t.topic}</strong>
            <span style={muted}>{t.subject} · {t.nextReviewAt?(due(t.nextReviewAt)?'Due for review':'Review '+future(t.nextReviewAt)):'Ready to revise'}</span>
          </span>
          <ChevronRight size={20} color="var(--vs-accent)"/>
        </button>)}
      </>:<p style={muted}>There are no approved public revision topics for this grade yet. You can still open Learn and return when topics are published.</p>}
    </>:nextDate?<>
      <div style={{textAlign:'center',display:'grid',justifyItems:'center',gap:9,padding:'15px 0'}}>
        <CheckCircle2 size={40} color="var(--vs-accent)"/>
        <h2 style={{fontSize:24,margin:0}}>Revision saved</h2>
        <p style={muted}>You recalled {remembered} of {cards.length} cards. {struggled>0?'The topics you found difficult will come back sooner.':'Keep building your memory with regular review.'}</p>
        <strong>Next review: {future(nextDate)}</strong>
        <button style={primary} onClick={()=>void finishAgain()}>Back to topics <ArrowRight size={16} style={{verticalAlign:'middle'}}/></button>
      </div>
    </>:<>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:9}}>
        <button type="button" onClick={()=>{setActive(null);setCards([])}} style={{...secondary,padding:9,minHeight:36}}><ArrowLeft size={17}/></button>
        <span style={{fontWeight:800}}>{active.topic}</span>
        <span style={muted}>{index+1} / {cards.length}</span>
      </div>
      <div style={{height:6,background:'var(--vs-accent-soft)',borderRadius:99,overflow:'hidden'}}><div style={{width:((index+1)/cards.length*100)+'%',height:'100%',background:'var(--vs-accent)',borderRadius:99}}/></div>
      <div style={{display:'flex',gap:7,alignItems:'center',fontSize:12,color:'var(--vs-muted)'}}><Layers3 size={16}/> Recall before revealing</div>
      <h2 style={{fontSize:'clamp(21px,3vw,28px)',margin:'6px 0',lineHeight:1.35}}>{cards[index]?.prompt}</h2>
      {!revealed?<>
        <p style={muted}>Think of the answer before looking. No timer, no exam score.</p>
        <button style={primary} onClick={()=>setRevealed(true)}>Reveal the answer <Lightbulb size={16} style={{verticalAlign:'middle'}}/></button>
      </>:<>
        <div style={{padding:16,background:'var(--vs-accent-soft)',borderRadius:14}}>
          <div style={{fontSize:11,fontWeight:850,color:'var(--vs-accent)',marginBottom:7}}>CORRECT ANSWER</div>
          <strong style={{fontSize:20}}>{cards[index]?.answer}</strong>
          <p style={{...muted,margin:'10px 0 0',color:'var(--vs-text)'}}>{cards[index]?.explanation}</p>
        </div>
        <h3 style={{fontSize:17,margin:0}}>Did you remember this?</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:9}}>
          <button style={primary} disabled={busy} onClick={()=>void mark(true)}><CheckCircle2 size={16} style={{verticalAlign:'middle'}}/> Yes</button>
          <button style={secondary} disabled={busy} onClick={()=>void mark(false)}><RotateCcw size={16} style={{verticalAlign:'middle'}}/> Not yet</button>
        </div>
        <p style={{...muted,fontSize:12,margin:0}}>Self-check only. This does not grade an exam or change verified mastery.</p>
      </>}
    </>}
    {error&&<div role="alert" style={{background:'var(--vs-accent-soft)',borderRadius:12,padding:11,color:'var(--vs-text)',fontSize:13}}>{error}</div>}
  </section>
})
export default RevisionTopicStarter
