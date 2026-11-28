'use client'
import {useState,type ReactNode} from 'react'
import {decodeAssessment,decodeDemo,isDemoBody,decodeMultiDemo,decodePhotoSlide,visualSlidePayload} from './LiveSlideProtocol'
import styles from './LiveClassroom.module.css'
import {SlideCanvas, type LiveSlide} from './LiveSlideCanvas'
import {SlideBodyEditor} from './LiveSlideBodyEditor'

type Props = {
 slide: LiveSlide
 number: number
 total: number
 disabled: boolean
 titleLabel?: string
 roomId?: string
 roomStatus?: 'active'|'paused'|'ended'
 preview?: ReactNode
 allowActivities?: boolean
 onChange: (patch: Partial<LiveSlide>) => void
}

export function EditableSlideCanvas({slide, number, total, disabled, titleLabel='Title', roomId, roomStatus, preview, allowActivities, onChange}: Props) {
 const [toolsHost,setToolsHost]=useState<HTMLDivElement|null>(null)
 const visual=visualSlidePayload(slide.body)!==null
 const text=!visual&&!isDemoBody(slide.body)&&!decodeDemo(slide.body)&&!decodeMultiDemo(slide.body)&&!decodePhotoSlide(slide.body)&&!decodeAssessment(slide.body)
 const editor=toolsHost&&<SlideBodyEditor slide={slide} disabled={disabled} roomId={roomId} roomStatus={roomStatus} allowActivities={allowActivities} toolsHost={toolsHost} inlineText={text} onChange={body=>onChange({body})}/>
 return <>
  <div ref={setToolsHost} className={styles.canvasToolRail} role="group" aria-label="Slide tools"/>
  <SlideCanvas slide={slide} number={number} total={total} roomId={roomId} ownerPhotoPreview edit={{
   title: <input className={styles.canvasTitleInput} aria-label={titleLabel} placeholder="Slide title" value={slide.title} maxLength={120} disabled={disabled} onChange={event=>onChange({title:event.target.value})}/>,
   body: preview||text||visual?<div className={styles.canvasBodyEditor}>{preview}{text&&<textarea aria-label="Content" placeholder="Type slide content" value={slide.body} maxLength={3878} disabled={disabled} onChange={event=>onChange({body:event.target.value})}/>} {visual&&editor}</div>:undefined,
  }}/>
  {!visual&&editor}
 </>
}
