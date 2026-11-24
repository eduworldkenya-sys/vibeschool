'use client'
import {useState} from 'react'
import {ObjectBoard} from './LiveObjectBoard'
import {BOARD_COLORS,emptyBoard,encodeBoard,decodeBoard} from './LiveBoardProtocol'
import {encodeSlide,visualSlideBody,visualSlidePayload,type LiveSlide} from './LiveSlideProtocol'
import styles from './LiveClassroom.module.css'

type Props={slide:LiveSlide;disabled:boolean;onChange:(body:string)=>void}
function VisualEditor({slide,disabled,onChange}:Props){
 const [undo,setUndo]=useState<string[]>([]),[redo,setRedo]=useState<string[]>([]),[error,setError]=useState('')
 const value=visualSlidePayload(slide.body)??''
 const valid=decodeBoard(value)
 function accept(next:string){
  const doc=decodeBoard(next)
  if(!doc){setError('Invalid visual slide.');return false}
  const canonical=encodeBoard({...doc,page:1,total:1})
  const body=visualSlideBody(canonical)
  if(!canonical||!encodeSlide({...slide,body},30,30)){setError('This slide has reached its live presentation size limit. Remove some objects or use another slide.');return false}
  setError('');onChange(body);return true
 }
 function change(next:string){
  if(disabled||next===value)return
  if(accept(next)){setUndo(items=>[...items.slice(-29),value]);setRedo([])}
 }
 function back(){
  if(disabled||!undo.length)return
  if(accept(undo[undo.length-1])){setRedo(items=>[...items.slice(-29),value]);setUndo(items=>items.slice(0,-1))}
 }
 function forward(){
  if(disabled||!redo.length)return
  if(accept(redo[redo.length-1])){setUndo(items=>[...items.slice(-29),value]);setRedo(items=>items.slice(0,-1))}
 }
 return <section className={styles.slideVisualEditor} aria-label="Visual slide editor">
  <div className={styles.slideToolbar}><strong>Visual slide</strong><button type="button" disabled={disabled} onClick={()=>{if(window.confirm('Replace visual objects with an empty text slide? Published slides remain unchanged.'))onChange('')}}>Switch to text</button></div>
  {valid?<ObjectBoard value={value} page={1} total={1} onChange={change} disabled={disabled} onUndo={back} onRedo={forward} canUndo={undo.length>0} canRedo={redo.length>0}/>:<p role="alert">This drawing is invalid. Switch to text to replace it.</p>}
  {error&&<p role="alert">{error}</p>}
 </section>
}
export function SlideBodyEditor({slide,disabled,onChange}:Props){
 if(visualSlidePayload(slide.body)!==null)return <VisualEditor slide={slide} disabled={disabled} onChange={onChange}/>
 function convert(){
  const text=slide.body.trim()
  if(text.length>180||text.includes('\n')){if(!window.confirm('This text is too long for a single movable object. Replace the content with a blank visual canvas?'))return}
  else if(text&&!window.confirm('Convert the existing text into a movable text object?'))return
  const doc=emptyBoard()
  if(text&&text.length<=180&&!text.includes('\n'))doc.objects.push({id:crypto.randomUUID().replaceAll('-',''),kind:'text',x:20,y:25,w:280,h:20,angle:0,color:BOARD_COLORS[0],stroke:3,text})
  const body=visualSlideBody(encodeBoard(doc))
  if(encodeSlide({...slide,body},30,30))onChange(body)
 }
 return <><label>Content<textarea value={slide.body} maxLength={3878} disabled={disabled} onChange={e=>onChange(e.target.value)}/></label><button type="button" disabled={disabled} onClick={convert}>Use visual canvas</button></>
}
