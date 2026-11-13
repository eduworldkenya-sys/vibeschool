'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { VisualRichText } from '@/components/learn/VisualLearningAsset'
import styles from './UniversalLearnReader.module.css'
import TeachingToolShelf from '@/components/learn/tools/TeachingToolShelf'
import type { TeachingToolSpec } from '@/lib/learn/teachingToolCatalog'

/** Presentation-only contract. Canonical release/RLS checks stay with the caller. */
export type UniversalLearnSection = {
  id: string
  title: string
  hint?: string
  tone?: string
  body: string
  /** Optional per-section learner activities, supplied by a released lesson. */
  tools?: readonly TeachingToolSpec[]
}

type Props = {
  subject: string
  sections: readonly UniversalLearnSection[]
  title?: string
  goal?: string
  anchorPrefix?: string
  topic?: string
  tools?: readonly TeachingToolSpec[]
  showTeachingTools?: boolean
  renderBody?: (section: UniversalLearnSection, index: number) => ReactNode
  afterSection?: (section: UniversalLearnSection, index: number) => ReactNode
}

export function learnSubjectMode(subject: string): 'math' | 'language' | 'science' | 'creative' | 'general' {
  if (/math|mathematics/i.test(subject)) return 'math'
  if (/english|kiswahili|language|literature|french|arabic/i.test(subject)) return 'language'
  if (/science|agriculture|health|biology|chemistry|physics|environment/i.test(subject)) return 'science'
  if (/creative|art|music|performing|design/i.test(subject)) return 'creative'
  return 'general'
}

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
 * Shared Learn section renderer for every subject and grade.
 * Content arrives from the existing certified/released source, never from a
 * hardcoded lesson or a new data store. Unknown sections remain readable.
 */
export default function UniversalLearnReader({
  subject, sections, title, goal, anchorPrefix = 'learn',
  topic = '', tools, showTeachingTools = true,
  renderBody, afterSection,
}: Props) {
  const mode = learnSubjectMode(subject)
  const anchor = (section: UniversalLearnSection, index: number) =>
    `${anchorPrefix}-${index}-${section.id.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`
  const validSections = sections.filter(section => typeof section.body === 'string' && !!section.body.trim())
  const sectionTools = validSections.flatMap(section => section.tools ?? [])
  if (!validSections.length) return <p role="status">No released lesson sections are available.</p>

  return <div className={styles.reader} data-subject-mode={mode}>
    {(title || goal) && <header className={styles.heading}>
      {title && <h3>{title}</h3>}
      {goal && <p><strong>What you will learn:</strong> {goal}</p>}
    </header>}
    {validSections.length > 1 && <nav className={styles.navigation} aria-label="Lesson sections">
      {validSections.map((section, index) =>
        <a key={anchor(section, index)} href={`#${anchor(section, index)}`}>{section.title || 'Section ' + (index + 1)}</a>)}
    </nav>}
    <div className={styles.sections}>
      {validSections.map((section, index) => {
        const id = anchor(section, index)
        const tone = ['learn', 'example', 'explore', 'practice', 'feedback', 'support', 'challenge', 'reflect'].includes(section.tone ?? '')
          ? section.tone : 'learn'
        if (section.id === 'feedback') return <details id={id} key={id} className={styles.feedback}>
          <summary>Review all explanations</summary>
          <div className={styles.feedbackBody}>
            {renderBody?.(section, index) ?? <VisualRichText body={section.body} />}
          </div>
        </details>
        return <section id={id} key={id} data-tone={tone} className={styles.section} aria-labelledby={`${id}-heading`}>
          <header className={styles.sectionHeading}>
            <h4 id={`${id}-heading`}>{section.title || 'Read and learn'}</h4>
            {section.hint && <p>{section.hint}</p>}
          </header>
          <div className={styles.body}>
            {renderBody?.(section, index)
              ?? (mode === 'math' && section.id === 'example'
                ? <MathsWorking key={id} body={section.body} />
                : <VisualRichText body={section.body} />)}
          </div>
          {afterSection?.(section, index)}
        </section>
      })}
    </div>
    {showTeachingTools && <TeachingToolShelf
      subject={subject} topic={topic || title || ''}
      tools={tools ?? (sectionTools.length ? sectionTools : undefined)}
    />}
  </div>
}
