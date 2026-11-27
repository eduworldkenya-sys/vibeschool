'use client'
import {useEffect,useRef,useState} from 'react'
import {SlideBodyEditor} from './LiveSlideBodyEditor'
import {SlideCanvas} from './LiveSlideCanvas'
import {decodeSlide,encodeSlide,decodeAssessment,decodePhotoSlide,type LiveSlide} from './LiveSlideProtocol'
import styles from './LiveClassroom.module.css'

export function canEditCurrentSlide(body:string):boolean{
 const slide=decodeSlide(body)
 return !!slide&&!decodeAssessment(slide.body)&&!decodePhotoSlide(slide.body)
  &&(!/^VSLIDE[A-Z0-9]*:/.test(slide.body)||/^VSLIDE(?:VIS|DEMO|MULTIDEMO)1:/.test(slide.body))
}

type Props={body:string;roomId:string;active:boolean;busy:boolean;onSync:(expected:string,next:string)=>Promise<string|undefined>;onClose:()=>void}
export function LiveCurrentSlideEditor({body,roomId,active,busy,onSync,onClose}:Props){
 const initial=decodeSlide(body)!
 const [draft,setDraft]=useState<LiveSlide>(()=>initial)
 const [expected,setExpected]=useState(body)
 const [sending,setSending]=useState(false)
 const [error,setError]=useState('')
 const alive=useRef(true)
 const sync=useRef(onSync)
 sync.current=onSync
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 const encoded=encodeSlide(draft,initial.number,initial.total)
 const dirty=encoded!==expected
 const reconciled=!!encoded&&dirty&&body===encoded
 const conflict=!sending&&body!==expected&&!reconciled
 function patch(p:Partial<LiveSlide>){setDraft(d=>({...d,...p}));setError('')}
 useEffect(()=>{
  if(!active||busy||sending||(error&&!reconciled)||conflict||!encoded||!dirty)return
  const timer=window.setTimeout(()=>{
   setSending(true)
   void sync.current(expected,encoded).then(result=>{
    if(!alive.current)return
    if(result===encoded){setExpected(result);setError('')}
    else setError('Changes not shared. Retry when the connection is ready, or reopen the current slide.')
   }).catch(()=>{if(alive.current)setError('Changes not shared. Retry or reopen the current slide.')})
   .finally(()=>{if(alive.current)setSending(false)})
  },500)
  return()=>window.clearTimeout(timer)
 },[active,busy,sending,error,conflict,encoded,dirty,expected,reconciled])
 const disabled=!active||sending||conflict
 return <div className={styles.slideWorkspace} aria-label="Edit presented slide">
  <div className={styles.slideToolbar}><strong>Edit live slide</strong><span>{initial.number} / {initial.total}</span>
   <button type="button" disabled={sending} onClick={()=>{if(!dirty||window.confirm('Discard changes that have not been shared?'))onClose()}}>Done</button>
  </div>
  <small role="status">{sending?'Sharing changes…':conflict?'The displayed slide changed elsewhere. Reopen it before editing.':!active?'Live updates paused.':!encoded?'Shorten or complete the slide.':error?'Not shared':dirty?'Changes pending…':'Shared with class'}</small>
  {error&&<div role="alert">{error}<button type="button" disabled={busy||disabled} onClick={()=>setError('')}>Retry</button></div>}
  <SlideCanvas slide={draft} number={initial.number} total={initial.total} roomId={roomId}/>
  <label>Title<input maxLength={120} value={draft.title} disabled={disabled} onChange={e=>patch({title:e.target.value})}/></label>
  <SlideBodyEditor slide={draft} disabled={disabled} allowActivities={false} onChange={body=>patch({body})}/>
  <small>Edits apply to this live lesson.</small>
 </div>
}
