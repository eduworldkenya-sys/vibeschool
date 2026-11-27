'use client'
import {useEffect,useState} from 'react'
import {SlideCanvas} from './LiveSlideCanvas'
import {encodeSlide,presenterNotes,studioMinutes,studioFile,studioResource,type LiveSlide} from './LiveSlideProtocol'
import styles from './LiveClassroom.module.css'

/** Local-only preview: no publish, session creation, recording or learner events. */
export function StudioRehearsal({slides,title,roomId,onClose}:{slides:readonly LiveSlide[];title:string;roomId?:string;onClose:()=>void}){
 const [index,setIndex]=useState(0)
 const [seconds,setSeconds]=useState(0)
 const [running,setRunning]=useState(false)
 const [showNotes,setShowNotes]=useState(false)
 const current=Math.min(index,Math.max(0,slides.length-1))
 const item=slides[current]
 const ready=slides.filter((slide,i)=>!!encodeSlide(slide,i+1,slides.length)).length
 useEffect(()=>{if(!running)return;const timer=window.setInterval(()=>setSeconds(v=>v+1),1000);return()=>window.clearInterval(timer)},[running])
 const elapsed=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')
 return <section className={styles.rehearsalWorkspace} aria-label="Private rehearsal">
  <header className={styles.studioHeading}><div><strong>Rehearse · {title}</strong><small>Private preview. Nothing here is sent to learners.</small></div><button type="button" onClick={onClose}>Exit rehearsal</button></header>
  <div className={styles.studioTransport}><span role="timer" aria-label="Rehearsal elapsed time">{elapsed}</span><button type="button" onClick={()=>setRunning(v=>!v)}>{running?'Pause timer':'Start timer'}</button><button type="button" onClick={()=>{setSeconds(0);setRunning(false);setIndex(0)}}>Restart</button></div>
  {item?<><div className={styles.rehearsalCanvas}><SlideCanvas slide={item} number={current+1} total={slides.length} roomId={roomId} ownerPhotoPreview/></div>
  <div className={styles.studioTransport}><button type="button" disabled={current===0} onClick={()=>setIndex(current-1)}>Previous</button><span>{current+1} / {slides.length}</span><button type="button" disabled={current>=slides.length-1} onClick={()=>setIndex(current+1)}>Next</button></div>
  <div className={styles.rehearsalDetails}><strong>Preparation check: {ready} / {slides.length} encodable slides</strong>{!encodeSlide(item,current+1,slides.length)&&<p role="status">This segment needs content or adjustment before presentation.</p>}{(studioFile(item)||studioResource(item))&&<p>Linked material requires classroom resource validation before presentation.</p>}{studioMinutes(item)>0&&<p>Planned duration: {studioMinutes(item)} min</p>}<button type="button" aria-expanded={showNotes} onClick={()=>setShowNotes(v=>!v)}>{showNotes?'Hide':'Show'} private notes</button>{showNotes&&<p className={styles.rehearsalNotes}>{presenterNotes(item.notes)||'No presenter notes.'}</p>}</div></>:<p>Choose a prepared presentation first.</p>}
 </section>
}
