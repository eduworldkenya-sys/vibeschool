'use client'
import {useState} from 'react'
import {ObjectBoard} from './LiveObjectBoard'
import {BOARD_COLORS,emptyBoard,encodeBoard,decodeBoard} from './LiveBoardProtocol'
import {encodeSlide,visualSlideBody,visualSlidePayload,decodeDemo,encodeDemo,defaultDemo,DEMO_RANGES,diagramLabel,decodeAssessment,decodePhotoSlide,decodeMultiDemo,encodeMultiDemo,type DemoKind,type LiveSlide} from './LiveSlideProtocol'
import {PhotoEditor} from './LiveSlidePhotos'
import {AssessmentEditor} from './LiveSlideAssessmentEditor'
import {MultiDiagramEditor} from './LiveMultiDiagram'
import {DemoControls} from './LiveAdjustableDiagram'
import styles from './LiveClassroom.module.css'

type Props={slide:LiveSlide;disabled:boolean;onChange:(body:string)=>void;roomId?:string;roomStatus?:'active'|'paused'|'ended'}
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
export function SlideBodyEditor({slide,disabled,onChange,roomId,roomStatus}:Props){
 const [photoOpen,setPhotoOpen]=useState(false)
 const photos=decodePhotoSlide(slide.body)
 const [activityOpen,setActivityOpen]=useState(false)
 const assessment=decodeAssessment(slide.body)
 const demo=decodeDemo(slide.body)
 const multi=decodeMultiDemo(slide.body)
 if(multi)return <MultiDiagramEditor items={multi} disabled={disabled} onChange={onChange}/>
 if((photoOpen||photos)&&roomId&&roomStatus)return <PhotoEditor doc={photos} roomId={roomId} status={roomStatus} disabled={disabled} onChange={body=>{onChange(body);if(!body)setPhotoOpen(false)}}/>
 if(photos)return <p>This photo slide is bound to its original classroom. <button type="button" disabled={disabled} onClick={()=>{if(window.confirm('Remove classroom photos from this draft?'))onChange('')}}>Remove photos</button></p>
 if(activityOpen)return <AssessmentEditor initial={assessment??{kind:'quiz',question:'',options:['','']}} disabled={disabled} onApply={body=>{onChange(body);setActivityOpen(false)}} onCancel={()=>setActivityOpen(false)}/>
 if(assessment)return <div className={styles.slideToolbar}><button type="button" disabled={disabled} onClick={()=>setActivityOpen(true)}>Edit quiz / poll</button><button type="button" disabled={disabled} onClick={()=>{if(window.confirm('Replace the activity with a text slide?'))onChange('')}}>Switch to text</button></div>
 if(demo)return <section aria-label="Adjustable teaching diagram"><DemoControls demo={demo} disabled={disabled} onChange={d=>onChange(encodeDemo(d))}/><button type="button" disabled={disabled} onClick={()=>onChange(encodeMultiDemo([{id:crypto.randomUUID(),demo}]))}>Add more diagrams</button><button type="button" disabled={disabled} onClick={()=>{if(window.confirm('Replace this demonstration with text?'))onChange('')}}>Switch to text</button></section>
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
 return <><label>Content<textarea value={slide.body} maxLength={3878} disabled={disabled} onChange={e=>onChange(e.target.value)}/></label><button type="button" disabled={disabled} onClick={convert}>Use visual canvas</button><button type="button" disabled={disabled} onClick={()=>{if(!slide.body.trim()||window.confirm('Replace existing content with a quiz or poll?'))setActivityOpen(true)}}>Add quiz or poll</button>{roomId&&roomStatus==='active'&&<button type="button" disabled={disabled} onClick={()=>{if(!slide.body.trim()||window.confirm('Replace the content with photo objects?'))setPhotoOpen(true)}}>Add photo objects</button>}<label>Adjustable demonstration<select disabled={disabled} value="" onChange={e=>{const kind=e.target.value as DemoKind;if(!kind||!Object.prototype.hasOwnProperty.call(DEMO_RANGES,kind))return;if(slide.body.trim()&&!window.confirm('Replace existing content with the demonstration?'))return;onChange(encodeDemo(defaultDemo(kind)))}}><option value="">Choose demonstration</option>{Object.keys(DEMO_RANGES).map(k=><option key={k} value={k}>{diagramLabel(k as DemoKind)}</option>)}</select></label></>
}
