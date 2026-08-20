"use client"

import { useEffect,useRef } from "react"
import { LearningTransformPanel } from "@/components/read/LearningTransformPanel"
import type { ReaderNarratorController } from "@/components/read/useReaderNarrator"
import styles from "./ReaderLearningSheet.module.css"

export type ReaderSheetMode='tools'|'learn'|'listen'

type Props={
  open:boolean
  mode:ReaderSheetMode
  chapterId:string
  chapterTitle:string
  fontSize:number
  narrator:ReaderNarratorController
  onMode:(mode:ReaderSheetMode)=>void
  onClose:()=>void
  onPractice:()=>void
  onFontSize:(size:number)=>void
  onFocus:()=>void
}

type ResumeDetail={blockElementId?:unknown}

export function ReaderLearningSheet({open,mode,chapterId,chapterTitle,fontSize,narrator,onMode,onClose,onPractice,onFontSize,onFocus}:Props){
  const closeRef=useRef<HTMLButtonElement|null>(null)
  const sheetRef=useRef<HTMLElement|null>(null)
  const dragStart=useRef<number|null>(null)
  const afterPopRef=useRef<(()=>void)|null>(null)
  const historyToken=useRef(`reader-sheet-${Math.random().toString(36).slice(2)}`)

  useEffect(()=>{
    const resume=(raw:Event)=>{const detail=(raw as CustomEvent<ResumeDetail>).detail;if(typeof detail?.blockElementId!=="string"||!detail.blockElementId)return;onMode('listen');narrator.startAtElementId(detail.blockElementId)}
    window.addEventListener('vibe:reader-resume-listening',resume)
    return()=>window.removeEventListener('vibe:reader-resume-listening',resume)
  },[narrator,onMode])

  useEffect(()=>{
    if(!open)return
    const previousOverflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    const token=historyToken.current
    if(window.history.state?.vibeReaderSheet!==token)window.history.pushState({...window.history.state,vibeReaderSheet:token},'')
    const pop=()=>{onClose();const next=afterPopRef.current;afterPopRef.current=null;if(next)window.setTimeout(next,0)}
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();if(window.history.state?.vibeReaderSheet===token)window.history.back();else onClose();return}
      if(event.key!=='Tab'||!sheetRef.current)return
      const focusable=Array.from(sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
      if(!focusable.length)return
      const first=focusable[0],last=focusable[focusable.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
    window.addEventListener('popstate',pop);window.addEventListener('keydown',key)
    window.setTimeout(()=>closeRef.current?.focus(),0)
    return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener('popstate',pop);window.removeEventListener('keydown',key)}
  },[open,onClose])

  if(!open)return null
  const closeThen=(after?:()=>void)=>{if(window.history.state?.vibeReaderSheet===historyToken.current){afterPopRef.current=after??null;window.history.back()}else{onClose();after?.()}}
  const back=()=>onMode('tools')
  const title=mode==='tools'?'Reading tools':mode==='learn'?'Learn this unit':'Listen'
  const eyebrow=mode==='tools'?'VibeLearn':chapterTitle
  const playLabel=narrator.status==='paused'?'Resume':narrator.status==='playing'?'Pause':'Play'

  return <div className={styles.backdrop} role="presentation" onMouseDown={event=>{if(event.currentTarget===event.target)closeThen()}}>
    <section ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.handleWrap} onPointerDown={event=>{dragStart.current=event.clientY}} onPointerUp={event=>{if(dragStart.current!==null&&event.clientY-dragStart.current>72)closeThen();dragStart.current=null}}><span className={styles.handle}/></div>
      <header className={styles.header}>
        {mode!=='tools'?<button type="button" className={styles.iconButton} aria-label="Back to reading tools" onClick={back}>←</button>:null}
        <div className={styles.titleWrap}><div className={styles.eyebrow}>{eyebrow}</div><div className={styles.title}>{title}</div></div>
        <button ref={closeRef} type="button" className={styles.iconButton} aria-label="Close reading tools" onClick={()=>closeThen()}>×</button>
      </header>
      <div className={styles.body}>
        {mode==='tools'?<>
          <div className={styles.primaryGrid}>
            <button className={styles.primaryAction} type="button" onClick={()=>onMode('learn')}><span><strong>Learn</strong><small>Explain, revise, quiz or visualise</small></span><span>›</span></button>
            <button className={styles.primaryAction} type="button" onClick={()=>closeThen(onPractice)}><span><strong>Practice</strong><small>Check your understanding</small></span><span>›</span></button>
            <button className={styles.primaryAction} type="button" onClick={()=>onMode('listen')}><span><strong>Listen</strong><small>Natural narration with controls</small></span><span>›</span></button>
          </div>
          <div className={styles.secondary}>
            <div className={styles.controlRow}><span>Text size</span><span className={styles.smallControls}><button className={styles.smallButton} type="button" aria-label="Decrease text size" onClick={()=>onFontSize(Math.max(16,fontSize-1))}>A−</button><button className={styles.smallButton} type="button" aria-label="Increase text size" onClick={()=>onFontSize(Math.min(26,fontSize+1))}>A+</button></span></div>
            <button className={styles.primaryAction} type="button" onClick={()=>closeThen(onFocus)}><span><strong>Focus reading</strong><small>Hide distractions and keep the chapter central</small></span><span>›</span></button>
          </div>
        </>:null}
        {mode==='learn'?<LearningTransformPanel chapterId={chapterId} chapterTitle={chapterTitle}/>:null}
        {mode==='listen'?<div className={styles.listenControls}>
          {narrator.status==='unavailable'?<div className={`${styles.notice} ${styles.error}`}>Audio reading is not available in this browser. You can keep reading normally.</div>:null}
          {narrator.status==='error'?<div className={`${styles.notice} ${styles.error}`}>The voice stopped unexpectedly. Try Play again or choose another voice.</div>:null}
          <div className={styles.transport} aria-label="Narration controls">
            <button type="button" aria-label="Previous section" onClick={narrator.previous} disabled={narrator.status==='unavailable'}>↶</button>
            <button type="button" onClick={playLabel==='Pause'?narrator.pause:playLabel==='Resume'?narrator.resume:narrator.start} disabled={narrator.status==='unavailable'}>{playLabel}</button>
            <button type="button" aria-label="Stop narration" onClick={narrator.stop} disabled={narrator.status==='idle'||narrator.status==='unavailable'}>■</button>
            <button type="button" aria-label="Next section" onClick={narrator.next} disabled={narrator.status==='unavailable'}>↷</button>
            <button type="button" aria-label="Restart narration" onClick={narrator.start} disabled={narrator.status==='unavailable'}>↺</button>
          </div>
          <div className={styles.progress}>{narrator.segmentCount?`Section ${Math.min(narrator.activeSegment+1,narrator.segmentCount)} of ${narrator.segmentCount}`:'Press Play to start from the beginning of this unit.'}</div>
          <div className={styles.field}><label htmlFor="reader-speed">Reading speed</label><select id="reader-speed" value={String(narrator.rate)} onChange={event=>narrator.setRate(Number(event.target.value))}><option value="0.75">0.75×</option><option value="0.9">0.9×</option><option value="0.95">0.95×</option><option value="1">1×</option><option value="1.15">1.15×</option><option value="1.3">1.3×</option><option value="1.5">1.5×</option></select></div>
          <div className={styles.field}><label htmlFor="reader-voice">Voice</label><select id="reader-voice" value={narrator.voiceName??''} onChange={event=>narrator.setVoiceName(event.target.value||null)}><option value="">Best available voice</option>{narrator.voices.filter(v=>v.lang.toLowerCase().startsWith('en')).map(v=><option key={`${v.name}-${v.lang}`} value={v.name}>{v.name} · {v.lang}</option>)}</select></div>
          <div className={styles.notice}>VibeLearn prefers a high-quality Kenyan English voice when your device provides one, then falls back safely to another English voice.</div>
        </div>:null}
      </div>
    </section>
  </div>
}

export function ReaderNarrationMiniPlayer({chapterTitle,narrator,onOpen}:{chapterTitle:string;narrator:ReaderNarratorController;onOpen:()=>void}){
  if(narrator.status!=='playing'&&narrator.status!=='paused')return null
  return <div className={styles.miniPlayer} role="region" aria-label="Narration player"><button type="button" aria-label="Open narration controls" onClick={onOpen}>☰</button><div className={styles.miniPlayerTitle}>{chapterTitle}</div><button type="button" aria-label={narrator.status==='playing'?'Pause narration':'Resume narration'} onClick={narrator.status==='playing'?narrator.pause:narrator.resume}>{narrator.status==='playing'?'Ⅱ':'▶'}</button><button type="button" aria-label="Stop narration" onClick={narrator.stop}>■</button></div>
}
