'use client'

import {useState} from 'react'
import {Hand, MessageSquare, Shuffle, Users, CheckCircle2, UserRound} from 'lucide-react'
import styles from './LiveClassroom.module.css'

type Learner={studentId:string;name:string;needsHelp:boolean;answer:string|null;unreadDm?:number}
type Props={participants:Learner[];waitingCount:number;pendingQuestions:number;busy:boolean;stale:boolean;onMessage:(learner:Learner)=>void;onAcknowledge:(id:string)=>void}

export default function ClassroomManager({participants,waitingCount,pendingQuestions,busy,stale,onMessage,onAcknowledge}:Props){
 const [filter,setFilter]=useState<'all'|'help'|'answered'>('all')
 const [selectedId,setSelectedId]=useState<string|null>(null)
 const [picked,setPicked]=useState<string[]>([])
 const selected=participants.find(p=>p.studentId===selectedId)
 const raised=participants.filter(p=>p.needsHelp).length
 const answered=participants.filter(p=>p.answer!==null).length
 const visible=participants.filter(p=>filter==='all'||(filter==='help'?p.needsHelp:p.answer!==null))
 function pick(){
   const remaining=participants.filter(p=>!picked.includes(p.studentId))
   if(!remaining.length)return
   const learner=remaining[Math.floor(Math.random()*remaining.length)]
   setFilter('all');setSelectedId(learner.studentId);setPicked(old=>[...old,learner.studentId])
 }
 return <section className={styles.manager} aria-label="Classroom Manager">
   <div className={styles.managerHead}><h3>Classroom Manager</h3><span role="status">{stale?'Reconnecting':'Session roster'}</span></div>
   {stale&&<p role="status">Last available roster. Updates may be delayed.</p>}
   <div className={styles.managerStats}>
     <div><small>Joined</small><strong>{participants.length}</strong></div>
     <div><small>Hands raised</small><strong>{raised}</strong></div>
     <div><small>Answered</small><strong>{answered}</strong></div>
   </div>
   <div className={styles.managerMeta}><span>{waitingCount} waiting</span><span>{pendingQuestions} private questions</span></div>
   <div className={styles.managerHead}><h3>Class heatmap</h3></div>
   <div className={styles.managerFilters} role="group" aria-label="Filter learners">
     {(['all','help','answered'] as const).map(f=><button key={f} type="button" aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f==='all'?'All':f==='help'?'Hands up':'Answered'}</button>)}
   </div>
   <div className={styles.managerGrid}>
     {visible.map(p=><button key={p.studentId} type="button" className={styles.managerTile} data-state={p.needsHelp?'help':p.answer!==null?'answered':'joined'} aria-pressed={selectedId===p.studentId} onClick={()=>setSelectedId(p.studentId)}>
       {p.needsHelp?<Hand size={21}/>:p.answer!==null?<CheckCircle2 size={21}/>:<UserRound size={21}/>}
       <strong>{p.name}</strong><small>{p.needsHelp?'Hand up':p.answer!==null?'Answered':'Joined'}</small>
       {!!p.unreadDm&&<small>{p.unreadDm} new messages</small>}
     </button>)}
   </div>
   {!visible.length&&<p>{participants.length?'No learners match this filter.':'No learners have joined yet.'}</p>}
   <small>Joined does not establish current connectivity or official attendance. Hand up is a learner help request.</small>
   {selected&&<div className={styles.managerDetail} aria-label="Selected learner">
     <div className={styles.managerHead}><strong>{selected.name}</strong><button type="button" onClick={()=>setSelectedId(null)}>Close</button></div>
     <p>{selected.answer??'No answer for the current activity.'}</p>
     <button type="button" disabled={busy||stale} onClick={()=>onMessage(selected)}><MessageSquare size={16}/> Message privately</button>
     {selected.needsHelp&&<button type="button" disabled={busy||stale} onClick={()=>onAcknowledge(selected.studentId)}><Hand size={16}/> Acknowledge hand</button>}
   </div>}
   <div className={styles.managerFilters}>
     <button type="button" disabled={busy||stale||!participants.some(p=>!picked.includes(p.studentId))} onClick={pick}><Shuffle size={17}/> Pick learner</button>
     <button type="button" disabled={!picked.length} onClick={()=>setPicked([])}><Users size={17}/> Reset round</button>
   </div>
 </section>
}
