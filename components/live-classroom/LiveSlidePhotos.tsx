'use client'
import {useState} from 'react'
import {LiveClassFiles} from './LiveClassFiles'
import {LiveFilePresentation} from './LiveFilePresentation'
import {encodePhotoSlide,updatePhoto,type PhotoSlide,type SlidePhoto} from './LiveSlideProtocol'
import styles from './LiveClassroom.module.css'
export function PhotoSurface({doc,roomId,mini=false}:{doc:PhotoSlide;roomId?:string;mini?:boolean}){
 if(roomId!==doc.roomId)return <p role="status">This photo slide belongs to its original classroom.</p>
 return <div className={styles.photoSlideSurface} aria-label="Photo slide">{doc.photos.map((photo,i)=><div key={photo.id} style={{position:'absolute',left:photo.x+'%',top:photo.y+'%',width:photo.w+'%',height:photo.h+'%',overflow:'hidden'}}>{mini?<span>Photo {i+1}</span>:<LiveFilePresentation roomId={roomId} fileId={photo.id} photoFit={photo.fit}/>}</div>)}</div>
}
export function PhotoEditor({doc,roomId,status,disabled,onChange}:{doc:PhotoSlide|null;roomId:string;status:'active'|'paused'|'ended';disabled:boolean;onChange:(body:string)=>void}){
 const [picker,setPicker]=useState(!doc),[selected,setSelected]=useState(0),[message,setMessage]=useState('')
 const photos=doc?.roomId===roomId?doc.photos:[]
 const photo=photos[Math.min(selected,photos.length-1)]
 const locked=disabled||status!=='active'
 function apply(next:SlidePhoto[]){
  if(locked)return
  if(!next.length){onChange('');return}
  const body=encodePhotoSlide({roomId,photos:next})
  if(body){onChange(body);setMessage('')}else setMessage('Invalid photo placement.')
 }
 function add(id:string){
  if(locked)return
  if(photos.some(p=>p.id===id)){setMessage('This photo is already on the slide.');return}
  if(photos.length>=4){setMessage('This slide already has four photos.');return}
  apply([...photos,{id,x:photos.length*8,y:photos.length*8,w:60,h:60,fit:'contain'}]);setSelected(photos.length);setPicker(false)
 }
 return <section className={styles.slideFields} aria-label="Photo objects">
 <small>Photos are shared from this classroom only. They cannot be exported or reused in another classroom.</small>
 <div className={styles.slideToolbar}>{photos.map((p,i)=><button type="button" key={p.id} aria-pressed={i===selected} onClick={()=>setSelected(i)}>Photo {i+1}</button>)}<button type="button" disabled={locked||photos.length>=4} onClick={()=>setPicker(v=>!v)}>{picker?'Hide photos':'Add photo'}</button><button type="button" disabled={locked} onClick={()=>{if(window.confirm('Remove photo objects from the draft? Shared lesson history remains.'))onChange('')}}>Switch to text</button></div>
 {photo&&<div className={styles.demoControls}>{(['x','y','w','h'] as const).map(field=><label key={field}>{({x:'Left',y:'Top',w:'Width',h:'Height'})[field]}: {photo[field]}%<input type="range" min={field==='w'||field==='h'?20:0} max={field==='x'?100-photo.w:field==='y'?100-photo.h:100} value={photo[field]} disabled={locked} onChange={e=>apply(photos.map(p=>p.id===photo.id?updatePhoto(p,{[field]:Number(e.target.value)}):p))}/></label>)}<label>Image fit<select value={photo.fit} disabled={locked} onChange={e=>apply(photos.map(p=>p.id===photo.id?updatePhoto(p,{fit:e.target.value==='cover'?'cover':'contain'}):p))}><option value="contain">Fit entire image</option><option value="cover">Fill and crop</option></select></label><button type="button" disabled={locked} onClick={()=>{apply(photos.filter(p=>p.id!==photo.id));setSelected(0)}}>Remove selected photo</button></div>}
 {message&&<p role="status">{message}</p>}
 {picker&&!locked&&<LiveClassFiles roomId={roomId} teacher status={status} onInsertPhoto={add}/>}
 </section>
}
