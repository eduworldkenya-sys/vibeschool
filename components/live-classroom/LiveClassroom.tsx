'use client'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { Maximize, Minimize, Users, PanelTop, Pencil, HelpCircle, ClipboardList, BarChart3, MoreHorizontal, X, Video, Move, GripHorizontal, Hand, MessageSquare, NotebookPen, History, Wifi, WifiOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import styles from './LiveClassroom.module.css'
import { SlideCanvas, encodeSlide, decodeSlide, validSlide, diagramLabel, SLIDE_DIAGRAMS, SLIDE_THEMES, type LiveSlide, type SlideDiagram, type SlideTheme } from './LiveSlideCanvas'
import { ObjectBoard, SharedObjectBoard } from './LiveObjectBoard'
import { TeachingLibrary } from './LiveTeachingLibrary'
import { BOARD_LIMIT, decodeBoard, encodeBoard } from './LiveBoardProtocol'

type ClassroomMode = 'school' | 'tuition' | 'homeschool' | 'open'
const classroomLabels: Record<ClassroomMode,string>={school:'School',tuition:'Tuition',homeschool:'Homeschool',open:'Open class'}
type Summary = { mode: ClassroomMode; canJoin: boolean; id: string; title: string; status: 'active' | 'paused'; own: boolean }
type Mode = 'teach' | 'quiz' | 'exercise' | 'poll' | 'clock' | 'board'
type Prompt = { id: string; kind: Mode; body: string; answerKey: string | null; revealed: boolean }
type HistoryPrompt = Prompt & { position: number; createdAt: string }
type Participant = { studentId: string; name: string; needsHelp: boolean; answer: string | null }
type LiveQuestion = {id:string;body:string;reply:string|null;name?:string}
type Room = { mode: ClassroomMode; id: string; title: string; version: number; status: 'active' | 'paused' | 'ended'; teacher: boolean; prompt: Prompt | null; history?: HistoryPrompt[]; handAckAt?: string|null; ownNote?:string; questions?:LiveQuestion[]; participants?: Participant[]; ownAnswer?: string | null; needsHelp?: boolean }
type ComposerDraft = { body: string; key: string }
type DraftState = { serverRevision?:number; board: string; boardPages?: string[]; boardPage?: number; slides: LiveSlide[]; slideIndex: number; mode: Mode; body: string; key: string; clock: string; composers: Partial<Record<Mode,ComposerDraft>> }
const validModes = ['teach','quiz','exercise','poll','clock','board'] as const
function roomUrl(id: string | null) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('resumeRoom',id)
  else url.searchParams.delete('resumeRoom')
  window.history.replaceState(window.history.state,'',url)
}
function recoverRoomId() {
  const id = new URL(window.location.href).searchParams.get('resumeRoom')
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null
}
function validateDraft(raw:unknown): DraftState | null {
  try {
    const d = raw as DraftState
    if (!d || typeof d.board !== 'string' || d.board.length > BOARD_LIMIT || !Array.isArray(d.slides) || !d.slides.length || d.slides.length > 30 || !d.slides.every(validSlide) || !Number.isInteger(d.slideIndex) || d.slideIndex < 0 || d.slideIndex >= d.slides.length || !validModes.includes(d.mode) || typeof d.body !== 'string' || d.body.length > 4000 || typeof d.key !== 'string' || d.key.length > 2000 || typeof d.clock !== 'string' || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(d.clock)) return null
    const clean: Partial<Record<Mode,ComposerDraft>> = {}
    for (const m of validModes) {
      const item = d.composers?.[m]
      if (item && typeof item.body === 'string' && item.body.length <= 4000 && typeof item.key === 'string' && item.key.length <= 2000) clean[m] = item
    }
    return {...d,composers:clean}
  } catch { return null }
}
function stableDraftFingerprint(value:unknown):string{
 return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().filter(k=>k!=='serverRevision').map(k=>[k,item[k]])):item)
}
function readDraft(key:string):DraftState|null{try{const raw=sessionStorage.getItem(key);return raw?validateDraft(JSON.parse(raw)):null}catch{return null}}
function removeDraft(key: string | null) { if(key) try { sessionStorage.removeItem(key) } catch {} }
function historyFor(room: Room): Prompt[] {
  return room.history ?? (room.prompt ? [room.prompt] : [])
}
const labels: Record<Mode,string> = {teach:'Teach',quiz:'Quiz',exercise:'Exercise',poll:'Poll',clock:'Clock',board:'Board'}

function BoardView({value}:{value:string}){
 if(decodeBoard(value))return <SharedObjectBoard value={value}/>
 const lines=value.split('|').slice(0,100).map(line=>line.split(';').filter(point=>/^\d{1,3},\d{1,3}$/.test(point)).slice(0,500).join(' ')).filter(Boolean)
 return <svg className={styles.board} viewBox="0 0 320 220" role="img" aria-label="Shared drawing board">
  {lines.map((line,i)=>line.includes(' ')?<polyline key={i} points={line} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>:<circle key={i} cx={line.split(',')[0]} cy={line.split(',')[1]} r="1.25" fill="currentColor"/>)}
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
function LessonNavigation({items,reviewId,onReview,ended=false}:{items:Prompt[];reviewId:string|null;onReview:(id:string|null)=>void;ended?:boolean}) {
  if (!items.length) return null
  const selected = reviewId ? items.findIndex(p=>p.id===reviewId) : items.length-1
  const index = selected < 0 ? items.length-1 : selected
  return <nav className={styles.lessonHistory} aria-label="Lesson progress">
    <button type="button" disabled={index===0} onClick={()=>onReview(items[0].id)} aria-label="First lesson page">First</button>
    <button type="button" disabled={index===0} onClick={()=>onReview(items[index-1].id)} aria-label="Previous lesson page">‹</button>
    <span aria-live="polite">{index+1} / {items.length}</span>
    <button type="button" disabled={index===items.length-1} onClick={()=>onReview(items[index+1].id)} aria-label="Next lesson page">›</button>
    <button type="button" disabled={reviewId===null} onClick={()=>onReview(null)}>{ended?'Latest':'Return to Live'}</button>
  </nav>
}
function SharedPrompt({prompt}:{prompt:Prompt|null|undefined}){
 const slide=prompt?.kind==='teach'?decodeSlide(prompt.body):null
 if(slide)return <SlideCanvas slide={slide} number={slide.number} total={slide.total}/>
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
 const [mini,setMini]=useState(true)
 const [camera,setCamera]=useState(false)
 const [cameraError,setCameraError]=useState('')
 const [pending,setPending]=useState(false)
 const stopCamera=useCallback(()=>{request.current++;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;setCamera(false);setPending(false)},[])
 useEffect(()=>()=>{request.current++;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null},[])
 useEffect(()=>{if(hidden||mini)stopCamera()},[hidden,mini,stopCamera])
 useEffect(()=>{if(camera&&video.current){video.current.srcObject=stream.current}},[camera])
 const clamp=useCallback((left:number,top:number,width:number)=>{
   const parent=box.current?.parentElement
   if(!parent)return {left,top,width}
   const maxWidth=Math.max(64,Math.min(280,parent.clientWidth-16))
   const w=Math.max(Math.min(112,maxWidth),Math.min(maxWidth,width))
   const h=box.current?.offsetHeight??100
   return {left:Math.max(0,Math.min(parent.clientWidth-(mini?64:w),left)),top:Math.max(0,Math.min(parent.clientHeight-h,top)),width:w}
 },[mini])
 useEffect(()=>{
   const parent=box.current?.parentElement
   if(!parent)return
   const resize=()=>setPosition(p=>p?clamp(p.left,p.top,p.width):p)
   resize()
   if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',resize);return ()=>window.removeEventListener('resize',resize)}
   const observer=new ResizeObserver(resize);observer.observe(parent)
   return ()=>observer.disconnect()
 },[hidden,clamp])
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
 function stop(){
   const kind=gesture.current?.kind;gesture.current=null
   if(kind!=='move'||!box.current)return
   const element=box.current,parent=element.parentElement
   if(!parent)return
   const left=element.offsetLeft+element.offsetWidth/2<parent.clientWidth/2?8:parent.clientWidth-element.offsetWidth-8
   const top=element.offsetTop+element.offsetHeight/2<parent.clientHeight/2?8:parent.clientHeight-element.offsetHeight-8
   setPosition(clamp(left,top,position?.width??element.offsetWidth))
 }
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
  const [boardPages,setBoardPages]=useState<string[]>([''])
  const [boardPage,setBoardPage]=useState(0)
  const [panel,setPanel]=useState<'compose'|'learners'|'more'|'slides'|'library'|null>(null)
  const [slides,setSlides]=useState<LiveSlide[]>([{title:'',body:''}])
  const [slideIndex,setSlideIndex]=useState(0)
  const [deletedSlide,setDeletedSlide]=useState<{slide:LiveSlide;index:number}|null>(null)
  const [beforeLibrary,setBeforeLibrary]=useState(false)
  const preparedDeck=useRef<{title:string;slides:LiveSlide[]}|null>(null)
  const [preparedTitle,setPreparedTitle]=useState('')
  const [workspaceRevision,setWorkspaceRevision]=useState<number|null>(null)
  const [workspaceStatus,setWorkspaceStatus]=useState('')
  const [workspaceRetry,setWorkspaceRetry]=useState(0)
  const workspaceSaved=useRef('')
  const workspaceSaving=useRef<string|null>(null)
  const [conflictDraft,setConflictDraft]=useState<DraftState|null>(null)
  const [focusMode,setFocusMode]=useState(false)
  const [editingBoard,setEditingBoard]=useState(false)
  const [showSticker,setShowSticker]=useState(true)
  const [undoBoards,setUndoBoards]=useState<string[]>([])
  const [redoBoards,setRedoBoards]=useState<string[]>([])
  const [focusDock,setFocusDock]=useState(false)
  const [endConfirm,setEndConfirm]=useState(false)
  const immersiveRef=useRef<HTMLElement>(null)
  const boardInitialized=useRef(false)
  const boardUndoByPage=useRef<Record<number,{undo:string[];redo:string[]}>>({})
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
  const [reviewId,setReviewId]=useState<string|null>(null)
  const [learnerTool,setLearnerTool]=useState<'ask'|'notes'|null>(null)
  const [questionDraft,setQuestionDraft]=useState('')
  const questionRequest=useRef<{body:string;id:string}|null>(null)
  const [noteDraft,setNoteDraft]=useState('')
  const noteDirty=useRef(false)
  const [replyDrafts,setReplyDrafts]=useState<Record<string,string>>({})
  const [online,setOnline]=useState(true)
  const [lastSync,setLastSync]=useState(0)
  useEffect(()=>{
    const status=()=>setOnline(navigator.onLine)
    status();window.addEventListener('online',status);window.addEventListener('offline',status)
    return ()=>{window.removeEventListener('online',status);window.removeEventListener('offline',status)}
  },[])
  useEffect(()=>{
    setLearnerTool(null);setQuestionDraft('');questionRequest.current=null;setNoteDraft(active.current?.ownNote??'');noteDirty.current=false;setReplyDrafts({})
  },[room?.id])
  useEffect(()=>{if(!noteDirty.current)setNoteDraft(room?.ownNote??'')},[room?.id,room?.ownNote])
  const [draftBinding,setDraftBinding]=useState<{roomId:string; key:string}|null>(null)
  const draftKey=useRef<string|null>(null)
  const composerDrafts=useRef<Partial<Record<Mode,ComposerDraft>>>({})
  const pendingPublish=useRef<{fingerprint:string;requestId:string}|null>(null)
  const [draftWarning,setDraftWarning]=useState(false)
  const revoke=useCallback(()=>{
    removeDraft(draftKey.current);draftKey.current=null;setDraftBinding(null);setBeforeLibrary(false);preparedDeck.current=null;setPreparedTitle('');setConflictDraft(null)
    pendingPublish.current=null;composerDrafts.current={}
    roomUrl(null);active.current=null;setRoom(null);setRooms([]);setReviewId(null)
    setError('Classroom access is no longer available.')
  },[])
  useEffect(()=>{
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
      if(event==='SIGNED_OUT'){generation.current++;lock.current=false;mutating.current=false;setBusy(false);setLoading(false);revoke()}
    })
    return ()=>subscription.unsubscribe()
  },[revoke])
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
    const old=active.current
    if(old?.id===next.id){
      if(next.version<old.version)return
      if(old.prompt&&!next.prompt)throw new Error('Incomplete lesson sync. Retrying.')
      if(old.history && (!next.history || old.history.some(p=>!next.history!.some(q=>q.id===p.id)))) throw new Error('Incomplete lesson history. Retrying.')
    }
    active.current=next
    setRoom(next)
    setLastSync(Date.now())
    roomUrl(next.id)
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
        const resumeId=recoverRoomId()
        if(resumeId){
          const next=await call('get',resumeId) as Room
          if(mounted.current&&generation.current===stamp){accept(next);setError('')}
          return
        }
        const list=await call('list') as Summary[]
        if(mounted.current&&generation.current===stamp) setRooms(list.filter(item=>teacher?item.own&&(classId?item.mode==='school':hostModeKey.split(',').includes(item.mode)):!item.own))
      }
      if(mounted.current&&generation.current===stamp) setError('')
    } catch(e) {
      if(mounted.current&&generation.current===stamp) {
        if(e instanceof Error&&e.message==='LIVE_ACCESS_REVOKED'){revoke()}
        else setError(e instanceof Error?e.message:'Connection interrupted. Retrying.')
      }
    } finally {
      if(generation.current===stamp) {lock.current=false;if(mounted.current)setLoading(false)}
    }
  },[call,accept,teacher,classId,hostModeKey,revoke])
  useEffect(()=>{
    mounted.current=true
    generation.current++
    lock.current=false
    mutating.current=false
    active.current=null
    setRoom(null); setRooms([]); setLoading(true);setBusy(false);setError('')
    void refresh()
    const timer=window.setInterval(()=>void refresh(),4000)
    const wake=()=>{if(document.visibilityState!=='hidden')void refresh()}
    window.addEventListener('online',wake)
    document.addEventListener('visibilitychange',wake)
    return ()=>{mounted.current=false;generation.current++;window.clearInterval(timer);window.removeEventListener('online',wake);document.removeEventListener('visibilitychange',wake)}
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
      let requestPayload=payload
      if(action==='publish'){
        const fingerprint=JSON.stringify([room?.id,payload.kind,payload.body,payload.answerKey??null])
        if(pendingPublish.current?.fingerprint!==fingerprint)pendingPublish.current={fingerprint,requestId:crypto.randomUUID()}
        requestPayload={...payload,requestId:pendingPublish.current.requestId}
      }
      const next=await call(action,id??room?.id??null,active.current?.version??null,requestPayload) as Room
      if(!mounted.current||generation.current!==stamp)return
      accept(next)
      if(action==='publish'){
        pendingPublish.current=null;setReviewId(null)
        if(panel==='compose'){delete composerDrafts.current[mode];setBody('');setKey('')}
        const presented=next.prompt?.kind==='teach'?decodeSlide(next.prompt.body):null
        if(presented&&presented.total===slides.length)setSlideIndex(presented.number-1)
        setPanel(null);if(payload.kind!=='board')setEditingBoard(false)
      }
      if(action==='ask'){questionRequest.current=null;setQuestionDraft('')}
      if(action==='note'){noteDirty.current=false;setNoteDraft(next.ownNote??'')}
      if(action==='reply'&&typeof payload.questionId==='string'){const questionId=payload.questionId;setReplyDrafts(items=>({...items,[questionId]:''}))}
      if(action==='end'){removeDraft(draftKey.current);draftKey.current=null;setDraftBinding(null)}
    } catch(e) {
      if(mounted.current&&generation.current===stamp){
        if(e instanceof Error&&e.message==='LIVE_ACCESS_REVOKED'){revoke()}
        else setError(e instanceof Error?e.message:'Could not save. Retry.')
      }
    } finally {
      if(generation.current===stamp){mutating.current=false;lock.current=false;if(mounted.current){setBusy(false);setLoading(false)}}
    }
  }
  function leave() {
    if(mutating.current)return
    generation.current++;lock.current=false;roomUrl(null);active.current=null;setRoom(null);setReviewId(null);setError('');setLoading(true);void refresh()
  }
  function rememberBoard(){setUndoBoards(history=>[...history.slice(-29),board]);setRedoBoards([])}
  function changeBoard(value:string){if(value!==board){rememberBoard();setBoard(value)}}
  const content=mode==='clock'?clock:mode==='board'?board:body
  const participants=room?.participants??[]
  const visibleRooms=rooms.filter(item=>teacher||((scope==='all'||item.mode===scope)&&(!search.trim()||item.title.toLowerCase().includes(search.trim().toLowerCase())))).sort((a,b)=>Number(b.id===sharedId)-Number(a.id===sharedId))
  const prompt=room?.prompt
  const history=room?historyFor(room):[]
  const viewedPrompt=(reviewId?history.find(p=>p.id===reviewId):null)??prompt
  const immersive=!!room&&room.status!=='ended'
  const draftLoading=teacher&&!!room&&draftBinding?.roomId!==room.id&&!draftWarning
  useEffect(()=>{
    setReviewId(null);setDraftBinding(null);draftKey.current=null;setWorkspaceRevision(null);setWorkspaceStatus('');workspaceSaved.current='';workspaceSaving.current=null;setConflictDraft(null);composerDrafts.current={};pendingPublish.current=null;setDraftWarning(false);setMode('teach');setClock('10:30');boardInitialized.current=false;setBoardPages(['']);setBoardPage(0);setPanel(null);setFocusMode(false);setEditingBoard(false);setShowSticker(true);setEndConfirm(false);setBoard('');setUndoBoards([]);setRedoBoards([]);boardUndoByPage.current={};setFocusDock(false);setSlides([{title:'',body:''}]);setSlideIndex(0);setDeletedSlide(null);setBody('');setKey('')
  },[room?.id])
  function restoreDraft(draft:DraftState){
    setBoard(draft.board)
    if(Array.isArray(draft.boardPages)&&draft.boardPages.length>0&&draft.boardPages.length<=30&&draft.boardPages.every(p=>typeof p==='string'&&p.length<=BOARD_LIMIT)&&Number.isInteger(draft.boardPage)&&draft.boardPage!>=0&&draft.boardPage!<draft.boardPages.length){setBoardPages(draft.boardPages);setBoardPage(draft.boardPage!)}
    boardInitialized.current=true;setSlides(draft.slides);setSlideIndex(draft.slideIndex);setClock(draft.clock)
    setMode(draft.mode);setBody(draft.body);setKey('');composerDrafts.current=draft.composers
  }
  // Private draft recovery is owner-scoped server state plus a same-device
  // recovery copy. Published history remains authoritative and independent.
  useEffect(()=>{
    if(!teacher||!room?.id||room.status==='ended')return
    const roomId=room.id
    let cancelled=false
    void supabase.auth.getUser().then(async({data,error})=>{
      if(cancelled)return
      if(error||!data.user){setDraftWarning(true);return}
      const key='vibe-live-draft:v1:'+data.user.id+':'+roomId
      draftKey.current=key
      const local=readDraft(key)
      let draft=local
      let revision:number|null=null
      try{
        const remote=await call('workspace_get',roomId) as {revision:number;draft:unknown}
        if(cancelled||draftKey.current!==key)return
        if(!Number.isInteger(remote.revision)||remote.revision<0)throw Error('Invalid workspace response')
        const server=validateDraft(remote.draft)
        if(remote.revision>0&&!server)throw Error('Invalid saved workspace')
        revision=remote.revision
        if(server){
          workspaceSaved.current=stableDraftFingerprint(server)
          if(local&&local.serverRevision!==remote.revision&&stableDraftFingerprint(local)!==workspaceSaved.current){setConflictDraft(local);draft=server}
          else draft=local??server
        }
        setWorkspaceStatus(revision>0?'Draft restored from server':'Draft ready to save')
      }catch(e){if(cancelled)return;if(e instanceof Error&&e.message==='LIVE_ACCESS_REVOKED'){revoke();return}setWorkspaceStatus('Local recovery only · server draft unavailable')}
      if(cancelled||draftKey.current!==key)return
      setWorkspaceRevision(revision)
      if(draft){restoreDraft(draft)}
      else if(preparedDeck.current){setSlides(preparedDeck.current.slides);setSlideIndex(0)}
      else{
        const latest=active.current
        const published=latest?historyFor(latest):[]
        const latestBoard=[...published].reverse().find(p=>p.kind==='board')
        if(latestBoard){
          const doc=decodeBoard(latestBoard.body)
          if(doc){
            const pages=Array<string>(doc.total).fill('')
            for(const item of published){const b=item.kind==='board'?decodeBoard(item.body):null;if(b&&b.page<=pages.length)pages[b.page-1]=item.body}
            setBoardPages(pages);setBoardPage(doc.page-1);setBoard(latestBoard.body)
          }else setBoard(latestBoard.body)
          boardInitialized.current=true
        }
        const latestSlide=[...published].reverse().map(p=>p.kind==='teach'?decodeSlide(p.body):null).find(x=>x!==null)
        if(latestSlide){
          const deck=Array.from({length:latestSlide.total},()=>({title:'',body:''} as LiveSlide))
          for(const item of published){const sl=item.kind==='teach'?decodeSlide(item.body):null;if(sl&&sl.total===deck.length)deck[sl.number-1]={title:sl.title,body:sl.body,diagram:sl.diagram,theme:sl.theme,layout:sl.layout,font:sl.font}}
          setSlides(deck);setSlideIndex(latestSlide.number-1)
        }
      }
      preparedDeck.current=null;setPreparedTitle('');setBeforeLibrary(false);setDraftBinding({roomId,key})
    }).catch(()=>{if(!cancelled)setDraftWarning(true)})
    return ()=>{cancelled=true}
  },[teacher,room?.id,room?.status==='ended',call,workspaceRetry,revoke])
  useEffect(()=>{
    if(!teacher||!room||room.status==='ended'||draftBinding?.roomId!==room.id||draftKey.current!==draftBinding.key)return
    const binding=draftBinding
    const draft:DraftState={board,boardPages:boardPages.map((p,i)=>i===boardPage?board:p),boardPage,slides,slideIndex,mode,body,key:'',clock,composers:Object.fromEntries(Object.entries(composerDrafts.current).map(([m,d])=>[m,{...d,key:''}]))}
    const fingerprint=stableDraftFingerprint(draft)
    if(conflictDraft)return
    try {sessionStorage.setItem(binding.key,JSON.stringify({...draft,serverRevision:workspaceRevision??undefined}))}catch{setDraftWarning(true)}
    if(workspaceRevision===null||!online||fingerprint===workspaceSaved.current)return
    const timer=window.setTimeout(()=>{
      if(workspaceSaving.current!==null||draftKey.current!==binding.key)return
      workspaceSaving.current=binding.key;setWorkspaceStatus('Saving draft…')
      void call('workspace_save',binding.roomId,null,{revision:workspaceRevision,draft}).then(result=>{
        if(draftKey.current!==binding.key)return
        const next=result as {revision:number}
        if(!Number.isInteger(next.revision)||next.revision!==workspaceRevision+1)throw Error('Invalid draft save response')
        workspaceSaved.current=fingerprint;setWorkspaceRevision(next.revision);setWorkspaceStatus('Draft saved')
      }).catch(e=>{
        if(draftKey.current!==binding.key)return
        if(e instanceof Error&&e.message==='LIVE_ACCESS_REVOKED'){revoke();return}
        setWorkspaceRevision(null);setWorkspaceStatus(e instanceof Error&&e.message.includes('conflict')?'Draft conflict · reload saved version':'Draft saved locally · server save needs retry')
      }).finally(()=>{if(workspaceSaving.current===binding.key)workspaceSaving.current=null})
    },650)
    return ()=>window.clearTimeout(timer)
  },[teacher,room?.id,room?.status,draftBinding,board,boardPages,boardPage,slides,slideIndex,mode,body,clock,workspaceRevision,online,call,conflictDraft,revoke])
  useEffect(()=>{
    if(room?.status==='ended'){removeDraft(draftKey.current);draftKey.current=null;setDraftBinding(null)}
  },[room?.status])
  useEffect(()=>{
    if(!immersive)return
    const previous=document.body.style.overflow
    const previousFocus=document.activeElement
    const element=immersiveRef.current
    document.body.style.overflow='hidden'
    element?.focus()
    const syncFullscreen=()=>{if(document.fullscreenElement!==element)setFocusMode(false)}
    document.addEventListener('fullscreenchange',syncFullscreen)
    return ()=>{document.body.style.overflow=previous;document.removeEventListener('fullscreenchange',syncFullscreen);if(previousFocus instanceof HTMLElement&&previousFocus.isConnected)previousFocus.focus()}
  },[immersive])
  function toggleFocus(){
    setPanel(null)
    if(focusMode){
      setFocusMode(false)
      if(document.fullscreenElement===immersiveRef.current&&document.exitFullscreen)void document.exitFullscreen().catch(()=>{/* viewport mode remains usable */})
    }else{
      setFocusMode(true);setFocusDock(false)
      if(immersiveRef.current?.requestFullscreen)void immersiveRef.current.requestFullscreen().catch(()=>{/* use viewport focus mode when native fullscreen is unavailable */})
    }
  }
  function chooseMode(item:Mode){
    if(item!==mode){
      composerDrafts.current[mode]={body,key}
      const saved=composerDrafts.current[item]
      setBody(saved?.body??'');setKey(saved?.key??'');setMode(item)
    }
    setReviewId(null);setEndConfirm(false)
    if(item==='board'){
      if(!boardInitialized.current){const last=[...history].reverse().find(p=>p.kind==='board');if(last)setBoard(last.body);boardInitialized.current=true}
      setEditingBoard(true);setPanel(null)
    }else{setEditingBoard(false);setPanel('compose')}
  }
  function switchBoardPage(index:number,add=false){
    if(busy)return
    const pages=boardPages.map((value,i)=>i===boardPage?board:value)
    if(add){if(pages.length>=30)return;pages.push('')}
    if(index<0||index>=pages.length)return
    boardUndoByPage.current[boardPage]={undo:undoBoards,redo:redoBoards}
    setBoardPages(pages);setBoardPage(index);setBoard(pages[index])
    setUndoBoards(boardUndoByPage.current[index]?.undo??[]);setRedoBoards(boardUndoByPage.current[index]?.redo??[])
  }
  function publishBoard(){
    const data=decodeBoard(board)
    const shared=data?encodeBoard({...data,page:boardPage+1,total:boardPages.length}):board
    if(!shared||!online||busy||room?.status!=='active')return
    void act('publish',null,{kind:'board',body:shared,answerKey:null})
  }
  function undoBoard(){
    if(undoBoards.length){setRedoBoards(items=>[...items.slice(-29),board]);setBoard(undoBoards[undoBoards.length-1]);setUndoBoards(items=>items.slice(0,-1))}
  }
  function redoBoard(){
    if(redoBoards.length){setUndoBoards(items=>[...items.slice(-29),board]);setBoard(redoBoards[redoBoards.length-1]);setRedoBoards(items=>items.slice(0,-1))}
  }
  const slide=slides[slideIndex]
  const liveSlide=prompt?.kind==='teach'?decodeSlide(prompt.body):null
  const slideText=slide?encodeSlide(slide,slideIndex+1,slides.length):''
  function editSlide(patch:Partial<LiveSlide>){setSlides(items=>items.map((item,i)=>i===slideIndex?{...item,...patch}:item))}
  function presentSlide(index:number){
    const item=slides[index];if(!item||busy||!online||room?.status!=='active')return
    const slideText=encodeSlide(item,index+1,slides.length)
    if(slideText)void act('publish',null,{kind:'teach',body:slideText,answerKey:null})
  }
  function moveSlide(delta:number){
    const to=slideIndex+delta;if(to<0||to>=slides.length)return
    setSlides(items=>{const next=[...items];[next[slideIndex],next[to]]=[next[to],next[slideIndex]];return next})
    setSlideIndex(to)
  }
  function addSlide(duplicate=false){
    if(slides.length>=30)return
    const item=duplicate&&slide?{...slide}:{title:'',body:''}
    setSlides(items=>[...items.slice(0,slideIndex+1),item,...items.slice(slideIndex+1)]);setSlideIndex(slideIndex+1)
  }
  function deleteSlide(){
    if(!slide||slides.length<=1)return
    setDeletedSlide({slide,index:slideIndex});setSlides(items=>items.filter((_,i)=>i!==slideIndex));setSlideIndex(Math.max(0,slideIndex-1))
  }
  function undoSlideDelete(){
    if(!deletedSlide||slides.length>=30)return
    const index=Math.min(deletedSlide.index,slides.length)
    setSlides(items=>[...items.slice(0,index),deletedSlide.slide,...items.slice(index)]);setSlideIndex(index);setDeletedSlide(null)
  }
  function askTeacher(){
    const body=questionDraft.trim();if(!body||busy)return
    if(questionRequest.current?.body!==body)questionRequest.current={body,id:crypto.randomUUID()}
    void act('ask',null,{body,requestId:questionRequest.current.id})
  }
  function openSlides(){setReviewId(null);setEditingBoard(false);setEndConfirm(false);setPanel('slides')}
  function useMaterial(material:{title:string;slides:LiveSlide[]}){
    if(room&&room.status!=='ended'){if(!window.confirm('Replace the current draft deck? Shared lesson history remains.'))return;setSlides(material.slides);setSlideIndex(0);setDeletedSlide(null);openSlides()}
    else {preparedDeck.current={title:material.title,slides:material.slides};setPreparedTitle(material.title);setTitle(material.title);setBeforeLibrary(false)}
  }

  if(immersive&&room){
    const stage=<main ref={immersiveRef} tabIndex={-1} className={styles.immersive} role="dialog" aria-modal="true" aria-label="Live classroom" onKeyDown={e=>{if(e.key==='Escape'){if(panel)setPanel(null);else if(focusMode)toggleFocus()}if(e.key==='Tab'&&immersiveRef.current){const controls=Array.from(immersiveRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')).filter(el=>el.offsetParent!==null);const first=controls[0],last=controls[controls.length-1];if(first&&last){if(e.shiftKey&&(document.activeElement===first||document.activeElement===immersiveRef.current)){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}}}>
    <header className={styles.liveTop}><button type="button" onClick={leave} disabled={busy} aria-label="Leave classroom"><X size={19}/></button><div className={styles.liveTitle}><strong>{room.title}</strong><small><span className={styles.liveDot} data-paused={room.status==='paused'}/>{!online||error?<WifiOff size={13} aria-hidden="true"/>:<Wifi size={13} aria-hidden="true"/>}{room.status==='active'?'LIVE':'PAUSED'} · {classroomLabels[room.mode]} · {!online?'Offline':error?'Reconnecting':lastSync?'Connected':'Syncing'}</small></div><button type="button" aria-label={focusMode?'Exit full screen':'Full screen'} aria-pressed={focusMode} onClick={toggleFocus}>{focusMode?<Minimize size={20}/>:<Maximize size={20}/>}</button>{focusMode&&<button type="button" aria-label={focusDock?'Hide classroom controls':'Show classroom controls'} aria-pressed={focusDock} onClick={()=>setFocusDock(v=>!v)}><MoreHorizontal size={20}/></button>}</header>
    {error&&<div role="alert" className={styles.liveAlert}>{error} <button onClick={()=>void refresh()}>Retry</button></div>}
    {draftWarning&&teacher&&<div role="status" className={styles.liveAlert}>Local recovery unavailable. Shared pages are saved on the server.</div>}
    {teacher&&workspaceStatus&&<div className={styles.workspaceStatus} role="status">{workspaceStatus}{workspaceRevision===null&&draftBinding&&<button type="button" onClick={()=>{setDraftBinding(null);setWorkspaceRetry(n=>n+1)}}>Retry draft sync</button>}{conflictDraft&&<><button type="button" onClick={()=>{restoreDraft(conflictDraft);setConflictDraft(null)}}>Restore local copy</button><button type="button" onClick={()=>setConflictDraft(null)}>Keep server copy</button></>}</div>}
    <LessonNavigation items={history} reviewId={reviewId} onReview={id=>{setEditingBoard(false);setPanel(null);setReviewId(id)}}/>
    {teacher&&participants.some(p=>p.needsHelp)&&<button className={styles.helpBanner} type="button" onClick={()=>setPanel('learners')}><Hand size={16}/> {participants.filter(p=>p.needsHelp).length} need help</button>}
    {!teacher&&(room.needsHelp||room.handAckAt)&&<div className={styles.handStatus} role="status">{room.needsHelp?'Hand raised — teacher notified':'Teacher acknowledged your hand'}</div>}
    <div className={styles.stage}>
      <section className={styles.stageContent} data-board-edit={editingBoard&&teacher} aria-label={editingBoard&&teacher?'Draft drawing board':'Shared lesson'}>
        {teacher&&panel==='library'?<div className={styles.slideWorkspace}><div className={styles.slideToolbar}><strong>My Presentations</strong><button onClick={openSlides}>Back to slides</button></div><TeachingLibrary command={call} currentDeck={slides} onUse={useMaterial}/></div>:teacher&&panel==='slides'&&slide?<div className={styles.slideWorkspace}>
          <div className={styles.slideToolbar}><strong>Slide editor</strong><span>{slideIndex+1} / {slides.length}</span><button type="button" onClick={()=>setPanel('library')}>My presentations</button><button type="button" onClick={()=>setPanel(null)}>Close</button></div>
          <SlideCanvas slide={slide} number={slideIndex+1} total={slides.length}/>
          <div className={styles.slideStrip} aria-label="Slide thumbnails">{slides.map((item,i)=><button type="button" key={i} aria-label={'Slide '+(i+1)+(item.title.trim()?': '+item.title:'')} aria-pressed={i===slideIndex} disabled={busy} onClick={()=>setSlideIndex(i)}><SlideCanvas slide={item} number={i+1} total={slides.length} mini/></button>)}<button type="button" aria-label="Add slide" disabled={slides.length>=30||busy} onClick={()=>addSlide()}>+ Add</button></div>
          <div className={styles.slideToolbar}><button type="button" disabled={busy||slideIndex===0} onClick={()=>setSlideIndex(i=>i-1)}>Previous</button><button type="button" disabled={busy||slideIndex===slides.length-1} onClick={()=>setSlideIndex(i=>i+1)}>Next</button><button className={styles.primary} disabled={busy||!online||room.status!=='active'||!slideText} onClick={()=>presentSlide(slideIndex)}>Present slide</button></div>
          <div className={styles.slideFields}>
            <label>Title<input value={slide.title} maxLength={120} disabled={busy} onChange={e=>editSlide({title:e.target.value})}/></label>
            <label>Content<textarea value={slide.body} maxLength={3878} disabled={busy} onChange={e=>editSlide({body:e.target.value})}/></label>
            <div className={styles.slideOptions}>
              <label>Diagram<select disabled={busy} value={slide.diagram??'none'} onChange={e=>editSlide({diagram:e.target.value as SlideDiagram})}>{SLIDE_DIAGRAMS.map(d=><option key={d} value={d}>{diagramLabel(d)}</option>)}</select></label>
              <label>Theme<select disabled={busy} value={slide.theme??'paper'} onChange={e=>editSlide({theme:e.target.value as SlideTheme})}>{SLIDE_THEMES.map(t=><option key={t}>{t}</option>)}</select></label>
              <label>Layout<select disabled={busy} value={slide.layout??'wide'} onChange={e=>editSlide({layout:e.target.value==='portrait'?'portrait':'wide'})}><option value="wide">Wide 16:9</option><option value="portrait">Portrait</option></select></label>
              <label>Text size<select disabled={busy} value={slide.font??'normal'} onChange={e=>editSlide({font:e.target.value==='large'?'large':'normal'})}><option value="normal">Normal</option><option value="large">Large</option></select></label>
            </div>
            <label>Presenter notes (private)<textarea maxLength={2000} value={slide.notes??''} disabled={busy} onChange={e=>editSlide({notes:e.target.value})}/></label>
            <div className={styles.slideToolbar}><button type="button" disabled={busy||slideIndex===0} onClick={()=>moveSlide(-1)}>Move left</button><button type="button" disabled={busy||slideIndex===slides.length-1} onClick={()=>moveSlide(1)}>Move right</button><button type="button" disabled={busy||slides.length>=30} onClick={()=>addSlide(true)}>Duplicate</button><button type="button" disabled={busy||slides.length<=1} onClick={deleteSlide}>Delete</button>{deletedSlide&&<button type="button" disabled={busy||slides.length>=30} onClick={undoSlideDelete}>Undo delete</button>}</div>
            {!slideText&&<small role="status">Add content or shorten text to fit the shared slide limit.</small>}
            <small>{workspaceStatus||'Draft'} · published slides remain in lesson history.</small>
          </div>
        </div>:editingBoard&&teacher?<>
          <div className={styles.boardTools}><button aria-label="Previous board page" disabled={busy||boardPage===0} onClick={()=>switchBoardPage(boardPage-1)}>‹</button><span aria-live="polite">Board {boardPage+1} / {boardPages.length}</span><button aria-label="Next board page" disabled={busy||boardPage===boardPages.length-1} onClick={()=>switchBoardPage(boardPage+1)}>›</button><button disabled={busy||boardPages.length>=30} onClick={()=>switchBoardPage(boardPages.length,true)}>+ Page</button></div>
          <ObjectBoard key={boardPage} value={board} page={boardPage+1} total={boardPages.length} onChange={changeBoard} disabled={busy} onUndo={undoBoard} onRedo={redoBoard} canUndo={!!undoBoards.length} canRedo={!!redoBoards.length}/>
          <button className={styles.primary} disabled={busy||!online||room.status!=='active'||!board.trim()} onClick={publishBoard}>Share board</button>
        </>:<SharedPrompt prompt={viewedPrompt}/>}
      </section>
      {!teacher&&learnerTool&&<section className={styles.sheet} aria-label={learnerTool==='ask'?'Ask teacher':'My notes'}>
        <div className={styles.sheetTitle}><strong>{learnerTool==='ask'?'Ask teacher':'My notes'}</strong><button type="button" aria-label="Close" onClick={()=>setLearnerTool(null)}><X size={18}/></button></div>
        {learnerTool==='ask'?<><small>Only you and your teacher can see this conversation.</small><ul className={styles.participants}>{(room.questions??[]).map(q=><li key={q.id}><strong>{q.body}</strong><span>{q.reply??'Awaiting reply'}</span></li>)}</ul><form onSubmit={e=>{e.preventDefault();askTeacher()}}><label>Your question<textarea maxLength={1000} value={questionDraft} disabled={busy} onChange={e=>setQuestionDraft(e.target.value)} required/></label><button className={styles.primary} disabled={busy||!online||!questionDraft.trim()}>Send privately</button></form></>:<form onSubmit={e=>{e.preventDefault();void act('note',null,{body:noteDraft})}}><label>Personal notes<textarea maxLength={8000} value={noteDraft} disabled={busy} onChange={e=>{noteDirty.current=true;setNoteDraft(e.target.value)}}/></label><button className={styles.primary} disabled={busy||!online||!noteDirty.current}>Save notes</button><small>{noteDirty.current?'Unsaved changes':'Notes saved privately'}</small></form>}
      </section>}
      {teacher&&<TeacherSticker prompt={prompt} hidden={!showSticker||!!panel||(focusMode&&!focusDock)} onHide={()=>setShowSticker(false)}/>}
      {teacher&&panel&&panel!=='slides'&&panel!=='library'&&<section className={styles.sheet} aria-label={panel==='compose'?labels[mode]:panel==='learners'?'Learners':'Classroom tools'}>
        <div className={styles.sheetTitle}><strong>{panel==='compose'?labels[mode]:panel==='learners'?'Learners':'More tools'}</strong><button aria-label="Close tools" onClick={()=>{setPanel(null);setEndConfirm(false)}}><X size={19}/></button></div>
        {panel==='compose'&&<form onSubmit={e=>{e.preventDefault();void act('publish',null,{kind:mode,body:content,answerKey:mode==='quiz'||mode==='exercise'?key:null})}}>
          {mode==='clock'?<><label>Show time<input type="time" value={clock} onChange={e=>setClock(e.target.value)}/></label><ClockView value={clock}/></>:<label>{mode==='teach'?'Lesson content':'Question or instruction'}<textarea required maxLength={4000} value={body} onChange={e=>setBody(e.target.value)}/></label>}
          {(mode==='quiz'||mode==='exercise')&&<label>Answer (hidden until reveal)<textarea maxLength={2000} value={key} onChange={e=>setKey(e.target.value)}/></label>}
          <button className={styles.primary} disabled={busy||room.status!=='active'||!content.trim()}>Share with class</button>
        </form>}
        {panel==='learners'&&<><div className={styles.metrics}><span>{(room.questions??[]).filter(q=>!q.reply).length} questions</span><span>{participants.length} joined</span><span>{participants.filter(p=>p.answer!==null).length} answered</span><span>{participants.filter(p=>p.needsHelp).length} need help</span></div>{!participants.length?<p>No learners have joined.</p>:<ul className={styles.participants}>{participants.map(p=><li key={p.studentId}><strong>{p.name}</strong><span>{p.answer??'No answer'}</span>{p.needsHelp&&<button disabled={busy} onClick={()=>void act('ack',null,{studentId:p.studentId})}>Acknowledge hand</button>}</li>)}</ul>}<h3>Private questions</h3>{(room.questions??[]).map(q=><form key={q.id} onSubmit={e=>{e.preventDefault();void act('reply',null,{questionId:q.id,body:replyDrafts[q.id]??''})}}><strong>{q.name??'Learner'}: {q.body}</strong>{q.reply&&<p>{q.reply}</p>}<label>Reply privately<textarea maxLength={1000} value={replyDrafts[q.id]??''} disabled={busy} onChange={e=>setReplyDrafts(items=>({...items,[q.id]:e.target.value}))}/></label><button disabled={busy||!online||!(replyDrafts[q.id]??'').trim()}>Send reply</button></form>)}</>}
        {panel==='more'&&<><div className={styles.controls}><button onClick={()=>chooseMode('clock')}>Clock</button><button onClick={()=>chooseMode('teach')}>Teach text</button><button onClick={()=>{setEditingBoard(false);setPanel('library')}}>My presentations</button><button onClick={()=>setShowSticker(v=>!v)}>{showSticker?'Hide preview':'Show preview'}</button><button disabled={busy||!prompt||!['quiz','exercise','poll'].includes(prompt.kind)||prompt.revealed} onClick={()=>void act('reveal')}>Reveal / close answers</button><button type="button" onClick={()=>setShareLink(new URL('/student/live?room='+encodeURIComponent(room.id),window.location.origin).href)}>Share lesson</button></div>{shareLink&&<><label>Lesson link<input readOnly value={shareLink} onFocus={e=>e.target.select()}/></label><a href={'https://wa.me/?text='+encodeURIComponent(shareLink)} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a></>}{endConfirm?<div className={styles.controls}><strong>End this session?</strong><button disabled={busy} onClick={()=>void act('end')}>Confirm end</button><button onClick={()=>setEndConfirm(false)}>Cancel</button></div>:null}</>}
      </section>}
    </div>
    {teacher&&panel===null&&!editingBoard&&reviewId===null&&liveSlide&&(!focusMode||focusDock)&&<div className={styles.presentControls}>
      <button type="button" disabled={busy||!online||room.status!=='active'||liveSlide.number<=1||liveSlide.total!==slides.length||!encodeSlide(slides[liveSlide.number-2],liveSlide.number-1,slides.length)} onClick={()=>presentSlide(liveSlide.number-2)}>Previous slide</button>
      <span>{liveSlide.number} / {liveSlide.total}</span><button type="button" onClick={openSlides}>Edit slides</button>
      <button type="button" disabled={busy||!online||room.status!=='active'||liveSlide.number>=slides.length||liveSlide.total!==slides.length||!encodeSlide(slides[liveSlide.number],liveSlide.number+1,slides.length)} onClick={()=>presentSlide(liveSlide.number)}>Next slide</button>
    </div>}
    {!teacher&&reviewId===null&&prompt&&['quiz','exercise','poll'].includes(prompt.kind)&&<section className={styles.answerPanel}>{room.ownAnswer!==null&&room.ownAnswer!==undefined?<p role="status"><strong>Submitted:</strong> {room.ownAnswer}</p>:prompt.revealed?<p>Responses closed.</p>:<form onSubmit={e=>{e.preventDefault();void act('answer',null,{body:answer,promptId:prompt.id})}}><label>Your answer<textarea maxLength={2000} required value={answerFor===prompt.id?answer:''} onChange={e=>{setAnswerFor(prompt.id);setAnswer(e.target.value)}} disabled={room.status!=='active'}/></label><button className={styles.primary} disabled={busy||room.status!=='active'||!answer.trim()||answerFor!==prompt.id}>Submit</button></form>}</section>}
    {(!focusMode||focusDock)&&<footer className={styles.dock}>{teacher?<><nav aria-label="Teaching tools" className={styles.toolRow}>{([{kind:'board',icon:Pencil},{kind:'teach',icon:PanelTop},{kind:'quiz',icon:HelpCircle},{kind:'exercise',icon:ClipboardList},{kind:'poll',icon:BarChart3}] as const).map(({kind,icon:Icon})=><button key={kind} aria-pressed={kind==='board'?editingBoard:kind==='teach'?panel==='slides':panel==='compose'&&mode===kind} disabled={draftLoading} onClick={()=>kind==='teach'?openSlides():chooseMode(kind)}><Icon size={18}/><span>{kind==='teach'?'Slides':labels[kind]}</span></button>)}<button disabled={draftLoading} aria-pressed={panel==='more'} onClick={()=>{setPanel(panel==='more'?null:'more');setEndConfirm(false)}}><MoreHorizontal size={18}/><span>More</span></button></nav><div className={styles.sessionRow}><button aria-pressed={panel==='learners'} onClick={()=>setPanel(panel==='learners'?null:'learners')}><Users size={18}/> Learners · {participants.length}</button><button disabled={busy} onClick={()=>void act(room.status==='paused'?'resume':'pause')}>{room.status==='paused'?'Resume':'Pause'}</button><button className={styles.danger} onClick={()=>{setPanel('more');setEndConfirm(true)}}>End</button></div></>:<nav aria-label="Learner tools" className={styles.learnerTools}>
      <button type="button" aria-pressed={!!room.needsHelp} data-raised={!!room.needsHelp} disabled={busy||!online} onClick={()=>void act(room.needsHelp?'lower':'help')}><Hand size={21}/><span>{room.needsHelp?'Lower hand':'Raise hand'}</span></button>
      <button type="button" aria-pressed={learnerTool==='ask'} onClick={()=>setLearnerTool(v=>v==='ask'?null:'ask')}><MessageSquare size={21}/><span>Ask</span></button>
      <button type="button" aria-pressed={learnerTool==='notes'} onClick={()=>setLearnerTool(v=>v==='notes'?null:'notes')}><NotebookPen size={21}/><span>Notes</span></button>
      <button type="button" aria-pressed={reviewId!==null} disabled={!history.length} onClick={()=>{setLearnerTool(null);setReviewId(reviewId?null:history[0].id)}}><History size={21}/><span>{reviewId?'Go live':'History'}</span></button>
    </nav>}</footer>}
    </main>
    return createPortal(stage,document.body)
  }
  return <main className={styles.live}>
    <header className={styles.header}><Link href={back}>Back</Link><h1>Live Classroom</h1>{room&&<span className={styles.status}>{room.status==='active'?'Live':room.status==='paused'?'Paused':'Ended'}</span>}</header>
    {error&&<div role="alert" className={styles.alert}>{error} <button onClick={()=>void refresh()}>Retry</button></div>}
    {loading&&!room&&<p role="status">Connecting…</p>}
    {!room&&!loading&&<section className={styles.panel}>
      {teacher&&<><button type="button" aria-expanded={beforeLibrary} onClick={()=>setBeforeLibrary(v=>!v)}>My presentations</button>{beforeLibrary&&<TeachingLibrary command={call} currentDeck={null} onUse={useMaterial}/>} {preparedTitle&&<p>Ready for next lesson: {preparedTitle} <button type="button" onClick={()=>{preparedDeck.current=null;setPreparedTitle('')}}>Remove</button></p>}</>}
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
    {room?.status==='ended'&&<section className={styles.panel}><h2>{room.title}</h2><p>This session has ended.</p><LessonNavigation items={history} reviewId={reviewId} onReview={setReviewId} ended/><div aria-label="Saved lesson"><SharedPrompt prompt={viewedPrompt}/></div>{!teacher&&room.ownNote&&<div><h3>My notes</h3><p className={styles.content}>{room.ownNote}</p></div>}<button onClick={leave}>Return to live lessons</button></section>}
  </main>
}
