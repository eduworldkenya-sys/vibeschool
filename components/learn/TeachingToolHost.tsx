'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { VisualRichText } from '@/components/learn/VisualLearningAsset'
import { selectTeachingTool, type TeachingToolSection } from '@/lib/learn/teachingToolRegistry'
import { getLearningToolSectionBinding } from '@/lib/learn/teachingToolContentBridge.mjs'
import styles from './UniversalLearnReader.module.css'

/** Progressive display only: the published explanation, not generated steps. */
function MathsWorking({ body }: { body: string }) {
  const working = useMemo(() => {
    const lead: string[] = []
    const steps: string[] = []
    for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
      const step = /^\s*\d+[.)]\s+(.+)$/.exec(raw)
      if (step) steps.push(step[1])
      else if (steps.length && raw.trim()) steps[steps.length - 1] += '\n' + raw
      else lead.push(raw)
    }
    return { lead: lead.join('\n').trim(), steps }
  }, [body])
  const [visible, setVisible] = useState(1)
  if (working.steps.length < 2) return <VisualRichText body={body} />
  return <div className={styles.mathWorking}>
    {working.lead && <VisualRichText body={working.lead} />}
    <ol className={styles.workingList}>
      {working.steps.slice(0, visible).map((step, i) =>
        <li key={i}><span className={styles.stepNumber} aria-hidden="true">{i + 1}</span><VisualRichText body={step} /></li>)}
    </ol>
    <div className={styles.workingActions}>
      {visible < working.steps.length
        ? <button type="button" onClick={() => setVisible(n => Math.min(n + 1, working.steps.length))}>
          Show next step <ArrowRight size={16} aria-hidden="true" />
        </button>
        : <span role="status">All {working.steps.length} steps are shown.</span>}
      <button type="button" onClick={() => setVisible(visible === 1 ? working.steps.length : 1)}>
        <RotateCcw size={15} aria-hidden="true" /> {visible === 1 ? 'Show all steps' : 'Start again'}
      </button>
    </div>
  </div>
}

/**
 * Tool host renders only the content supplied by the authorised reader.
 * The canonical VisualRichText resolver controls [visual:UUID] admission.
 * No exam engine, student completion state or new data fetching is introduced.
 */
export default function TeachingToolHost({
  subject, section, sourceBinding = null,
}: {
  subject: string
  section: TeachingToolSection
  /** Exact certified/published version and section, resolved upstream. */
  sourceBinding?: NonNullable<ReturnType<typeof getLearningToolSectionBinding>> | null
}) {
  const body = sourceBinding?.body ?? (typeof section.body === 'string' ? section.body : '')
  const tool = selectTeachingTool(subject, { ...section, body })
  return <div data-teaching-tool={tool.id} data-tool-source={tool.source}>
    {tool.id === 'math-worked-steps'
      ? <MathsWorking key={section.id} body={body} />
      : tool.id === 'language-reading'
      ? <div className={styles.readingPassage} aria-label="Reading passage"><VisualRichText body={body} /></div>
      : tool.id === 'science-observation'
      ? <div className={styles.scienceObservation} role="group" aria-label="Observation"><VisualRichText body={body} /></div>
      : <VisualRichText body={body} />}
  </div>
}
