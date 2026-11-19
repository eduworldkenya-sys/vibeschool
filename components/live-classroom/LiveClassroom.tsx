'use client'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import styles from './LiveClassroom.module.css'

type ClassroomMode = 'school' | 'tuition' | 'homeschool' | 'open'
const classroomLabels: Record<ClassroomMode,string>={school:'School',tuition:'Tuition',homeschool:'Homeschool',open:'Open class'}
type Summary = { mode: ClassroomMode; canJoin: boolean; id: string; title: string; status: 'active' | 'paused'; own: boolean }
type Mode = 'teach' | 'quiz' | 'exercise' | 'poll' | 'clock' | 'board'
type Prompt = { id: string; kind: Mode; body: string; answerKey: string | null; revealed: boolean }
type Participant = { studentId: string; name: string; needsHelp: boolean; answer: string | null }
type Room = { mode: ClassroomMode; id: string; title: string; version: number; status: 'active' | 'paused' | 'ended'; teacher: boolean; prompt: Prompt | null; participants?: Participant[]; ownAnswer?: string | null; needsHelp?: boolean }
const modes: Mode[] = ['teach','quiz','exercise','poll','clock','board']
const labels: Record<Mode,string> = {teach:'Teach',quiz:'Quiz',exercise:'Exercise',poll:'Poll',clock:'Clock',board:'Board'}

function BoardView({value,onPointerDown,onPointerMove,onPointerUp}:{value:string;onPointerDown?:(event:PointerEvent<SVGSVGElement>)=>void;onPointerMove?:(event:PointerEvent<SVGSVGElement>)=>void;onPointerUp?:(event:PointerEvent<SVGSVGElement>)=>void}){
 const lines=value.split('|').slice(0,100).map(line=>line.split(';').filter(point=>/^\d{1,3},\d{1,3}$/.test(point)).slice(0,500).join(' ')).filter(Boolean)
 return <svg className={styles.board} viewBox="0 0 320 220" role="img" aria-label="Shared drawing board" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
  {lines.map((line,i)=><polyline key={i} points={line} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>)}
 </svg>
}
function ClockView({value}:{value:string}){
 const [h,m]=value.split(':').map(Number)
 if(!/^([01]?\d|2[0-3]):[0-5]\d$/.test(value))return null
 const hand=(angle:number,length:number)=>[100+length*Math.sin(angle*Math.PI/180),100-length*Math.cos(angle*Math.PI/180)]
 const hour=hand((h%12)*30+m/2,44),minute=hand(m*6,67)
 return <svg className={styles.clock} viewBox="0 0 200 200" role="img" aria-label={'Clock showing '+value}>
   <circle cx="100" cy="100" r="94" stroke="currentColor" fill="none" strokeWidth="2"/>
   {Array.from({length:12},(_,i)=>i+1).map(n=><text key={n} x={100+79*Math.sin(n*Math.PI/6)} y={104-79*Math.cos(n*Math.PI/6)} textAnchor="middle" fill="currentColor" fontSize="14">{n}</text>)}
   <line x1="100" y1="100" x2={hour[0]} y2={hour[1]} stroke="currentColor" strokeWidth="6" strokeLinecap="round"/><line x1="100" y1="100" x2={minute[0]} y2={minute[1]} stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/><circle cx="100" cy="100" r="4" fill="currentColor"/>
 </svg>
}
export default function LiveClassroom({classId,teacher,back,hostModes=['tuition','open']}:{classId:string|null;teacher:boolean;back:string;hostModes?:ClassroomMode[]}) {
  const hostModeKey=hostModes.join(',')
  const [hostMode,setHostMode]=useState<ClassroomMode>(classId?'school':hostModes[0])
  const [groupId,setGroupId]=useState('')
  const [groups,setGroups]=useState<{id:string;title:string}[]>([])
  const [clock,setClock]=useState('10:30')
  const [board,setBoard]=useState('')
  const [tab,setTab]=useState<'present'|'learners'>('present')
  const drawing=useRef(false)
  const [rooms,setRooms] = useState<Summary[]>([])
  const [search,setSearch]=useState('')
  const [scope,setScope]=useState<'all'|ClassroomMode>('all')
  const [sharedId,setSharedId]=useState('')
  const [shareLink,setShareLink]=useState('')
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
    const {data,error:failure}=await supabase.rpc('vibe_live_command',{p_action:action,p_class_id:classId,p_session_id:id,p_version:version,p_payload:{...payload,host:teacher}})
    if(failure) {
      if(failure.code==='42501') throw new Error('LIVE_ACCESS_REVOKED')
      throw new Error(failure.message||'Could not sync the classroom.')
    }
    if(data===null||typeof data!=='object') throw new Error('Invalid classroom response.')
    return data
  },[classId,teacher])
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
        if(mounted.current&&generation.current===stamp) setRooms(list.filter(item=>teacher?item.own&&(classId?item.mode==='school':hostModeKey.split(',').includes(item.mode)):!item.own))
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
  },[call,accept,teacher,classId,hostModeKey])
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
  useEffect(()=>{if(!teacher||classId||hostMode!=='tuition')return;let cancelled=false;void call('groups').then(data=>{if(!cancelled)setGroups(data as {id:string;title:string}[])}).catch(()=>{if(!cancelled)setGroups([])});return()=>{cancelled=true}},[teacher,classId,hostMode,call])
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search)
    const requested=params.get('mode')
    if(!classId&&teacher&&(requested==='tuition'||requested==='open')&&hostModeKey.split(',').includes(requested))setHostMode(requested)
    const id=params.get('room')
    if(!teacher&&id&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))setSharedId(id)
  },[classId,teacher,hostModeKey])
  useEffect(()=>{setShareLink('')},[room?.id])
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
  function point(event:PointerEvent<SVGSVGElement>){
    const rect=event.currentTarget.getBoundingClientRect()
    return Math.max(0,Math.min(320,Math.round((event.clientX-rect.left)*320/rect.width)))+','+Math.max(0,Math.min(220,Math.round((event.clientY-rect.top)*220/rect.height)))
  }
  function drawStart(event:PointerEvent<SVGSVGElement>){event.currentTarget.setPointerCapture(event.pointerId);drawing.current=true;const xy=point(event);setBoard(value=>value.length>3400?value:value+(value?'|':'')+xy+';')}
  function drawMove(event:PointerEvent<SVGSVGElement>){if(drawing.current){const xy=point(event);setBoard(value=>value.length>3400?value:value+xy+';')}}
  function drawStop(){drawing.current=false}
  const content=mode==='clock'?clock:mode==='board'?board:body
  const participants=room?.participants??[]
  const visibleRooms=rooms.filter(item=>teacher||((scope==='all'||item.mode===scope)&&(!search.trim()||item.title.toLowerCase().includes(search.trim().toLowerCase())))).sort((a,b)=>Number(b.id===sharedId)-Number(a.id===sharedId))
  const prompt=room?.prompt
  return <main className={styles.live}>
    <header className={styles.header}><Link href={back}>Back</Link><h1>Live Classroom</h1>{room&&<span className={styles.status}>{room.status==='active'?'Live':room.status==='paused'?'Paused':'Ended'}</span>}</header>
    {error&&<div role="alert" className={styles.alert}>{error} <button onClick={()=>void refresh()}>Retry</button></div>}
    {loading&&!room&&<p role="status">Connecting…</p>}
    {!room&&!loading&&<section className={styles.panel}>
      {teacher&&<form onSubmit={e=>{e.preventDefault();void act('start',null,{title,mode:hostMode,groupId:classId||hostMode!=='tuition'?null:groupId||null})}}>
        {!classId&&hostModes.length>1&&<div className={styles.controls} aria-label="Classroom type">{hostModes.map(item=><button type="button" key={item} aria-pressed={hostMode===item} onClick={()=>{setHostMode(item);setGroupId('')}}>{classroomLabels[item]}</button>)}</div>}
        {!classId&&hostMode==='tuition'&&<label>Learners<select value={groupId} onChange={e=>setGroupId(e.target.value)}><option value="">All connected learners</option>{groups.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label>}
        {hostMode==='open'&&<small>Discoverable to school-level learners. Joining requires an approved tutor connection.</small>}
        <label>Lesson title<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Grade 4 · Mathematics"/></label>
        <button className={styles.primary} disabled={busy||!title.trim()}>Go Live</button>
      </form>}
      {!teacher&&<div className={styles.controls}>
        <label>Find live lessons<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search lesson title"/></label>
        <label>Audience<select value={scope} onChange={e=>setScope(e.target.value as 'all'|ClassroomMode)}><option value="all">All lessons</option>{Object.entries(classroomLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        {sharedId&&!rooms.some(item=>item.id===sharedId)&&<button disabled={busy} onClick={()=>void act('join',sharedId)}>Join shared lesson</button>}
      </div>}
      {visibleRooms.length>0?<div className={styles.rooms}>{visibleRooms.map(item=>teacher||item.canJoin?<button key={item.id} disabled={busy} onClick={()=>void act(teacher?'get':'join',item.id)}><strong>{item.title}<small>{classroomLabels[item.mode]}</small></strong><span>{teacher?'Resume': 'Join Live'}</span></button>:<div key={item.id} className={styles.discover}><strong>{item.title}<small>Open class</small></strong><Link href="/student/tutoring">Connect to tutor</Link></div>)}</div>:<p>{teacher?'No active session':rooms.length?'No matching lessons':'Waiting for your teacher to go live.'}</p>}
    </section>}
    {room&&<><section className={styles.panel}><h2>{room.title} <small>{classroomLabels[room.mode]}</small></h2>
      {room.status==='ended'?<><p>This session has ended.</p><button onClick={leave}>Return to live lessons</button></>:<>
        {prompt?<><div className={styles.label}>{labels[prompt.kind]}</div>{prompt.kind==='clock'?<ClockView value={prompt.body}/>:prompt.kind==='board'?<BoardView value={prompt.body}/>:<p className={styles.content}>{prompt.body}</p>}
          {prompt.revealed&&prompt.answerKey&&<div className={styles.solution}><strong>Answer</strong><p className={styles.content}>{prompt.answerKey}</p></div>}
        </>:<p>Waiting for lesson content.</p>}
        {!teacher&&prompt&&['quiz','exercise','poll'].includes(prompt.kind)&&<div>
          {room.ownAnswer!==null&&room.ownAnswer!==undefined?<p role="status"><strong>Submitted:</strong> {room.ownAnswer}</p>:prompt.revealed?<p>Responses closed.</p>:<form onSubmit={e=>{e.preventDefault();void act('answer',null,{body:answer,promptId:prompt.id})}}>
          <label>Your answer<textarea maxLength={2000} required value={answerFor===prompt.id?answer:''} onChange={e=>{setAnswerFor(prompt.id);setAnswer(e.target.value)}} disabled={room.status!=='active'}/></label>
          <button className={styles.primary} disabled={busy||room.status!=='active'||!answer.trim()||answerFor!==prompt.id}>Submit</button></form>}
        </div>}
        {!teacher&&<div className={styles.controls}><button disabled={busy||room.needsHelp} onClick={()=>void act('help')}>{room.needsHelp?'Hand raised':'Raise hand'}</button><button disabled={busy} onClick={leave}>Leave</button></div>}
      </>}
    </section>
    {teacher&&room.status!=='ended'&&<>
      <div className={styles.controls}>
        <button type="button" onClick={()=>setShareLink(new URL('/student/live?room='+encodeURIComponent(room.id),window.location.origin).href)}>Share lesson</button>
        {shareLink&&<><label>Lesson link<input readOnly value={shareLink} onFocus={e=>e.target.select()}/></label><a href={'https://wa.me/?text='+encodeURIComponent(shareLink)} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a></>}
      </div>
      <nav className={styles.tabs}><button aria-pressed={tab==='present'} onClick={()=>setTab('present')}>Present</button><button aria-pressed={tab==='learners'} onClick={()=>setTab('learners')}>Learners · {participants.length}</button></nav>
      {tab==='present'&&<section className={styles.panel}><h2>Present</h2>
        <div className={styles.controls}>{modes.map(item=><button key={item} aria-pressed={mode===item} onClick={()=>{setMode(item);setKey('')}}>{labels[item]}</button>)}</div>
        <form onSubmit={e=>{e.preventDefault();void act('publish',null,{kind:mode,body:content,answerKey:mode==='quiz'||mode==='exercise'?key:null})}}>
          {mode==='clock'?<><label>Show time<input type="time" value={clock} onChange={e=>setClock(e.target.value)}/></label><ClockView value={clock}/></>:mode==='board'?<><BoardView value={board} onPointerDown={drawStart} onPointerMove={drawMove} onPointerUp={drawStop}/><button type="button" onClick={()=>setBoard('')}>Clear board</button></>:<label>{mode==='teach'?'Lesson content':'Question or instruction'}<textarea required maxLength={4000} value={body} onChange={e=>setBody(e.target.value)}/></label>}
          {(mode==='quiz'||mode==='exercise')&&<label>Answer (hidden until reveal)<textarea maxLength={2000} value={key} onChange={e=>setKey(e.target.value)}/></label>}
          <button className={styles.primary} disabled={busy||room.status!=='active'||!content.trim()}>Share with class</button>
        </form>
        <div className={styles.controls}>
          <button disabled={busy||!prompt||!['quiz','exercise','poll'].includes(prompt.kind)||prompt.revealed} onClick={()=>void act('reveal')}>Reveal / close answers</button>
          <button disabled={busy} onClick={()=>void act(room.status==='paused'?'resume':'pause')}>{room.status==='paused'?'Resume':'Pause'}</button>
          <button disabled={busy} onClick={()=>void act('end')}>End session</button>
        </div>
      </section>}
      {tab==='learners'&&<section className={styles.panel}><h2>Learners</h2><div className={styles.metrics}><span>{participants.length} joined</span><span>{participants.filter(p=>p.answer!==null).length} answered</span><span>{participants.filter(p=>p.needsHelp).length} need help</span></div>
        {participants.length===0?<p>No learners have joined.</p>:<ul className={styles.participants}>{participants.map(p=><li key={p.studentId}><strong>{p.name}</strong><span>{p.answer??'No answer'}</span>{p.needsHelp&&<button disabled={busy} onClick={()=>void act('ack',null,{studentId:p.studentId})}>Acknowledge hand</button>}</li>)}</ul>}
      </section>}
    </>}
    </>}
  </main>
}
