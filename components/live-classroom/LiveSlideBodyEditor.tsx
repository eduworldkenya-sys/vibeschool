'use client'
import {createPortal} from 'react-dom'
import {useState} from 'react'
import {ObjectBoard} from './LiveObjectBoard'
import {encodeBoard,decodeBoard,composeVisualSlide} from './LiveBoardProtocol'
import {encodeSlide,visualSlideBody,visualSlidePayload,decodeDemo,encodeDemo,defaultDemo,DEMO_RANGES,decodeAssessment,decodePhotoSlide,decodeMultiDemo,encodeMultiDemo,type DemoKind,type LiveSlide} from './LiveSlideProtocol'
import {PhotoEditor} from './LiveSlidePhotos'
import {AssessmentEditor} from './LiveSlideAssessmentEditor'
import {MultiDiagramEditor} from './LiveMultiDiagram'
import {DemoControls} from './LiveAdjustableDiagram'
import {TeachingModelOptions} from './TeachingModelPicker'
import styles from './LiveClassroom.module.css'

type Props={slide:LiveSlide;disabled:boolean;allowVisual?:boolean;allowActivities?:boolean;onChange:(body:string)=>void;roomId?:string;toolsHost?:HTMLElement|null;inlineText?:boolean;roomStatus?:'active'|'paused'|'ended'}
function VisualEditor({slide,disabled,onChange,toolsHost}:Props){
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
  {placeTools(<div className={styles.slideToolbar}><strong>Visual slide</strong><button type="button" disabled={disabled} onClick={()=>{if(window.confirm('Replace visual objects with an empty text slide? Published slides remain unchanged.'))onChange('')}}>Switch to text</button></div>,toolsHost)}
  {valid?<ObjectBoard value={value} page={1} total={1} onChange={change} disabled={disabled} onUndo={back} onRedo={forward} canUndo={undo.length>0} canRedo={redo.length>0} allowAdjustable toolsHost={toolsHost}/>:<p role="alert">This drawing is invalid. Switch to text to replace it.</p>}
  {error&&<p role="alert">{error}</p>}
 </section>
}
function placeTools(content:React.ReactNode,host?:HTMLElement|null){
 return host?createPortal(content,host):content
}
export function SlideBodyEditor({slide,disabled,onChange,roomId,roomStatus,allowVisual=true,allowActivities=true,toolsHost,inlineText=false}:Props){
 const props={slide,disabled,onChange,roomId,roomStatus,allowVisual,allowActivities}
 if(toolsHost&&visualSlidePayload(slide.body)===null)
  return createPortal(<BodyControls {...props} inlineText={inlineText}/>,toolsHost)
 return <BodyControls {...props} toolsHost={toolsHost} inlineText={inlineText}/>
}
function BodyControls({slide,disabled,onChange,roomId,roomStatus,allowVisual,allowActivities,toolsHost,inlineText}:Props){
 const [photoOpen,setPhotoOpen]=useState(false)
 const photos=decodePhotoSlide(slide.body)
 const [activityOpen,setActivityOpen]=useState(false)
 const assessment=decodeAssessment(slide.body)
 const demo=decodeDemo(slide.body)
 const multi=decodeMultiDemo(slide.body)
 const [composeError,setComposeError]=useState('')
 function convert(extra?:ReturnType<typeof defaultDemo>){
  const body=composeVisualSlide(slide.body,extra,()=>crypto.randomUUID().replaceAll('-',''))
  if(!body||!encodeSlide({...slide,body},30,30)){setComposeError('This slide cannot fit on the interactive canvas. Shorten the text or add an explicit new slide. Existing content is unchanged.');return}
  setComposeError('');onChange(body)
 }
 if(multi)return <><MultiDiagramEditor items={multi} disabled={disabled} onChange={onChange}/>{allowVisual&&<button type="button" disabled={disabled} onClick={()=>convert()}>Add writing or objects on interactive canvas</button>}{composeError&&<p role="alert">{composeError}</p>}</>
 if((photoOpen||photos)&&roomId&&roomStatus&&(!photos||photos.roomId===roomId))return <PhotoEditor doc={photos} roomId={roomId} status={roomStatus} disabled={disabled} onChange={body=>{onChange(body);if(!body)setPhotoOpen(false)}}/>
 if(photos)return <p>Saved photo layout. The original photos remain protected; prepare copies in the current classroom before presenting. <button type="button" disabled={disabled} onClick={()=>{if(window.confirm('Remove classroom photos from this draft?'))onChange('')}}>Remove photos</button></p>
 if(activityOpen)return <AssessmentEditor initial={assessment??{kind:'quiz',question:'',options:['','']}} disabled={disabled} onApply={body=>{onChange(body);setActivityOpen(false)}} onCancel={()=>setActivityOpen(false)}/>
 if(assessment)return <div className={styles.slideToolbar}><button type="button" disabled={disabled} onClick={()=>setActivityOpen(true)}>Edit quiz / poll</button><button type="button" disabled={disabled} onClick={()=>{if(window.confirm('Replace the activity with a text slide?'))onChange('')}}>Switch to text</button></div>
 if(demo)return <section aria-label="Adjustable teaching diagram"><DemoControls demo={demo} disabled={disabled} onChange={d=>onChange(encodeDemo(d))}/><button type="button" disabled={disabled} onClick={()=>onChange(encodeMultiDemo([{id:crypto.randomUUID(),demo}]))}>Add more diagrams</button>{allowVisual&&<button type="button" disabled={disabled} onClick={()=>convert()}>Add writing or objects on interactive canvas</button>}{composeError&&<p role="alert">{composeError}</p>}<button type="button" disabled={disabled} onClick={()=>{if(window.confirm('Replace this demonstration with text?'))onChange('')}}>Switch to text</button></section>
 if(visualSlidePayload(slide.body)!==null)return <VisualEditor slide={slide} disabled={disabled} onChange={onChange} toolsHost={toolsHost}/>

 return <>{!inlineText&&<label>Content<textarea aria-label="Content" value={slide.body} maxLength={3878} disabled={disabled} onChange={e=>onChange(e.target.value)}/></label>}{allowVisual&&<button type="button" disabled={disabled} onClick={()=>convert()}>Use interactive canvas</button>}{allowActivities&&<button type="button" disabled={disabled} onClick={()=>{if(!slide.body.trim()||window.confirm('Replace existing content with a quiz or poll?'))setActivityOpen(true)}}>Add quiz or poll</button>}{roomId&&roomStatus==='active'&&<button type="button" disabled={disabled} onClick={()=>{if(!slide.body.trim()||window.confirm('Replace the content with photo objects?'))setPhotoOpen(true)}}>Add photo objects</button>}<label>Adjustable demonstration<select disabled={disabled} value="" onChange={e=>{const kind=e.target.value as DemoKind;if(!kind||!Object.prototype.hasOwnProperty.call(DEMO_RANGES,kind))return;if(allowVisual){convert(defaultDemo(kind));return}if(slide.body.trim()&&!window.confirm('Replace existing content with the demonstration?'))return;onChange(encodeDemo(defaultDemo(kind)))}}><option value="">Choose demonstration</option><TeachingModelOptions/></select></label>{composeError&&<p role="alert">{composeError}</p>}</>
}
