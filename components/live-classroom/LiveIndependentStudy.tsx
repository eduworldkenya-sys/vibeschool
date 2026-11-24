'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import {supabase} from '@/lib/supabase'
import {SlideCanvas} from './LiveSlideCanvas'
import {decodeAssessment,validSlide,type LiveSlide} from './LiveSlideProtocol'
import styles from './LiveClassroom.module.css'
type Summary={id:string;title:string;slideCount:number;completed?:number;assignedCount?:number;completedCount?:number;revoked?:boolean}
type Material={id:string;title:string;revision:number;slideCount:number}
type Feedback={kind:'quiz'|'poll';selected:number;correct?:boolean;correctOption?:number;explanation?:string}
type Study={id:string;title:string;slides:LiveSlide[];page:number;visited:number[];answers:Record<string,Feedback>}
type Props={classId:string|null;teacher:boolean;mode?:'school'|'tuition'|'homeschool'|'open';groupId?:string|null;roomId?:string}
async function command(action:string,classId:string|null,id:string|null=null,payload:Record<string,unknown>={}):Promise<unknown>{
 const {data,error}=await supabase.rpc('vibe_live_study_command',{p_action:action,p_class:classId,p_id:id,p_payload:payload})
 if(error)throw Error(error.message)
 return data
}
function parseStudy(data:unknown):Study{
 const v=data as Study
 if(!v||typeof v.id!=='string'||typeof v.title!=='string'||!Array.isArray(v.slides)||v.slides.length<1||v.slides.length>30||!v.slides.every(s=>validSlide(s)&&s.notes===undefined)||!Number.isInteger(v.page)||v.page<0||v.page>=v.slides.length||!Array.isArray(v.visited)||!v.visited.every(i=>Number.isInteger(i)&&i>=0&&i<v.slides.length)||!v.answers||typeof v.answers!=='object')throw Error('Invalid independent lesson response.')
 return v
}
export function LiveIndependentStudy({classId,teacher,mode,groupId,roomId}:Props){
 const [open,setOpen]=useState(false),[items,setItems]=useState<Summary[]>([]),[materials,setMaterials]=useState<Material[]>([]),[study,setStudy]=useState<Study|null>(null),[selected,setSelected]=useState(''),[option,setOption]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[available,setAvailable]=useState(false)
 const lock=useRef(false),generation=useRef(0),request=useRef<{signature:string;id:string}|null>(null)
 const list=useCallback(async()=>{
  const data=await command(teacher?'list_owner':'list',classId)
  if(!Array.isArray(data))throw Error('Invalid assigned presentations list.')
  return data as Summary[]
 },[teacher,classId])
 useEffect(()=>{let alive=true;setAvailable(false);setOpen(false);setStudy(null);setError('');generation.current++;void list().then(data=>{if(alive){setItems(data);setAvailable(true)}}).catch(()=>{/* Migration not installed or this identity is ineligible. No unsafe fallback. */});return()=>{alive=false;generation.current++}},[list])
 async function run(job:(current:()=>boolean)=>Promise<void>){
  if(lock.current)return
  lock.current=true;setBusy(true);setError('');const stamp=generation.current
  try{await job(()=>generation.current===stamp)}catch(e){if(generation.current===stamp)setError(e instanceof Error?e.message:'Could not complete the action.')}
  finally{lock.current=false;setBusy(false)}
 }
 async function refresh(current:()=>boolean){const data=await list();if(current())setItems(data)}
 function toggle(){
  if(open){setOpen(false);setStudy(null);setOption(null);return}
  setOpen(true);void run(async current=>{await refresh(current)
   if(teacher){const {data,error}=await supabase.rpc('vibe_live_command',{p_action:'materials_list',p_class_id:classId,p_session_id:null,p_version:null,p_payload:{host:true}});if(error)throw Error(error.message);const values=(data as {materials?:Material[]})?.materials;if(!Array.isArray(values))throw Error('Invalid teacher presentations.');if(current())setMaterials(values)}
  })
 }
 function assign(){
  const material=materials.find(m=>m.id===selected)
  if(!material||mode==='open'||!mode)return
  if(!window.confirm('Assign the saved revision of this presentation to currently eligible learners?'))return
  const payload=roomId?{materialId:material.id,revision:material.revision,roomId}:{materialId:material.id,revision:material.revision,mode,groupId:mode==='tuition'?groupId||null:null}
  const signature=JSON.stringify([classId,payload])
  if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()}
  const id=request.current.id
  void run(async current=>{await command(roomId?'create_from_room':'create',classId,id,payload);if(!current())return;request.current=null;setSelected('');await refresh(current)})
 }
 function load(id:string){void run(async current=>{const value=parseStudy(await command('get',classId,id));if(current()){setStudy(value);setOption(null)}})}
 function advance(page:number,complete:boolean){if(!study)return;void run(async current=>{const value=parseStudy(await command('advance',classId,study.id,{page,complete}));if(current()){setStudy(value);setOption(null);await refresh(current)}})}
 function submit(){if(!study||option===null)return;void run(async current=>{const value=parseStudy(await command('answer',classId,study.id,{page:study.page,option}));if(current())setStudy(value)})}
 if(!available)return null
 const activity=study?decodeAssessment(study.slides[study.page].body):null,feedback=study?.answers[String(study.page)]
 return <section className={styles.panel} aria-label={teacher?'Assigned presentations':'Independent learning'}>
 <button type="button" disabled={busy} aria-expanded={open} onClick={toggle}>{open?'Close independent learning':teacher?'Assign presentations':'Independent learning'}</button>
 {open&&<>{error&&<p role="alert">{error}</p>}{teacher?<>
 <h3>{roomId?'Assign a presentation to this lesson’s audience':'Assign a saved presentation'}</h3>
 {mode==='open'?<p>Select a school, tuition or homeschool audience to assign privately.</p>:<><label>Presentation<select disabled={busy} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose saved presentation</option>{materials.map(m=><option key={m.id} value={m.id}>{m.title} · {m.slideCount} slides</option>)}</select></label><button type="button" disabled={busy||!selected||!mode} onClick={assign}>Assign</button><small>Creates a fixed revision for currently eligible learners. Prepare quiz answers before assigning. Room-specific photo slides are not yet eligible.</small></>}
 {items.map(item=><div key={item.id} className={styles.slideToolbar}><strong>{item.title}</strong><span>{item.completedCount??0}/{item.assignedCount??0} complete</span>{item.revoked?<span>Withdrawn</span>:<button type="button" disabled={busy} onClick={()=>{if(window.confirm('Withdraw this presentation from learners?'))void run(async current=>{await command('revoke',classId,item.id);await refresh(current)})}}>Withdraw</button>}</div>)}
 </>:study?<><div className={styles.slideToolbar}><strong>{study.title}</strong><button type="button" disabled={busy} onClick={()=>{setStudy(null);setOption(null)}}>Back to assignments</button></div><progress max={study.slides.length} value={new Set(study.visited).size}/><p>{new Set(study.visited).size} / {study.slides.length} completed · saved to your account</p>
 <SlideCanvas key={study.id+':'+study.page} slide={study.slides[study.page]} number={study.page+1} total={study.slides.length} explore/>
 {activity&&<section className={styles.selfPacedPractice}>{feedback?<div role="status"><strong>{feedback.kind==='poll'?'Response saved':feedback.correct?'Correct':'Review this answer'}</strong>{feedback.correctOption!==undefined&&<p>Answer: {activity.options[feedback.correctOption]}</p>}{feedback.explanation&&<p>{feedback.explanation}</p>}</div>:<><fieldset><legend>Choose your answer</legend>{activity.options.map((o,i)=><label key={i}><input type="radio" name="study-answer" value={i} checked={option===i} disabled={busy} onChange={()=>setOption(i)}/>{o}</label>)}</fieldset><button type="button" disabled={busy||option===null} onClick={submit}>Submit answer</button></>}</section>}
 <div className={styles.slideToolbar}><button type="button" disabled={busy||study.page===0} onClick={()=>advance(study.page-1,false)}>Previous</button><button type="button" disabled={busy||!!activity&&!feedback} onClick={()=>advance(study.page,true)}>{study.page===study.slides.length-1?'Complete lesson':'Complete & next'}</button></div>{study.visited.length===study.slides.length&&<p role="status">Presentation completed.</p>}</>:items.length?items.map(item=><button type="button" key={item.id} disabled={busy} onClick={()=>load(item.id)}>{item.title} · {item.completed??0}/{item.slideCount} complete</button>):<p>No independent presentations assigned yet.</p>}</>}
 </section>
}
