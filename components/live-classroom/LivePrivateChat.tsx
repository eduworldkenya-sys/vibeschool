'use client'

import { useEffect, useRef, useState } from 'react'
import { X, MessageSquareLock } from 'lucide-react'
import styles from './LiveClassroom.module.css'

type Message = {
  id:string
  sender:'learner'|'teacher'
  body:string
  createdAt:string
  deliveredAt:string|null
  readAt:string|null
}
type Command=(action:string,id?:string|null,version?:number|null,payload?:Record<string,unknown>)=>Promise<unknown>
const VALID_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validMessage(input:unknown):input is Message {
  if(!input||typeof input!=='object')return false
  const m=input as Partial<Message>
  return typeof m.id==='string'&&VALID_ID.test(m.id)
    && (m.sender==='teacher'||m.sender==='learner')
    && typeof m.body==='string'&&m.body.length>0&&m.body.length<=1000
    && typeof m.createdAt==='string'
    && (m.readAt==null||typeof m.readAt==='string')
    && (m.deliveredAt==null||typeof m.deliveredAt==='string')
}

/** One admitted classroom's private thread; the authenticated RPC decides who can read. */
export function LivePrivateChat({roomId,teacher,recipient,status,command,onClose}:{
  roomId:string
  teacher:boolean
  recipient:{studentId:string;name:string}|null
  status:'active'|'paused'|'ended'
  command:Command
  onClose:()=>void
}) {
  const [messages,setMessages]=useState<Message[]>([])
  const [draft,setDraft]=useState('')
  const [error,setError]=useState('')
  const [sending,setSending]=useState(false)
  const [online,setOnline]=useState(true)
  const [peerTyping,setPeerTyping]=useState(false)
  const lastTyping=useRef(0)
  const pending=useRef<{body:string;requestId:string}|null>(null)
  const refreshing=useRef(false)
  const studentId=teacher?recipient?.studentId:null

  useEffect(()=>{
    const check=()=>setOnline(navigator.onLine)
    check();window.addEventListener('online',check);window.addEventListener('offline',check)
    return ()=>{window.removeEventListener('online',check);window.removeEventListener('offline',check)}
  },[])

  useEffect(()=>{
    let cancelled=false
    refreshing.current=false
    pending.current=null
    setMessages([]);setDraft('');setError('');setPeerTyping(false);lastTyping.current=0
    const payload:Record<string,unknown>=teacher?{studentId}:{}
    const refresh=async()=>{
      if(cancelled||refreshing.current||document.visibilityState==='hidden'||!navigator.onLine)return
      refreshing.current=true
      try{
        const result=await command('dm_list',roomId,null,payload) as {messages?:unknown;peerTyping?:boolean}
        if(!Array.isArray(result.messages))throw new Error('Private messages are unavailable.')
        let items=result.messages.filter(validMessage)
        if(cancelled)return
        setMessages(items)
        setPeerTyping(result.peerTyping===true)
        const me=teacher?'teacher':'learner'
        if(items.some(item=>item.sender!==me&&!item.readAt)){
          const read=await command('dm_read',roomId,null,payload) as {messages?:unknown}
          if(!cancelled&&Array.isArray(read.messages))items=read.messages.filter(validMessage)
          if(!cancelled)setMessages(items)
        }
        if(!cancelled)setError('')
      }catch(e){
        if(!cancelled)setError(e instanceof Error&&e.message==='LIVE_ACCESS_REVOKED'?'Classroom access is no longer available.':'Private conversation could not sync. Retry when connected.')
      }finally{refreshing.current=false}
    }
    void refresh()
    const interval=window.setInterval(()=>void refresh(),2000)
    const onWake=()=>void refresh()
    document.addEventListener('visibilitychange',onWake)
    window.addEventListener('online',onWake)
    return()=>{
      cancelled=true;window.clearInterval(interval)
      document.removeEventListener('visibilitychange',onWake)
      window.removeEventListener('online',onWake)
    }
  },[roomId,teacher,studentId,command])

  async function send(){
    const body=draft.trim()
    if(!body||sending||!online||status!=='active')return
    if(pending.current?.body!==body)pending.current={body,requestId:crypto.randomUUID()}
    setSending(true);setError('')
    try {
      const payload:Record<string,unknown>={body,requestId:pending.current.requestId}
      if(teacher)payload.studentId=studentId
      const data=await command('dm_send',roomId,null,payload) as {messages?:unknown}
      if(!Array.isArray(data.messages))throw new Error('Message not saved')
      setMessages(data.messages.filter(validMessage))
      pending.current=null;setDraft('')
      void command('dm_typing',roomId,null,teacher?{studentId,typing:false}:{typing:false}).catch(()=>{})
    }catch(e){
      setError(e instanceof Error&&e.message==='LIVE_ACCESS_REVOKED'?'Classroom access is no longer available.':'Not sent. Check your connection and retry.')
    }finally{setSending(false)}
  }

  function announceTyping(value:string){
    if(status!=='active'||!online)return
    const now=Date.now()
    if(value.trim()&&now-lastTyping.current>=2600){
      lastTyping.current=now
      void command('dm_typing',roomId,null,teacher?{studentId,typing:true}:{typing:true}).catch(()=>{})
    }else if(!value.trim()&&lastTyping.current>0){
      lastTyping.current=0
      void command('dm_typing',roomId,null,teacher?{studentId,typing:false}:{typing:false}).catch(()=>{})
    }
  }

  const myRole=teacher?'teacher':'learner'
  return <section className={styles.sheet} role="dialog" aria-label="Private conversation" aria-modal="false">
    <div className={styles.sheetTitle}>
      <strong><MessageSquareLock size={17} aria-hidden="true"/> {teacher?recipient?.name??'Learner':'Teacher'} · Private</strong>
      <button type="button" aria-label="Close private conversation" onClick={onClose}><X size={18}/></button>
    </div>
    <small>Only you and the {teacher?'selected learner':'teacher'} can see these saved messages. Other learners cannot access them.</small>
    <div className={styles.chatMessages} role="log" aria-live="polite" aria-relevant="additions text">
      {!messages.length&&<p>No messages yet. {teacher?'Send the learner a private message.':'You can ask your teacher directly.'}</p>}
      {messages.map(m=><div key={m.id} className={styles.messageBubble} data-own={m.sender===myRole}>
        <small>{m.sender===myRole?'You':teacher?recipient?.name??'Learner':'Teacher'}</small>
        <span>{m.body}</span>
        {m.sender===myRole&&<small>{m.readAt?'Read':m.deliveredAt?'Delivered':'Sent'}</small>}
      </div>)}
    </div>
    {peerTyping&&<small role="status">{teacher?recipient?.name??'Learner':'Teacher'} is typing…</small>}
    {error&&<p role="alert">{error}</p>}
    {status==='ended'?<small>This class has ended. Messages are available for review only.</small>:
      <form onSubmit={e=>{e.preventDefault();void send()}}>
        <label>Private message<textarea maxLength={1000} required value={draft} disabled={sending||!online||status!=='active'} onChange={e=>{setDraft(e.target.value);announceTyping(e.target.value)}} placeholder="Write a private message…"/></label>
        <button className={styles.primary} disabled={sending||!online||status!=='active'||!draft.trim()}>{sending?'Sending…':'Send privately'}</button>
        {status==='paused'&&<small>Messages can be sent when the class resumes.</small>}
      </form>}
  </section>
}
