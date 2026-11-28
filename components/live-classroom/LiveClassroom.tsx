'use client'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { Search, ChevronDown, Settings, Link2, Pause, Play, Maximize, Minimize, Users, PanelTop, Pencil, HelpCircle, ClipboardList, BarChart3, MoreHorizontal, X, Video, Move, GripHorizontal, Hand, MessageSquare, NotebookPen, History, Wifi, WifiOff, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import styles from './LiveClassroom.module.css'
import ClassroomManager from './ClassroomManager'
import {TeachingElapsed,ActivityCountdown} from './LiveDeliveryTimers'
import OnlineTeacherWorkspace from '@/components/timetable/OnlineTeacherWorkspace'
import EndedTeacherWorkspace from './EndedTeacherWorkspace'
import type {ScheduledBookingContext} from './ScheduledBookingContext'
import {encodeDemo, adjacentSlide, buildTextRevealSlides, decodeAssessment, assessmentPrompt, decodePhotoSlide, visualSlideBody, visualSlidePayload, preparedAssessment, presenterNotes, studioMinutes } from './LiveSlideProtocol'
import { ExecutiveDialog } from './ExecutiveDialog'
import { ExecutiveCommandPalette } from './ExecutiveCommandPalette'
import { LiveContentDrawer, type ContentTab } from './LiveContentDrawer'
import { StudioRehearsal } from './StudioRehearsal'
import { SlideCanvas, encodeSlide, decodeSlide, validSlide, diagramLabel, SLIDE_DIAGRAMS, SLIDE_THEMES, type LiveSlide, type SlideDiagram, type SlideTheme } from './LiveSlideCanvas'
import { ObjectBoard, SharedObjectBoard } from './LiveObjectBoard'
import {LiveIndependentStudy} from './LiveIndependentStudy'
import {LiveSelfPacedReview} from './LiveSelfPacedReview'
import {copyPhotoDeck,shareSlidePhotos} from './LivePhotoDeckReuse'
import {PrivateSlideFields} from './LivePreparedAssessment'
import {SlideBodyEditor} from './LiveSlideBodyEditor'
import {LiveCurrentSlideEditor,canEditCurrentSlide} from './LiveCurrentSlideEditor'
import { TeachingLibrary, isMaterial } from './LiveTeachingLibrary'
import {validateStudioResources} from './LiveStudioResourceValidation'
import {studioResource,studioFile} from './LiveSlideProtocol'
import {presentStudioFile,validateStudioFiles} from './LiveStudioFiles'
import { LiveResourcePicker } from './LiveResourcePicker'
import { LiveClassFiles } from './LiveClassFiles'
import { LiveFilePresentation } from './LiveFilePresentation'
import { decodeLiveFileRef } from '@/lib/live/filePresentation'
import { BOARD_LIMIT, decodeBoard, encodeBoard, revealBoard, boardRevealCount } from './LiveBoardProtocol'
import { liveSyncDelay } from './LiveSyncPolicy'
import { LivePrivateChat } from './LivePrivateChat'
import { LiveClassChat } from './LiveClassChat'
import { LiveVoice } from './LiveVoice'
import { LiveWorkbook } from './LiveWorkbook'
import { LiveStageInk } from './LiveStageInk'
import { LiveReadingSurface } from './LiveReadingSurface'
import { teacherLivePlan } from '@/lib/live/lessonPlanPresentation'
import { validLessonId } from '@/lib/teaching/liveLessonLinks'
import LiveLessonReview from './LiveLessonReview'
import TeachingKit from '@/components/teacher/TeachingKit'
import {TeachingModelPicker} from './TeachingModelPicker'
import { liveAnswerChoices, addWorkToPrivateNotes } from '@/lib/live/learnerActivity'
import type { LessonDeliveryStep } from '@/lib/teaching/lessonPlanCodec'

type ClassroomMode = 'school' | 'tuition' | 'homeschool' | 'open'
const classroomLabels: Record<ClassroomMode,string>={school:'My Class',tuition:'Invited',homeschool:'Homeschool',open:'Public'}
type Summary = { mode: ClassroomMode; canJoin: boolean; id: string; title: string; teacherName?:string|null; status: 'active' | 'paused'; own: boolean; waitingStatus?:'pending'|'admitted'|'denied'|null }
type PastSummary = { id: string; title: string; mode: ClassroomMode; startedAt: string; status: 'ended' }
type Mode = 'teach' | 'quiz' | 'exercise' | 'poll' | 'clock' | 'board'
type TeachingPhase = 'teaching' | 'activity' | 'discussion'
const phaseLabels:Record<TeachingPhase,string>={teaching:'Teach',activity:'Activity',discussion:'Discuss'}
type Prompt = { id: string; kind: Mode; body: string; answerKey: string | null; revealed: boolean }
type HistoryPrompt = Prompt & { position: number; createdAt: string }
type Participant = { studentId: string; name: string; needsHelp: boolean; answer: string | null; unreadDm?: number }
type PresenterPosition = {roomId:string;promptId:string;currentPromptId:string;ratio:number}
type WaitingRequest = {studentId:string;name:string;requestedAt:string}
type LiveQuestion = {id:string;body:string;reply:string|null;name?:string}
type Room = { bookingCreated?:boolean; teachingPhase?:TeachingPhase; mode: ClassroomMode; id: string; title: string; version: number; status: 'active' | 'paused' | 'ended'; teacher: boolean; prompt: Prompt | null; history?: HistoryPrompt[]; handAckAt?: string|null; ownNote?:string; questions?:LiveQuestion[]; participants?: Participant[]; ownAnswer?: string | null; needsHelp?: boolean; dmUnread?: number; chatEnabled?:boolean; waitingCount?:number; presentedPromptId?:string|null; presentedScrollRatio?:number; presentedSeq?:number }
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
function ClockExplorer({value}:{value:string}){
  const original=value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  const [hour,setHour]=useState(original?Number(original[1]):9)
  const [minute,setMinute]=useState(original?Number(original[2]):0)
  const [checked,setChecked]=useState(false)
  useEffect(()=>{const next=value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);if(next){setHour(Number(next[1]));setMinute(Number(next[2]));setChecked(false)}},[value])
  if(!original)return <ClockView value={value}/>
  const formatted=String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0')
  const expected=String(Number(original[1])).padStart(2,'0')+':'+original[2]
  return <div className={styles.clockExplorer} aria-label="Explore the analogue clock">
    <strong>Try moving the clock hands</strong>
    <ClockView value={formatted}/>
    <output aria-live="polite">{formatted}</output>
    <label>Hour <input type="range" min="0" max="23" value={hour} onChange={e=>{setHour(Number(e.target.value));setChecked(false)}}/></label>
    <label>Minutes <input type="range" min="0" max="59" step="1" value={minute} onChange={e=>{setMinute(Number(e.target.value));setChecked(false)}}/></label>
    <button type="button" onClick={()=>setChecked(true)}>Check against teacher's clock</button>
    {checked&&<p role="status">{formatted===expected?'Correct. The clocks match.':'Keep trying. This practice stays on your device.'}</p>}
    <small>Personal practice only — it will not change the teacher's clock or submit a graded answer.</small>
  </div>
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
function SharedPrompt({prompt,roomId,learner=false,compact=false,onQuote}:{prompt:Prompt|null|undefined;roomId?:string;learner?:boolean;compact?:boolean;onQuote?:(quote:string)=>void}){
 const sharedFile=prompt?.kind==='teach'?decodeLiveFileRef(prompt.body):null
 if(sharedFile)return roomId?<LiveFilePresentation roomId={roomId} fileId={sharedFile}/>:<p>Shared PDF or photo</p>
 const slide=prompt?.kind==='teach'?decodeSlide(prompt.body):null
 if(slide)return <SlideCanvas slide={slide} number={slide.number} total={slide.total} mini={compact} explore={learner&&!compact} roomId={roomId}/>
 return prompt?<><div className={styles.label}>{labels[prompt.kind]}</div>{prompt.kind==='clock'?(learner?<ClockExplorer value={prompt.body}/>:<ClockView value={prompt.body}/>):prompt.kind==='board'?<BoardView value={prompt.body}/>:prompt.kind==='teach'&&!compact?<LiveReadingSurface body={prompt.body} learner={learner} onQuote={onQuote}/>:<p className={styles.content}>{prompt.body}</p>}{prompt.revealed&&prompt.answerKey&&<div className={styles.solution}><strong>Answer</strong><p className={styles.content}>{prompt.answerKey}</p></div>}</>:<p className={styles.empty}>Choose a teaching tool to start.</p>
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
   {!mini&&<><div className={styles.stickerContent}>{camera?<video ref={video} autoPlay muted playsInline aria-label="Local camera self-view"/>:<SharedPrompt prompt={prompt} compact/>}</div>
   <div className={styles.stickerFooter}><span>{camera?'You · local only':'Learner preview'}</span><button type="button" aria-label={camera?'Stop local camera':'Start local camera preview'} title="Local camera only" aria-pressed={camera} onClick={()=>void toggleCamera()}><Video size={15}/></button></div>
   {pending&&<small role="status">Opening camera…</small>}{cameraError&&<small role="status">{cameraError}</small>}
   <button type="button" className={styles.resize} aria-label="Resize preview" title="Drag to resize" onPointerDown={e=>start(e,'resize')} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onKeyDown={e=>{if(box.current&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setPosition(clamp(box.current.offsetLeft,box.current.offsetTop,box.current.offsetWidth+(['ArrowRight','ArrowDown'].includes(e.key)?12:-12)))}}}><GripHorizontal size={14}/></button></>}
 </div>
}

export default function LiveClassroom({classId,teacher,back,hostModes=['tuition','open'],initialStudio=false,instantEntry=false,scheduledBooking}:{classId:string|null;teacher:boolean;back:string;hostModes?:ClassroomMode[];initialStudio?:boolean;instantEntry?:boolean;scheduledBooking?:ScheduledBookingContext}) {
  const scheduledId=scheduledBooking?.id
  const bookedRoomRef=useRef<string|null>(scheduledBooking?.roomId??null)
  useEffect(()=>{if(scheduledBooking?.roomId)bookedRoomRef.current=scheduledBooking.roomId},[scheduledBooking?.roomId])
  const hostModeKey=hostModes.join(',')
  const [hostMode,setHostMode]=useState<ClassroomMode>(classId?'school':hostModes[0])
  const [groupId,setGroupId]=useState('')
  const [groups,setGroups]=useState<{id:string;title:string}[]>([])
  const [clock,setClock]=useState('10:30')
  const [board,setBoard]=useState('')
  const [boardPages,setBoardPages]=useState<string[]>([''])
  const [boardPage,setBoardPage]=useState(0)
  const [panel,setPanel]=useState<'compose'|'learners'|'more'|'slides'|'library'|'resources'|'plan'|'kit'|'chat'|'interactive'|'invite'|'live-slide'|'production'|'activity'|null>(null)
  const liveEditTarget=useRef<{roomId:string;promptId:string}|null>(null)
  const [slides,setSlides]=useState<LiveSlide[]>([{title:'',body:''}])
  const [slideIndex,setSlideIndex]=useState(0)
  const [studioAdvanced,setStudioAdvanced]=useState(false)
  const [rehearsalOpen,setRehearsalOpen]=useState(false)
  const [studioAddOpen,setStudioAddOpen]=useState(false)
  const [studioMonitor,setStudioMonitor]=useState<'now'|'next'>('now')
  const [studioReturn,setStudioReturn]=useState(false)
  const [studioInspector,setStudioInspector]=useState<'content'|'design'|'notes'>('content')
  const [deletedSlide,setDeletedSlide]=useState<{slide:LiveSlide;index:number}|null>(null)
  const [beforeLibrary,setBeforeLibrary]=useState(initialStudio&&teacher)
  const preparedRoomId=useRef<string|null>(null)
  const preparedDeck=useRef<{title:string;slides:LiveSlide[]}|null>(null)
  const [preparedTitle,setPreparedTitle]=useState('')
  const [linkedPlan,setLinkedPlan]=useState<{id:string;schemeId:string|null;title:string;steps:LessonDeliveryStep[]}|null>(null)
  const [selectedPlanId,setSelectedPlanId]=useState<string|null>(null)
  const [savedPlans,setSavedPlans]=useState<{id:string;title:string}[]>([])
  const [plansError,setPlansError]=useState('')
  const [plansLoading,setPlansLoading]=useState(false)
  const [linkedPlanError,setLinkedPlanError]=useState('')
  const [attachingPlan,setAttachingPlan]=useState(false)
  const [planLoadAttempt,retryPlanLoad]=useState(0)
  const [attachedPresentation,setAttachedPresentation]=useState<string|null>(null)
  const [planPhase,setPlanPhase]=useState(0)
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
  const [dockHidden,setDockHidden]=useState(true)
  const [toolPickerOpen,setToolPickerOpen]=useState(false)
  const [pinnedTools,setPinnedTools]=useState<string[]>(['board','teach','quiz','exercise','poll','files'])
  useEffect(()=>{
    try {
      const saved=window.localStorage.getItem('vibe-live-teacher-tools-v1')
      if(saved){
        const parsed=JSON.parse(saved)
        if(Array.isArray(parsed))setPinnedTools(['board','teach','quiz','exercise','poll','files'].filter(k=>parsed.includes(k)))
      }
    } catch { /* storage may be unavailable */ }
  },[])
  function togglePinnedTool(kind:string){
    setPinnedTools(previous=>{
      const next=previous.includes(kind)?previous.filter(k=>k!==kind):[...previous,kind]
      try{window.localStorage.setItem('vibe-live-teacher-tools-v1',JSON.stringify(next))}catch{}
      return next
    })
  }

  const [premiumMenu,setPremiumMenu]=useState<string|null>(null)
  const [commandOpen,setCommandOpen]=useState(false)
  const [contentTab,setContentTab]=useState<ContentTab|null>(null)
  const [contentFeedback,setContentFeedback]=useState('')
  const [executiveInvite,setExecutiveInvite]=useState(false)
  const [endConfirm,setEndConfirm]=useState(false)
  const immersiveRef=useRef<HTMLElement>(null)
  const boardInitialized=useRef(false)
  const boardUndoByPage=useRef<Record<number,{undo:string[];redo:string[]}>>({})
  const [rooms,setRooms] = useState<Summary[]>([])
  const [pastRooms,setPastRooms] = useState<PastSummary[]>([])
  const [pastOpen,setPastOpen] = useState(false)
  const [pastAvailable,setPastAvailable] = useState(false)
  const [pastLoading,setPastLoading] = useState(false)
  const [pastError,setPastError] = useState('')
  const [search,setSearch]=useState('')
  const [subjectFilter,setSubjectFilter]=useState('all')
  const [gradeFilter,setGradeFilter]=useState('all')
  const [publicGrade,setPublicGrade]=useState('Grade 4')
  const [publicSubject,setPublicSubject]=useState('Mathematics')
  const [scope,setScope]=useState<'all'|ClassroomMode>('all')
  const [sharedId,setSharedId]=useState('')
  const [shareLink,setShareLink]=useState('')
  const [inviteFeedback,setInviteFeedback]=useState('')
  const [room,setRoom] = useState<Room|null>(null)
  useEffect(()=>{setCommandOpen(false);setExecutiveInvite(false);setPremiumMenu(null);setContentTab(null);setContentFeedback('')},[room?.id])
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
  const [selfPaced,setSelfPaced]=useState(false)
  const [followingTeacher,setFollowingTeacher]=useState(true)
  const stageScrollRef=useRef<HTMLElement|null>(null)
  const pendingTeacherViewport=useRef<{roomId:string;promptId:string;ratio:number}|null>(null)
  const presenterTimer=useRef<number|null>(null)
  const presenterPending=useRef<PresenterPosition|null>(null)
  const presenterChain=useRef<Promise<void>>(Promise.resolve())
  const [learnerTool,setLearnerTool]=useState<'ask'|'notes'|'files'|'work'|null>(null)
  const [workingByPrompt,setWorkingByPrompt]=useState<Record<string,string>>({})
  const [learnerMenu,setLearnerMenu]=useState(false)
  const [questionDraft,setQuestionDraft]=useState('')
  const questionRequest=useRef<{body:string;id:string}|null>(null)
  const [noteDraft,setNoteDraft]=useState('')
  const noteDirty=useRef(false)
  const [replyDrafts,setReplyDrafts]=useState<Record<string,string>>({})
  const [privateTarget,setPrivateTarget]=useState<{studentId:string;name:string}|null>(null)
  const [privateOpen,setPrivateOpen]=useState(false)
  const [classChatOpen,setClassChatOpen]=useState(false)
  const [waitingRequests,setWaitingRequests]=useState<WaitingRequest[]>([])
  const [waitingError,setWaitingError]=useState('')
  const [online,setOnline]=useState(true)
  const [lastSync,setLastSync]=useState(0)
  useEffect(()=>{
    const status=()=>setOnline(navigator.onLine)
    status();window.addEventListener('online',status);window.addEventListener('offline',status)
    return ()=>{window.removeEventListener('online',status);window.removeEventListener('offline',status)}
  },[])
  useEffect(()=>{
    setFollowingTeacher(true)
    presenterPending.current=null
    if(presenterTimer.current!==null){window.clearTimeout(presenterTimer.current);presenterTimer.current=null}
    setLearnerTool(null);setWorkingByPrompt({});setQuestionDraft('');questionRequest.current=null;setNoteDraft(active.current?.ownNote??'');noteDirty.current=false;setReplyDrafts({});setPrivateTarget(null);setPrivateOpen(false);setClassChatOpen(false);setLearnerMenu(false);setWaitingRequests([]);setWaitingError('')
  },[room?.id])
  useEffect(()=>{if(!noteDirty.current)setNoteDraft(room?.ownNote??'')},[room?.id,room?.ownNote])
  const [draftBinding,setDraftBinding]=useState<{roomId:string; key:string}|null>(null)
  const draftKey=useRef<string|null>(null)
  const composerDrafts=useRef<Partial<Record<Mode,ComposerDraft>>>({})
  const pendingPublish=useRef<{fingerprint:string;requestId:string}|null>(null)
  const [draftWarning,setDraftWarning]=useState(false)
  const revoke=useCallback(()=>{
    removeDraft(draftKey.current);draftKey.current=null;setDraftBinding(null);setBeforeLibrary(false);preparedDeck.current=null;preparedRoomId.current=null;setPreparedTitle('');setConflictDraft(null)
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
    if(scheduledId&&action==='past_list')return []
    if(scheduledId&&action==='get'&&id!==bookedRoomRef.current)throw Error('This is not the room for this booking.')
    if(scheduledId&&action==='list'&&!bookedRoomRef.current)return []
    const bookingStart=!!scheduledId&&action==='start'
    const {data,error:failure}=bookingStart
      ?await supabase.rpc('vibe_live_tuition_booking',{p_booking:scheduledId,p_action:'start'})
      :await supabase.rpc('vibe_live_command',{p_action:action,p_class_id:classId,p_session_id:id,p_version:version,p_payload:{...payload,host:teacher}})
    if(failure) {
      if(failure.code==='42501') throw new Error('LIVE_ACCESS_REVOKED')
      throw new Error(failure.message||'Could not sync the classroom.')
    }
    if(data===null||typeof data!=='object') throw new Error('Invalid classroom response.')
    if(bookingStart){if(typeof data.id!=='string'||data.teacher!==true)throw Error('Invalid scheduled room.');bookedRoomRef.current=data.id}
    if(scheduledId&&action==='list')return Array.isArray(data)?data.filter((item:Summary)=>item.id===bookedRoomRef.current):[]
    return data
  },[classId,teacher,scheduledId])
  // Position metadata follows the existing authorized RPC; never broadcast
  // document contents or grant browsers write access to the Realtime topic.
  const queuePresenter=useCallback((promptId:string,ratio:number,immediate=false)=>{
    const current=active.current
    if(!teacher||!current||current.status!=='active'||!current.prompt||
       typeof current.presentedSeq!=='number')return
    const position:PresenterPosition={roomId:current.id,promptId,
      currentPromptId:current.prompt.id,ratio:Math.min(1,Math.max(0,Number.isFinite(ratio)?ratio:0))}
    presenterPending.current=position
    if(presenterTimer.current!==null)window.clearTimeout(presenterTimer.current)
    presenterTimer.current=window.setTimeout(()=>{
      presenterTimer.current=null
      const next=presenterPending.current
      presenterPending.current=null
      if(!next)return
      // Serial submission avoids an older scroll overtaking a newer page.
      presenterChain.current=presenterChain.current.catch(()=>{}).then(async()=>{
        if(!mounted.current||active.current?.id!==next.roomId||
           active.current.status!=='active')return
        try{
          await call('present',next.roomId,null,{
            promptId:next.promptId,currentPromptId:next.currentPromptId,
            ratio:next.ratio.toFixed(6),
          })
        }catch{
          if(mounted.current&&active.current?.id===next.roomId)
            setError('Reading position could not sync. Learners can still navigate independently.')
        }
      })
    },immediate?0:450)
  },[teacher,call])
  const accept=useCallback((next:Room)=>{
    if(next.teacher!==teacher) throw new Error('Choose the correct classroom account.')
    const old=active.current
    if(old?.id===next.id){
      if(next.version<old.version)return
      if(next.version===old.version&&typeof old.presentedSeq==='number'&&
        typeof next.presentedSeq==='number'&&next.presentedSeq<old.presentedSeq)return
      if(old.prompt&&!next.prompt)throw new Error('Incomplete lesson sync. Retrying.')
      if(old.history && (!next.history || old.history.some(p=>!next.history!.some(q=>q.id===p.id)))) throw new Error('Incomplete lesson history. Retrying.')
    }
    active.current=next
    setRoom(next)
    setLastSync(Date.now())
    roomUrl(next.id)
    if(next.status==='ended') setError('')
  },[teacher])
  const refresh=useCallback(async():Promise<boolean|null>=>{
    if(lock.current||!mounted.current||document.visibilityState==='hidden'||!navigator.onLine) return null
    lock.current=true
    const stamp=generation.current
    try {
      const current=active.current
      if(current&&current.status!=='ended') {
        const next=await call('get',current.id) as Room
        if(mounted.current&&generation.current===stamp) accept(next)
      } else if(!current) {
        const resumeId=recoverRoomId()
        if(resumeId&&scheduledId&&resumeId!==bookedRoomRef.current)roomUrl(null)
        if(resumeId&&(!scheduledId||resumeId===bookedRoomRef.current)){
          const next=await call('get',resumeId) as Room
          if(mounted.current&&generation.current===stamp){accept(next);setError('')}
          return true
        }
        const list=await call('list') as Summary[]
        if(mounted.current&&generation.current===stamp) setRooms(list.filter(item=>teacher?item.own&&(classId?item.mode==='school':hostModeKey.split(',').includes(item.mode)):!item.own))
      }
      if(mounted.current&&generation.current===stamp) setError('')
      return true
    } catch(e) {
      if(mounted.current&&generation.current===stamp) {
        if(e instanceof Error&&e.message==='LIVE_ACCESS_REVOKED'){revoke()}
        else setError(e instanceof Error?e.message:'Connection interrupted. Retrying.')
      }
      return false
    } finally {
      if(generation.current===stamp) {lock.current=false;if(mounted.current)setLoading(false)}
    }
  },[call,accept,teacher,classId,hostModeKey,revoke,scheduledId])
  // Backend capability probing keeps the archive control hidden until the
  // compatible, independently verified read-only RPC has been commissioned.
  useEffect(()=>{
    if(loading){setPastAvailable(false);return}
    if(room?.id)return
    let cancelled=false
    void call('past_list').then(data=>{
      if(!cancelled)setPastAvailable(Array.isArray(data))
    }).catch(()=>{if(!cancelled)setPastAvailable(false)})
    return ()=>{cancelled=true}
  },[call,loading,room?.id])
  useEffect(()=>{
    mounted.current=true
    generation.current++
    lock.current=false
    mutating.current=false
    active.current=null
    setRoom(null); setRooms([]); setLoading(true);setBusy(false);setError('')
    let timer:number|undefined
    let sequence=0
    let failures=0
    let disposed=false
    const cancel=()=>{sequence++;if(timer!==undefined)window.clearTimeout(timer);timer=undefined}
    const visible=()=>!disposed&&document.visibilityState!=='hidden'&&navigator.onLine
    const tick=async(stamp:number)=>{
      if(!visible()||stamp!==sequence)return
      const result=await refresh()
      if(!visible()||stamp!==sequence)return
      if(result===true)failures=0
      else if(result===false)failures++
      timer=window.setTimeout(()=>void tick(stamp),liveSyncDelay(active.current?.status??null,failures))
    }
    const wake=()=>{cancel();if(visible()){failures=0;void tick(sequence)}}
    wake()
    window.addEventListener('online',wake)
    window.addEventListener('offline',wake)
    document.addEventListener('visibilitychange',wake)
    return ()=>{disposed=true;cancel();mounted.current=false;generation.current++;window.removeEventListener('online',wake);window.removeEventListener('offline',wake);document.removeEventListener('visibilitychange',wake)}
  },[refresh])
  // Private session WebSocket carries only an invalidation signal. All lesson,
  // roster and answer content is fetched again through the canonical scoped RPC.
  // The existing bounded adaptive poll remains active during outages, reconnects
  // and after an access change; no message payload can grant classroom admission.
  useEffect(()=>{
    const roomId=room?.id
    if(!roomId||room?.status==='ended')return
    let disposed=false
    let channel:ReturnType<typeof supabase.channel>|null=null
    let debounce:number|undefined
    let inFlight=false
    let dirty=false
    const flush=async()=>{
      debounce=undefined
      if(disposed||!dirty||inFlight)return
      dirty=false;inFlight=true
      try{await refresh()}finally{
        inFlight=false
        if(dirty&&!disposed)schedule()
      }
    }
    const schedule=()=>{
      if(disposed)return
      dirty=true
      if(debounce!==undefined||inFlight)return
      debounce=window.setTimeout(()=>void flush(),75)
    }
    void supabase.auth.getSession().then(({data})=>{
      if(disposed||!data.session?.access_token)return
      supabase.realtime.setAuth(data.session.access_token)
      const next=supabase.channel('vibe-live:'+roomId,{config:{private:true}})
      channel=next.on('broadcast',{event:'refresh'},schedule)
        .subscribe(status=>{if(status==='SUBSCRIBED')schedule()})
    }).catch(()=>{/* authorized polling fallback remains active */})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==='TOKEN_REFRESHED'&&session?.access_token)supabase.realtime.setAuth(session.access_token)
    })
    return()=>{
      disposed=true
      if(debounce!==undefined)window.clearTimeout(debounce)
      subscription.unsubscribe()
      if(channel)void supabase.removeChannel(channel)
    }
  },[room?.id,room?.status,refresh])
  // Teacher-only plan picker. Live guests cannot select or read private
  // Lesson Plans. A plan is never published simply because it is selected.
  useEffect(()=>{
    if(!teacher||!classId)return
    setSelectedPlanId(new URLSearchParams(window.location.search).get('lessonPlanId')??'')
  },[teacher,classId])
  useEffect(()=>{
    if(!teacher||!classId)return
    let cancelled=false
    const load=async()=>{
      setPlansLoading(true);setPlansError('')
      try{
        const auth=await supabase.auth.getUser()
        if(auth.error||!auth.data.user)throw Error('Sign in to view saved lessons.')
        const result=await supabase.from('lesson_plans')
          .select('id,title,topic,created_at')
          .eq('teacher_id',auth.data.user.id).eq('class_id',classId)
          .order('created_at',{ascending:false}).limit(24)
        if(result.error)throw result.error
        if(!cancelled)setSavedPlans((result.data??[])
          .filter((item:{id:string})=>validLessonId(item.id))
          .map((item:{id:string;topic?:string|null;title?:string|null})=>({id:item.id,title:String(item.topic||item.title||'Untitled lesson').slice(0,120)})))
      }catch{
        if(!cancelled){setSavedPlans([]);setPlansError('Saved Lesson Plans are unavailable. You can still teach without linking a plan.')}
      }finally{if(!cancelled)setPlansLoading(false)}
    }
    void load()
    return()=>{cancelled=true}
  },[teacher,classId])
  // Saved plan content stays private to the teacher; only approved resources
  // are explicitly published through the existing Live command.
  useEffect(()=>{
    if(!teacher||!classId||selectedPlanId===null)return
    setLinkedPlan(null);setLinkedPlanError('');setPlanPhase(0)
    if(!active.current){
      setAttachedPresentation(null)
      setAttachingPlan(false)
      preparedDeck.current=null
      setPreparedTitle('')
    }
    if(!selectedPlanId)return
    if(!validLessonId(selectedPlanId)){setLinkedPlanError('Invalid lesson link. Choose a saved Lesson Plan.');return}
    const planId=selectedPlanId
    let cancelled=false
    const load=async()=>{
      try{
        const auth=await supabase.auth.getUser()
        const user=auth.data.user
        if(auth.error||!user)throw new Error('Sign in to open your lesson plan.')
        const result=await supabase.from('lesson_plans')
          .select('id,topic,body,scheme_id')
          .eq('id',planId).eq('teacher_id',user.id).eq('class_id',classId)
          .maybeSingle()
        if(result.error||!result.data)throw new Error('This plan is not available for your teaching class.')
        const projection=teacherLivePlan(String(result.data.body??''))
        if(!projection?.steps.length)throw new Error('The saved Lesson Plan needs review before teaching.')
        if(cancelled)return
        const topic=String(result.data.topic||'Lesson Plan').trim().slice(0,120)||'Lesson Plan'
        if(!active.current){
          setTitle(topic)
          const attachment=await supabase.rpc('vibe_live_plan_presentation',{p_plan_id:planId})
          if(attachment.error)throw new Error('Could not load the plan’s presentation. Try loading the plan again.')
          if(cancelled)return
          if(attachment.data&&!active.current){
            const material=await call('materials_get',null,null,{id:attachment.data})
            if(cancelled)return
            if(!isMaterial(material)||material.id!==attachment.data)throw new Error('The attached presentation is unavailable.')
            if(!active.current){
              preparedDeck.current={title:material.title,slides:material.slides}
              setPreparedTitle(material.title)
              setAttachedPresentation(material.id)
            }
          }
        }
        setLinkedPlan({id:result.data.id,schemeId:result.data.scheme_id??null,title:topic,steps:projection.steps})
        setLinkedPlanError('');setPlanPhase(0)
      }catch(e){if(!cancelled)setLinkedPlanError(e instanceof Error?e.message:'Could not read the saved Lesson Plan.')}
    }
    void load()
    return()=>{cancelled=true}
  },[teacher,classId,selectedPlanId,call,planLoadAttempt])
  useEffect(()=>{
    if(!teacher||room?.mode!=='open'||!room.id)return
    let cancelled=false
    void call('wait_list',room.id).then(data=>{
      if(cancelled)return
      const list=(data as {requests?:unknown})?.requests
      if(!Array.isArray(list))throw Error('Invalid waiting room')
      setWaitingRequests(list.filter((v):v is WaitingRequest=>!!v&&typeof v.studentId==='string'&&typeof v.name==='string'&&typeof v.requestedAt==='string'))
      setWaitingError('')
    }).catch(()=>{if(!cancelled)setWaitingError('Could not refresh the waiting room.')})
    return()=>{cancelled=true}
  },[teacher,room?.id,room?.mode,room?.version,call])
  useEffect(()=>{if(!teacher||classId||hostMode!=='tuition')return;let cancelled=false;void call('groups').then(data=>{if(!cancelled)setGroups(data as {id:string;title:string}[])}).catch(()=>{if(!cancelled)setGroups([])});return()=>{cancelled=true}},[teacher,classId,hostMode,call])
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search)
    if(teacher&&params.get('studio')==='1')setBeforeLibrary(true)
    const requested=params.get('mode')
    if(!classId&&teacher&&(requested==='tuition'||requested==='open')&&hostModeKey.split(',').includes(requested))setHostMode(requested)
    const id=params.get('room')
    if(!teacher&&id&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))setSharedId(id)
  },[classId,teacher,hostModeKey])
  useEffect(()=>{setShareLink('')},[room?.id])
  useEffect(()=>{if(room?.id)setPastOpen(false)},[room?.id])
  useEffect(()=>{setAnswer('');setAnswerFor(room?.prompt?.id??'')},[room?.prompt?.id])
  function closeRoomVoice(next:Room){
    if(process.env.NEXT_PUBLIC_VIBE_LIVE_VOICE_ENABLED==='true' && next.teacher){
      // End-class media ejection is a separate, strictly authorized server
      // operation. The classroom and saved teaching history remain intact.
      void supabase.auth.getSession().then(async({data:{session}})=>{
        if(!session)return
        const res=await fetch('/api/live/voice/'+encodeURIComponent(next.id),{
          method:'DELETE',headers:{Authorization:'Bearer '+session.access_token},
          cache:'no-store',
        })
        if(!res.ok && mounted.current)setError('Class ended, but the audio service may still be closing.')
      }).catch(()=>{if(mounted.current)setError('Class ended; audio closure needs verification.')})
    }
  }
  async function act(action:string,id:string|null=null,payload:Record<string,unknown>={},replaceRoomId?:string):Promise<Room|undefined> {
    if(mutating.current) return
    const stamp=++generation.current // discard any earlier poll; never discard the user's click
    mutating.current=true;lock.current=true;setBusy(true);setError('')
    try {
      let requestPayload=payload
      if(action==='start'&&preparedDeck.current){await validateStudioResources(preparedDeck.current.slides);await validateStudioFiles(preparedDeck.current.slides);if(!mounted.current||generation.current!==stamp)return}
      const startingPrepared=action==='start'&&instantEntry&&!!preparedDeck.current
      if(startingPrepared){
        const openRooms=await call('list') as Summary[]
        if(!mounted.current||generation.current!==stamp)return
        const existing=openRooms.find(item=>item.own&&item.mode!=='school')
        if(existing&&existing.id!==replaceRoomId){
          setRooms(openRooms.filter(item=>item.own))
          throw Error('A class is already open. Confirm ending it before starting the prepared lesson.')
        }
        if(existing){
          const previous=await call('get',existing.id) as Room
          if(!mounted.current||generation.current!==stamp)return
          if(!previous.teacher||previous.id!==existing.id)throw Error('Could not confirm the existing class.')
          if(previous.status!=='ended'){
            const ended=await call('end',previous.id,previous.version) as Room
            if(ended.status!=='ended')throw Error('Could not end the existing class.')
            closeRoomVoice(ended)
          }
          setRooms(items=>items.filter(item=>item.id!==existing.id))
        }
      }
      if(action==='publish'){
        const fingerprint=JSON.stringify([room?.id,payload.kind,payload.body,payload.answerKey??null])
        if(pendingPublish.current?.fingerprint!==fingerprint)pendingPublish.current={fingerprint,requestId:crypto.randomUUID()}
        requestPayload={...payload,requestId:pendingPublish.current.requestId}
      }
      let next: Room
      try {
        next=await call(action,id??room?.id??null,active.current?.version??null,requestPayload) as Room
      } catch(e) {
        // Another teacher tab or attendance can advance the version before a click.
        // Retry once against the same room, preserving any slide identity checks.
        if((action!=='publish'&&action!=='slide_update'&&action!=='end')||!(e instanceof Error)||e.message!=='live_stale_version'||!room?.id)throw e
        const latest=await call('get',room.id) as Room
        if(!mounted.current||generation.current!==stamp)return
        accept(latest)
        if(!latest.teacher||(action==='end'?latest.status==='ended':latest.status!=='active'))throw new Error('The lesson is no longer active.')
        if(action==='slide_update'&&(latest.prompt?.id!==payload.promptId||latest.prompt?.body!==payload.expectedBody))throw new Error('live_slide_conflict')
        next=await call(action,room.id,latest.version,requestPayload) as Room
      }
      // Bind a selected saved plan before presenting the newly created
      // room as ready. Recovery/re-entry remains idempotent via the same RPC.
      // A failed bind must never be reported as a successfully linked lesson.
      let startLinkFailure=''
      if(action==='start'&&next.mode==='school'&&selectedPlanId&&linkedPlan?.id===selectedPlanId){
        const suppliedOccurrence=new URLSearchParams(window.location.search).get('occurrenceId')
        const {error:bindError}=await supabase.rpc('vibe_live_lesson_bridge',{
          p_action:'bind',
          p_session_id:next.id,
          p_lesson_plan_id:linkedPlan.id,
          p_occurrence_id:validLessonId(suppliedOccurrence)?suppliedOccurrence:null,
        })
        if(bindError)startLinkFailure='Live started, but the Lesson Plan link could not be saved. '+(bindError.message||'Retry from lesson review.')
      }
      if(!mounted.current||generation.current!==stamp)return
      if(startingPrepared){
        if((scheduledId&&!next.bookingCreated)||next.id===replaceRoomId||next.title!==payload.title||next.version!==0||next.prompt){
          accept(next)
          setError('An existing class reopened. The prepared lesson is still queued.')
          return
        }
        preparedRoomId.current=next.id
      }
      accept(next)
      if(startLinkFailure)setLinkedPlanError(startLinkFailure)
      if(action==='publish'){
        pendingTeacherViewport.current=null;pendingPublish.current=null;setReviewId(null)
        if(!contentTab&&panel==='compose'){delete composerDrafts.current[mode];setBody('');setKey('')}
        const presented=next.prompt?.kind==='teach'?decodeSlide(next.prompt.body):null
        if(!contentTab&&presented&&presented.total===slides.length)setSlideIndex(panel==='production'?Math.min(presented.number,slides.length-1):presented.number-1)
        if(!contentTab){if(panel==='slides'&&studioReturn){setStudioReturn(false);setPanel('production')}else if(panel!=='production')setPanel(null);if(payload.kind!=='board')setEditingBoard(false)}
      }
      if(action==='phase_set'){
        setEditingBoard(false);setReviewId(null);setDockHidden(true);setToolPickerOpen(false)
        if(next.teachingPhase==='discussion')setPanel('chat')
        else if(next.teachingPhase==='activity')chooseMode('exercise')
        else setPanel('kit')
      }
      if(action==='ask'){questionRequest.current=null;setQuestionDraft('')}
      if(action==='note'){noteDirty.current=false;setNoteDraft(next.ownNote??'')}
      if(action==='reply'&&typeof payload.questionId==='string'){const questionId=payload.questionId;setReplyDrafts(items=>({...items,[questionId]:''}))}
      if(action==='end'){
        removeDraft(draftKey.current);draftKey.current=null;setDraftBinding(null)
        closeRoomVoice(next)
      }
      return next
    } catch(e) {
      if(mounted.current&&generation.current===stamp){
        if(e instanceof Error&&e.message==='LIVE_ACCESS_REVOKED'){revoke()}
        else setError(e instanceof Error?e.message:'Could not save. Retry.')
      }
    } finally {
      if(generation.current===stamp){mutating.current=false;lock.current=false;if(mounted.current){setBusy(false);setLoading(false)}}
    }
    return undefined
  }
  async function requestAdmission(sessionId:string){
    if(busy||!online)return
    setBusy(true);setError('')
    try{
      await call('wait_request',sessionId)
      await refresh()
    }catch(e){setError(e instanceof Error?e.message:'Could not request admission. Retry.')}
    finally{setBusy(false)}
  }
  async function decideAdmission(studentId:string,admit:boolean){
    if(!teacher||!room?.id||room.mode!=='open'||busy||!online)return
    setBusy(true);setWaitingError('')
    try{
      await call('wait_decide',room.id,null,{studentId,admit})
      setWaitingRequests(list=>list.filter(item=>item.studentId!==studentId))
      await refresh()
    }catch(e){setWaitingError(e instanceof Error?e.message:'Could not decide admission.')}
    finally{setBusy(false)}
  }

  const initialPastHandled=useRef(false)
  useEffect(()=>{
    if(!teacher||loading||room||!pastAvailable||initialPastHandled.current)return
    if(new URLSearchParams(window.location.search).get('past')!=='1')return
    initialPastHandled.current=true
    if(!pastOpen)void togglePastClasses()
  },[teacher,loading,room,pastAvailable,pastOpen])
  async function togglePastClasses() {
    if (pastOpen) { setPastOpen(false); return }
    setPastOpen(true); setPastLoading(true); setPastError('')
    try {
      const data = await call('past_list')
      if (!Array.isArray(data)) throw new Error('Invalid saved lesson list')
      const valid = data.filter((item): item is PastSummary => {
        if (!item || typeof item !== 'object') return false
        return typeof item.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)
          && typeof item.title === 'string' && item.title.length > 0
          && ['school','tuition','homeschool','open'].includes(item.mode)
          && item.status === 'ended' && typeof item.startedAt === 'string' && Number.isFinite(Date.parse(item.startedAt))
      })
      setPastRooms(valid.slice(0, 30))
    } catch {
      setPastRooms([])
      setPastError('Past classes could not be loaded. Retry when connected.')
    } finally { setPastLoading(false) }
  }
  function leave() {
    if(mutating.current)return
    if(scheduledId){roomUrl(null);window.location.assign(back);return}
    generation.current++;lock.current=false;roomUrl(null);active.current=null;setRoom(null);setReviewId(null);setError('');setLoading(true);void refresh()
  }
  function rememberBoard(){setUndoBoards(history=>[...history.slice(-29),board]);setRedoBoards([])}
  function changeBoard(value:string){if(value!==board){rememberBoard();setBoard(value)}}
  const content=mode==='clock'?clock:mode==='board'?board:body
  const participants=room?.participants??[]
  const subjects=['Mathematics','English','Kiswahili','Science','Creative Arts','CRE','IRE','Social Studies','Agriculture','Pre-Technical Studies'] as const
  const grades=['PP1','PP2',...Array.from({length:9},(_,i)=>'Grade '+(i+1)),...Array.from({length:4},(_,i)=>'Form '+(i+1))]
  const matchLabel=(title:string,label:string)=>(' '+title.toLocaleLowerCase('en').split(/[^a-z0-9]+/).join(' ')+' ').includes(' '+label.toLocaleLowerCase('en')+' ')
  const linkedRooms=rooms.filter(item=>item.mode!=='open'&&item.canJoin)
  const visibleRooms=rooms.filter(item=>teacher||(
    (scope==='all'||item.mode===scope)
    &&(subjectFilter==='all'||matchLabel(item.title,subjectFilter))
    &&(gradeFilter==='all'||matchLabel(item.title,gradeFilter))
    &&(!search.trim()||[item.title,item.teacherName??''].some(text=>text.toLowerCase().includes(search.trim().toLowerCase())))
  )).sort((a,b)=>Number(b.id===sharedId)-Number(a.id===sharedId)||Number(a.mode==='open')-Number(b.mode==='open'))
  const prompt=room?.prompt
  const history=room?historyFor(room):[]
  const teachingPhase=room?.teachingPhase??(prompt&&['quiz','exercise','poll'].includes(prompt.kind)?'activity':'teaching')
  const lessonMaterials=history.filter(item=>item.kind==='teach'||item.kind==='board')
  const lessonActivities=history.filter(item=>['quiz','exercise','poll'].includes(item.kind))
  const viewedPrompt=(reviewId?history.find(p=>p.id===reviewId):null)??prompt
  const workPromptId=viewedPrompt?.id??'general'
  const workDraft=workingByPrompt[workPromptId]??''
  const answerChoices=prompt&&['quiz','exercise','poll'].includes(prompt.kind)?liveAnswerChoices(prompt.body):[]
  function updateWorkDraft(text:string){setWorkingByPrompt(items=>({...items,[workPromptId]:text}))}
  function moveWorkToNotes(){
    const next=addWorkToPrivateNotes(noteDraft,workDraft)
    if(next===null){setError('Your workpad is empty or private notes have reached their limit.');return}
    noteDirty.current=true;setNoteDraft(next);setLearnerTool('notes');setError('')
  }
  // Learners follow the teacher by default, but are never locked to the
  // presenter. The same ratio adapts to different Android screen heights.
  useEffect(()=>{
    if(teacher||!followingTeacher||!room||room.status==='ended'||
       typeof room.presentedSeq!=='number')return
    const desired=room.presentedPromptId??room.prompt?.id
    if(!desired||!history.some(item=>item.id===desired))return
    if(viewedPrompt?.id!==desired){
      setReviewId(desired===room.prompt?.id?null:desired)
      return
    }
    const element=stageScrollRef.current
    if(!element)return
    const max=Math.max(0,element.scrollHeight-element.clientHeight)
    const ratio=Math.min(1,Math.max(0,Number(room.presentedScrollRatio??0)))
    const target=max*ratio
    if(Math.abs(element.scrollTop-target)>3)element.scrollTop=target
  },[teacher,followingTeacher,room?.id,room?.status,room?.presentedSeq,
     room?.presentedPromptId,room?.presentedScrollRatio,viewedPrompt?.id])
  const immersive=!!room&&room.status!=='ended'
  const draftLoading=teacher&&!!room&&draftBinding?.roomId!==room.id&&!draftWarning
  // Report the saved state of the *current* draft, not a previous snapshot.
  const currentDraftFingerprint=stableDraftFingerprint({board,boardPages:boardPages.map((p,i)=>i===boardPage?board:p),boardPage,slides,slideIndex,mode,body,key:'',clock,composers:Object.fromEntries(Object.entries(composerDrafts.current).map(([m,d])=>[m,{...d,key:''}]))})
  const currentWorkspaceStatus=workspaceStatus==='Draft saved'&&currentDraftFingerprint!==workspaceSaved.current?'Draft changes pending…':workspaceStatus
  useEffect(()=>{
    const restored=teacher&&room&&room.status!=='ended'&&room.presentedPromptId&&history.some(item=>item.id===room.presentedPromptId)?room.presentedPromptId:null
    pendingTeacherViewport.current=room&&restored?{roomId:room.id,promptId:restored,ratio:Math.min(1,Math.max(0,Number(room.presentedScrollRatio??0)||0))}:null
    setSelfPaced(false);setReviewId(restored&&restored!==room?.prompt?.id?restored:null);setDraftBinding(null);draftKey.current=null;setWorkspaceRevision(null);setWorkspaceStatus('');workspaceSaved.current='';workspaceSaving.current=null;setConflictDraft(null);composerDrafts.current={};pendingPublish.current=null;setDraftWarning(false);setMode('teach');setClock('10:30');boardInitialized.current=false;setBoardPages(['']);setBoardPage(0);setPanel(null);setFocusMode(false);setEditingBoard(false);setShowSticker(true);setEndConfirm(false);setBoard('');setUndoBoards([]);setRedoBoards([]);boardUndoByPage.current={};setFocusDock(false);setSlides([{title:'',body:''}]);setSlideIndex(0);setDeletedSlide(null);setBody('');setKey('')
  },[room?.id])
  // Restore the last acknowledged teacher viewport on entry only. Ordinary
  // polls must not fight the teacher's subsequent navigation.
  useEffect(()=>{
    const pending=pendingTeacherViewport.current
    if(!teacher||!room||!pending||pending.roomId!==room.id||draftLoading||viewedPrompt?.id!==pending.promptId||panel||contentTab||editingBoard||rehearsalOpen)return
    const element=stageScrollRef.current
    if(!element)return
    const frame=window.requestAnimationFrame(()=>{
      if(pendingTeacherViewport.current!==pending||active.current?.id!==pending.roomId)return
      element.scrollTop=Math.max(0,element.scrollHeight-element.clientHeight)*pending.ratio
      pendingTeacherViewport.current=null
    })
    return ()=>window.cancelAnimationFrame(frame)
  },[teacher,room?.id,draftLoading,viewedPrompt?.id,panel,contentTab,editingBoard,rehearsalOpen])
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
      else if(preparedDeck.current&&(!instantEntry||preparedRoomId.current===roomId)){
        setSlides(preparedDeck.current.slides);setSlideIndex(0)
        if(instantEntry){setStudioInspector('notes');setPanel('slides')}
      }
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
      if(!instantEntry||preparedRoomId.current===roomId){
        preparedDeck.current=null;setPreparedTitle('');preparedRoomId.current=null
      }
      setBeforeLibrary(false);setDraftBinding({roomId,key})
    }).catch(()=>{if(!cancelled)setDraftWarning(true)})
    return ()=>{cancelled=true}
  },[teacher,room?.id,room?.status==='ended',call,workspaceRetry,revoke,instantEntry])
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
    setDockHidden(true);setToolPickerOpen(false)
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
  const liveVisualBody=liveSlide?visualSlidePayload(liveSlide.body):null
  const originalVisual=liveSlide&&liveSlide.total===slides.length&&slides[liveSlide.number-1]?visualSlidePayload(slides[liveSlide.number-1].body):null
  const visibleObjects=originalVisual!==null&&liveVisualBody!==null?boardRevealCount(originalVisual,liveVisualBody):null
  const objectTotal=originalVisual!==null?decodeBoard(originalVisual)?.objects.length??0:0
  const fullVisualMatch=visibleObjects!==null&&liveSlide&&slides[liveSlide.number-1]?decodeSlide(encodeSlide(slides[liveSlide.number-1],liveSlide.number,slides.length)):null
  const revealMatch=fullVisualMatch&&liveSlide&&JSON.stringify({...fullVisualMatch,body:liveSlide.body})===JSON.stringify(liveSlide)
  const matchedSlide=revealMatch?fullVisualMatch:liveSlide
  const previousLiveSlide=matchedSlide?adjacentSlide(slides,matchedSlide,-1):null
  const nextLiveSlide=matchedSlide?adjacentSlide(slides,matchedSlide,1):null
  const canNavigateSlides=teacher&&!busy&&!draftLoading&&online&&room?.status==='active'
  function editSlide(patch:Partial<LiveSlide>){setSlides(items=>items.map((item,i)=>i===slideIndex?{...item,...patch}:item))}
  const [photoPreparing,setPhotoPreparing]=useState(false)
  const photoLock=useRef(false)
  async function preparePhotoSlide(index:number){
    const item=slides[index],roomId=room?.id
    if(!item||!roomId||photoLock.current||!canNavigateSlides)return
    const doc=decodePhotoSlide(item.body);if(!doc)return
    if(!window.confirm('Prepare these photos and share them with learners when presenting this slide?'))return
    photoLock.current=true;setPhotoPreparing(true);setError('')
    const current=()=>active.current?.id===roomId&&active.current?.status==='active'&&active.current?.teacher===true
    try{
      const deck=await copyPhotoDeck([item],roomId,current)
      if(!current())throw Error('Classroom changed.')
      await shareSlidePhotos(deck[0].body,roomId,current)
      if(!current())throw Error('Classroom changed.')
      const next=deck[0];setSlides(items=>items.map((s,i)=>i===index&&s.body===item.body?next:s))
      const encoded=encodeSlide(next,index+1,slides.length)
      if(encoded)await act('publish',null,{kind:'teach',body:encoded,answerKey:null})
    }catch(e){setError(e instanceof Error?e.message:'Could not prepare photos.')}
    finally{photoLock.current=false;setPhotoPreparing(false)}
  }
  function presentSlide(index:number,revealCount?:number){
    const item=slides[index];if(!item||!canNavigateSlides||photoLock.current)return
    if(studioFile(item)){
      const roomId=room?.id;if(!roomId||!window.confirm('Share this prepared file with the current classroom?'))return
      photoLock.current=true;setPhotoPreparing(true);setError('')
      const current=()=>active.current?.id===roomId&&active.current?.status==='active'&&active.current?.teacher===true
      void presentStudioFile(item,roomId,current).then(async body=>{if(current()&&body)await act('publish',null,{kind:'teach',body,answerKey:null})}).catch(e=>setError(e instanceof Error?e.message:'File preparation failed.')).finally(()=>{photoLock.current=false;setPhotoPreparing(false)})
      return
    }
    const photos=decodePhotoSlide(item.body);if(photos){void preparePhotoSlide(index);return}
    const visual=visualSlidePayload(item.body)
    const partial=revealCount!==undefined&&visual!==null?revealBoard(visual,revealCount):null
    if(revealCount!==undefined&&!partial)return
    const slideText=partial?encodeSlide({...item,body:visualSlideBody(partial)},index+1,slides.length):encodeSlide(item,index+1,slides.length)
    if(!slideText)return
    if(!studioResource(item)){void act('publish',null,{kind:'teach',body:slideText,answerKey:null});return}
    const roomId=room?.id;photoLock.current=true;setPhotoPreparing(true);setError('')
    void validateStudioResources([item]).then(async()=>{if(active.current?.id===roomId&&active.current?.status==='active'&&active.current?.teacher===true)await act('publish',null,{kind:'teach',body:slideText,answerKey:null})}).catch(e=>setError(e instanceof Error?e.message:'Resource verification failed.')).finally(()=>{photoLock.current=false;setPhotoPreparing(false)})
  }
  function moveSlide(delta:number){
    const to=slideIndex+delta;if(to<0||to>=slides.length)return
    setSlides(items=>{const next=[...items];[next[slideIndex],next[to]]=[next[to],next[slideIndex]];return next})
    setSlideIndex(to)
  }
  function addPlanSegments(){
    if(!linkedPlan?.steps.length||busy||draftLoading||conflictDraft||photoPreparing)return
    const available=30-slides.length
    const blank=slides.length===1&&!slides[0].title.trim()&&!slides[0].body.trim()&&!slides[0].notes?.trim()&&(!slides[0].diagram||slides[0].diagram==='none')
    if(linkedPlan.steps.length>available+(blank?1:0)){setError('Not enough room for all plan stages. Remove unused slides first.');return}
    if(!window.confirm('Add private lesson-plan guidance as draft slides? Long notes are limited to 2000 characters. Full guidance remains in the Lesson Plan. Prepare learner-facing content separately.'))return
    const additions:LiveSlide[]=linkedPlan.steps.map(step=>({title:'',body:'',notes:(step.label+'\n'+(step.durationMinutes?step.durationMinutes+' min\n':'')+step.teacherContent).slice(0,2000)}))
    const index=blank?0:slides.length
    setSlides(items=>blank?additions:[...items,...additions]);setSlideIndex(index);setStudioInspector('notes');setStudioReturn(true);openSlides()
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
  function launchSlideAssessment(){
    const activity=liveSlide?decodeAssessment(liveSlide.body):null
    if(!activity||!canNavigateSlides)return
    const question=assessmentPrompt(activity)
    const saved=activity.kind===mode?{body,key}:composerDrafts.current[activity.kind]
    if((saved?.body||saved?.key)&&!window.confirm('Replace the unsent activity draft?'))return
    chooseMode(activity.kind);setBody(question);const draft=liveSlide&&slides[liveSlide.number-1];setKey(draft&&draft.body===liveSlide?.body?preparedAssessment(draft)?.answer??'':'')
  }
  // Match published pages against the private prepared deck. Ad-hoc tools and
  // resource previews can also be encoded as one-slide decks; do not treat
  // those as a teaching position just because they decode as a slide.
  function matchesPreparedPage(item:Prompt){
    const published=item.kind==='teach'?decodeSlide(item.body):null
    if(!published||published.total!==slides.length)return false
    const draft=slides[published.number-1]
    if(!draft)return false
    const encoded=encodeSlide(draft,published.number,slides.length)
    if(encoded===item.body)return true
    const full=decodeSlide(encoded)
    const original=visualSlidePayload(draft.body),shared=visualSlidePayload(published.body)
    return !!full&&original!==null&&shared!==null&&boardRevealCount(original,shared)!==null&&JSON.stringify({...full,body:published.body})===JSON.stringify(published)
  }
  const preparedHistoryPrompt=!draftLoading&&!conflictDraft?[...history].reverse().find(matchesPreparedPage):undefined
  const lastSlidePrompt=preparedHistoryPrompt??[...history].reverse().find(item=>item.kind==='teach'&&decodeSlide(item.body))
  const lastPresentedSlide=lastSlidePrompt?decodeSlide(lastSlidePrompt.body):null
  const presenterSlide=matchedSlide&&matchedSlide.total===slides.length?slides[matchedSlide.number-1]:null
  const presenterMatches=presenterSlide&&matchedSlide&&encodeSlide(presenterSlide,matchedSlide.number,slides.length)===encodeSlide(matchedSlide,matchedSlide.number,matchedSlide.total)
  const liveNotes=presenterMatches?presenterNotes(presenterSlide.notes):''
  const plannedMinutes=presenterMatches?studioMinutes(presenterSlide):0
  const upcomingSlide=nextLiveSlide===null?null:slides[nextLiveSlide]
  const currentAssessment=liveSlide?decodeAssessment(liveSlide.body):null
  const interruptedPresentation=prompt&&(prompt.kind==='board'||prompt.kind==='clock'||(prompt.kind==='teach'&&!presenterMatches))
  const returnPrompt=interruptedPresentation?(preparedHistoryPrompt??(prompt.kind==='board'&&!draftLoading&&!conflictDraft?lastSlidePrompt:undefined)):undefined
  const returnSlide=returnPrompt?decodeSlide(returnPrompt.body):null
  async function returnToPreparedSlide(){
    if(!returnPrompt||!returnSlide||!canNavigateSlides||photoLock.current||conflictDraft)return
    const next=await act('publish',null,{kind:'teach',body:returnPrompt.body,answerKey:null})
    if(next?.prompt?.body===returnPrompt.body){
      setContentTab(null);setEditingBoard(false);setPanel(null)
      if(returnSlide.total===slides.length)setSlideIndex(returnSlide.number-1)
    }
  }

  function startPreparedActivity(){
    if(!currentAssessment||!canNavigateSlides)return
    const answerKey=presenterMatches?preparedAssessment(presenterSlide)?.answer??null:null
    void act('publish',null,{kind:currentAssessment.kind,body:assessmentPrompt(currentAssessment),answerKey})
  }
  const resumeAfterActivity=lastPresentedSlide?adjacentSlide(slides,lastPresentedSlide,1):null
  function reuseQuestion(item:Prompt){
    if(!teacher||busy||draftLoading||room?.status!=='active'||!['quiz','exercise','poll'].includes(item.kind))return
    const saved=item.kind===mode?{body,key}:composerDrafts.current[item.kind]
    if((saved?.body||saved?.key)&&(saved.body!==item.body||saved.key!==(item.answerKey??''))&&!window.confirm('Replace the unsent question draft? Previous shared questions and answers will remain.'))return
    chooseMode(item.kind)
    setBody(item.body);setKey(item.answerKey??'')
  }
  function askTeacher(){
    const body=questionDraft.trim();if(!body||busy)return
    if(questionRequest.current?.body!==body)questionRequest.current={body,id:crypto.randomUUID()}
    void act('ask',null,{body,requestId:questionRequest.current.id})
  }
  function openContent(tab:ContentTab='resources'){setContentFeedback('');setContentTab(tab);setPremiumMenu(null)}
  function addContentDeck(additions:LiveSlide[]){
    if(!teacher||draftLoading||busy||conflictDraft||photoLock.current){setContentFeedback('The draft is unavailable.');return}
    if(!additions.length||!additions.every(validSlide)){setContentFeedback('This content cannot be added.');return}
    const blank=slides.length===1&&!slides[0].title.trim()&&!slides[0].body.trim()&&!slides[0].notes?.trim()&&(!slides[0].diagram||slides[0].diagram==='none')
    if((blank?0:slides.length)+additions.length>30){setContentFeedback('The lesson can hold up to 30 slides. Remove unused slides first.');return}
    setSlides(items=>blank?additions:[...items,...additions])
    setContentFeedback(additions.length===1?'Added privately to the lesson.':`Added ${additions.length} slides privately to the lesson.`)
  }
  async function showContentSlide(item:LiveSlide){
    const roomId=room?.id;if(!roomId||!canNavigateSlides||photoLock.current)throw Error('Classroom is not ready to share.')
    const current=()=>active.current?.id===roomId&&active.current?.status==='active'&&active.current?.teacher===true&&navigator.onLine
    photoLock.current=true;setPhotoPreparing(true)
    try{
      await validateStudioResources([item])
      let encoded:string|null
      if(studioFile(item))encoded=await presentStudioFile(item,roomId,current)
      else if(decodePhotoSlide(item.body)){const deck=await copyPhotoDeck([item],roomId,current);await shareSlidePhotos(deck[0].body,roomId,current);encoded=encodeSlide(deck[0],1,1)}
      else encoded=encodeSlide(item,1,1)
      if(!current()||!encoded)throw Error('Content is no longer ready to share.')
      const next=await act('publish',null,{kind:'teach',body:encoded,answerKey:null})
      if(!next)throw Error('Content could not be shown. Retry when connected.')
    }finally{photoLock.current=false;setPhotoPreparing(false)}
  }
  function openExecutiveInvite(){if(!room)return;setEndConfirm(false);setInviteFeedback('');setShareLink(new URL(scheduledId?'/tuition/lessons/'+encodeURIComponent(scheduledId):'/student/live?room='+encodeURIComponent(room.id),window.location.origin).href);setExecutiveInvite(true)}
  function openSlides(){setDockHidden(true);setToolPickerOpen(false);setReviewId(null);setEditingBoard(false);setEndConfirm(false);setPanel('slides')}
  function openCurrentSlide(){
    if(!liveSlide||draftLoading||busy||conflictDraft)return
    if(process.env.NEXT_PUBLIC_VIBE_LIVE_SLIDE_UPDATE_ENABLED==='true'&&teacher&&room?.status==='active'&&prompt&&canEditCurrentSlide(prompt.body)){
      liveEditTarget.current={roomId:room.id,promptId:prompt.id};openSlides();setPanel('live-slide');return
    }
    const index=liveSlide.number-1
    const candidate=slides[index]
    const canonical=candidate&&slides.length===liveSlide.total?decodeSlide(encodeSlide(candidate,liveSlide.number,slides.length)):null
    if(canonical&&(JSON.stringify(canonical)===JSON.stringify(liveSlide)||revealMatch)){
      setSlideIndex(index);openSlides();return
    }
    const total=liveSlide.total
    const published:LiveSlide={title:liveSlide.title,body:liveSlide.body,diagram:liveSlide.diagram,theme:liveSlide.theme,layout:liveSlide.layout,font:liveSlide.font}
    if(slides.length===total){
      if(candidate&&(candidate.title.trim()||candidate.body.trim()||candidate.diagram&&candidate.diagram!=='none')&&!window.confirm('The draft differs from the displayed slide. Restore the displayed content into this slide? Private notes are retained.'))return
      setSlides(items=>items.map((item,i)=>i===index?{...published,notes:item.notes}:item))
    }else{
      if(slides.some(item=>item.title.trim()||item.body.trim()||item.notes?.trim()||item.diagram&&item.diagram!=='none')&&!window.confirm('The draft belongs to a different deck. Restore the displayed presentation from class history? This replaces the private draft deck.'))return
      const restored=Array.from({length:total},()=>({title:'',body:''} as LiveSlide))
      if(room)for(const item of historyFor(room)){
        const saved=item.kind==='teach'?decodeSlide(item.body):null
        if(saved&&saved.total===total)restored[saved.number-1]={title:saved.title,body:saved.body,diagram:saved.diagram,theme:saved.theme,layout:saved.layout,font:saved.font}
      }
      restored[index]=published
      setSlides(restored);setDeletedSlide(null)
    }
    setSlideIndex(index);openSlides()
  }
  async function syncCurrentSlide(expected:string,body:string):Promise<string|undefined>{
    const current=active.current,target=liveEditTarget.current
    if(!target||!current||current.id!==target.roomId||current.prompt?.id!==target.promptId||current.status!=='active'||!current.teacher||!online||mutating.current)return undefined
    if(current.prompt.body!==expected&&current.prompt.body!==body)return undefined
    const next=current.prompt.body===body?current:await act('slide_update',current.id,{promptId:target.promptId,expectedBody:expected,body})
    if(!next||next.id!==target.roomId||next.prompt?.id!==target.promptId||next.prompt.body!==body)return undefined
    const published=decodeSlide(body)
    if(published)setSlides(items=>{
      const index=published.number-1,item=items[index]
      if(!item||items.length!==published.total||encodeSlide(item,index+1,items.length)!==expected)return items
      return items.map((entry,i)=>i===index?{title:published.title,body:published.body,diagram:published.diagram,theme:published.theme,layout:published.layout,font:published.font,notes:entry.notes}:entry)
    })
    return body
  }
  function useMaterial(material:{title:string;slides:LiveSlide[]}){
    if(room&&room.status!=='ended'){if(!window.confirm('Replace the current draft deck? Shared lesson history remains.'))return;setSlides(material.slides);setSlideIndex(0);setDeletedSlide(null);openSlides()}
    else {preparedDeck.current={title:material.title,slides:material.slides};setPreparedTitle(material.title);setTitle(material.title);setBeforeLibrary(false)}
  }

  async function attachPlanPresentation(material:{id:string;title:string;slides:LiveSlide[]}){
    if(!linkedPlan||linkedPlan.id!==selectedPlanId||active.current)throw new Error('Select a Lesson Plan before attaching a presentation.')
    const result=await supabase.rpc('vibe_live_plan_presentation',{
      p_plan_id:linkedPlan.id,p_presentation_id:material.id,p_write:true,
    })
    if(result.error||result.data!==material.id)throw new Error('Could not attach this presentation to the Lesson Plan.')
    setAttachedPresentation(material.id)
    preparedDeck.current={title:material.title,slides:material.slides}
    setPreparedTitle(material.title)
    setAttachingPlan(false)
    setBeforeLibrary(false)
  }

  if(teacher&&rehearsalOpen&&!room&&!loading)return <main className={styles.live} aria-label="Private rehearsal"><StudioRehearsal slides={preparedDeck.current?.slides??[]} title={preparedTitle||'Untitled lesson'} onClose={()=>setRehearsalOpen(false)} /></main>
  if(immersive&&room){
    const stage=<main ref={immersiveRef} tabIndex={-1} className={instantEntry&&teacher?styles.immersive+" "+styles.premium:styles.immersive} role="dialog" aria-modal="true" aria-label="Live classroom" onKeyDown={e=>{if((e.target as HTMLElement).closest('dialog'))return;if(instantEntry&&teacher&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!endConfirm&&!executiveInvite){e.preventDefault();setPremiumMenu(null);setCommandOpen(true);return}if(e.key==='Escape'){if(endConfirm)setEndConfirm(false);else if(premiumMenu)setPremiumMenu(null);else if(contentTab){if(!photoPreparing)setContentTab(null)}else if(rehearsalOpen)setRehearsalOpen(false);else if(panel)setPanel(null);else if(focusMode)toggleFocus()}if(e.key==='Tab'&&immersiveRef.current){const controls=Array.from(immersiveRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')).filter(el=>el.offsetParent!==null);const first=controls[0],last=controls[controls.length-1];if(first&&last){if(e.shiftKey&&(document.activeElement===first||document.activeElement===immersiveRef.current)){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}}}>
    <header className={styles.liveTop}><button type="button" onClick={leave} disabled={busy} aria-label="Leave classroom"><X size={19}/></button><div className={styles.liveTitle}><strong>{room.title}</strong><small><span className={styles.liveDot} data-paused={room.status==='paused'}/>{!online||error?<WifiOff size={13} aria-hidden="true"/>:<Wifi size={13} aria-hidden="true"/>}{room.status==='active'?'LIVE':'PAUSED'} · {classroomLabels[room.mode]} · {phaseLabels[teachingPhase]} · {!online?'Offline':error?'Reconnecting':lastSync?'Connected':'Syncing'}</small></div>{instantEntry&&teacher&&(!focusMode||focusDock)&&<nav aria-label="Classroom menus" className={styles.premiumMenu}>
      <div className={styles.executiveModes} role="group" aria-label="Teaching workspace">
        <button type="button" aria-pressed={panel!=='slides'&&panel!=='library'&&panel!=='production'&&panel!=='live-slide'&&!rehearsalOpen} onClick={()=>{setRehearsalOpen(false);setReviewId(null);setEditingBoard(false);setPanel(null);setDockHidden(true);setPremiumMenu(null)}}><BookOpen size={17}/>Teach</button>
        <button type="button" disabled={draftLoading} aria-pressed={panel==='slides'||panel==='library'||panel==='live-slide'||rehearsalOpen} onClick={()=>{setRehearsalOpen(false);setStudioReturn(false);setPremiumMenu(null);openSlides()}}><PanelTop size={17}/>Prepare</button>
        <button type="button" disabled={draftLoading} aria-pressed={panel==='production'&&!rehearsalOpen} onClick={()=>{setRehearsalOpen(false);setEditingBoard(false);setReviewId(null);setStudioReturn(false);setPanel('production');setDockHidden(true);setPremiumMenu(null)}}><Video size={17}/>Produce</button>
      </div>
      <div className={styles.premiumMenuGroup}><button type="button" aria-expanded={premiumMenu==='More'} onClick={()=>setPremiumMenu(v=>v==='More'?null:'More')}><MoreHorizontal size={18}/> More <ChevronDown size={14}/></button>{premiumMenu==='More'&&<div className={styles.premiumDropdown} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setPremiumMenu(null)}}}>{([['Teaching shortcuts and phases',()=>{setDockHidden(v=>!v);setToolPickerOpen(false)}],['Clock',()=>chooseMode('clock')],['Teach text',()=>chooseMode('teach')],['Classroom tools',()=>{setEditingBoard(false);setEndConfirm(false);setPanel('more')}],['Full screen',toggleFocus]] as [string,()=>void][]).map(([label,run])=><button type="button" key={label} disabled={draftLoading} onClick={()=>{setPremiumMenu(null);setRehearsalOpen(false);run()}}>{label}</button>)}</div>}</div>
    </nav>}
      {instantEntry&&teacher&&(!focusMode||focusDock)&&<div className={styles.compactTiming}><TeachingElapsed firstSharedAt={room.history?.[0]?.createdAt}/>{panel===null&&!contentTab&&!editingBoard&&!rehearsalOpen&&reviewId===null&&<button type="button" disabled={busy||draftLoading||photoPreparing||!!conflictDraft||!slides.some((item,i)=>!!encodeSlide(item,i+1,slides.length))} onClick={()=>{setStudioReturn(false);setStudioMonitor('next');if(nextLiveSlide!==null)setSlideIndex(nextLiveSlide);setDockHidden(true);setPremiumMenu(null);setPanel('production')}}>Preview slides</button>}</div>}
      <div className={styles.headerActions}>{instantEntry&&teacher&&<button type="button" className={styles.executiveSearchButton} title="Find a teaching action (Ctrl+K)" aria-label="Find a teaching action" onClick={()=>{setPremiumMenu(null);setCommandOpen(true)}}><Search size={18}/><span>Find</span><kbd>Ctrl K</kbd></button>}<button type="button" aria-label={focusMode?'Exit full screen':'Full screen'} aria-pressed={focusMode} onClick={toggleFocus}>{focusMode?<Minimize size={20}/>:<Maximize size={20}/>}</button>{focusMode&&<button type="button" aria-label={focusDock?'Hide classroom controls':'Show classroom controls'} aria-pressed={focusDock} onClick={()=>setFocusDock(v=>!v)}><MoreHorizontal size={20}/></button>}</div>{!instantEntry&&<div className={styles.voiceSlot}><LiveVoice key={room.id} enabled={process.env.NEXT_PUBLIC_VIBE_LIVE_VOICE_ENABLED==='true'} roomId={room.id} classId={classId} teacher={teacher} status={room.status} learners={participants} onAcknowledge={async studentId=>{const next=await call('ack',room.id,null,{studentId}) as Room;accept(next)}}/></div>}{instantEntry&&teacher&&<button type="button" className={styles.danger} onClick={()=>{setEndConfirm(true);setPremiumMenu(null)}}>End class</button>}</header>
    {teacher&&room.mode==='school'&&<LiveLessonReview roomId={room.id} roomStatus={room.status} preparedPlanId={linkedPlan?.id??null} selectedPlanId={selectedPlanId} classId={classId??''} savedPlans={savedPlans} onSelectPlan={setSelectedPlanId}/>}
    {error&&<div role="alert" className={styles.liveAlert}>{error} <button onClick={()=>void refresh()}>Retry</button></div>}
    {draftWarning&&teacher&&<div role="status" className={styles.liveAlert}>Local recovery unavailable. Shared pages are saved on the server.</div>}
    {teacher&&linkedPlanError&&<div role="alert" className={styles.liveAlert}>{linkedPlanError}</div>}
    {teacher&&currentWorkspaceStatus&&<span className={styles.srOnly} role="status">{currentWorkspaceStatus}</span>}
    {teacher&&workspaceStatus&&(workspaceRevision===null||!!conflictDraft)&&<div className={styles.workspaceStatus} role="alert">{workspaceStatus}{workspaceRevision===null&&draftBinding&&<button type="button" onClick={()=>{setDraftBinding(null);setWorkspaceRetry(n=>n+1)}}>Retry draft sync</button>}{conflictDraft&&<><button type="button" onClick={()=>{restoreDraft(conflictDraft);setConflictDraft(null)}}>Restore local copy</button><button type="button" onClick={()=>setConflictDraft(null)}>Keep server copy</button></>}</div>}
    {(history.length>1||reviewId!==null)&&<LessonNavigation items={history} reviewId={reviewId} onReview={id=>{
      pendingTeacherViewport.current=null;setEditingBoard(false);setPanel(null);setReviewId(id)
      if(stageScrollRef.current)stageScrollRef.current.scrollTop=0
      if(teacher){if(room.status==='active'&&(id??prompt?.id))queuePresenter(id??prompt!.id,0,true)}
      else setFollowingTeacher(id===null)
    }}/>} 
    {!teacher&&typeof room.presentedSeq==='number'&&<div className={styles.followBar} role="group" aria-label="Reading position">
      <span role="status">{followingTeacher?'Following teacher':'Browsing independently'}</span>
      <button type="button" aria-pressed={followingTeacher} onClick={()=>setFollowingTeacher(value=>!value)}>
        {followingTeacher?'Browse freely':'Jump to teacher'}</button>
    </div>}
    {!teacher&&Number(room.dmUnread)>0&&!privateOpen&&<button type="button" className={styles.helpBanner} onClick={()=>{setPrivateOpen(true);setLearnerTool(null)}}><MessageSquare size={16}/> {room.dmUnread} private {room.dmUnread===1?'message':'messages'} from your teacher</button>}
    {teacher&&room.mode==='open'&&Number(room.waitingCount)>0&&<button type="button" className={styles.helpBanner} onClick={()=>setPanel('learners')}>Waiting room · {room.waitingCount} request{room.waitingCount===1?'':'s'}</button>}
    {teacher&&participants.some(p=>p.needsHelp)&&<button className={styles.helpBanner} type="button" onClick={()=>setPanel('learners')}><Hand size={16}/> {participants.filter(p=>p.needsHelp).length} need help</button>}
    {!teacher&&(room.needsHelp||room.handAckAt)&&<div className={styles.handStatus} role="status"><span>{room.needsHelp?'Hand raised — teacher notified':'Teacher acknowledged your hand'}</span>{!room.needsHelp&&room.handAckAt&&<button type="button" onClick={()=>{setLearnerTool('ask');setReviewId(null)}}>Ask privately</button>}</div>}
    <div className={styles.stage} data-executive={instantEntry&&teacher} data-content-open={!!contentTab} data-rail={instantEntry&&teacher&&(!focusMode||focusDock)}>
      {instantEntry&&teacher&&(!focusMode||focusDock)&&<nav className={styles.executiveRail} aria-label="Classroom tool rail">
        {([{label:'Tools',icon:MoreHorizontal,active:panel==='interactive',run:()=>{setEditingBoard(false);setPanel(panel==='interactive'?null:'interactive')}},{label:'Board',icon:Pencil,active:editingBoard,run:()=>chooseMode('board')},{label:'Add content',icon:BookOpen,active:!!contentTab,run:()=>contentTab?setContentTab(null):openContent(linkedPlan?'lesson':'resources')},{label:'Activities',icon:ClipboardList,active:panel==='activity'||panel==='compose'&&['quiz','exercise','poll'].includes(mode),run:()=>{setEditingBoard(false);setPanel(panel==='activity'?null:'activity')}},{label:'Plan',icon:NotebookPen,active:panel==='plan',run:()=>{setEditingBoard(false);setPanel(panel==='plan'?null:'plan')}},{label:'Learners',icon:Users,active:panel==='learners',run:()=>{setEditingBoard(false);setPanel(panel==='learners'?null:'learners')}},{label:'Chat',icon:MessageSquare,active:panel==='chat',run:()=>{setEditingBoard(false);setPanel(panel==='chat'?null:'chat')}}]).map(({label,icon:Icon,active,run})=><button type="button" key={label} title={label} aria-pressed={active} disabled={draftLoading||label==='Plan'&&!linkedPlan||label==='Add content'&&photoPreparing} onClick={()=>{setPremiumMenu(null);setRehearsalOpen(false);setEndConfirm(false);run()}}><Icon size={21}/><span>{label}</span></button>)}

      </nav>}
      <section ref={stageScrollRef} className={styles.stageContent}
        data-board-edit={editingBoard&&teacher&&!contentTab} data-workspace={contentTab?'content':rehearsalOpen?'rehearsal':panel==='slides'?'prepare':panel==='production'?'produce':'teach'}
        aria-label={contentTab?'Now showing':editingBoard&&teacher?'Draft drawing board':'Shared lesson'}
        onScroll={event=>{
          if(!teacher||pendingTeacherViewport.current||contentTab||panel||rehearsalOpen||editingBoard||room.status!=='active'||!viewedPrompt)return
          const element=event.currentTarget
          const max=element.scrollHeight-element.clientHeight
          queuePresenter(viewedPrompt.id,max>0?element.scrollTop/max:0)
        }}
        onWheel={()=>{if(!teacher)setFollowingTeacher(false)}}
        onTouchMove={()=>{if(!teacher)setFollowingTeacher(false)}}
        onKeyDown={event=>{
          if(!teacher&&['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))
            setFollowingTeacher(false)
        }}>
        {teacher&&contentTab?<section className={styles.contentNowShowing}><header><strong>Now showing</strong><small>{room.status==='active'?'Visible to learners':'Paused'}</small></header><div className={styles.contentCurrentCanvas}>{prompt?<SharedPrompt prompt={prompt} roomId={room.id}/>:<p>Nothing shared yet. Choose content to show to the class.</p>}</div><small role="status">{contentFeedback}</small></section>:teacher&&rehearsalOpen?<StudioRehearsal slides={slides} title={room.title} roomId={room.id} onClose={()=>setRehearsalOpen(false)} />:teacher&&panel==='production'?<div className={styles.productionWorkspace} aria-label="Live Production Studio">
          <header className={styles.studioHeading}><div><strong>Teach live</strong><small>Choose what learners see next</small></div><div className={styles.studioActions}><button type="button" onClick={()=>{setStudioReturn(true);openSlides()}}>Prepare slides</button><button type="button" onClick={()=>{setStudioReturn(false);setPanel(null)}}>Standard classroom</button><button type="button" aria-expanded={studioAdvanced} onClick={()=>setStudioAdvanced(v=>!v)}><Settings size={16}/> Advanced</button></div></header>
          <div className={styles.studioMonitorTabs} role="group" aria-label="Monitor view"><button type="button" aria-pressed={studioMonitor==='now'} onClick={()=>setStudioMonitor('now')}>Now showing</button><button type="button" aria-pressed={studioMonitor==='next'} onClick={()=>setStudioMonitor('next')}>Up next</button></div>
          <div className={styles.productionMonitors} data-monitor={studioMonitor}>
            <section className={styles.productionProgram} aria-label="Shared program monitor"><div className={styles.productionMonitorHeader}><strong>{studioAdvanced?'PROGRAM':'Now showing'}</strong><small>{room.status==='active'?'Learner view':'Paused'}</small></div><div className={styles.studioMonitorCanvas}>{prompt?<SharedPrompt prompt={prompt} roomId={room.id}/>:<p className={styles.productionNotice}>Nothing shared yet. Choose a slide to start.</p>}</div></section>
            <section className={styles.productionPreview}><div className={styles.productionMonitorHeader}><strong>{studioAdvanced?'PREVIEW':'Up next'}</strong><small>Private · {slideIndex+1}/{slides.length}</small></div><div className={styles.studioMonitorCanvas}>{slide&&<SlideCanvas slide={slide} number={slideIndex+1} total={slides.length} roomId={room.id} ownerPhotoPreview/>}</div></section>
          </div>
          <div className={styles.studioTransport}><button type="button" disabled={busy||!liveSlide||draftLoading||!!conflictDraft} onClick={()=>{setStudioReturn(true);openCurrentSlide()}}>Edit current</button><button type="button" disabled={busy||slideIndex===0} onClick={()=>setSlideIndex(i=>i-1)} aria-label="Select previous slide">‹</button><button className={styles.primary} type="button" disabled={!canNavigateSlides||photoPreparing||!slideText||!!conflictDraft} onClick={()=>presentSlide(slideIndex)}>{photoPreparing?'Preparing…':studioAdvanced?'Take Live · Cut':'Show selected slide'}</button><button type="button" disabled={busy||slideIndex>=slides.length-1} onClick={()=>setSlideIndex(i=>i+1)} aria-label="Select next slide">›</button></div>
          {slide&&visualSlidePayload(slide.body)!==null&&!studioResource(slide)&&!studioFile(slide)&&<div className={styles.studioTransport} aria-label="Selected slide effects"><button type="button" disabled={!canNavigateSlides||photoPreparing||!!conflictDraft||!slideText} onClick={()=>presentSlide(slideIndex,0)}>Show with step-by-step reveal</button></div>}
          {liveSlide&&revealMatch&&visibleObjects!==null&&objectTotal>0&&<div className={styles.studioTransport} aria-label="Live object reveal"><button type="button" disabled={!canNavigateSlides||photoPreparing||!!conflictDraft||visibleObjects===0} onClick={()=>presentSlide(liveSlide.number-1,visibleObjects-1)}>Hide last object</button><span aria-live="polite">{visibleObjects} / {objectTotal} objects</span><button type="button" className={styles.primary} disabled={!canNavigateSlides||photoPreparing||!!conflictDraft||visibleObjects>=objectTotal} onClick={()=>presentSlide(liveSlide.number-1,visibleObjects+1)}>Reveal next object</button></div>}
          <div className={styles.studioLower}><section className={styles.productionRundown}><div className={styles.studioSectionTitle}><strong>Lesson sequence</strong><button type="button" disabled={busy||slides.length>=30||draftLoading||!!conflictDraft} aria-expanded={studioAddOpen} onClick={()=>setStudioAddOpen(v=>!v)}>{instantEntry?'Edit sequence':'+ Add content'}</button></div>{studioAddOpen&&<div className={styles.studioQuickPanel}><button type="button" onClick={()=>{setStudioAddOpen(false);setStudioReturn(true);setStudioInspector('content');addSlide();openSlides()}}>New content segment</button><button type="button" onClick={()=>{setStudioAddOpen(false);setStudioReturn(true);setStudioInspector('content');addSlide(true);openSlides()}}>Duplicate selected segment</button><button type="button" onClick={()=>{setStudioAddOpen(false);setStudioReturn(true);setStudioInspector('content');openSlides()}}>Edit selected content</button>{linkedPlan&&<button type="button" onClick={()=>{setStudioAddOpen(false);addPlanSegments()}}>Add lesson-plan stages</button>}<small>Text, photos, demonstrations and activities are available in the content editor.</small></div>}{slides.map((item,i)=><button type="button" key={i} aria-pressed={slideIndex===i} disabled={busy||photoPreparing} onClick={()=>{setSlideIndex(i);setStudioMonitor('next')}}><span>{String(i+1).padStart(2,'0')}</span><span>{item.title.trim()||'Untitled slide'}</span>{liveSlide&&liveSlide.total===slides.length&&liveSlide.number===i+1&&JSON.stringify(decodeSlide(encodeSlide(item,i+1,slides.length)))===JSON.stringify(liveSlide)&&<small className={styles.studioOnAir}>LIVE</small>}{slideIndex===i&&<small>NEXT</small>}</button>)}</section><section className={styles.studioQuickPanel}><strong>Teaching tools</strong>{linkedPlan?.steps.length? <div className={styles.studioPlanCue}><label>Current plan guidance<select value={Math.min(planPhase,linkedPlan.steps.length-1)} onChange={e=>setPlanPhase(Number(e.target.value))}>{linkedPlan.steps.map((step,i)=><option key={step.id} value={i}>{step.label}</option>)}</select></label><details><summary>Private teaching guidance</summary><p>{linkedPlan.steps[Math.min(planPhase,linkedPlan.steps.length-1)].teacherContent}</p></details></div>:null}{linkedPlan&&<><button type="button" onClick={()=>setPanel('plan')}>Lesson plan · {linkedPlan.title}</button><button type="button" disabled={busy||draftLoading||!!conflictDraft} onClick={addPlanSegments}>Prepare plan stages</button></>}{liveSlide&&decodeAssessment(liveSlide.body)&&<button type="button" disabled={!canNavigateSlides} onClick={launchSlideAssessment}>Launch activity</button>}<button type="button" onClick={()=>{setStudioReturn(true);openSlides()}}>Edit selected slide</button><button type="button" onClick={()=>instantEntry?openContent('presentations'):setPanel('library')}>My presentations</button><button type="button" onClick={()=>instantEntry?openContent('resources'):setPanel('resources')}>Resources</button><button type="button" onClick={()=>chooseMode('quiz')}>Ask a question</button><button type="button" onClick={()=>setPanel('learners')}>Learner responses</button>{studioAdvanced&&<><small>Transition: Cut. Visual objects can be revealed one at a time.</small><small>Audio controls remain below the workspace. Fade, timeline and media mixing are not yet available.</small></>}</section></div>
          <details className={styles.studioPlanCue}><summary>Delivery record · {history.length} shared items</summary><p>{history.filter(item=>item.kind==='teach'&&decodeSlide(item.body)).length} slide presentations · {history.filter(item=>['quiz','exercise','poll'].includes(item.kind)).length} activities shared</p><small>Actual shared items, not completed plan stages or scored learning outcomes.</small></details><small role="status">{workspaceStatus||'Private draft'} · Only shared content is visible to learners.</small>
        </div>:teacher&&panel==='resources'?<div className={styles.resourceWorkspace}><LiveResourcePicker classId={room.mode==='school'?classId:null} lessonPlanId={room.mode==='school'?linkedPlan?.id??null:null} schemeLessonId={room.mode==='school'?linkedPlan?.schemeId??null:null} canPresent={!busy&&online&&room.status==='active'} onPresent={body=>void act('publish',null,{kind:'teach',body,answerKey:null})} onClose={()=>setPanel(null)}/><LiveClassFiles roomId={room.id} teacher status={room.status} onPresentFile={reference=>{if(!busy&&online&&room.status==='active')void act('publish',null,{kind:'teach',body:reference,answerKey:null})}}/></div>:teacher&&panel==='library'?<div className={styles.slideWorkspace}><div className={styles.slideToolbar}><strong>My Presentations</strong><button onClick={openSlides}>Back to slides</button></div><TeachingLibrary command={call} currentDeck={slides} onUse={useMaterial}/></div>:teacher&&panel==='live-slide'?<>{liveEditTarget.current?.roomId===room.id&&liveEditTarget.current?.promptId===prompt?.id&&prompt&&canEditCurrentSlide(prompt.body)?<LiveCurrentSlideEditor key={room.id+':'+prompt.id} body={prompt.body} roomId={room.id} active={online&&room.status==='active'} busy={busy} onSync={syncCurrentSlide} onClose={()=>{setPanel(studioReturn?'production':null);setStudioReturn(false)}}/>:<section><p>The displayed slide changed. Reopen the current slide to edit.</p><button type="button" onClick={()=>setPanel(null)}>Close</button></section>}</>:teacher&&panel==='slides'&&slide?<div className={styles.slideWorkspace+' '+styles.studioEditor}>
          <header className={styles.studioHeading}><div><strong>Prepare slides</strong><small>{workspaceStatus||'Draft'} · {slideIndex+1} / {slides.length}</small></div><div className={styles.studioActions}><button type="button" disabled={busy||photoPreparing||draftLoading||!!conflictDraft} onClick={()=>setRehearsalOpen(true)}>Rehearse privately</button><button type="button" onClick={()=>instantEntry?openContent('presentations'):setPanel('library')}>My presentations</button>{instantEntry&&<button type="button" onClick={()=>{setStudioReturn(false);setPanel('production')}}>Teach live</button>}<button type="button" onClick={()=>{setPanel(studioReturn?'production':null);setStudioReturn(false)}}>Close</button></div></header>
          <div className={styles.studioEditorGrid}>
          <div className={styles.studioCanvas}><SlideCanvas slide={slide} number={slideIndex+1} total={slides.length} roomId={room.id} ownerPhotoPreview/></div>
          <div className={styles.slideStrip} aria-label="Slide thumbnails">{slides.map((item,i)=><button type="button" key={i} aria-label={'Slide '+(i+1)+(item.title.trim()?': '+item.title:'')} aria-pressed={i===slideIndex} disabled={busy} onClick={()=>setSlideIndex(i)}><SlideCanvas slide={item} number={i+1} total={slides.length} mini roomId={room.id} ownerPhotoPreview/></button>)}<button type="button" aria-label="Add slide" disabled={slides.length>=30||busy} onClick={()=>addSlide()}>+ Add</button></div>
          <div className={styles.slideToolbar}><button type="button" disabled={busy||slideIndex===0} onClick={()=>setSlideIndex(i=>i-1)}>Previous preview</button><button type="button" disabled={busy||slideIndex===slides.length-1} onClick={()=>setSlideIndex(i=>i+1)}>Next preview</button><button className={styles.primary} disabled={busy||photoPreparing||!online||room.status!=='active'||!slideText} onClick={()=>presentSlide(slideIndex)}>{photoPreparing?'Preparing photos…':liveSlide&&slideIndex===liveSlide.number-1&&slides.length===liveSlide.total?'Apply & present':'Present slide'}</button>{slide&&visualSlidePayload(slide.body)!==null&&<button type="button" disabled={busy||!online||room.status!=='active'||!slideText} onClick={()=>presentSlide(slideIndex,0)}>Present with object reveals</button>}</div>
          <div className={styles.slideFields+' '+styles.studioInspector}><div className={styles.studioInspectorTabs} role="group" aria-label="Slide editing tools">{([["content","Content"],["design","Design"],["notes","Notes"]] as const).map(([id,label])=><button key={id} type="button" aria-pressed={studioInspector===id} onClick={()=>setStudioInspector(id)}>{label}</button>)}</div><div hidden={studioInspector!=='content'} className={styles.studioInspectorSection}>
            <label>Title<input value={slide.title} maxLength={120} disabled={busy} onChange={e=>editSlide({title:e.target.value})}/></label>
            <SlideBodyEditor key={room.id+':'+slideIndex} slide={slide} roomId={room.id} roomStatus={room.status} disabled={busy||photoPreparing} onChange={body=>editSlide({body})}/><button type="button" disabled={busy||buildTextRevealSlides(slide,31-slides.length).length===0} onClick={()=>{const steps=buildTextRevealSlides(slide,31-slides.length);if(steps.length&&window.confirm('Replace this slide with '+steps.length+' progressive teaching steps?'))setSlides(items=>[...items.slice(0,slideIndex),...steps,...items.slice(slideIndex+1)])}}>Build reveal steps</button>
            </div><div hidden={studioInspector!=='design'} className={styles.studioInspectorSection}><div className={styles.slideOptions}>
              <label>Diagram<select aria-label="Diagram" disabled={busy} value={slide.diagram??'none'} onChange={e=>editSlide({diagram:e.target.value as SlideDiagram})}>{SLIDE_DIAGRAMS.map(d=><option key={d} value={d}>{diagramLabel(d)}</option>)}</select></label>
              <label>Theme<select aria-label="Theme" disabled={busy} value={slide.theme??'paper'} onChange={e=>editSlide({theme:e.target.value as SlideTheme})}>{SLIDE_THEMES.map(t=><option key={t}>{t}</option>)}</select></label>
              <label>Layout<select aria-label="Layout" disabled={busy} value={slide.layout??'wide'} onChange={e=>editSlide({layout:e.target.value==='portrait'?'portrait':'wide'})}><option value="wide">Wide 16:9</option><option value="portrait">Portrait</option></select></label>
              <label>Text size<select aria-label="Text size" disabled={busy} value={slide.font??'normal'} onChange={e=>editSlide({font:e.target.value==='large'?'large':'normal'})}><option value="normal">Normal</option><option value="large">Large</option></select></label>
            </div>
            </div><div hidden={studioInspector!=='notes'} className={styles.studioInspectorSection}><PrivateSlideFields key={room.id+':private:'+slideIndex} slide={slide} disabled={busy} onChange={notes=>editSlide({notes})}/></div>
            <div className={styles.slideToolbar}><button type="button" disabled={busy||slideIndex===0} onClick={()=>moveSlide(-1)}>Move left</button><button type="button" disabled={busy||slideIndex===slides.length-1} onClick={()=>moveSlide(1)}>Move right</button><button type="button" disabled={busy||slides.length>=30} onClick={()=>addSlide(true)}>Duplicate</button><button type="button" disabled={busy||slides.length<=1} onClick={deleteSlide}>Delete</button>{deletedSlide&&<button type="button" disabled={busy||slides.length>=30} onClick={undoSlideDelete}>Undo delete</button>}</div>
            {!slideText&&<small role="status">Add content or shorten text to fit the shared slide limit.</small>}
            <small>{workspaceStatus||'Draft'} · published slides remain in lesson history.</small>
          </div></div>
        </div>:editingBoard&&teacher?<>
          <div className={styles.boardTools}><button aria-label="Previous board page" disabled={busy||boardPage===0} onClick={()=>switchBoardPage(boardPage-1)}>‹</button><span aria-live="polite">Board {boardPage+1} / {boardPages.length}</span><button aria-label="Next board page" disabled={busy||boardPage===boardPages.length-1} onClick={()=>switchBoardPage(boardPage+1)}>›</button><button disabled={busy||boardPages.length>=30} onClick={()=>switchBoardPage(boardPages.length,true)}>+ Page</button></div>
          <ObjectBoard key={boardPage} value={board} page={boardPage+1} total={boardPages.length} onChange={changeBoard} disabled={busy} onUndo={undoBoard} onRedo={redoBoard} canUndo={!!undoBoards.length} canRedo={!!redoBoards.length}/>
          <button className={styles.primary} disabled={busy||!online||room.status!=='active'||!board.trim()} onClick={publishBoard}>Share board</button>
        </>:teacher&&!viewedPrompt?<section className={styles.startPanel} aria-label="Start teaching"><div className={styles.startEmblem}><BookOpen size={24} aria-hidden="true"/></div><h2>{instantEntry?(room.status==='paused'?'Class paused':'Class is live · ready to teach'):'Ready to teach'}</h2><p>{instantEntry?'Share your first teaching material to start the lesson timer.':'Choose a prepared lesson or share something with your class.'}</p><div className={styles.startActions}><button type="button" className={styles.primary} onClick={()=>{setReviewId(null);setEditingBoard(false);if(instantEntry)openContent(linkedPlan?'lesson':'resources');else setPanel(linkedPlan?'plan':'resources')}}>{instantEntry?'Start teaching · add content':linkedPlan?'Open lesson plan':'Open resources'}</button>{instantEntry&&slides.some((item,i)=>!!encodeSlide(item,i+1,slides.length))&&<button type="button" disabled={!canNavigateSlides||photoPreparing||!!conflictDraft} onClick={()=>{const first=slides.findIndex((item,i)=>!!encodeSlide(item,i+1,slides.length));if(first>=0)presentSlide(first)}}>Present first slide</button>}<button type="button" onClick={openSlides}>Prepare slides</button><button type="button" onClick={()=>setPanel('interactive')}>Interactive tools</button><button type="button" onClick={()=>setPanel('kit')}>Teaching Kit</button><button type="button" onClick={()=>chooseMode('board')}>Whiteboard</button></div>{linkedPlan&&<small>Prepared: {linkedPlan.title}</small>}</section>:viewedPrompt?<LiveStageInk key={room.id+":"+viewedPrompt.id+":"+teacher} roomId={room.id} promptId={viewedPrompt.id} currentId={prompt?.id} teacher={teacher} status={room.status} online={online} participants={participants} command={call} version={room.version}><SharedPrompt prompt={viewedPrompt} roomId={room.id} learner={!teacher} onQuote={!teacher ? quote=>{if(noteDraft.length+quote.length+4>8000){setError('Your private notes are full. Shorten them before adding this passage.');return}setNoteDraft(value=>value.trim()?value+'\n\n“'+quote+'”':'“'+quote+'”');noteDirty.current=true;setPrivateOpen(false);setClassChatOpen(false);setLearnerTool('notes')} : undefined}/></LiveStageInk>:<SharedPrompt prompt={null}/>}
      </section>
      {((teacher&&privateTarget&&panel===null)||(!teacher&&privateOpen&&!learnerTool))&&<LivePrivateChat key={room.id+':'+(privateTarget?.studentId??'self')} roomId={room.id} teacher={teacher} recipient={privateTarget} status={room.status} command={call} onClose={()=>{setPrivateOpen(false);setPrivateTarget(null)}}/>}
      {((teacher&&panel==='chat')||(!teacher&&classChatOpen&&!learnerTool))&&<LiveClassChat key={room.id} roomId={room.id} version={room.version} teacher={teacher} status={room.status} command={call} onClose={()=>{if(teacher)setPanel(null);else setClassChatOpen(false)}}/>}
      {!teacher&&learnerMenu&&<section className={styles.sheet} aria-label="More learner tools">
         <div className={styles.sheetTitle}><strong>More tools</strong><button type="button" aria-label="Close more tools" onClick={()=>setLearnerMenu(false)}><X size={18}/></button></div>
         <div className={styles.learnerMenuGrid}>
           <button type="button" onClick={()=>{setLearnerMenu(false);setLearnerTool(null);setClassChatOpen(false);setPrivateOpen(true)}}><MessageSquare size={19}/> Teacher messages{Number(room.dmUnread)>0?' · '+room.dmUnread+' new':''}</button>
           <button type="button" onClick={()=>{setLearnerMenu(false);setPrivateOpen(false);setClassChatOpen(false);setLearnerTool('files')}}><BookOpen size={19}/> Shared files</button>
            <button type="button" onClick={()=>{setLearnerMenu(false);setPrivateOpen(false);setClassChatOpen(false);setLearnerTool('work')}}><Pencil size={19}/> My workpad</button>
           <button type="button" disabled={!history.length} onClick={()=>{setLearnerMenu(false);setLearnerTool(null);setReviewId(reviewId?null:history[0].id)}}><History size={19}/> {reviewId?'Go live':'Lesson history'}</button>
         </div>
       </section>}
       {!teacher&&learnerTool&&<section className={styles.sheet} aria-label={learnerTool==='ask'?'Ask teacher':learnerTool==='files'?'Class PDF and photos':learnerTool==='work'?'Private workpad':'My notes'}>
        <div className={styles.sheetTitle}><strong>{learnerTool==='ask'?'Ask teacher':learnerTool==='files'?'Class PDF and photos':learnerTool==='work'?'Private workpad':'My notes'}</strong><button type="button" aria-label="Close" onClick={()=>setLearnerTool(null)}><X size={18}/></button></div>
        {learnerTool==='ask'?<><small>Only you and your teacher can see this conversation.</small><ul className={styles.participants}>{(room.questions??[]).map(q=><li key={q.id} className={styles.messageExchange}><div className={styles.messageBubble} data-own="true"><small>You → Teacher</small><span>{q.body}</span><small>Sent · {q.reply?'Replied':'Awaiting reply'}</small></div>{q.reply&&<div className={styles.messageBubble}><small>Teacher → You</small><span>{q.reply}</span></div>}</li>)}</ul><form onSubmit={e=>{e.preventDefault();askTeacher()}}><label>Your question<textarea maxLength={1000} value={questionDraft} disabled={busy} onChange={e=>setQuestionDraft(e.target.value)} required/></label><button className={styles.primary} disabled={busy||!online||!questionDraft.trim()}>Send privately</button></form></> :learnerTool==='files'?<LiveClassFiles roomId={room.id} teacher={false} status={room.status}/>:learnerTool==='work'?<div className={styles.workpad}>
           <LiveWorkbook roomId={room.id} teacher={teacher} status={room.status} online={online} questions={history} currentId={prompt?.id} command={call} joined={participants.length}/><h3>Quick private scratchpad</h3><p>Work privately before answering. Your draft is not shared with the teacher.</p>
           {viewedPrompt&&<small>Working on: {viewedPrompt.body.slice(0,160)}</small>}
           <label>My working<textarea aria-label="Private working" maxLength={2000} rows={6} value={workDraft} onChange={e=>updateWorkDraft(e.target.value)} placeholder="Show your steps, draft an explanation or work out a question…"/></label>
           <div className={styles.workpadActions}>
             <button type="button" disabled={answerChoices.length>0||!workDraft.trim()||!prompt||viewedPrompt?.id!==prompt.id||!['quiz','exercise','poll'].includes(prompt.kind)||prompt.revealed||(room.ownAnswer!==null&&room.ownAnswer!==undefined)||room.status!=='active'} onClick={()=>{if(!prompt)return;setAnswer(workDraft.trim());setAnswerFor(prompt.id);setLearnerTool(null)}}>Use as answer</button>
             <button type="button" disabled={!workDraft.trim()} onClick={moveWorkToNotes}>Add to private notes</button>
             <button type="button" disabled={!workDraft} onClick={()=>updateWorkDraft('')}>Clear work</button>
           </div>
           <small>Work remains in this classroom tab until you leave or reload. Save important work in My notes.</small>
         </div>:<form onSubmit={e=>{e.preventDefault();void act('note',null,{body:noteDraft})}}><label>Personal notes<textarea maxLength={8000} value={noteDraft} disabled={busy} onChange={e=>{noteDirty.current=true;setNoteDraft(e.target.value)}}/></label><button className={styles.primary} disabled={busy||!online||!noteDirty.current}>Save notes</button><small>{noteDirty.current?'Unsaved changes':'Notes saved privately'}</small></form>}
      </section>}
      {teacher&&<TeacherSticker prompt={prompt} hidden={!showSticker||!!contentTab||!!panel||(focusMode&&!focusDock)} onHide={()=>setShowSticker(false)}/>}
      {teacher&&contentTab&&<LiveContentDrawer tab={contentTab} onTab={setContentTab} onClose={()=>setContentTab(null)} classId={room.mode==='school'?classId:null} lessonPlanId={room.mode==='school'?linkedPlan?.id??null:null} schemeLessonId={room.mode==='school'?linkedPlan?.schemeId??null:null} roomId={room.id} command={call} canAdd={!busy&&!draftLoading&&!photoPreparing&&!conflictDraft&&slides.length<30} canShow={!!canNavigateSlides&&!photoPreparing} onAdd={slide=>addContentDeck([slide])} onAddDeck={addContentDeck} onShow={showContentSlide} onManagePresentations={()=>{setContentTab(null);setPanel('library')}} onShowText={body=>{setContentFeedback('');void act('publish',null,{kind:'teach',body,answerKey:null}).then(next=>{if(next)setContentFeedback('Shown to class.')})}}/>}
      {teacher&&!contentTab&&panel&&panel!=='slides'&&panel!=='library'&&panel!=='resources'&&panel!=='chat'&&panel!=='production'&&panel!=='live-slide'&&!(instantEntry&&panel==='invite')&&<section className={styles.sheet} aria-label={panel==='compose'?labels[mode]:panel==='learners'?'Classroom Manager':panel==='invite'?'Invite learners':'Classroom tools'}>
        <div className={styles.sheetTitle}><strong>{panel==='compose'?labels[mode]:panel==='learners'?'Classroom Manager':panel==='kit'?'Teaching Kit':panel==='interactive'?'Interactive tools':panel==='invite'?'Invite learners':panel==='activity'?'Activities':panel==='plan'?'Lesson plan':'More tools'}</strong><button aria-label="Close tools" onClick={()=>{setPanel(null);setEndConfirm(false)}}><X size={19}/></button></div>
        {panel==='activity'&&<div className={styles.executiveActivityList}><button type="button" onClick={()=>chooseMode('quiz')}><HelpCircle size={20}/> Quiz</button><button type="button" onClick={()=>chooseMode('exercise')}><ClipboardList size={20}/> Exercise</button><button type="button" onClick={()=>chooseMode('poll')}><BarChart3 size={20}/> Poll</button><button type="button" onClick={()=>setPanel('learners')}><Users size={20}/> Learner responses</button></div>}
        {panel==='compose'&&<form onSubmit={e=>{e.preventDefault();void act('publish',null,{kind:mode,body:content,answerKey:mode==='quiz'||mode==='exercise'?key:null})}}>
          {mode==='clock'?<><label>Show time<input type="time" value={clock} onChange={e=>setClock(e.target.value)}/></label><ClockView value={clock}/></>:<label>{mode==='teach'?'Lesson content':'Question or instruction'}<textarea required maxLength={4000} value={body} onChange={e=>setBody(e.target.value)}/></label>}
          {(mode==='quiz'||mode==='exercise')&&<label>Answer (hidden until reveal)<textarea maxLength={2000} value={key} onChange={e=>setKey(e.target.value)}/></label>}
          <button className={styles.primary} disabled={busy||room.status!=='active'||!content.trim()}>Share with class</button>
        </form>}
        {panel==='learners'&&<><LiveWorkbook roomId={room.id} teacher={teacher} status={room.status} online={online} questions={history} currentId={prompt?.id} command={call} joined={participants.length}/><ClassroomManager key={room.id} participants={participants} waitingCount={room.waitingCount??0} pendingQuestions={(room.questions??[]).filter(q=>!q.reply).length} busy={busy} stale={!online||!!error} onMessage={p=>{setPrivateTarget({studentId:p.studentId,name:p.name});setPanel(null);setReviewId(null);setEditingBoard(false)}} onAcknowledge={studentId=>void act('ack',null,{studentId})}/>{room.mode==='open'&&<section aria-label="Waiting room" className={styles.waitingRoom}><h3>Waiting room · {waitingRequests.length}</h3><small>Only eligible learners can request entry. The teacher approves admission.</small>{waitingError&&<p role="alert">{waitingError}</p>}{!waitingRequests.length?<p>No pending requests.</p>:<ul className={styles.participants}>{waitingRequests.map(w=><li key={w.studentId}><strong>{w.name}</strong><div className={styles.waitingActions}><button type="button" disabled={busy||!online} onClick={()=>void decideAdmission(w.studentId,true)}>Admit</button><button type="button" disabled={busy||!online} onClick={()=>void decideAdmission(w.studentId,false)}>Decline</button></div></li>)}</ul>}</section>}<h3>Private questions</h3>{(room.questions??[]).map(q=><form key={q.id} onSubmit={e=>{e.preventDefault();void act('reply',null,{questionId:q.id,body:replyDrafts[q.id]??''})}}><div className={styles.messageExchange}><div className={styles.messageBubble}><small>{q.name??'Learner'} → You</small><span>{q.body}</span></div>{q.reply&&<div className={styles.messageBubble} data-own="true"><small>You → {q.name??'Learner'}</small><span>{q.reply}</span><small>Sent</small></div>}</div>{!q.reply?<><label>Reply privately<textarea maxLength={1000} value={replyDrafts[q.id]??''} disabled={busy} onChange={e=>setReplyDrafts(items=>({...items,[q.id]:e.target.value}))}/></label><button disabled={busy||!online||!(replyDrafts[q.id]??'').trim()}>Send reply</button></>:<small>Reply saved. Start another private conversation through the learner list.</small>}</form>)}</>}
        {panel==='plan'&&<div className={styles.planGuide}>
          <strong>Lesson Plan · {linkedPlan?.title}</strong>
          <small>Private teaching guidance. Nothing on this panel is shared with learners.</small>
          {linkedPlan?.steps.length?<><label>Teaching phase<select aria-label="Teaching phase" value={planPhase} onChange={e=>setPlanPhase(Number(e.target.value))}>{linkedPlan.steps.map((s,i)=><option key={s.id} value={i}>{s.label}{s.durationMinutes?' · '+s.durationMinutes+' min':''}</option>)}</select></label>
            <div className={styles.planGuideBody}>{linkedPlan.steps[Math.min(planPhase,linkedPlan.steps.length-1)].teacherContent}</div>
            <button type="button" disabled={busy||draftLoading||!!conflictDraft} onClick={addPlanSegments}>Prepare plan stages in Studio</button><button type="button" onClick={()=>{setReviewId(null);setEditingBoard(false);setPanel('resources')}}>Present approved Resources</button>
          </>:<p>No linked plan is available.</p>}
        </div>}
        {panel==='kit'&&<TeachingKit compact actions={{
          plan:linkedPlan?()=>setPanel('plan'):undefined,
          slides:openSlides,
          resources:()=>setPanel('resources'),
          book:()=>setPanel('resources'),
          exercises:()=>chooseMode('exercise'),
          board:()=>chooseMode('board'),
          interactive:()=>setPanel('interactive'),
        }}/>} 
        {panel==='interactive'&&<TeachingModelPicker disabled={busy||!online||room.status!=='active'} onPresent={demo=>{
          if(busy||!online||room.status!=='active'||!teacher)return
          const encoded=encodeSlide({title:diagramLabel(demo.kind),body:encodeDemo(demo)},1,1)
          if(encoded)void act('publish',null,{kind:'teach',body:encoded,answerKey:null})
        }}/>}
        {panel==='invite'&&<><p>Share this lesson link with eligible learners. Existing classroom access permissions still apply.</p><label>Lesson link<input readOnly value={shareLink} onFocus={e=>e.target.select()}/></label><button type="button" onClick={()=>{void navigator.clipboard.writeText(shareLink).then(()=>setInviteFeedback('Link copied')).catch(()=>setInviteFeedback('Copy the link from the field above.'))}}>Copy link</button><a href={'https://wa.me/?text='+encodeURIComponent(shareLink)} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a><small role="status">{inviteFeedback}</small><button type="button" onClick={()=>setPanel('learners')}>Manage learners</button></>}
        {panel==='more'&&<><div className={styles.controls}><button onClick={()=>chooseMode('clock')}>Clock</button><button onClick={()=>chooseMode('teach')}>Teach text</button><button onClick={()=>{setEditingBoard(false);setPanel('library')}}>My presentations</button><button onClick={()=>{setReviewId(null);setEditingBoard(false);setPanel('resources')}}>Resources</button>{linkedPlan&&<button type="button" onClick={()=>{setEditingBoard(false);setPanel('plan')}}>Lesson Plan</button>}<button onClick={()=>setShowSticker(v=>!v)}>{showSticker?'Hide preview':'Show preview'}</button><button disabled={busy||!prompt||!['quiz','exercise','poll'].includes(prompt.kind)||prompt.revealed} onClick={()=>void act('reveal')}>Reveal / close answers</button><button type="button" onClick={()=>setShareLink(new URL(scheduledId?'/tuition/lessons/'+encodeURIComponent(scheduledId):'/student/live?room='+encodeURIComponent(room.id),window.location.origin).href)}>Share lesson</button></div>{shareLink&&<><label>Lesson link<input readOnly value={shareLink} onFocus={e=>e.target.select()}/></label><a href={'https://wa.me/?text='+encodeURIComponent(shareLink)} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a></>}{endConfirm&&!instantEntry?<div className={styles.controls}><strong>End this session?</strong><button disabled={busy} onClick={()=>void act('end')}>Confirm end</button><button onClick={()=>setEndConfirm(false)}>Cancel</button></div>:null}</>}
      </section>}
    </div>
    {teacher&&panel===null&&!editingBoard&&viewedPrompt&&['quiz','exercise','poll'].includes(viewedPrompt.kind)&&(!focusMode||focusDock)&&<div className={styles.presentControls} aria-label="Question controls">
      <span>{viewedPrompt.id===prompt?.id?(viewedPrompt.revealed?'Responses closed':'Current question'):'Previous question'}</span>
      <button type="button" disabled={busy||draftLoading||!online||room.status!=='active'} onClick={()=>reuseQuestion(viewedPrompt)}>Edit as new question</button>
      {viewedPrompt.id===prompt?.id&&<button type="button" disabled={busy||!online||room.status!=='active'||viewedPrompt.revealed} onClick={()=>void act('reveal')}>Reveal / close</button>}
      {viewedPrompt.id===prompt?.id&&<button type="button" onClick={()=>setPanel('learners')}>Responses</button>}
      {viewedPrompt.id===prompt?.id&&viewedPrompt.revealed&&resumeAfterActivity!==null&&<button type="button" disabled={!canNavigateSlides} onClick={()=>presentSlide(resumeAfterActivity)}>Continue slides</button>}
    </div>}
    {teacher&&panel===null&&reviewId===null&&returnSlide&&(!focusMode||focusDock)&&<div className={styles.presentControls} aria-label="Resume prepared lesson">
      <button type="button" disabled={!canNavigateSlides||photoPreparing||!!conflictDraft} onClick={()=>void returnToPreparedSlide()}>Return to slide {returnSlide.number}</button>
      {instantEntry&&<small>{returnSlide.title||'Prepared lesson'}</small>}
    </div>}
    {teacher&&instantEntry&&panel===null&&!contentTab&&!editingBoard&&reviewId===null&&liveSlide&&(!focusMode||focusDock)&&<section className={styles.deliveryGuidance} aria-label="Private teaching guidance">
      <span>Slide {liveSlide.number} of {liveSlide.total}{plannedMinutes>0?` · ${plannedMinutes} min planned`:''}</span>
      {upcomingSlide&&<span>Up next: {upcomingSlide.title||'Untitled slide'}{studioMinutes(upcomingSlide)>0?` · ${studioMinutes(upcomingSlide)} min`:''}</span>}
      {liveNotes&&<details><summary>Private teacher notes</summary><p>{liveNotes}</p></details>}
      {plannedMinutes>0&&prompt?.id&&<ActivityCountdown key={room.id+':'+prompt.id+':'+plannedMinutes} roomId={room.id} promptId={prompt.id} minutes={plannedMinutes} disabled={!canNavigateSlides}/>}
    </section>}
    {teacher&&panel===null&&!editingBoard&&reviewId===null&&liveSlide&&(!focusMode||focusDock)&&<div className={styles.presentControls}>
      <button type="button" disabled={!canNavigateSlides||previousLiveSlide===null} onClick={()=>{if(previousLiveSlide!==null)presentSlide(previousLiveSlide)}}>Previous slide</button>
      <span>{liveSlide.number} / {liveSlide.total}</span><button type="button" disabled={busy||draftLoading||!!conflictDraft} onClick={openCurrentSlide}>Edit current slide</button>{currentAssessment&&<>{instantEntry&&<button type="button" className={styles.primary} disabled={!canNavigateSlides} onClick={startPreparedActivity}>Start {currentAssessment.kind}</button>}<button type="button" disabled={!canNavigateSlides} onClick={launchSlideAssessment}>{instantEntry?'Edit':'Launch'} {currentAssessment.kind}</button></>}
      {revealMatch&&visibleObjects!==null&&objectTotal>0&&<><button type="button" disabled={!canNavigateSlides||visibleObjects===0} onClick={()=>presentSlide(liveSlide.number-1,visibleObjects-1)}>Hide last object</button><button type="button" disabled={!canNavigateSlides||visibleObjects>=objectTotal} onClick={()=>presentSlide(liveSlide.number-1,visibleObjects+1)}>Reveal next object</button><small>{visibleObjects}/{objectTotal} objects</small></>}
      <button type="button" disabled={!canNavigateSlides||nextLiveSlide===null} onClick={()=>{if(nextLiveSlide!==null)presentSlide(nextLiveSlide)}}>Next slide</button>
      {canNavigateSlides&&nextLiveSlide!==null&&nextLiveSlide>liveSlide.number&&<small role="status">Blank or invalid draft slides will be skipped.</small>}
      {canNavigateSlides&&nextLiveSlide===null&&liveSlide.number<liveSlide.total&&<small role="status">No matching publishable next slide. Open Edit slides, restore or complete the deck, and present a slide again.</small>}
    </div>}
    {!teacher&&reviewId===null&&prompt&&['quiz','exercise','poll'].includes(prompt.kind)&&<section className={styles.answerPanel}>{room.ownAnswer!==null&&room.ownAnswer!==undefined?<p role="status"><strong>Submitted:</strong> {room.ownAnswer}</p>:prompt.revealed?<p>Responses closed.</p>:<form onSubmit={e=>{e.preventDefault();void act('answer',null,{body:answer,promptId:prompt.id})}}>
       {answerChoices.length?<fieldset className={styles.answerChoices}><legend>Choose your answer</legend>{answerChoices.map(option=><label key={option.letter}><input type="radio" name="live-choice" value={option.value} checked={answerFor===prompt.id&&answer===option.value} onChange={()=>{setAnswerFor(prompt.id);setAnswer(option.value)}} disabled={room.status!=='active'}/><span><strong>{option.letter}.</strong> {option.text}</span></label>)}</fieldset>:<label>Your answer<textarea maxLength={2000} required value={answerFor===prompt.id?answer:''} onChange={e=>{setAnswerFor(prompt.id);setAnswer(e.target.value)}} disabled={room.status!=='active'}/></label>}
       <div className={styles.workpadActions}><button className={styles.primary} disabled={busy||!online||room.status!=='active'||!answer.trim()||answerFor!==prompt.id}>Submit</button><button type="button" onClick={()=>{setLearnerMenu(false);setLearnerTool('work')}}>Work it out</button></div>
     </form>}</section>}
    {instantEntry&&teacher&&commandOpen&&!endConfirm&&!executiveInvite&&<ExecutiveCommandPalette onClose={()=>setCommandOpen(false)} actions={[
      {label:'Teach',detail:'Return to the shared classroom',keywords:'live classroom',run:()=>{setRehearsalOpen(false);setReviewId(null);setEditingBoard(false);setPanel(null)}},
      {label:'Prepare slides',detail:'Open the private slide editor',keywords:'presentation edit',disabled:draftLoading,run:()=>{setRehearsalOpen(false);setStudioReturn(false);openSlides()}},
      {label:'Production Studio',detail:'Preview and program monitors',keywords:'produce present',disabled:draftLoading,run:()=>{setRehearsalOpen(false);setEditingBoard(false);setReviewId(null);setStudioReturn(false);setPanel('production')}},
      {label:'Whiteboard',detail:'Draw and explain',keywords:'pen drawing',run:()=>{setRehearsalOpen(false);chooseMode('board')}},
      {label:'Interactive tools',detail:'Teaching demonstrations',keywords:'ruler clock fractions',run:()=>{setRehearsalOpen(false);setEditingBoard(false);setPanel('interactive')}},
      {label:'My presentations',detail:'Browse prepared lessons',keywords:'library deck',run:()=>openContent('presentations')},
      {label:'Add content',detail:'Books, saved presentations and uploads',keywords:'resources pdf photos textbook',run:()=>openContent('resources')},
      {label:'Quiz',detail:'Create a question',keywords:'assessment activity',run:()=>{setRehearsalOpen(false);chooseMode('quiz')}},
      {label:'Poll',detail:'Ask the class',keywords:'activity vote',run:()=>{setRehearsalOpen(false);chooseMode('poll')}},
      {label:'Lesson plan',detail:'Private teaching guidance',keywords:'objectives curriculum',disabled:!linkedPlan,run:()=>{setRehearsalOpen(false);setEditingBoard(false);setPanel('plan')}},
      {label:'Classroom manager',detail:'Learners and responses',keywords:'roster attendance',run:()=>{setRehearsalOpen(false);setEditingBoard(false);setPanel('learners')}},
      {label:'Invite learners',detail:'Copy the existing class link',keywords:'share link whatsapp',run:openExecutiveInvite},
      {label:'Class chat',detail:'Open classroom messages',keywords:'message discussion',run:()=>{setRehearsalOpen(false);setEditingBoard(false);setPanel('chat')}}
    ]}/>}
    {instantEntry&&teacher&&executiveInvite&&!endConfirm&&<ExecutiveDialog title="Invite learners" onClose={()=>setExecutiveInvite(false)}><p>Share this lesson link with eligible learners. Existing classroom access permissions still apply.</p><label>Lesson link<input readOnly value={shareLink} onFocus={e=>e.target.select()}/></label><div className={styles.executiveDialogActions}><button type="button" onClick={()=>{void navigator.clipboard.writeText(shareLink).then(()=>setInviteFeedback('Link copied')).catch(()=>setInviteFeedback('Copy the link from the field above.'))}}>Copy link</button><a href={'https://wa.me/?text='+encodeURIComponent(shareLink)} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a><button type="button" onClick={()=>{setExecutiveInvite(false);setEditingBoard(false);setRehearsalOpen(false);setPanel('learners')}}>Manage learners</button></div><small role="status">{inviteFeedback}</small></ExecutiveDialog>}
    {instantEntry&&teacher&&endConfirm&&<ExecutiveDialog title="End class?" onClose={()=>setEndConfirm(false)}><p>This ends the current live session for all participants.</p>{!online&&<p role="status">You are offline. Reconnect before ending class.</p>}{error&&<p role="alert">{error}</p>}<div className={styles.executiveDialogActions}><button type="button" onClick={()=>setEndConfirm(false)}>Keep teaching</button><button type="button" className={styles.danger} disabled={busy||!online} onClick={()=>void act('end').then(next=>{if(next?.status==='ended')setEndConfirm(false)})}>End class</button></div></ExecutiveDialog>}
    <div className={instantEntry&&teacher?styles.compactFooter:styles.standardFooter}>
    {instantEntry&&teacher&&<div className={styles.premiumVoiceDock} hidden={focusMode&&!focusDock}><div className={styles.voiceSlot}><LiveVoice compact key={room.id} enabled={process.env.NEXT_PUBLIC_VIBE_LIVE_VOICE_ENABLED==='true'} roomId={room.id} classId={classId} teacher={teacher} status={room.status} learners={participants} onAcknowledge={async studentId=>{const next=await call('ack',room.id,null,{studentId}) as Room;accept(next)}}/></div></div>}
    {(!focusMode||focusDock)&&<footer className={styles.dock}>{teacher?<><div className={styles.dockHeader} hidden={instantEntry}><button type="button" aria-expanded={!dockHidden} onClick={()=>{setDockHidden(v=>!v);setToolPickerOpen(false)}}>{dockHidden?"Tools":"Hide tools"}</button><button type="button" aria-pressed={panel==='kit'} onClick={()=>{setDockHidden(true);setToolPickerOpen(false);setEditingBoard(false);setPanel(panel==='kit'?null:'kit')}}>Teaching Kit</button></div>{!dockHidden&&<div role="group" aria-label="Teaching phase" className={styles.sessionRow}>{(Object.keys(phaseLabels) as TeachingPhase[]).map(phase=><button key={phase} type="button" aria-pressed={teachingPhase===phase} disabled={busy||!online||room.status!=='active'||!room.teachingPhase} onClick={()=>{if(phase===teachingPhase){if(phase==='teaching')setPanel('kit');else if(phase==='activity')chooseMode('exercise');else setPanel('chat');return}void act('phase_set',null,{phase})}}>{phaseLabels[phase]}</button>)}</div>}{!dockHidden&&toolPickerOpen&&<div className={styles.toolPicker} aria-label="Customize teaching tools">{["board","teach","quiz","exercise","poll","files"].map(kind=><label key={kind}><input type="checkbox" checked={pinnedTools.includes(kind)} onChange={()=>togglePinnedTool(kind)}/>{kind==="teach"?"Slides":kind==="files"?"Files":labels[kind as Mode]}</label>)}</div>}{!dockHidden&&<nav aria-label="Teaching tools" className={styles.toolRow}>{([{kind:'board',icon:Pencil},{kind:'teach',icon:PanelTop},{kind:'quiz',icon:HelpCircle},{kind:'exercise',icon:ClipboardList},{kind:'poll',icon:BarChart3}] as const).filter(({kind})=>pinnedTools.includes(kind)).map(({kind,icon:Icon})=><button key={kind} aria-pressed={kind==='board'?editingBoard:kind==='teach'?panel==='slides':panel==='compose'&&mode===kind} disabled={draftLoading} onClick={()=>kind==='teach'?openSlides():chooseMode(kind)}><Icon size={18}/><span>{kind==='teach'?'Slides':labels[kind]}</span></button>)}{pinnedTools.includes("files")&&<button type="button" disabled={draftLoading} aria-label="Resources" title="Resources and shared files" aria-pressed={panel==='resources'} onClick={()=>{setDockHidden(true);setToolPickerOpen(false);setReviewId(null);setEditingBoard(false);setPanel(panel==='resources'?null:'resources')}}><BookOpen size={18}/><span>Files</span></button>}<button disabled={draftLoading} aria-pressed={panel==='more'} onClick={()=>{setDockHidden(true);setToolPickerOpen(false);setPanel(panel==='more'?null:'more');setEndConfirm(false)}}><MoreHorizontal size={18}/><span>More</span></button><button type="button" aria-expanded={toolPickerOpen} onClick={()=>setToolPickerOpen(v=>!v)}>+ Add tools</button></nav>}<div className={styles.sessionRow}><button aria-pressed={panel==='learners'} onClick={()=>setPanel(panel==='learners'?null:'learners')}><Users size={18}/> Learners · {participants.length}{participants.some(p=>Number(p.unreadDm)>0)?' · '+participants.reduce((n,p)=>n+Number(p.unreadDm??0),0)+' new':''}</button><button type="button" aria-pressed={panel==='chat'} onClick={()=>{setEditingBoard(false);setPanel(panel==='chat'?null:'chat')}}><MessageSquare size={16}/> Chat{room.chatEnabled?' · On':''}</button><button disabled={busy} onClick={()=>void act(room.status==='paused'?'resume':'pause')}>{instantEntry&&(room.status==='paused'?<Play size={18}/>:<Pause size={18}/>)}{room.status==='paused'?'Resume':'Pause'}</button>{!instantEntry&&<button className={styles.danger} onClick={()=>{setPanel('more');setEndConfirm(true)}}>End</button>}{instantEntry&&<button type="button" aria-haspopup="dialog" onClick={openExecutiveInvite}><Link2 size={18}/> Invite</button>}{instantEntry&&<button type="button" onClick={()=>{setShareLink('');setEndConfirm(false);setPanel('more')}}><Settings size={18}/> Settings</button>}</div></>:<nav aria-label="Learner tools" className={styles.learnerTools}>
      <button type="button" aria-label={room.needsHelp?'Lower hand':'Raise hand'} aria-pressed={!!room.needsHelp} data-raised={!!room.needsHelp} disabled={busy||!online} onClick={()=>void act(room.needsHelp?'lower':'help')}><Hand size={21}/><span>{room.needsHelp?'Lower hand':'Hand'}</span></button>
      <button type="button" aria-pressed={learnerTool==='ask'} onClick={()=>{setLearnerMenu(false);setClassChatOpen(false);setPrivateOpen(false);setLearnerTool(v=>v==='ask'?null:'ask')}}><MessageSquare size={21}/><span>Ask</span></button>
      <button type="button" aria-pressed={learnerTool==='notes'} onClick={()=>{setLearnerMenu(false);setClassChatOpen(false);setPrivateOpen(false);setLearnerTool(v=>v==='notes'?null:'notes')}}><NotebookPen size={21}/><span>Notes</span></button>
      <button type="button" aria-label={room.chatEnabled?'Chat · On':'Chat'} aria-pressed={classChatOpen} onClick={()=>{setLearnerMenu(false);setLearnerTool(null);setPrivateOpen(false);setClassChatOpen(v=>!v)}}><MessageSquare size={21}/><span>Chat</span></button>
      <button type="button" aria-pressed={learnerMenu} aria-expanded={learnerMenu} onClick={()=>{setLearnerTool(null);setClassChatOpen(false);setPrivateOpen(false);setLearnerMenu(v=>!v)}}><MoreHorizontal size={21}/><span>More{Number(room.dmUnread)>0?' · '+room.dmUnread:''}</span></button>
     </nav>}</footer>}
    </div>
    </main>
    return createPortal(stage,document.body)
  }
  if(teacher&&beforeLibrary&&!room&&!loading)return <main className={`${styles.live} ${styles.studioPage}`} aria-label="Live Studio"><TeachingLibrary command={call} currentDeck={null} onUse={attachingPlan?attachPlanPresentation:useMaterial} attachToPlan={attachingPlan} onClose={()=>{setAttachingPlan(false);setBeforeLibrary(false)}}/></main>
  if(instantEntry&&teacher&&!classId&&room?.status==='ended'){
    const endedRoom=room
    const items=history.map(item=>{
      const activity=['quiz','exercise','poll'].includes(item.kind)
      const title=item.kind==='board'?'Shared whiteboard':item.kind==='clock'?'Clock demonstration':decodeLiveFileRef(item.body)?'Shared PDF or photo':decodeSlide(item.body)?.title||decodeAssessment(item.body)?.question||item.body.split('\n')[0]?.slice(0,100)||labels[item.kind]
      return {id:item.id,title,category:activity?labels[item.kind]:item.kind==='teach'?'Teaching page':labels[item.kind],activity}
    })
    return <EndedTeacherWorkspace key={room.id} title={room.title} audience={classroomLabels[room.mode]+' classroom'} joined={participants.length} items={items} onBack={leave} busy={busy} error={error||undefined}
      renderItem={id=>{
        const item=history.find(p=>p.id===id)
        return item?<LiveStageInk key={endedRoom.id+':'+item.id+':teacher'} roomId={endedRoom.id} promptId={item.id} currentId={prompt?.id} teacher status={endedRoom.status} online={online} participants={participants} command={call} version={endedRoom.version}><SharedPrompt prompt={item} roomId={endedRoom.id}/></LiveStageInk>:null
      }}
      work={<LiveWorkbook roomId={room.id} teacher status={room.status} online={online} questions={history} currentId={prompt?.id} command={call} joined={participants.length}/>}
      files={<LiveClassFiles roomId={room.id} teacher status="ended"/>}
      followup={room.mode!=='open'?<LiveIndependentStudy showUnavailable key={room.id} classId={room.mode==='school'?classId:null} teacher mode={room.mode} roomId={room.id}/>:undefined}/>
  }
  if(scheduledBooking&&teacher&&!room&&!loading){
    const booking=scheduledBooking
    const canPrepare=!booking.roomId&&['upcoming','joinable'].includes(booking.state)
    const canStart=booking.state==='joinable'&&!booking.roomId
    return <main className={styles.live}>
      <header className={styles.header}><Link href={back}>Back to teaching</Link><h1>Scheduled lesson</h1></header>
      <section className={styles.panel} aria-label="Booked teaching lesson">
        <h2>{booking.title}</h2>
        <p>{new Date(booking.startsAt).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'})} – {new Date(booking.endsAt).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Nairobi'})} EAT</p>
        <small>Private booking · Only the booked learner may join.</small>
        {error&&<p role="alert">{error==='live_end_previous_session'?'Another class is active. Finish it before starting this booking.':error} <button type="button" onClick={()=>void refresh()}>Retry</button></p>}
        {canPrepare&&<button type="button" disabled={busy} onClick={()=>setBeforeLibrary(true)}>Prepare lesson</button>}
        {preparedTitle&&canPrepare&&<p>Prepared: {preparedTitle} <button type="button" disabled={busy} onClick={()=>setRehearsalOpen(true)}>Rehearse privately</button> <button type="button" disabled={busy} onClick={()=>{preparedDeck.current=null;setPreparedTitle('')}}>Remove preparation</button></p>}
        {booking.roomId?<button type="button" className={styles.primary} disabled={busy||!online} onClick={()=>void act('get',booking.roomId!)}>{['ended','completed','cancelled'].includes(booking.state)?'Review lesson':'Resume lesson'}</button>:canStart?<button type="button" className={styles.primary} disabled={busy||!online} onClick={()=>void act('start',null,{title:booking.title,mode:'tuition'})}>{busy?'Starting…':'Start booked lesson'}</button>:<p role="status">{booking.state==='upcoming'?'You can start 15 minutes before the booking.':booking.state==='cancelled'?'This booking was cancelled.':'This lesson has ended without a linked classroom.'}</p>}
      </section>
    </main>
  }
  if(instantEntry&&teacher&&!classId&&!room&&!loading){
    const currentClass=rooms.find(item=>item.own&&item.mode!=='school')
    return <OnlineTeacherWorkspace back={back} onOpenStudio={()=>setBeforeLibrary(true)}>
      {error&&<p role="alert">{error} <button onClick={()=>void refresh()}>Retry</button></p>}
      <div className={styles.controls}>
        <button type="button" disabled={busy} onClick={()=>setBeforeLibrary(true)}>Prepare lesson</button>
        {currentClass&&<button type="button" className={styles.primary} disabled={busy||!online} onClick={()=>void act('get',currentClass.id)}>Resume {currentClass.title}</button>}
        {(preparedTitle||!currentClass)&&<button type="button" className={styles.primary} disabled={busy||!online} onClick={()=>{
          if(currentClass&&!window.confirm(`End “${currentClass.title}” for everyone and start “${preparedTitle}”?`))return
          void act('start',null,{title:preparedTitle||'Untitled lesson',mode:'tuition',groupId:null},currentClass?.id)
        }}>{busy?'Connecting…':preparedTitle?`Start ${preparedTitle}`:'Go Live'}</button>}
      </div>
      {preparedTitle&&<p>Ready for next lesson: {preparedTitle} <button type="button" disabled={busy} onClick={()=>setRehearsalOpen(true)}>Rehearse privately</button> <button type="button" disabled={busy} onClick={()=>{preparedDeck.current=null;setPreparedTitle('')}}>Remove from this session</button></p>}
      <small>Invited classroom · Microphone starts muted</small>
      {rooms.filter(item=>item.id!==currentClass?.id&&item.mode!=='tuition').map(item=><button key={item.id} disabled={busy} onClick={()=>void act('get',item.id)}>Resume {item.title}</button>)}
      {pastAvailable&&<button type="button" aria-expanded={pastOpen} disabled={pastLoading} onClick={()=>void togglePastClasses()}>{pastOpen?'Hide past classes':'Past classes'}</button>}
      {pastOpen&&<section aria-label="Past classes">{pastLoading&&<p role="status">Loading…</p>}{pastError&&<p role="alert">{pastError}</p>}{pastRooms.map(item=><button key={item.id} disabled={busy} onClick={()=>void act('get',item.id)}>{item.title}</button>)}</section>}
    </OnlineTeacherWorkspace>
  }
  return <main className={styles.live}>
    <header className={styles.header}><Link href={back}>Back</Link><h1>Live Classroom</h1>{room&&<span className={styles.status}>{room.status==='active'?'Live':room.status==='paused'?'Paused':'Ended'}</span>}</header>
    {error&&<div role="alert" className={styles.alert}>{error} <button onClick={()=>void refresh()}>Retry</button></div>}
    {loading&&!room&&<p role="status">Connecting…</p>}
    {!room&&!loading&&<section className={`${styles.panel} ${teacher?styles.classroomEntry:""}`}>
      {teacher&&<><button type="button" className={styles.studioEntry} aria-label="Live Studio" onClick={()=>setBeforeLibrary(true)}><PanelTop aria-hidden="true"/><span><strong>Live Studio</strong><small>Prepare, preview and rehearse</small></span><span aria-hidden="true">›</span></button>{preparedTitle&&<p>Ready for next lesson: {preparedTitle} <button type="button" onClick={()=>setRehearsalOpen(true)}>Rehearse privately</button> <button type="button" onClick={()=>{preparedDeck.current=null;setPreparedTitle('')}}>Remove from this session</button></p>}</>}
      {teacher&&<div className={styles.startLesson}><h2>Start a lesson</h2>{classId&&<section aria-label="Prepare Live Lesson" className={styles.planPicker}>
        <label>Saved Lesson Plan
          <select aria-label="Saved Lesson Plan" value={selectedPlanId??''}
            onChange={e=>setSelectedPlanId(e.target.value)} disabled={busy||plansLoading}>
            <option value="">Teach without a saved plan</option>
            {savedPlans.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
            {selectedPlanId&&validLessonId(selectedPlanId)&&!savedPlans.some(p=>p.id===selectedPlanId)&&
              <option value={selectedPlanId}>Linked Lesson Plan</option>}
          </select>
        </label>
        {plansLoading&&<small>Loading saved plans…</small>}
        {plansError&&<small role="status">{plansError}</small>}
        {linkedPlanError&&<div role="alert"><small>{linkedPlanError}</small><button type="button" disabled={busy} onClick={()=>retryPlanLoad(attempt=>attempt+1)}>Retry plan</button></div>}
        {linkedPlan&&<><small>Private teacher plan ready · {linkedPlan.steps.length} teaching phases</small>
          <button type="button" disabled={busy} onClick={()=>{setAttachingPlan(true);setBeforeLibrary(true)}}>
            {attachedPresentation?'Change attached presentation':'Attach presentation'}
          </button>
        </>}
      </section>}
      <form onSubmit={e=>{e.preventDefault();void act('start',null,{title:hostMode==='open'?`${publicGrade} · ${publicSubject} · ${title.trim()}`:title,mode:hostMode,groupId:classId||hostMode!=='tuition'?null:groupId||null})}}>
        {!classId&&hostModes.length>1&&<div className={styles.controls} aria-label="Classroom type">{hostModes.map(item=><button type="button" key={item} aria-pressed={hostMode===item} onClick={()=>{setHostMode(item);setGroupId('')}}>{classroomLabels[item]}</button>)}</div>}
        {!classId&&hostMode==='tuition'&&<label>Learners<select value={groupId} onChange={e=>setGroupId(e.target.value)}><option value="">All connected learners</option>{groups.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label>}
        {hostMode==='open'&&<><div className={styles.controls}><label>Grade<select value={publicGrade} onChange={e=>setPublicGrade(e.target.value)}>{grades.map(g=><option key={g} value={g}>{g}</option>)}</select></label><label>Subject<select value={publicSubject} onChange={e=>setPublicSubject(e.target.value)}>{subjects.map(g=><option key={g} value={g}>{g}</option>)}</select></label></div><small>Visible to eligible VibeSchool learners. You approve each request before they enter.</small></>}
        <label>Lesson title<input required maxLength={hostMode==='open'?80:120} value={title} onChange={e=>setTitle(e.target.value)} placeholder={hostMode==='open'?'Lesson topic':'Grade 4 · Mathematics'}/></label>
        <button className={styles.primary} disabled={busy||!title.trim()||!!selectedPlanId&&linkedPlan?.id!==selectedPlanId}>Go Live</button>
        {!title.trim()&&<small>Enter a lesson title to go live.</small>}
      </form></div>}
      {!teacher&&<div className={styles.controls}>
        <label>Find live lessons<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search lessons or teachers"/></label>
        <label>Audience<select value={scope} onChange={e=>setScope(e.target.value as 'all'|ClassroomMode)}><option value="all">All lessons</option>{Object.entries(classroomLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Subject<select aria-label="Filter by subject" value={subjectFilter} onChange={e=>setSubjectFilter(e.target.value)}><option value="all">All subjects</option>{subjects.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label>Grade<select aria-label="Filter by grade" value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)}><option value="all">All grades</option>{grades.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        {sharedId&&!rooms.some(item=>item.id===sharedId)&&<button disabled={busy} onClick={()=>void act('join',sharedId)}>Join shared lesson</button>}
      </div>}
      {!teacher&&linkedRooms.length>0&&<p>My Live Lessons · {linkedRooms.length}</p>}
      {teacher&&visibleRooms.length>0&&<small className={styles.entryCaption}>Current session</small>}
      {visibleRooms.length>0?<div className={styles.rooms}>{visibleRooms.map(item=>
        teacher?<button type="button" key={item.id} disabled={busy} onClick={()=>void act('get',item.id)}><strong>{item.title}<small>{classroomLabels[item.mode]}</small></strong><span>Resume</span></button>
        :!item.canJoin?<div key={item.id} className={styles.discover}><strong>{item.title}<small>{classroomLabels[item.mode]}</small></strong><Link href="/student/tutoring">Connect to teacher</Link></div>
        :item.mode==='open'&&item.waitingStatus!=='admitted'?<div key={item.id} className={styles.discover}><strong>{item.title}<small>{item.teacherName||'Verified teacher'} · Public · Teacher approval required</small></strong>
          {item.waitingStatus==='pending'?<span role="status">Request sent · Waiting for teacher</span>:item.waitingStatus==='denied'?<span>Admission declined</span>:<button type="button" disabled={busy||!online} onClick={()=>void requestAdmission(item.id)}>Request to join</button>}
        </div>
        :<button type="button" key={item.id} disabled={busy} onClick={()=>void act('join',item.id)}><strong>{item.title}<small>{item.teacherName||'Teacher'} · {classroomLabels[item.mode]}</small></strong><span>Join Live</span></button>
      )}</div>:<p>{teacher?'No active session':rooms.length?'No matching lessons':'Waiting for your teacher to go live.'}</p>}
      <LiveIndependentStudy key={(classId??'all')+':'+String(teacher)} classId={classId} teacher={teacher} mode={hostMode} groupId={groupId||null}/>
      {pastAvailable&&<button type="button" aria-expanded={pastOpen} disabled={pastLoading} onClick={()=>void togglePastClasses()}>{pastOpen?'Hide Past Classes':'Past Classes'}</button>}
      {pastAvailable&&pastOpen&&<section aria-label="Past Classes">
        {pastLoading&&<p role="status">Loading saved lessons…</p>}
        {pastError&&<p role="alert">{pastError}</p>}
        {!pastLoading&&!pastError&&!pastRooms.length&&<p>No previously attended lessons to review.</p>}
        {!!pastRooms.length&&<div className={styles.rooms}>{pastRooms.map(item=><button key={item.id} type="button" disabled={busy||pastLoading} onClick={()=>void act('get',item.id)}>
          <strong>{item.title}<small>{classroomLabels[item.mode]} · Started {new Date(item.startedAt).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Nairobi'})}</small></strong>
          <span>View saved lesson</span>
        </button>)}</div>}
      </section>}
    </section>}
    {teacher&&room?.status==='ended'&&room.mode==='school'&&
      <LiveLessonReview roomId={room.id} roomStatus={room.status}
        preparedPlanId={linkedPlan?.id??null} selectedPlanId={selectedPlanId} classId={classId??''} savedPlans={savedPlans} onSelectPlan={setSelectedPlanId}/>}
    {room?.status==='ended'&&<section className={styles.panel}><h2>{room.title}</h2><p>This session has ended.</p>{teacher&&room.mode!=='open'&&<LiveIndependentStudy key={room.id} classId={room.mode==='school'?classId:null} teacher mode={room.mode} roomId={room.id}/>} {!teacher&&history.length>0&&<button type="button" onClick={()=>setSelfPaced(v=>!v)}>{selfPaced?'Close self-paced review':'Study independently'}</button>}{!teacher&&selfPaced?<LiveSelfPacedReview key={room.id} items={history} renderPage={item=><SharedPrompt prompt={item} roomId={room.id} learner/>} onClose={()=>setSelfPaced(false)}/>:<><LessonNavigation items={history} reviewId={reviewId} onReview={setReviewId} ended/>
       <section aria-label="Lesson summary" className={styles.savedMaterials}><h3>Lesson summary</h3><div className={styles.metrics}><span>{lessonMaterials.length} teaching pages</span><span>{lessonActivities.length} activities</span>{teacher&&<span>{participants.length} joined</span>}</div>{lessonActivities.length>0&&<><strong>Review and practise</strong><ul className={styles.savedMaterialList}>{lessonActivities.map((item,i)=><li key={item.id}><button type="button" aria-pressed={viewedPrompt?.id===item.id} onClick={()=>setReviewId(item.id)}>{i+1}. {item.body.slice(0,100)}</button></li>)}</ul><small>Review the questions and any revealed solutions.</small></>}</section><section aria-label="Saved teaching materials" className={styles.savedMaterials}><strong>Lesson materials</strong><p>Review the pages, diagrams and board work your teacher presented. Access still follows your current class or tuition permission.</p>
       <div className={styles.savedMaterialList}>{history.filter(item=>item.kind==='teach'||item.kind==='board').map(item=><button type="button" key={item.id} aria-pressed={viewedPrompt?.id===item.id} onClick={()=>setReviewId(item.id)}>{item.kind==='board'?'Shared whiteboard':decodeLiveFileRef(item.body)?'Shared PDF or photo':decodeSlide(item.body)?.title??item.body.split('\n')[0]?.slice(0,85)??'Lesson page'}</button>)}</div>
       {!history.some(item=>item.kind==='teach'||item.kind==='board')&&<p>No teaching materials were presented in this class.</p>}</section>
       <LiveWorkbook roomId={room.id} teacher={teacher} status={room.status} online={online} questions={history} currentId={prompt?.id} command={call} joined={participants.length}/><div aria-label="Saved lesson">{viewedPrompt?<LiveStageInk key={room.id+":"+viewedPrompt.id+":"+teacher} roomId={room.id} promptId={viewedPrompt.id} currentId={prompt?.id} teacher={teacher} status={room.status} online={online} participants={participants} command={call} version={room.version}><SharedPrompt prompt={viewedPrompt} roomId={room.id} learner={!teacher}/></LiveStageInk>:<SharedPrompt prompt={null}/>}</div></>}<LiveClassFiles roomId={room.id} teacher={teacher} status="ended"/>{!teacher&&room.ownNote&&<div><h3>My notes</h3><p className={styles.content}>{room.ownNote}</p></div>}<button onClick={leave}>Return to live lessons</button></section>}
  </main>
}
