'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
 ArrowLeft, ArrowRight, Bell, BookOpen, BookOpenCheck, BrainCircuit, Calculator,
 CalendarDays, ChartNoAxesColumn, CheckCircle2, ChevronRight, Clock3, Flame,
 FlaskConical, House, Languages, Layers3, Lightbulb, RefreshCcw, RotateCcw, X
} from 'lucide-react'
import { useStudent } from '@/lib/student-context'
import { useLearningFeedback } from '@/components/learn/LearningFeedback'
import RevisionTopicStarter, { type RevisionStarterHandle } from '@/components/student/RevisionTopicStarter'
import { getRevisionWorkspace, isCurrentGradeMistake, type MistakeNotebookItem, type RevisionWorkspace } from '@/lib/student/vibelearn'
import { getMyRevisionMemory, recordRevisionRecall, type RevisionMemoryRecord } from '@/lib/student/revisionMemory'
import type { RevisionTopic } from '@/lib/student/revisionTopic'

type Screen = 'home' | 'recall' | 'feedback' | 'finished'
type Mode = 'Recall' | 'Flashcards'
type Period = 'today' | 'week'

const subjectTiles = [
 {name:'Mathematics',Icon:Calculator},
 {name:'English',Icon:BookOpen},
 {name:'Kiswahili',Icon:Languages},
 {name:'Science',Icon:FlaskConical},
] as const
const colors={
 navy:'var(--vs-hero-bg, #10213b)',
 heroText:'var(--vs-hero-text, #fff)',
 goal:'var(--vs-goal-fill, #b9f58c)',
 canvas:'var(--vs-soft)',
 panel:'var(--vs-card)',
 ink:'var(--vs-text)',
 muted:'var(--vs-muted)',
 border:'var(--vs-border)',
 accent:'var(--vs-accent)',
 accentSoft:'var(--vs-accent-soft)',
}
const basic:React.CSSProperties={fontFamily:'inherit',cursor:'pointer'}
const card:React.CSSProperties={padding:15,border:'1px solid var(--vs-border)',borderRadius:16,background:colors.panel}
const muted:React.CSSProperties={fontSize:12,lineHeight:1.5,color:colors.muted}
const primary:React.CSSProperties={...basic,minHeight:44,border:0,borderRadius:999,padding:'11px 18px',fontSize:13,fontWeight:850,background:colors.accent,color:'var(--vs-on-accent, #fff)'}
const secondary:React.CSSProperties={...basic,minHeight:42,borderRadius:12,padding:'10px 14px',border:'1px solid var(--vs-border)',fontWeight:750,fontSize:13,background:colors.accentSoft,color:colors.accent}
const dateDue=(date:string|null)=>!date||new Date(date).getTime()<=Date.now()
const dateLabel=(date:string)=>new Intl.DateTimeFormat('en-KE',{month:'short',day:'numeric',timeZone:'Africa/Nairobi'}).format(new Date(date))

export default function RevisionStudioPage(){
 const router=useRouter()
 const searchParams=useSearchParams()
 const requestedSubject=searchParams.get('subject')?.trim()??''
 const {identity,loading:identityLoading}=useStudent()
 const {play}=useLearningFeedback()
 const launcher=useRef<RevisionStarterHandle>(null)
 const [workspace,setWorkspace]=useState<RevisionWorkspace|null>(null)
 const [memory,setMemory]=useState<RevisionMemoryRecord[]>([])
 const [topics,setTopics]=useState<RevisionTopic[]>([])
 const [subject,setSubject]=useState('Mathematics')
 const [queuePeriod,setQueuePeriod]=useState<Period>('today')
 const [topicActive,setTopicActive]=useState(false)
 const [launching,setLaunching]=useState(false)
 const [screen,setScreen]=useState<Screen>('home')
 const [item,setItem]=useState<MistakeNotebookItem|null>(null)
 const [mode,setMode]=useState<Mode>('Recall')
 const [revealed,setRevealed]=useState(false)
 const [remembered,setRemembered]=useState<boolean|null>(null)
 const [nextReview,setNextReview]=useState<string|null>(null)
 const [saving,setSaving]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const load=useCallback(async()=>{
   setLoading(true);setError('')
   try{
     const [w,m]=await Promise.all([getRevisionWorkspace(),getMyRevisionMemory()])
     setWorkspace(w);setMemory(m)
   }catch(e){setError(e instanceof Error?e.message:'Your revision history could not be loaded.')}
   finally{setLoading(false)}
 },[])
 useEffect(()=>{if(!identityLoading&&identity)void load();else if(!identityLoading)setLoading(false)},[identity,identityLoading,load])
 useEffect(()=>{if(requestedSubject){const tile=subjectTiles.find(t=>t.name.toLowerCase()===requestedSubject.toLowerCase());if(tile)setSubject(tile.name)}},[requestedSubject])
 const verified=useMemo(()=> (workspace?.mistakes??[]).filter(m=>isCurrentGradeMistake(m,identity?.className)),[workspace,identity?.className])
 const memoryById=useMemo(()=>new Map(memory.map(m=>[m.mistakeId,m])),[memory])
 const available=useMemo(()=>topics.filter(t=>t.subject.toLowerCase()===subject.toLowerCase()),[topics,subject])
 const selectedTopic=available.find(t=>dateDue(t.nextReviewAt))??available[0]??null
 const dueTopics=topics.filter(t=>dateDue(t.nextReviewAt))
 const reviewedTopics=topics.filter(t=>t.recallCount>0)
 const recalledTopics=topics.filter(t=>t.recallCount>0&&!dateDue(t.nextReviewAt))
 const needReviewTopics=topics.filter(t=>t.recallCount>0&&dateDue(t.nextReviewAt))
 const dueMistakes=verified.filter(m=>dateDue(memoryById.get(m.id)?.nextReviewAt??null))
 const memoryHealth={
   remembered:recalledTopics.length+memory.filter(m=>m.lastRemembered===true&&verified.some(v=>v.id===m.mistakeId)).length,
   due:dueTopics.length+dueMistakes.length,
   needs:needReviewTopics.length+memory.filter(m=>m.lastRemembered===false&&verified.some(v=>v.id===m.mistakeId)).length,
 }
 const dailyGoal=Math.min(3,reviewedTopics.filter(t=>!dateDue(t.nextReviewAt)).length)
 const selectedItem=dueMistakes.find(m=>m.subject.toLowerCase()===subject.toLowerCase())??dueMistakes[0]??null
 const weekTopics=topics.filter(t=>t.nextReviewAt&&!dateDue(t.nextReviewAt)&&new Date(t.nextReviewAt).getTime()<=Date.now()+7*86400000)
 function begin(m:MistakeNotebookItem, selectedMode:Mode='Recall'){
   setItem(m);setMode(selectedMode);setRevealed(false);setRemembered(null);setNextReview(null);setError('');setScreen('recall')
 }
 async function submitRecall(value:boolean){
   if(!item||saving)return
   setSaving(true);setError('')
   try{
     const result=await recordRevisionRecall(item.id,value)
     setNextReview(result.nextReviewAt);setRemembered(value)
     setMemory(prev=>[...prev.filter(m=>m.mistakeId!==item.id),{mistakeId:item.id,nextReviewAt:result.nextReviewAt,lastRemembered:value,recallCount:(memoryById.get(item.id)?.recallCount??0)+1}])
     play(value?'correct':'saved',value?'Recall recorded':'Review scheduled')
     setScreen('feedback')
   }catch(e){play('error');setError(e instanceof Error?e.message:'Could not save your revision.')}
   finally{setSaving(false)}
 }
 async function launchTopic(assignmentId?:string, wantedSubject?:string){
   setError('');setLaunching(true)
   try{
     const started=assignmentId?await launcher.current?.startTopic(assignmentId)
       :await launcher.current?.startFirst(wantedSubject??subject)
     if(!started)setError('No approved recall cards are available for this subject yet.')
   }finally{setLaunching(false)}
 }
 function openMistakes(){router.push('/student/vibelearn/mistakes')}
 function startRevision(){
   if(selectedTopic)void launchTopic(selectedTopic.assignmentId)
   else if(selectedItem)begin(selectedItem)
   else setError('No approved revision cards for this subject yet. Try Mathematics or open Learn.')
 }
 const activityIcon:React.CSSProperties={width:43,height:43,borderRadius:12,display:'grid',placeItems:'center',flexShrink:0}
 const rowStyle:React.CSSProperties={...basic,width:'100%',display:'flex',alignItems:'center',gap:13,padding:'14px 13px',border:0,borderBottom:'1px solid var(--vs-border)',background:'transparent',textAlign:'left',color:colors.ink}
 const onHome=screen==='home'&&!topicActive
 return <main style={{padding:'16px 12px 80px',background:colors.canvas,color:colors.ink,minHeight:'100vh'}}>
   <div style={{maxWidth:770,margin:'0 auto',border:'1px solid var(--vs-border)',borderRadius:22,overflow:'hidden',background:colors.panel,boxShadow:'0 12px 35px rgba(0,0,0,.055)'}}>
     <header style={{padding:'15px 15px 18px',background:colors.navy,color:colors.heroText}}>
       <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:onHome?18:8}}>
         {!onHome&&<button type="button" aria-label="Back to Revision" style={{...basic,border:0,color:'inherit',background:'transparent',padding:5}} onClick={()=>{setScreen('home');setTopicActive(false)}}><ArrowLeft size={20}/></button>}
         <span style={{width:37,height:37,display:'grid',placeItems:'center',background:colors.goal,color:'#10213b',borderRadius:13}}><BrainCircuit size={21}/></span>
         <div style={{flex:1,minWidth:0}}><strong style={{fontSize:16,color:colors.heroText}}>vibeschool</strong><div style={{fontSize:9,letterSpacing:.6,opacity:.83}}>REVISION STUDIO</div></div>
         <button type="button" onClick={()=>router.push('/student/tasks')} aria-label="My reminders" style={{...basic,color:colors.heroText,background:'rgba(255,255,255,.1)',border:0,borderRadius:999,width:34,height:34,display:'grid',placeItems:'center'}}><Bell size={16}/></button>
         <span aria-label="Learner account" style={{width:35,height:35,borderRadius:999,display:'grid',placeItems:'center',background:'var(--vs-accent-soft, #e9d2a1)',color:'var(--vs-accent, #10213b)',fontSize:13,fontWeight:850}}>{identity?.studentName?.slice(0,1).toUpperCase()??'S'}</span>
       </div>
       {onHome?<div>
         <div style={{fontSize:11,letterSpacing:.55,color:'var(--vs-goal-fill, #c8f3aa)',fontWeight:700}}>TODAY · REVISION SPACE</div>
         <h1 style={{fontSize:'clamp(25px,4.6vw,32px)',lineHeight:1.16,letterSpacing:'-.03em',margin:'11px 0 8px',fontWeight:800,color:colors.heroText}}>A little today.<span style={{display:'block'}}>Stronger tomorrow.</span></h1>
         <p style={{fontSize:13,margin:'0 0 24px',color:'rgba(255,255,255,.86)'}}>Everything you need to remember, all in one place.</p>
         <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',marginBottom:7,fontSize:12}}><span>Daily revision goal</span><strong>{dailyGoal}/3</strong></div>
         <div role="progressbar" aria-label="Daily revision goal" aria-valuenow={dailyGoal} aria-valuemin={0} aria-valuemax={3} style={{height:7,background:'rgba(255,255,255,.2)',borderRadius:99,overflow:'hidden'}}><div style={{width:(dailyGoal/3*100)+'%',height:'100%',borderRadius:99,background:colors.goal}}/></div>
       </div>:<div style={{padding:'8px 0 5px',fontSize:18,fontWeight:800}}>{topicActive?'Your recall session':screen==='recall'?'Remember this':'Your revision'}</div>}
     </header>
     <div style={{background:colors.canvas,padding:'12px 13px 18px',display:'grid',gap:14}}>
       {error&&<div role="alert" style={{...card,color:'var(--vs-danger, #b12e2e)',fontSize:13}}>{error} <button style={{...secondary,marginLeft:8}} onClick={()=>void load()}>Retry</button></div>}
       {(identityLoading||loading)&&<div style={card} role="status">Preparing your revision…</div>}
       {!identityLoading&&!loading&&!identity&&<div style={card}><strong>Sign in to revise</strong><p style={muted}>Revision progress belongs to your learner account.</p><button type="button" style={primary} onClick={()=>router.push('/student')}>Learner home</button></div>}
       {identity&&!identityLoading&&!loading&&<>
         {onHome&&<>
           <section aria-label="Your next revision" style={{...card,background:'var(--vs-soft)',border:'0',padding:0}}>
             <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 0 9px',gap:8}}>
               <h2 style={{fontSize:17,margin:0}}>Your next revision</h2>
               {selectedTopic&&<span style={{fontSize:11,fontWeight:800,color:'var(--vs-accent)',background:colors.accentSoft,padding:'4px 9px',borderRadius:99}}>Ready</span>}
             </div>
             <div style={{background:colors.panel,borderRadius:16,padding:12,display:'grid',gap:12}}>
               <div style={{display:'flex',alignItems:'center',gap:12}}>
                 <span style={{width:62,height:62,background:'var(--vs-accent-soft)',color:colors.accent,display:'grid',placeItems:'center',borderRadius:15,flexShrink:0}}><BookOpenCheck size={25}/></span>
                 <div><span style={muted}>{subject} · Quick revision</span><h3 style={{fontSize:19,margin:'3px 0 5px'}}>{selectedTopic?.topic??selectedItem?.topic??'Choose a topic'}</h3><div style={muted}>Refresh what you already know</div></div>
               </div>
               <div style={{display:'flex',alignItems:'center',gap:14,color:colors.muted,fontSize:12}}><span style={{display:'inline-flex',alignItems:'center',gap:5}}><Clock3 size={14}/> 5–10 min</span><span style={{display:'inline-flex',alignItems:'center',gap:5}}><BrainCircuit size={14}/> Memory recall</span></div>
               <button type="button" onClick={startRevision} disabled={launching} style={{...primary,width:'100%',borderRadius:999}}>{launching?'Opening…':'Start revision'} <ArrowRight size={15} style={{verticalAlign:'middle',marginLeft:5}}/></button>
             </div>
           </section>
           <section aria-label="Choose a revision subject">
             <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:10}}><h2 style={{fontSize:18,margin:0}}>Subjects</h2><span style={muted}>Select to revise</span></div>
             <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8}}>
               {subjectTiles.map(({name,Icon})=><button key={name} type="button" aria-pressed={subject===name} onClick={()=>{setSubject(name);setError('')}} style={{...basic,minWidth:0,display:'grid',placeItems:'center',gap:6,padding:'12px 3px',minHeight:66,borderRadius:15,border:subject===name?'2px solid var(--vs-accent)':'1px solid var(--vs-border)',background:subject===name?'var(--vs-accent-soft)':colors.panel,color:colors.ink}}>
                 <Icon size={19} strokeWidth={1.8}/><span style={{fontSize:'clamp(9px,1.6vw,12px)',fontWeight:subject===name?850:650,overflowWrap:'anywhere'}}>{name}</span>
               </button>)}
             </div>
           </section>
           <section aria-label="Your revision activities">
             <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:10}}>
               <h2 style={{fontSize:18,margin:0}}>Your revision</h2>
               <div style={{display:'flex',gap:12}}>{(['today','week'] as const).map(period=><button key={period} type="button" onClick={()=>setQueuePeriod(period)} aria-pressed={queuePeriod===period} style={{...basic,fontSize:13,fontWeight:800,border:0,background:'transparent',padding:'7px 0',color:queuePeriod===period?colors.ink:colors.muted}}>{period==='today'?'Today':'This week'}</button>)}</div>
             </div>
             <div style={{background:colors.panel,border:'1px solid var(--vs-border)',borderRadius:17,overflow:'hidden'}}>
               {queuePeriod==='today'?<>
                 <button type="button" style={rowStyle} onClick={openMistakes}><span style={{...activityIcon,background:'var(--vs-accent-soft)'}}><RefreshCcw size={19}/></span><span style={{flex:1}}><strong style={{fontSize:15}}>Review mistakes</strong><small style={{...muted,display:'block',marginTop:3}}>Return to questions you missed</small></span><ChevronRight size={18} color="var(--vs-muted)"/></button>
                 <button type="button" style={rowStyle} onClick={()=>void launchTopic(selectedTopic?.assignmentId)}><span style={{...activityIcon,background:'var(--vs-accent-soft)'}}><Layers3 size={19}/></span><span style={{flex:1}}><strong style={{fontSize:15}}>Quick flashcards</strong><small style={{...muted,display:'block',marginTop:3}}>Recall definitions and concepts</small></span><ChevronRight size={18} color="var(--vs-muted)"/></button>
                 <button type="button" style={{...rowStyle,borderBottom:0}} onClick={startRevision}><span style={{...activityIcon,background:'var(--vs-accent-soft)'}}><BrainCircuit size={19}/></span><span style={{flex:1}}><strong style={{fontSize:15}}>Memory check</strong><small style={{...muted,display:'block',marginTop:3}}>See what you still remember</small></span><ChevronRight size={18} color="var(--vs-muted)"/></button>
               </>:<>
                 {(weekTopics.length?weekTopics:topics.slice(0,3)).map(t=><button type="button" key={t.assignmentId} style={rowStyle} onClick={()=>void launchTopic(t.assignmentId)}><span style={{...activityIcon,background:colors.accentSoft}}><CalendarDays size={18}/></span><span style={{flex:1}}><strong style={{fontSize:14}}>{t.topic}</strong><small style={{...muted,display:'block'}}>{t.nextReviewAt?dateLabel(t.nextReviewAt):'Revise anytime'} · {t.subject}</small></span><ChevronRight size={17}/></button>)}
                 {!topics.length&&<p style={{...muted,padding:12}}>More topics will appear as approved revision content becomes available.</p>}
               </>}
             </div>
           </section>
           <section aria-label="Memory health" style={{background:colors.panel,borderRadius:16,padding:'15px 12px'}}>
             <div style={{display:'flex',alignItems:'center',gap:9}}><ChartNoAxesColumn size={17}/><h2 style={{fontSize:16,margin:0}}>Memory health</h2><span style={{marginLeft:'auto',fontSize:11,background:colors.accentSoft,color:colors.accent,padding:'4px 9px',borderRadius:99}}>Saved activity</span></div>
             <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',textAlign:'center',gap:7,marginTop:16}}>
               {[{label:'Remembered',value:memoryHealth.remembered},{label:'Due soon',value:memoryHealth.due},{label:'Needs review',value:memoryHealth.needs}].map((m,i)=><div key={m.label}><strong style={{fontSize:23,color:i===0?'var(--vs-accent)':colors.ink}}>{m.value}</strong><div style={{...muted,fontSize:11,marginTop:4}}>{m.label}</div></div>)}
             </div>
           </section>
         </>}
         {screen==='recall'&&item&&<section style={card}>
           <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><strong style={{fontSize:12,color:colors.accent}}>{mode} · {item.subject}</strong><button type="button" aria-label="Exit recall" style={{...basic,border:0,background:'transparent'}} onClick={()=>setScreen('home')}><X size={18}/></button></div>
           <div style={{height:5,background:colors.accentSoft,borderRadius:99,margin:'17px 0'}}><div style={{height:'100%',width:revealed?'100%':'45%',background:colors.accent,borderRadius:99}}/></div>
           <h2 style={{fontSize:23,lineHeight:1.35}}>{item.prompt}</h2>
           {!revealed?<><p style={muted}>Think of the answer before looking.</p><button type="button" style={primary} onClick={()=>setRevealed(true)}>Reveal answer <Lightbulb size={16}/></button></>:
             <><div style={{background:colors.accentSoft,padding:15,borderRadius:12}}>{item.explanation??item.hint??'Read the linked lesson to review this idea.'}</div><h3>Did you remember it?</h3><div style={{display:'flex',gap:8}}><button disabled={saving} style={primary} onClick={()=>void submitRecall(true)}>Yes, I did</button><button disabled={saving} style={secondary} onClick={()=>void submitRecall(false)}>Not yet</button></div></>}
         </section>}
         {screen==='feedback'&&item&&<section style={{...card,textAlign:'center'}}><CheckCircle2 size={35} color={colors.accent}/><h2>{remembered?'Well remembered!':'Keep practising'}</h2><p style={muted}>Your recall has been saved.</p>{nextReview&&<p>Next review: {dateLabel(nextReview)}</p>}<button type="button" style={primary} onClick={()=>setScreen('finished')}>Finish session</button></section>}
         {screen==='finished'&&<section style={{...card,textAlign:'center'}}><CheckCircle2 size={35} color={colors.accent}/><h2>Revision complete</h2><p style={muted}>Your next revision will appear automatically.</p><button type="button" style={primary} onClick={()=>{setScreen('home');void load()}}>Back to Revision Studio</button></section>}
         <RevisionTopicStarter ref={launcher} className={identity.className??''} embedded onTopicsChange={setTopics} onActiveChange={setTopicActive} onCompleted={()=>void load()}/>
         {onHome&&workspace && workspace.revisionMode.daysRemaining > 0&&<p style={{...muted,textAlign:'center'}}>Exam in {workspace.revisionMode.daysRemaining} days · {workspace.revisionMode.message}</p>}
       </>}
     </div>
     <nav aria-label="Revision Studio navigation" style={{borderTop:'1px solid var(--vs-border)',display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',background:colors.canvas,padding:'12px 6px'}}>
       {[{label:'Home',Icon:House,href:'/student'},{label:'Learn',Icon:BookOpen,href:'/student/study'},{label:'Revision',Icon:BrainCircuit,href:'/student/vibelearn/revision'},{label:'Progress',Icon:ChartNoAxesColumn,href:'/student/marks'}].map(({label,Icon,href})=><button type="button" key={label} onClick={()=>{if(label==='Revision'){setScreen('home');return}router.push(href)}} aria-current={label==='Revision'?'page':undefined} style={{...basic,display:'grid',placeItems:'center',gap:6,padding:6,minHeight:50,border:0,background:'transparent',color:label==='Revision'?colors.accent:colors.muted,fontWeight:label==='Revision'?850:550,fontSize:11}}><Icon size={19}/>{label}</button>)}
     </nav>
   </div>
 </main>
}
