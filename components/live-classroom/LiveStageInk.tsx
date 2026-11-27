'use client'
import {useCallback,useEffect,useRef,useState,type PointerEvent,type ReactNode} from 'react'
import { Pencil, Undo2, Trash2, Check, X, UserPlus } from 'lucide-react'
import {BOARD_COLORS} from './LiveBoardProtocol'
import styles from './LiveClassroom.module.css'
type Point=[number,number]
type Stroke={color:string;width:2|4|8;points:Point[]}
type Snapshot={revision:number;ink:Stroke[];canContribute:boolean;grantee:string|null;proposal:Stroke[]|null;pending:boolean}
type Command=(action:string,id:string|null,version:number|null,payload:Record<string,unknown>)=>Promise<unknown>
type Props={children:ReactNode;roomId:string;promptId:string;currentId?:string;teacher:boolean;status:string;online:boolean;participants:{studentId:string;name:string}[];command:Command;version:number}
const EMPTY:Snapshot={revision:0,ink:[],canContribute:false,grantee:null,proposal:null,pending:false}
const pointValid=(p:unknown):p is Point=>Array.isArray(p)&&p.length===2&&p.every(x=>Number.isInteger(x)&&x>=0&&x<=1000)
function validInk(v:unknown):v is Stroke[]{
 return Array.isArray(v)&&v.length<=24&&v.every(s=>s&&typeof s==='object'&&BOARD_COLORS.some(c=>c===s.color)&&[2,4,8].includes(s.width)&&Array.isArray(s.points)&&s.points.length>0&&s.points.length<=80&&s.points.every(pointValid))
}
function parse(v:unknown):Snapshot{
 const s=v as Snapshot
 if(!s||!Number.isInteger(s.revision)||s.revision<0||!validInk(s.ink)||typeof s.canContribute!=='boolean'||typeof s.pending!=='boolean'||(s.grantee!==null&&typeof s.grantee!=='string')||(s.proposal!==null&&!validInk(s.proposal)))throw Error('Invalid annotation response.')
 return s
}
function Marks({strokes}:{strokes:Stroke[]}){
 return <>{strokes.map((s,i)=>s.points.length===1?<path key={i} d={'M'+s.points[0].join(' ')+'h.1'} stroke={s.color} strokeWidth={s.width} vectorEffect="non-scaling-stroke" strokeLinecap="round"/>:<polyline key={i} points={s.points.map(p=>p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth={s.width} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>)}</>
}
/** Uses the existing authorized prompt; ink is a bounded visual layer, not a new content source.
 * A learner's proposal never appears on other learners' screens before explicit host approval. */
export function LiveStageInk({children,roomId,promptId,currentId,teacher,status,online,participants,command,version}:Props){
 const [snapshot,setSnapshot]=useState<Snapshot>(EMPTY),[loaded,setLoaded]=useState(false),[editing,setEditing]=useState(false),[draft,setDraft]=useState<Stroke[]>([]),[preview,setPreview]=useState<Stroke|null>(null),[color,setColor]=useState<string>(BOARD_COLORS[2]),[width,setWidth]=useState<2|4|8>(4),[grant,setGrant]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[review,setReview]=useState(false)
 const stroke=useRef<{pointerId:number;value:Stroke}|null>(null),revision=useRef(0),alive=useRef(false),pending=useRef(false),readId=useRef(0),reading=useRef(false)
 const open=status==='active'&&currentId===promptId&&online
 const permitted=loaded&&open&&(teacher||snapshot.canContribute)
 const refresh=useCallback(async()=>{
  if(pending.current||reading.current||!online||document.visibilityState==='hidden')return
  reading.current=true;const id=++readId.current
  try{
   const next=parse(await command('ink_get',roomId,null,{promptId}))
   if(alive.current&&id===readId.current&&!pending.current){setSnapshot(next);setLoaded(true)}
  }catch(e){
   if(alive.current&&id===readId.current){setLoaded(false);setEditing(false);setSnapshot(EMPTY);setReview(false);setError(e instanceof Error?e.message:'Annotations unavailable.')}
  }finally{reading.current=false}
 },[online,command,roomId,promptId])
 useEffect(()=>{alive.current=true;void refresh();const timer=window.setInterval(()=>void refresh(),2500);const wake=()=>void refresh();document.addEventListener('visibilitychange',wake);return()=>{alive.current=false;readId.current++;window.clearInterval(timer);document.removeEventListener('visibilitychange',wake)}},[refresh])
 useEffect(()=>{void refresh()},[version,refresh])
 useEffect(()=>{if(!permitted){setEditing(false);stroke.current=null;setPreview(null)}},[permitted])
 const begin=()=>{if(!permitted)return;setDraft(snapshot.ink);revision.current=snapshot.revision;setEditing(true);setReview(false);setError('')}
 function point(e:PointerEvent<SVGSVGElement>):Point{
  const r=e.currentTarget.getBoundingClientRect()
  const clamp=(n:number)=>Math.round(Math.max(0,Math.min(1000,n)))
  return [clamp((e.clientX-r.left)*1000/Math.max(1,r.width)),clamp((e.clientY-r.top)*1000/Math.max(1,r.height))]
 }
 function down(e:PointerEvent<SVGSVGElement>){
  if(!editing||!permitted||busy||draft.length>=24||stroke.current||e.button!==0)return
  e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId)
  const value:Stroke={color,width,points:[point(e)]};stroke.current={pointerId:e.pointerId,value};setPreview(value)
 }
 function move(e:PointerEvent<SVGSVGElement>){
  if(stroke.current?.pointerId!==e.pointerId||!editing||!permitted)return
  const s=stroke.current.value,p=point(e),last=s.points[s.points.length-1]
  if(s.points.length>=80||Math.hypot(p[0]-last[0],p[1]-last[1])<8)return
  s.points.push(p);setPreview({...s,points:[...s.points]})
 }
 function stop(e:PointerEvent<SVGSVGElement>){
  if(stroke.current?.pointerId!==e.pointerId)return
  const value=stroke.current.value;stroke.current=null;setPreview(null)
  if(permitted&&editing)setDraft(v=>[...v,value].slice(0,24))
 }
 async function write(action:string,payload:Record<string,unknown>={},expected=snapshot.revision){
  if(pending.current||!open||!loaded)return
  pending.current=true;readId.current++;setBusy(true);setError('')
  try{
   const next=parse(await command(action,roomId,null,{promptId,revision:expected,...payload}))
   if(!alive.current)return
   setSnapshot(next);setEditing(false);setReview(false);setPreview(null);setLoaded(true);stroke.current=null
  }catch(e){
   if(alive.current)setError(e instanceof Error&&e.message==='live_ink_conflict'?'The shared drawing changed. Copy or discard your draft and reopen annotation.':e instanceof Error?e.message:'Could not save drawing.')
  }finally{pending.current=false;if(alive.current)setBusy(false)}
 }
 const visible=editing?draft:review&&teacher&&snapshot.proposal?snapshot.proposal:snapshot.ink
 return <div className={teacher?styles.inkWorkspace:styles.inkLearnerWorkspace}>
  {(teacher&&open&&loaded||snapshot.canContribute||snapshot.pending||snapshot.ink.length>0||error)&&<div className={teacher?styles.inkRail:styles.boardTools} aria-label="Presentation annotation controls">
   {permitted&&!editing&&<button type="button" aria-label={teacher?'Annotate presentation':'Draw for teacher'} onClick={begin}>{teacher&&<Pencil size={18}/>}<span>{teacher?'Annotate':'Draw for teacher'}</span></button>}
   {editing&&<><label>Ink<select aria-label="Ink colour" value={color} onChange={e=>setColor(e.target.value)}>{BOARD_COLORS.map((c,i)=><option key={c} value={c}>{['Ink','Blue','Red','Green','Gold','Violet'][i]}</option>)}</select></label><label>Width<select aria-label="Ink width" value={width} onChange={e=>setWidth(Number(e.target.value) as 2|4|8)}><option value={2}>Fine</option><option value={4}>Medium</option><option value={8}>Thick</option></select></label>
    <button type="button" disabled={busy||!draft.length} aria-label="Undo stroke" title="Undo stroke" onClick={()=>setDraft(v=>v.slice(0,-1))}><Undo2 size={18}/><span>Undo</span></button><button type="button" disabled={busy||!draft.length} aria-label="Clear draft" title="Clear draft" onClick={()=>setDraft([])}><Trash2 size={18}/><span>Clear</span></button><button type="button" disabled={busy||!permitted||!!preview} onClick={()=>void write(teacher?'ink_save':'ink_offer',{ink:draft},revision.current)}><Check size={18}/><span>{teacher?'Share marks':'Submit drawing'}</span></button><button type="button" disabled={busy} onClick={()=>{setEditing(false);setPreview(null);stroke.current=null;setError('')}}><X size={18}/><span>Cancel</span></button><small>Marks use the displayed surface; page layout can differ between devices. {draft.length}/24 strokes</small></>}
   {teacher&&open&&loaded&&!editing&&<><label>Invite learner<select aria-label="Invite learner to draw" value={grant} onChange={e=>setGrant(e.target.value)}><option value="">Choose learner</option>{participants.map(p=><option key={p.studentId} value={p.studentId}>{p.name}</option>)}</select></label><button type="button" disabled={busy||!grant} onClick={()=>{if(!snapshot.proposal||window.confirm('Discard the pending drawing and invite another learner?'))void write('ink_grant',{studentId:grant})}}><UserPlus size={18}/><span>Invite</span></button>{snapshot.grantee&&<button type="button" disabled={busy} onClick={()=>{if(!snapshot.proposal||window.confirm('Discard the pending learner drawing?'))void write('ink_grant',{studentId:null})}}>Revoke invitation</button>}
    {snapshot.proposal&&<><button type="button" aria-pressed={review} onClick={()=>setReview(v=>!v)}>{review?'Show class view':'Preview learner drawing'}</button><button type="button" disabled={busy||!review} onClick={()=>void write('ink_publish')}>Share learner drawing</button><button type="button" disabled={busy} onClick={()=>void write('ink_reject')}>Decline drawing</button><small>Only you can see the proposed marks until shared.</small></>}</>}
   {!teacher&&snapshot.pending&&<small role="status">Drawing sent for teacher review.</small>}
   {error&&<small role="alert">{error} <button type="button" disabled={!online||busy} onClick={()=>{setError('');void refresh()}}>Retry</button></small>}
  </div>}
  <div style={{position:'relative',display:'flex',flexDirection:'column',gap:8,flex:'1 0 auto',minWidth:0,minHeight:0}}>
   {children}
   {(visible.length>0||editing||preview)&&<svg aria-label={editing?'Drawing surface':'Shared presentation annotations'} role="img" viewBox="0 0 1000 1000" preserveAspectRatio="none" onPointerDown={down} onPointerMove={move} onPointerUp={stop} onPointerCancel={()=>{stroke.current=null;setPreview(null)}} onLostPointerCapture={()=>{stroke.current=null;setPreview(null)}} style={{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:5,touchAction:editing?'none':'auto',pointerEvents:editing&&permitted?'auto':'none',cursor:editing?'crosshair':'default'}}><Marks strokes={visible}/>{preview&&<Marks strokes={[preview]}/>}</svg>}
  </div>
 </div>
}
