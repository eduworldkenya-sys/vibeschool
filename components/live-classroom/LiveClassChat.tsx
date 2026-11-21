'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Flag, ShieldCheck, X } from 'lucide-react'
import styles from './LiveClassroom.module.css'

type Message={id:string;body:string;author:string;own:boolean;hidden:boolean;sentAt:string;reports:number}
type Command=(action:string,id?:string|null,version?:number|null,payload?:Record<string,unknown>)=>Promise<unknown>
type ChatResponse={enabled?:boolean;messages?:unknown}

function isMessage(m:unknown):m is Message {
 const v=m as Partial<Message>|null
 return !!v&&typeof v.id==='string'&&typeof v.body==='string'&&typeof v.author==='string'
   &&typeof v.own==='boolean'&&typeof v.hidden==='boolean'&&typeof v.sentAt==='string'
}

export function LiveClassChat({roomId,version,teacher,status,command,onClose}:{
 roomId:string
 version:number
 teacher:boolean
 status:'active'|'paused'|'ended'
 command:Command
 onClose:()=>void
}) {
 const [messages,setMessages]=useState<Message[]>([])
 const [enabled,setEnabled]=useState(false)
 const [draft,setDraft]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [reported,setReported]=useState<string[]>([])
 const pending=useRef<{body:string;requestId:string}|null>(null)
 const inFlight=useRef(false)
 const alive=useRef(true)

 const refresh=useCallback(async()=>{
   if(inFlight.current||document.visibilityState==='hidden'||!navigator.onLine)return
   inFlight.current=true
   try {
     const result=await command('chat_list',roomId) as ChatResponse
     if(!Array.isArray(result.messages)||typeof result.enabled!=='boolean')throw Error('Chat is not available')
     if(!alive.current)return
     setEnabled(result.enabled)
     setMessages(result.messages.filter(isMessage))
     setError('')
   }catch(e){
     if(alive.current)setError(e instanceof Error&&e.message==='LIVE_ACCESS_REVOKED'
       ?'Your class access has changed.':'Class chat could not sync. Check your connection.')
   }finally {inFlight.current=false}
 },[command,roomId])

 useEffect(()=>{
   alive.current=true
   void refresh()
   const timer=window.setInterval(()=>void refresh(),1800)
   const wake=()=>void refresh()
   window.addEventListener('online',wake)
   document.addEventListener('visibilitychange',wake)
   return()=>{alive.current=false;window.clearInterval(timer);window.removeEventListener('online',wake);document.removeEventListener('visibilitychange',wake)}
 },[refresh])
 useEffect(()=>{void refresh()},[version,refresh])

 async function send(){
   const body=draft.trim()
   if(!body||!enabled||busy||status!=='active'||!navigator.onLine)return
   if(pending.current?.body!==body)pending.current={body,requestId:crypto.randomUUID()}
   setBusy(true);setError('')
   try{
     await command('chat_send',roomId,null,{body,requestId:pending.current.requestId})
     pending.current=null;setDraft('')
     await refresh()
   }catch(e){
     const msg=e instanceof Error?e.message:''
     setError(msg.includes('rate_limit')?'Send less often. Try again shortly.':msg.includes('limit')?'This class chat has reached its message limit.':'Message not sent. Retry when connected.')
   }finally{setBusy(false)}
 }
 async function toggle(){
   if(!teacher||status==='ended'||busy)return
   setBusy(true)
   try{
     const result=await command('chat_toggle',roomId,null,{enabled:!enabled}) as {enabled?:boolean}
     if(typeof result.enabled!=='boolean')throw Error('Chat setting not saved')
     setEnabled(result.enabled);setError('')
   }catch{setError('Could not change class chat. Retry.')}finally{setBusy(false)}
 }
 async function hide(id:string){
   if(!teacher||busy||!window.confirm('Hide this message from learners? It will remain in the moderation record.'))return
   setBusy(true)
   try{await command('chat_hide',roomId,null,{messageId:id});await refresh()}
   catch{setError('Could not moderate this message. Retry.')}
   finally{setBusy(false)}
 }
 async function report(id:string){
   if(teacher||busy||reported.includes(id))return
   setBusy(true)
   try{
     await command('chat_report',roomId,null,{messageId:id,reason:'Inappropriate or unsafe class message'})
     setReported(v=>v.includes(id)?v:[...v,id]);setError('')
   }catch{setError('Could not report this message. Retry.')}
   finally{setBusy(false)}
 }

 return <section className={styles.sheet} role="dialog" aria-label="Class chat" aria-modal="false">
   <div className={styles.sheetTitle}><strong><ShieldCheck size={17} aria-hidden="true"/> Class chat</strong>
     <button type="button" aria-label="Close class chat" onClick={onClose}><X size={18}/></button></div>
   <small>Only learners admitted to this Live class can participate. The teacher can close chat or hide messages.</small>
   {teacher&&<button type="button" disabled={busy||status==='ended'} onClick={()=>void toggle()}>{enabled?'Close learner chat':'Enable class chat'}</button>}
   {!enabled&&<p role="status">Class chat is closed by the teacher.</p>}
   <div className={styles.chatMessages} role="log" aria-live="polite" aria-relevant="additions text">
     {enabled&&!messages.length&&<p>There are no class messages yet.</p>}
     {messages.map(m=><div key={m.id} className={styles.classChatEntry}>
       <div className={styles.classChatHeader}><strong>{m.author}{m.own?' · You':''}</strong>
         <small>{Number.isFinite(Date.parse(m.sentAt))?new Date(m.sentAt).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}):''}</small></div>
       <p>{m.hidden?<em>Hidden by teacher</em>:m.body}</p>
       {teacher?<div className={styles.classChatActions}>{m.reports>0&&<small>{m.reports} reported</small>}{!m.hidden&&<button type="button" disabled={busy} onClick={()=>void hide(m.id)}>Hide message</button>}</div>
         :!m.own&&!reported.includes(m.id)&&<button type="button" disabled={busy} onClick={()=>void report(m.id)}><Flag size={13}/> Report</button>}
       {!teacher&&reported.includes(m.id)&&<small role="status">Reported to teacher</small>}
     </div>)}
   </div>
   {error&&<p role="alert">{error}</p>}
   {enabled&&status==='active'&&<form onSubmit={e=>{e.preventDefault();void send()}}>
     <label>Message the class<textarea maxLength={500} required value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)} placeholder="Ask or share with your class…"/></label>
     <button type="submit" className={styles.primary} disabled={busy||!draft.trim()}>{busy?'Sending…':'Send to class'}</button>
   </form>}
   {status==='paused'&&<small>Sending is paused until the teacher resumes the session.</small>}
   {status==='ended'&&<small>The class has ended. Chat is read-only.</small>}
 </section>
}
