'use client'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { Maximize, Minimize, Users, PanelTop, Pencil, HelpCircle, ClipboardList, BarChart3, MoreHorizontal, X, Video, Move, GripHorizontal } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import styles from './LiveClassroom.module.css'

type ClassroomMode = 'school' | 'tuition' | 'homeschool' | 'open'
const classroomLabels: Record<ClassroomMode,string>={school:'School',tuition:'Tuition',homeschool:'Homeschool',open:'Open class'}
type Summary = { mode: ClassroomMode; canJoin: boolean; id: string; title: string; status: 'active' | 'paused'; own: boolean }
type Mode = 'teach' | 'quiz' | 'exercise' | 'poll' | 'clock' | 'board'
type Prompt = { id: string; kind: Mode; body: string; answerKey: string | null; revealed: boolean }
type Participant = { studentId: string; name: string; needsHelp: boolean; answer: string | null }
type Room = { mode: ClassroomMode; id: string; title: string; version: number; status: 'active' | 'paused' | 'ended'; teacher: boolean; prompt: Prompt | null; participants?: Participant[]; ownAnswer?: string | null; needsHelp?: boolean }
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
function SharedPrompt({prompt}:{prompt:Prompt|null|undefined}){
 return prompt?<><div className={styles.label}>{labels[prompt.kind]}</div>{prompt.kind==='clock'?<ClockView value={prompt.body}/>:prompt.kind==='board'?<BoardView value={prompt.body}/>:<p className={styles.content}>{prompt.body}</p>}{prompt.revealed&&prompt.answerKey&&<div className={styles.solution}><strong>Answer</strong><p className={styles.content}>{prompt.answerKey}</p></div>}</>:<p className={styles.empty}>Choose a teaching tool to start.</p>
}

// Local preview only: no camera stream is transmitted by the classroom pilot.
function TeacherSticker({prompt,hidden,onHide}:{prompt:Prompt|null|undefined;hidden:boolean;onHide:()=>void}){
 const box=useRef<HTMLDivElement>(null)
 const video=useRef<HTMLVideoElement>(null)
 const stream=useRef<MediaStream|null>(null)
 const request=useRef(0)
 const gesture=useRef<{kind:'move'|'resize';x:number;y:number;left:number;top:number;width:number}|null>(null)
 const [position,setPosition]=useState<{left:number;top:number;width:number}|null>(null)
 const [mini,setMini]=useState(false)
 const [camera,setCamera]=useState(false)
 const [cameraError,setCameraError]=useState('')
 const [pending,setPending]=useState(false)
 const stopCamera=useCallback(()=>{request.current++;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;setCamera(false);setPending(false)},[])
 useEffect(()=>()=>{request.current++;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null},[])
 useEffect(()=>{if(hidden||mini)stopCamera()},[hidden,mini,stopCamera])
 useEffect(()=>{if(camera&&video.current){video.current.srcObject=stream.current}},[camera])
 function clamp(left:number,top:number,width:number){
   const parent=box.current?.parentElement
   if(!parent)return {left,top,width}
   const maxWidth=Math.max(64,Math.min(280,parent.clientWidth-16))
   const w=Math.max(Math.min(112,maxWidth),Math.min(maxWidth,width))
   const h=box.current?.offsetHeight??100
   return {left:Math.max(0,Math.min(parent.clientWidth-(mini?64:w),left)),top:Math.max(0,Math.min(parent.clientHeight-h,top)),width:w}
 }
 useEffect(()=>{
   const parent=box.current?.parentElement
   if(!parent)return
   const resize=()=>setPosition(p=>p?clamp(p.left,p.top,p.width):p)
   const observer=new ResizeObserver(resize);observer.observe(parent)
   return ()=>observer.disconnect()
 // clamp uses current minimized state and parent size.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[hidden,mini])
 async function toggleCamera(){
   if(camera||pending){stopCamera();return}
   if(!navigator.mediaDevices?.getUserMedia){setCameraError('Camera unavailable on this device.');return}
   const id=++request.current;setPending(true);setCameraError('')
   try{
     const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false})
     if(request.current!==id){next.getTracks().forEach(track=>track.stop());return}
     stream.current=next;setCamera(true)
   }catch{if(request.current===id)setCameraError('Camera permission unavailable.')}
   finally{if(request.current===id)setPending(false)}
 }
 function start(event:PointerEvent<HTMLButtonElement>,kind:'move'|'resize'){
   if(!box.current)return
   event.currentTarget.setPointerCapture(event.pointerId)
   gesture.current={kind,x:event.clientX,y:event.clientY,left:box.current.offsetLeft,top:box.current.offsetTop,width:box.current.offsetWidth}
 }
 function move(event:PointerEvent<HTMLButtonElement>){
   const g=gesture.current;if(!g)return
   const dx=event.clientX-g.x,dy=event.clientY-g.y
   setPosition(clamp(g.left+(g.kind==='move'?dx:0),g.top+(g.kind==='move'?dy:0),g.width+(g.kind==='resize'?Math.max(dx,dy):0)))
 }
 function stop(){gesture.current=null}
 if(hidden)return null
 return <div ref={box} className={styles.sticker} data-mini={mini} style={position?{left:position.left,top:position.top,right:'auto',width:mini?64:position.width}:undefined}>
   <div className={styles.stickerHeader}>
     <button type="button" aria-label="Move teacher preview" title="Drag to move" className={styles.drag} onPointerDown={e=>start(e,'move')} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onKeyDown={e=>{const delta:Record<string,[number,number]>={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]};if(delta[e.key]&&box.current){e.preventDefault();const [x,y]=delta[e.key];setPosition(clamp(box.current.offsetLeft+x,box.current.offsetTop+y,box.current.offsetWidth))}}}><Move size={15}/></button>
     <button type="button" aria-label={mini?'Expand preview':'Minimize preview'} onClick={()=>setMini(v=>!v)}>{mini?<Maximize size={14}/>:<Minimize size={14}/>}</button>
     {!mini&&<button type="button" aria-label="Hide preview" onClick={onHide}><X size={14}/></button>}
   </div>
   {!mini&&<><div className={styles.stickerContent}>{camera?<video ref={video} autoPlay muted playsInline aria-label="Local camera self-view"/>:<SharedPrompt prompt={prompt}/>}</div>
   <div className={styles.stickerFooter}><span>{camera?'You · local only':'Learner preview'}</span><button type="button" aria-label={camera?'Stop local camera':'Start local camera preview'} title="Local camera only" aria-pressed={camera} onClick={()=>void toggleCamera()}><Video size={15}/></button></div>
   {pending&&<small role="status">Opening camera…</small>}{cameraError&&<small role="status">{cameraError}</small>}
   <button type="button" className={styles.resize} aria-label="Resize preview" title="Drag to resize" onPointerDown={e=>start(e,'resize')} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onKeyDown={e=>{if(box.current&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setPosition(clamp(box.current.offsetLeft,box.current.offsetTop,box.current.offsetWidth+(['ArrowRight','ArrowDown'].includes(e.key)?12:-12)))}}}><GripHorizontal size={14}/></button></>}
 </div>
}

export default function LiveClassroom({classId,teacher,back,hostModes=['tuition','open']}:{classId:string|null;teacher:boolean;back:string;hostModes?:ClassroomMode[]}) {
  const hostModeKey=hostModes.join(',')
  const [hostMode,setHostMode]=useState<ClassroomMode>(classId?'school':hostModes[0])
  const [groupId,setGroupId]=useState('')
  const [groups,setGroups]=useState<{id:string;title:string}[]>([])
  const [clock,setClock]=useState('10:30')
  const [board,setBoard]=useState('')
  const [panel,setPanel]=useState<'compose'|'learners'|'more'|null>(null)
  const [focusMode,setFocusMode]=useState(false)
  const [editingBoard,setEditingBoard]=useState(false)
  const [showSticker,setShowSticker]=useState(true)
  const [redoLines,setRedoLines]=useState<string[]>([])
  const [endConfirm,setEndConfirm]=useState(false)
  const immersiveRef=useRef<HTMLElement>(null)
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
      if(action==='publish'){setBody('');setKey('');setPanel(null);setEditingBoard(false)}
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
    const svg=event.currentTarget
    const matrix=svg.getScreenCTM()
    if(!matrix)return '0,0'
    const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY
    const xy=p.matrixTransform(matrix.inverse())
    return Math.max(0,Math.min(320,Math.round(xy.x)))+','+Math.max(0,Math.min(220,Math.round(xy.y)))
  }
  function drawStart(event:PointerEvent<SVGSVGElement>){event.currentTarget.setPointerCapture(event.pointerId);drawing.current=true;setRedoLines([]);const xy=point(event);setBoard(value=>value.length>3400?value:value+(value?'|':'')+xy+';')}
  function drawMove(event:PointerEvent<SVGSVGElement>){if(drawing.current){const xy=point(event);setBoard(value=>value.length>3400?value:value+xy+';')}}
  function drawStop(){drawing.current=false}
  const content=mode==='clock'?clock:mode==='board'?board:body
  const participants=room?.participants??[]
  const visibleRooms=rooms.filter(item=>teacher||((scope==='all'||item.mode===scope)&&(!search.trim()||item.title.toLowerCase().includes(search.trim().toLowerCase())))).sort((a,b)=>Number(b.id===sharedId)-Number(a.id===sharedId))
  const prompt=room?.prompt
  const immersive=!!room&&room.status!=='ended'
  useEffect(()=>{
    setPanel(null);setFocusMode(false);setEditingBoard(false);setShowSticker(true);setEndConfirm(false);setBoard('');setRedoLines([]);setBody('');setKey('')
  },[room?.id])
  useEffect(()=>{
    if(!immersive)return
    const previous=document.body.style.overflow
    document.body.style.overflow='hidden'
    immersiveRef.current?.focus()
    return ()=>{document.body.style.overflow=previous}
  },[immersive])
  function chooseMode(item:Mode){
    setMode(item);setKey('');setEndConfirm(false)
    if(item==='board'){
      if(!editingBoard&&prompt?.kind==='board')setBoard(prompt.body)
      setEditingBoard(true);setPanel(null)
    }else{setEditingBoard(false);setPanel('compose')}
  }
  function undoBoard(){
    const lines=board.split('|').filter(Boolean)
    const last=lines.pop()
    if(last){setRedoLines(items=>[...items,last]);setBoard(lines.join('|'))}
  }
  function redoBoard(){
    const last=redoLines[redoLines.length-1]
    if(last&&board.length+last.length+1<=3400){setBoard(value=>[value,last].filter(Boolean).join('|'));setRedoLines(items=>items.slice(0,-1))}
  }
  if(immersive&&room){
    const stage=<main ref={immersiveRef} tabIndex={-1} className={styles.immersive} aria-label="Live classroom" onKeyDown={e=>{if(e.key==='Escape'){if(panel)setPanel(null);else if(focusMode)setFocusMode(false)}if(e.key==='Tab'&&immersiveRef.current){const controls=Array.from(immersiveRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')).filter(el=>el.offsetParent!==null);const first=controls[0],last=controls[controls.length-1];if(first&&last){if(e.shiftKey&&(document.activeElement===first||document.activeElement===immersiveRef.current)){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}}}>
    <header className={styles.liveTop}><button type="button" onClick={leave} disabled={busy} aria-label="Leave classroom"><X size={19}/></button><div className={styles.liveTitle}><strong>{room.title}</strong><small><span className={styles.liveDot} data-paused={room.status==='paused'}/>{room.status==='active'?'LIVE':'PAUSED'} · {classroomLabels[room.mode]}</small></div><button type="button" aria-label={focusMode?'Exit full screen':'Full screen'} aria-pressed={focusMode} onClick={()=>{setPanel(null);setFocusMode(v=>!v)}}>{focusMode?<Minimize size={20}/>:<Maximize size={20}/>}</button></header>
    {error&&<div role="alert" className={styles.liveAlert}>{error} <button onClick={()=>void refresh()}>Retry</button></div>}
    <div className={styles.stage}>
      <section className={styles.stageContent} aria-label={editingBoard&&teacher?'Draft drawing board':'Shared lesson'}>
        {editingBoard&&teacher?<><div className={styles.boardTools}><span>Board draft</span><button onClick={undoBoard} disabled={!board}>Undo</button><button onClick={redoBoard} disabled={!redoLines.length}>Redo</button><button onClick={()=>{setBoard('');setRedoLines([])}}>Clear</button></div><BoardView value={board} onPointerDown={drawStart} onPointerMove={drawMove} onPointerUp={drawStop}/><button className={styles.primary} disabled={busy||room.status!=='active'||!board.trim()} onClick={()=>void act('publish',null,{kind:'board',body:board,answerKey:null})}>Share board</button></>:<SharedPrompt prompt={prompt}/>}
      </section>
      {teacher&&<TeacherSticker prompt={prompt} hidden={!showSticker} onHide={()=>setShowSticker(false)}/>}
      {teacher&&panel&&<section className={styles.sheet} aria-label={panel==='compose'?labels[mode]:panel==='learners'?'Learners':'Classroom tools'}>
        <div className={styles.sheetTitle}><strong>{panel==='compose'?labels[mode]:panel==='learners'?'Learners':'More tools'}</strong><button aria-label="Close tools" onClick={()=>{setPanel(null);setEndConfirm(false)}}><X size={19}/></button></div>
        {panel==='compose'&&<form onSubmit={e=>{e.preventDefault();void act('publish',null,{kind:mode,body:content,answerKey:mode==='quiz'||mode==='exercise'?key:null})}}>
          {mode==='clock'?<><label>Show time<input type="time" value={clock} onChange={e=>setClock(e.target.value)}/></label><ClockView value={clock}/></>:<label>{mode==='teach'?'Lesson content':'Question or instruction'}<textarea required maxLength={4000} value={body} onChange={e=>setBody(e.target.value)}/></label>}
          {(mode==='quiz'||mode==='exercise')&&<label>Answer (hidden until reveal)<textarea maxLength={2000} value={key} onChange={e=>setKey(e.target.value)}/></label>}
          <button className={styles.primary} disabled={busy||room.status!=='active'||!content.trim()}>Share with class</button>
        </form>}
        {panel==='learners'&&<><div className={styles.metrics}><span>{participants.length} joined</span><span>{participants.filter(p=>p.answer!==null).length} answered</span><span>{participants.filter(p=>p.needsHelp).length} need help</span></div>{!participants.length?<p>No learners have joined.</p>:<ul className={styles.participants}>{participants.map(p=><li key={p.studentId}><strong>{p.name}</strong><span>{p.answer??'No answer'}</span>{p.needsHelp&&<button disabled={busy} onClick={()=>void act('ack',null,{studentId:p.studentId})}>Acknowledge hand</button>}</li>)}</ul>}</>}
        {panel==='more'&&<><div className={styles.controls}><button onClick={()=>chooseMode('clock')}>Clock</button><button onClick={()=>setShowSticker(v=>!v)}>{showSticker?'Hide preview':'Show preview'}</button><button disabled={busy||!prompt||!['quiz','exercise','poll'].includes(prompt.kind)||prompt.revealed} onClick={()=>void act('reveal')}>Reveal / close answers</button><button type="button" onClick={()=>setShareLink(new URL('/student/live?room='+encodeURIComponent(room.id),window.location.origin).href)}>Share lesson</button></div>{shareLink&&<><label>Lesson link<input readOnly value={shareLink} onFocus={e=>e.target.select()}/></label><a href={'https://wa.me/?text='+encodeURIComponent(shareLink)} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a></>}{endConfirm?<div className={styles.controls}><strong>End this session?</strong><button disabled={busy} onClick={()=>void act('end')}>Confirm end</button><button onClick={()=>setEndConfirm(false)}>Cancel</button></div>:<button className={styles.danger} disabled={busy} onClick={()=>setEndConfirm(true)}>End session</button>}</>}
      </section>}
    </div>
    {!teacher&&prompt&&['quiz','exercise','poll'].includes(prompt.kind)&&<section className={styles.answerPanel}>{room.ownAnswer!==null&&room.ownAnswer!==undefined?<p role="status"><strong>Submitted:</strong> {room.ownAnswer}</p>:prompt.revealed?<p>Responses closed.</p>:<form onSubmit={e=>{e.preventDefault();void act('answer',null,{body:answer,promptId:prompt.id})}}><label>Your answer<textarea maxLength={2000} required value={answerFor===prompt.id?answer:''} onChange={e=>{setAnswerFor(prompt.id);setAnswer(e.target.value)}} disabled={room.status!=='active'}/></label><button className={styles.primary} disabled={busy||room.status!=='active'||!answer.trim()||answerFor!==prompt.id}>Submit</button></form>}</section>}
    {!focusMode&&<footer className={styles.dock}>{teacher?<><nav aria-label="Teaching tools" className={styles.toolRow}>{([{kind:'board',icon:Pencil},{kind:'teach',icon:PanelTop},{kind:'quiz',icon:HelpCircle},{kind:'exercise',icon:ClipboardList},{kind:'poll',icon:BarChart3}] as const).map(({kind,icon:Icon})=><button key={kind} aria-pressed={kind==='board'?editingBoard:panel==='compose'&&mode===kind} onClick={()=>chooseMode(kind)}><Icon size={18}/><span>{labels[kind]}</span></button>)}<button aria-pressed={panel==='more'} onClick={()=>{setPanel(panel==='more'?null:'more');setEndConfirm(false)}}><MoreHorizontal size={18}/><span>More</span></button></nav><div className={styles.sessionRow}><button aria-pressed={panel==='learners'} onClick={()=>setPanel(panel==='learners'?null:'learners')}><Users size={18}/> Learners · {participants.length}</button><button disabled={busy} onClick={()=>void act(room.status==='paused'?'resume':'pause')}>{room.status==='paused'?'Resume':'Pause'}</button><button className={styles.danger} onClick={()=>{setPanel('more');setEndConfirm(true)}}>End</button></div></>:<div className={styles.sessionRow}><button disabled={busy||room.needsHelp} onClick={()=>void act('help')}>{room.needsHelp?'Hand raised':'Raise hand'}</button><button disabled={busy} onClick={leave}>Leave</button></div>}</footer>}
    </main>
    return createPortal(stage,document.body)
  }
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
    {room?.status==='ended'&&<section className={styles.panel}><h2>{room.title}</h2><p>This session has ended.</p><button onClick={leave}>Return to live lessons</button></section>}
  </main>
}
