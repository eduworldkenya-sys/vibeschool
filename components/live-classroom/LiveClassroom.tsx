'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import styles from './LiveClassroom.module.css'

type Summary = { id: string; title: string; status: 'active' | 'paused'; own: boolean }
type Mode = 'teach' | 'quiz' | 'exercise' | 'poll'
type Prompt = { id: string; kind: Mode; body: string; answerKey: string | null; revealed: boolean }
type Participant = { studentId: string; name: string; needsHelp: boolean; answer: string | null }
type Room = { id: string; title: string; version: number; status: 'active' | 'paused' | 'ended'; teacher: boolean; prompt: Prompt | null; participants?: Participant[]; ownAnswer?: string | null; needsHelp?: boolean }
const modes: Mode[] = ['teach','quiz','exercise','poll']
const labels: Record<Mode,string> = {teach:'Teach',quiz:'Quiz',exercise:'Exercise',poll:'Poll'}

export default function LiveClassroom({classId,teacher,back}:{classId:string;teacher:boolean;back:string}) {
  const [rooms,setRooms] = useState<Summary[]>([])
  const [room,setRoom] = useState<Room|null>(null)
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [title,setTitle] = useState('')
  const [mode,setMode] = useState<Mode>('teach')
  const [body,setBody] = useState('')
  const [key,setKey] = useState('')
  const [answer,setAnswer] = useState('')
  const [answerFor,setAnswerFor] = useState('')
  const lock=useRef(false)
  const mutating=useRef(false)
  const mounted=useRef(false)
  const active=useRef<Room|null>(null)
  const generation=useRef(0)
  const call=useCallback(async (action:string,id:string|null=null,version:number|null=null,payload:Record<string,unknown>={})=>{
    const {data,error:failure}=await supabase.rpc('vibe_live_command',{p_action:action,p_class_id:classId,p_session_id:id,p_version:version,p_payload:payload})
    if(failure) {
      if(failure.code==='42501') throw new Error('LIVE_ACCESS_REVOKED')
      throw new Error(failure.message||'Could not sync the classroom.')
    }
    if(data===null||typeof data!=='object') throw new Error('Invalid classroom response.')
    return data
  },[classId])
  const accept=useCallback((next:Room)=>{
    if(next.teacher!==teacher) throw new Error('Choose the correct classroom account.')
    active.current=next
    setRoom(next)
    if(next.status==='ended') setError('')
  },[teacher])
  const refresh=useCallback(async()=>{
    if(lock.current||!mounted.current||document.visibilityState==='hidden') return
    lock.current=true
    const stamp=generation.current
    try {
      const current=active.current
      if(current&&current.status!=='ended') {
        const next=await call('get',current.id) as Room
        if(mounted.current&&generation.current===stamp) accept(next)
      } else if(!current) {
        const list=await call('list') as Summary[]
        if(mounted.current&&generation.current===stamp) setRooms(list.filter(item=>teacher?item.own:!item.own))
      }
      if(mounted.current&&generation.current===stamp) setError('')
    } catch(e) {
      if(mounted.current&&generation.current===stamp) {
        if(e instanceof Error&&e.message==='LIVE_ACCESS_REVOKED'){active.current=null;setRoom(null);setRooms([]);setError('Classroom access is no longer available.')}
        else setError(e instanceof Error?e.message:'Connection interrupted. Retrying.')
      }
    } finally {
      if(generation.current===stamp) {lock.current=false;if(mounted.current)setLoading(false)}
    }
  },[call,accept,teacher])
  useEffect(()=>{
    mounted.current=true
    generation.current++
    lock.current=false
    mutating.current=false
    active.current=null
    setRoom(null); setRooms([]); setLoading(true);setBusy(false);setError('')
    void refresh()
    const timer=window.setInterval(()=>void refresh(),4000)
    return ()=>{mounted.current=false;generation.current++;window.clearInterval(timer)}
  },[refresh])
  useEffect(()=>{setAnswer('');setAnswerFor(room?.prompt?.id??'')},[room?.prompt?.id])
  async function act(action:string,id:string|null=null,payload:Record<string,unknown>={}) {
    if(mutating.current) return
    const stamp=++generation.current // discard any earlier poll; never discard the user's click
    mutating.current=true;lock.current=true;setBusy(true);setError('')
    try {
      const next=await call(action,id??room?.id??null,room?.version??null,payload) as Room
      if(!mounted.current||generation.current!==stamp)return
      accept(next)
      if(action==='publish'){setBody('');setKey('')}
    } catch(e) {
      if(mounted.current&&generation.current===stamp){
        if(e instanceof Error&&e.message==='LIVE_ACCESS_REVOKED'){active.current=null;setRoom(null);setRooms([]);setError('Classroom access is no longer available.')}
        else setError(e instanceof Error?e.message:'Could not save. Retry.')
      }
    } finally {
      if(generation.current===stamp){mutating.current=false;lock.current=false;if(mounted.current){setBusy(false);setLoading(false)}}
    }
  }
  function leave() {
    if(mutating.current)return
    generation.current++;lock.current=false;active.current=null;setRoom(null);setError('');setLoading(true);void refresh()
  }
  const participants=room?.participants??[]
  const prompt=room?.prompt
  return <main className={styles.live}>
    <header className={styles.header}><Link href={back}>Back</Link><h1>Live Classroom</h1>{room&&<span className={styles.status}>{room.status==='active'?'Live':room.status==='paused'?'Paused':'Ended'}</span>}</header>
    {error&&<div role="alert" className={styles.alert}>{error} <button onClick={()=>void refresh()}>Retry</button></div>}
    {loading&&!room&&<p role="status">Connecting…</p>}
    {!room&&!loading&&<section className={styles.panel}>
      {teacher&&<form onSubmit={e=>{e.preventDefault();void act('start',null,{title})}}>
        <label>Lesson title<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Grade 4 · Mathematics"/></label>
        <button className={styles.primary} disabled={busy||!title.trim()}>Go Live</button>
      </form>}
      {rooms.length>0?<div className={styles.rooms}>{rooms.map(item=><button key={item.id} disabled={busy} onClick={()=>void act(teacher?'get':'join',item.id)}><strong>{item.title}</strong><span>{teacher?'Resume': 'Join Live'}</span></button>)}</div>:<p>{teacher?'No active session':'Waiting for your teacher to go live.'}</p>}
    </section>}
    {room&&<><section className={styles.panel}><h2>{room.title}</h2>
      {room.status==='ended'?<><p>This session has ended.</p><button onClick={leave}>Return to live lessons</button></>:<>
        {prompt?<><div className={styles.label}>{labels[prompt.kind]}</div><p className={styles.content}>{prompt.body}</p>
          {prompt.revealed&&prompt.answerKey&&<div className={styles.solution}><strong>Answer</strong><p className={styles.content}>{prompt.answerKey}</p></div>}
        </>:<p>Waiting for lesson content.</p>}
        {!teacher&&prompt&&prompt.kind!=='teach'&&<div>
          {room.ownAnswer!==null&&room.ownAnswer!==undefined?<p role="status"><strong>Submitted:</strong> {room.ownAnswer}</p>:prompt.revealed?<p>Responses closed.</p>:<form onSubmit={e=>{e.preventDefault();void act('answer',null,{body:answer,promptId:prompt.id})}}>
          <label>Your answer<textarea maxLength={2000} required value={answerFor===prompt.id?answer:''} onChange={e=>{setAnswerFor(prompt.id);setAnswer(e.target.value)}} disabled={room.status!=='active'}/></label>
          <button className={styles.primary} disabled={busy||room.status!=='active'||!answer.trim()||answerFor!==prompt.id}>Submit</button></form>}
        </div>}
        {!teacher&&<div className={styles.controls}><button disabled={busy||room.needsHelp} onClick={()=>void act('help')}>{room.needsHelp?'Hand raised':'Raise hand'}</button><button disabled={busy} onClick={leave}>Leave</button></div>}
      </>}
    </section>
    {teacher&&room.status!=='ended'&&<>
      <section className={styles.panel}><h2>Present</h2>
        <div className={styles.controls}>{modes.map(item=><button key={item} aria-pressed={mode===item} onClick={()=>{setMode(item);setKey('')}}>{labels[item]}</button>)}</div>
        <form onSubmit={e=>{e.preventDefault();void act('publish',null,{kind:mode,body,answerKey:mode==='quiz'||mode==='exercise'?key:null})}}>
          <label>{mode==='teach'?'Lesson content':'Question or instruction'}<textarea required maxLength={4000} value={body} onChange={e=>setBody(e.target.value)}/></label>
          {(mode==='quiz'||mode==='exercise')&&<label>Answer (hidden until reveal)<textarea maxLength={2000} value={key} onChange={e=>setKey(e.target.value)}/></label>}
          <button className={styles.primary} disabled={busy||room.status!=='active'||!body.trim()}>Share with class</button>
        </form>
        <div className={styles.controls}>
          <button disabled={busy||!prompt||prompt.kind==='teach'||prompt.revealed} onClick={()=>void act('reveal')}>Reveal / close answers</button>
          <button disabled={busy} onClick={()=>void act(room.status==='paused'?'resume':'pause')}>{room.status==='paused'?'Resume':'Pause'}</button>
          <button disabled={busy} onClick={()=>void act('end')}>End session</button>
        </div>
      </section>
      <section className={styles.panel}><h2>Learners</h2><div className={styles.metrics}><span>{participants.length} joined</span><span>{participants.filter(p=>p.answer!==null).length} answered</span><span>{participants.filter(p=>p.needsHelp).length} need help</span></div>
        {participants.length===0?<p>No learners have joined.</p>:<ul className={styles.participants}>{participants.map(p=><li key={p.studentId}><strong>{p.name}</strong><span>{p.answer??'No answer'}</span>{p.needsHelp&&<button disabled={busy} onClick={()=>void act('ack',null,{studentId:p.studentId})}>Acknowledge hand</button>}</li>)}</ul>}
      </section>
    </>}
    </>}
  </main>
}
