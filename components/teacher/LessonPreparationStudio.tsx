'use client'

import { useState } from 'react'
import { BookOpen, ClipboardCheck, Layers, Library, NotebookPen, Presentation, Users } from 'lucide-react'
import type { LessonPlanSections } from '@/lib/teaching/lessonPlanCodec'
import styles from './ApprovedWorkspace.module.css'

const phases = [
  ['introduction', 'Connect'], ['development', 'Explore & explain'],
  ['consolidation', 'Practice'], ['assessmentHook', 'Check'],
] as const
const tools = [
  ['objectives', 'Learning outcomes', BookOpen], ['resources', 'Resources', Library],
  ['differentiation', 'Differentiate', Users], ['homework', 'Practice & homework', ClipboardCheck],
] as const

export default function LessonPreparationStudio({ sections, topic, resourceCount, onTeach, onEdit }: {
  sections: LessonPlanSections; topic: string; resourceCount: number; onTeach: () => void; onEdit: () => void
}) {
  const [phase, setPhase] = useState<(typeof phases)[number][0]>('introduction')
  const [detail, setDetail] = useState<(typeof tools)[number][0] | null>(null)
  const active = phases.find(item => item[0] === phase)!
  const phaseContent = sections[phase].trim()
  const preview = phaseContent.length > 650 ? `${phaseContent.slice(0, 650).trimEnd()}…` : phaseContent
  return <section className={styles.workspace} aria-label="Lesson preparation">
    <div className={styles.heading}><div><p className={styles.eyebrow}>YOUR LESSON</p><h2>{topic || 'Lesson preparation'}</h2></div><button className={styles.secondary} onClick={onEdit}><NotebookPen size={16}/>Edit plan</button></div>
    <div className={styles.focusGrid}>
      <article className={styles.paper}>
        <div className={styles.heading}><h3>Lesson flow</h3><Layers size={18}/></div>
        <nav className={styles.phases} aria-label="Lesson plan phases">{phases.map(([key, label], index) => <button key={key} aria-pressed={phase === key} onClick={() => { setPhase(key); setDetail(null) }}><strong>{String(index + 1).padStart(2, '0')}</strong><span>{label}</span></button>)}</nav>
        <div className={styles.board} key={phase}><span className={styles.eyebrow}>{active[1]}</span>{phaseContent.length > 650 ? <details><summary>Read this phase</summary><div className={styles.content}>{phaseContent}</div></details> : <div className={styles.content}>{preview || 'This phase has not been prepared yet.'}</div>}{phaseContent.length > 650 && <p className={styles.phasePreview}>{preview}</p>}</div>
        <div className={styles.heading}><span className={styles.muted}>Saved lesson content</span><button className={styles.textAction} onClick={onTeach}><Presentation size={16}/>Open Teach Mode →</button></div>
      </article>
      <div className={styles.toolGrid}>{tools.map(([key, label, Icon], index) => <button key={key} className={`${styles.tile} ${index === 0 ? styles.wide : ''}`} aria-pressed={detail === key} onClick={() => setDetail(detail === key ? null : key)}><Icon size={22}/><h3>{label}</h3><span className={styles.muted}>{key === 'resources' ? `${resourceCount} attached ${resourceCount === 1 ? 'item' : 'items'}` : sections[key].trim() ? 'View saved content' : 'Needs preparation'}</span><span className={styles.arrow} aria-hidden="true">↗</span></button>)}</div>
    </div>
    {detail && <article className={styles.paper} aria-live="polite"><div className={styles.heading}><h3>{tools.find(item => item[0] === detail)?.[1]}</h3><button className={styles.textAction} onClick={() => setDetail(null)}>Close</button></div><div className={styles.content}>{sections[detail].trim() || 'No content saved here yet. Edit the plan to prepare this section.'}</div></article>}
  </section>
}
