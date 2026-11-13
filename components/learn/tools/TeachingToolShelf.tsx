'use client'

import { useId, useState } from 'react'
import {
  TEACHING_TOOL_CATALOG,
  resolveTeachingTools,
  type TeachingToolId,
  type TeachingToolSpec,
} from '@/lib/learn/teachingToolCatalog'
import MathTeachingTool from './MathTeachingTools'
import LanguageScienceTeachingTool from './LanguageScienceTeachingTools'
import EarlyYearsPracticalTool from './EarlyYearsPracticalTools'
import styles from './TeachingTools.module.css'

/**
 * Read-only, optional interaction layer below a released lesson.
 * An existing authorised reader supplies the subject/topic and may attach
 * activities explicitly. The examples are not assessment attempts.
 */
export default function TeachingToolShelf({
  subject, topic = '', tools,
}: {
  subject: string
  topic?: string
  tools?: readonly TeachingToolSpec[]
}) {
  const headingId = useId()
  const available = resolveTeachingTools(subject, topic, tools)
  const [active, setActive] = useState<TeachingToolId | null>(null)
  if (!available.length) return null

  const current = available.find(tool => tool.id === active) ?? available[0]
  const metadata = TEACHING_TOOL_CATALOG.find(tool => tool.id === current.id)!
  return <aside className={styles.shelf} aria-labelledby={headingId}>
    <div className={styles.heading}>
      <div>
        <h4 id={headingId}>Explore with a learning tool</h4>
        <p>Try an example and change the values. This practice is not graded or saved.</p>
      </div>
    </div>
    <div role="group" aria-label="Choose a learning tool" className={styles.menu}>
      {available.map(spec => {
        const tool = TEACHING_TOOL_CATALOG.find(item => item.id === spec.id)!
        return <button type="button" key={spec.id} aria-pressed={current.id === spec.id} onClick={() => setActive(spec.id)}>{tool.title}</button>
      })}
    </div>
    <div className={styles.tool} aria-live="off">
      <h5>{metadata.title}</h5>
      <p className={styles.description}>{current.prompt || metadata.description}</p>
      {metadata.subject === 'math'
        ? <MathTeachingTool key={current.id} spec={current} />
        : current.id === 'sorting-groups'
        ? <LanguageScienceTeachingTool key={current.id} spec={current} />
        : metadata.subject === 'interactive'
        ? <EarlyYearsPracticalTool key={current.id} spec={current} />
        : <LanguageScienceTeachingTool key={current.id} spec={current} />}
    </div>
  </aside>
}
