'use client'
import {useEffect,useRef,useState} from 'react'
import {SlideCanvas,type LiveSlide} from './LiveSlideCanvas'
import {decodeAssessment,preparedAssessment,presenterNotes,isPhotoBody,studioMinutes,studioFile} from './LiveSlideProtocol'
import styles from './LiveClassroom.module.css'
import {StudioFilePreview} from './LiveStudioFiles'

// This rehearsal has no classroom command, room ID, or learner identity.
type Props={
 slides:LiveSlide[]
 initialIndex:number
 onClose:(index:number)=>void
 onSave:()=>void
 onPrepare:()=>void
 saveDisabled:boolean
 prepareLabel:string
 status:string
 error:string
}

export function LiveStudioRehearsal({slides,initialIndex,onClose,onSave,onPrepare,saveDisabled,prepareLabel,status,error}:Props){
 const [index,setIndex]=useState(initialIndex)
 const [teacherView,setTeacherView]=useState(false)
 const [choice,setChoice]=useState<number|null>(null)
 const [mic,setMic]=useState<'idle'|'checking'|'ready'|'error'>('idle')
 const alive=useRef(false)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 async function testMicrophone(){
  if(mic==='checking')return
  setMic('checking')
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true})
   const ready=stream.getAudioTracks().some(t=>t.readyState==='live')
   stream.getTracks().forEach(t=>t.stop())
   if(alive.current)setMic(ready?'ready':'error')
  }catch{if(alive.current)setMic('error')}
 }
 const slide=slides[index]
 if(!slide)return null
 const assessment=decodeAssessment(slide.body)
 const answer=preparedAssessment(slide)
 const {notes:privateNotes,...publicSlide}=slide
 function navigate(next:number){setIndex(next);setChoice(null)}
 return <section className={styles.slideFields} aria-label="Private slide rehearsal">
  <div className={styles.slideToolbar}><strong>Private rehearsal</strong><button type="button" onClick={()=>onClose(initialIndex)}>Back to preparation</button><button type="button" onClick={()=>onClose(index)}>Edit this slide</button></div>
  <div className={styles.controls}>
   <button type="button" disabled={saveDisabled} onClick={onSave}>Save presentation</button>
   <button type="button" className={styles.primary} disabled={saveDisabled} onClick={onPrepare}>{prepareLabel}</button>
   <small role="status">{status}</small>
  </div>
  {error&&<p role="alert">{error}</p>}
  <p role="status">No students are connected. Nothing is published or recorded.</p>
  <div className={styles.controls}><button type="button" aria-pressed={!teacherView} onClick={()=>setTeacherView(false)}>Student preview</button><button type="button" aria-pressed={teacherView} onClick={()=>setTeacherView(true)}>Teacher view</button><button type="button" disabled={mic==='checking'} onClick={()=>void testMicrophone()}>Test microphone</button></div>
  {mic!=='idle'&&<small role="status">{mic==='checking'?'Checking permission…':mic==='ready'?'Microphone access verified; microphone released.':'Microphone unavailable. Check device permissions.'}</small>}
  {studioFile(slide)?<StudioFilePreview reference={studioFile(slide)!} title={slide.title}/>:isPhotoBody(slide.body)&&!teacherView?<p role="status">Photos require authorized sharing in the live room. Learner access cannot be verified before launch.</p>:<SlideCanvas slide={publicSlide} number={index+1} total={slides.length} explore={!teacherView} ownerPhotoPreview={teacherView}/>}
  {assessment&&!teacherView&&<div className={styles.controls} aria-label="Simulated learner response">{assessment.options.map((option,i)=><button key={i} type="button" aria-pressed={choice===i} onClick={()=>setChoice(i)}>{option}</button>)}{choice!==null&&<small role="status">Practice response selected. No results saved.</small>}</div>}
  {teacherView&&<section aria-label="Private presenter notes"><strong>Teacher notes</strong><p>Planned stage: {studioMinutes(slide)||'Not set'} {studioMinutes(slide)?'min':''} · Total: {slides.reduce((sum,s)=>sum+studioMinutes(s),0)} min</p><p>{presenterNotes(privateNotes)||'No notes'}</p>{answer&&<p>Prepared answer: {answer.answer}</p>}</section>}
  <div className={styles.slideToolbar}><button type="button" disabled={index===0} onClick={()=>navigate(index-1)}>Previous</button><span>{index+1} / {slides.length}</span><button type="button" disabled={index===slides.length-1} onClick={()=>navigate(index+1)}>Next</button><button type="button" onClick={()=>navigate(0)}>Restart</button></div>
 </section>
}
