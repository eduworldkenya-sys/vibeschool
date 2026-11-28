'use client'

import {useCallback,useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import {supabase} from '@/lib/supabase'
import LiveClassroom from '@/components/live-classroom/LiveClassroom'
import {parseScheduledBooking,type ScheduledBookingContext} from '@/components/live-classroom/ScheduledBookingContext'
import styles from '@/components/live-classroom/LiveClassroom.module.css'

export default function ScheduledLiveClassroom({lessonId}:{lessonId:string}){
 const [context,setContext]=useState<ScheduledBookingContext|null>(null)
 const [entered,setEntered]=useState(false)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const generation=useRef(0)
 const joining=useRef(false)
 const load=useCallback(async()=>{
  const stamp=++generation.current
  try{
   const {data,error:failure}=await supabase.rpc('vibe_live_tuition_booking',{p_booking:lessonId,p_action:'context'})
   if(failure){
    if(generation.current===stamp&&failure.code==='42501'){setContext(null);setEntered(false)}
    throw Error('Could not verify your access to this scheduled lesson.')
   }
   const next=parseScheduledBooking(data,lessonId)
   if(generation.current!==stamp)return
   setContext(next);setError('')
  }catch(e){if(generation.current===stamp){setError(e instanceof Error?e.message:'Lesson unavailable.')}}
 },[lessonId])
 useEffect(()=>{
  setContext(null);setEntered(false)
  void load()
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible'&&!joining.current)void load()},15000)
  const focus=()=>{if(!joining.current)void load()}
  window.addEventListener('focus',focus)
  return()=>{generation.current++;window.clearInterval(timer);window.removeEventListener('focus',focus)}
 },[load])
 function enter(roomId:string){
  const url=new URL(window.location.href)
  url.searchParams.set('resumeRoom',roomId)
  window.history.replaceState(window.history.state,'',url)
  setEntered(true)
 }
 async function join(){
  if(joining.current||!context||context.role!=='student'||context.state!=='joinable'||!context.roomId)return
  joining.current=true;generation.current++;setBusy(true);setError('')
  try{
   const {data,error:failure}=await supabase.rpc('vibe_live_tuition_booking',{p_booking:lessonId,p_action:'join'})
   if(failure||!data||data.id!==context.roomId||data.teacher!==false)throw Error('Could not join the booked classroom. Check the lesson time and connection.')
   enter(data.id)
  }catch(e){setError(e instanceof Error?e.message:'Could not join.')}
  finally{joining.current=false;setBusy(false)}
 }
 if(context?.role==='teacher')return <>{error&&<p role="alert">{error} <button type="button" onClick={()=>void load()}>Retry access</button></p>}<LiveClassroom key={lessonId+':teacher'} classId={null} teacher back="/onlineteacherv1" instantEntry scheduledBooking={context}/></>
 if(context?.role==='student'&&entered&&context.roomId&&context.state!=='cancelled')return <LiveClassroom key={lessonId+':student'} classId={null} teacher={false} back="/student/tutoring" scheduledBooking={context}/>
 return <main className={styles.live}><header className={styles.header}><Link href="/student/tutoring">Back</Link><h1>{context?.title??'Scheduled lesson'}</h1></header>
  <section className={styles.panel}>
   {error&&<div role="alert">{error} <button type="button" onClick={()=>void load()}>Retry access</button></div>}
   {!context&&!error&&<p role="status">Checking booking access…</p>}
   {!context&&error&&<Link href={'/login?redirect='+encodeURIComponent('/tuition/lessons/'+lessonId)}>Sign in with your booked account</Link>}
   {context&&<><p>{new Date(context.startsAt).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'})} EAT</p>
   {context.state==='upcoming'?<p>Join opens 15 minutes before the lesson.</p>:context.state==='cancelled'?<p>This booking was cancelled.</p>:context.state==='joinable'?(context.roomId?<button className={styles.primary} type="button" onClick={()=>void join()} disabled={busy}>{busy?'Joining…':'Join lesson'}</button>:<p role="status">Waiting for your teacher to start the lesson.</p>):<><p>This lesson has ended.</p>{context.roomId&&context.hasJoined&&<button type="button" onClick={()=>enter(context.roomId!)}>Review lesson</button>}</>}
   <button type="button" onClick={()=>void load()} disabled={busy}>Refresh lesson</button></>}
  </section>
 </main>
}
