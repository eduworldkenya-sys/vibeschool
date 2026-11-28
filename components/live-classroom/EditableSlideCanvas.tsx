'use client'
import type {ReactNode} from 'react'
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
 return <SlideCanvas slide={slide} number={number} total={total} roomId={roomId} ownerPhotoPreview edit={{
  title: <input className={styles.canvasTitleInput} aria-label={titleLabel} placeholder="Slide title" value={slide.title} maxLength={120} disabled={disabled} onChange={event=>onChange({title:event.target.value})}/>,
  body: <div className={styles.canvasBodyEditor}>{preview}<SlideBodyEditor slide={slide} disabled={disabled} roomId={roomId} roomStatus={roomStatus} allowActivities={allowActivities} onChange={body=>onChange({body})}/></div>,
 }}/>
}
