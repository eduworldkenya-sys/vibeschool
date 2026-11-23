'use client'
import {BookOpen, ClipboardCheck, Library, NotebookPen, PenTool, Presentation} from 'lucide-react'
import styles from './TeachingKit.module.css'

export type TeachingKitTool = 'plan' | 'slides' | 'resources' | 'book' | 'exercises' | 'board'
type Actions = Partial<Record<TeachingKitTool, () => void>>
const tools = [
  {id:'plan',label:'Plan',icon:NotebookPen},
  {id:'slides',label:'Slides',icon:Presentation},
  {id:'resources',label:'Resources',icon:Library},
  {id:'book',label:'Textbook',icon:BookOpen},
  {id:'exercises',label:'Exercises',icon:ClipboardCheck},
  {id:'board',label:'Whiteboard',icon:PenTool},
] as const

/** Delivery-neutral controls. The caller supplies existing authorized actions;
 * no plan text, answer key or teacher notes are ever projected to learners. */
export default function TeachingKit({actions,onInClass,onGoLive,compact=false}:{
  actions: Actions
  onInClass?: () => void
  onGoLive?: () => void
  compact?: boolean
}) {
  return <section className={styles.kit} aria-label="Teaching Kit" data-compact={compact}>
    <div className={styles.heading}><div><span className={styles.eyebrow}>LESSON MATERIALS</span><h2>Teaching Kit</h2></div></div>
    <div className={styles.tools}>{tools.map(({id,label,icon:Icon})=>
      <button key={id} type="button" className={styles.tool} onClick={actions[id]} disabled={!actions[id]}
        aria-label={label + (!actions[id]?' unavailable':'')}>
        <Icon size={21} aria-hidden="true"/><span>{label}</span>
      </button>
    )}</div>
    {(onInClass||onGoLive)&&<div className={styles.delivery} aria-label="Choose how to teach">
      {onInClass&&<button type="button" className={styles.primary} onClick={onInClass}>Teach in class</button>}
      {onGoLive&&<button type="button" className={styles.secondary} onClick={onGoLive}>Go Live</button>}
    </div>}
  </section>
}
