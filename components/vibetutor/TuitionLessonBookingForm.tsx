'use client'
import {useState,type FormEvent} from 'react'
import {getSupabaseClient} from '@/lib/supabase'

/** Private tuition's existing accepted-invitation writer remains the only authority. */
export default function TuitionLessonBookingForm({invitationId,onBooked,initialDate=''}:{invitationId:string;onBooked:()=>void|Promise<void>;initialDate?:string}){
 const [title,setTitle]=useState('')
 const [start,setStart]=useState(initialDate?initialDate+'T09:00':'')
 const [duration,setDuration]=useState(40)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return
  const when=new Date(start+':00+03:00')
  if(!title.trim()||!Number.isFinite(when.getTime())||when.getTime()<=Date.now()||!Number.isInteger(duration)||duration<1||duration>180){setError('Choose a future date and a duration of 1–180 minutes.');return}
  setBusy(true);setError('');setNotice('')
  try{
   const {error:problem}=await getSupabaseClient().rpc('vibetutor_schedule_lesson',{p_invitation:invitationId,p_title:title.trim(),p_start:when.toISOString(),p_end:new Date(when.getTime()+duration*60000).toISOString()})
   if(problem){setError(problem.message);return}
   setTitle('');setStart('');setNotice('Lesson scheduled for both accounts.')
   await onBooked()
  }catch{setError('Could not confirm the result. Refresh lessons before trying again.')}
  finally{setBusy(false)}
 }
 const input={display:'block',width:'100%',boxSizing:'border-box' as const,padding:10,minHeight:44,border:'1px solid var(--vs-border,#c6d6cb)',borderRadius:8,color:'inherit',background:'var(--vs-card,transparent)',font:'inherit'}
 return <form onSubmit={e=>void submit(e)} style={{display:'grid',gap:10,minWidth:0}} aria-label="Schedule a private lesson">
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  <label>Lesson topic<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Fractions" disabled={busy} style={input}/></label>
  <label>Date and time (EAT)<input required type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} disabled={busy} style={input}/></label>
  <label>Duration (minutes)<input required type="number" min={1} max={180} step={1} value={duration||''} onChange={e=>setDuration(Number(e.target.value))} disabled={busy} style={input}/></label>
  <button type="submit" disabled={busy} style={{minHeight:44,background:'#087451',color:'#fff',border:0,borderRadius:8,fontWeight:700}}>{busy?'Scheduling…':'Schedule lesson'}</button>
 </form>
}
